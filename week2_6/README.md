# Task, Auth & Triage API

A Node.js + [Express](https://expressjs.com) REST API built in three stages:

1. **Task CRUD** on a local [SQLite](https://sqlite.org) database
2. **Authentication** with [Supabase Auth](https://supabase.com/docs/guides/auth) and JWT-protected routes
3. **`POST /triage`**, an LLM endpoint that classifies support messages into strict, validated JSON

Interactive docs are served at **`/docs`** (Swagger UI).

---

## Quick start

```bash
git clone https://github.com/Ahmadkhaan08/Flyrank_Tasks.git
cd Flyrank_Tasks/week2_6
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm run hello             # checks the LLM provider → "Answer: ready"
npm start
```

```
Server running on http://localhost:3000
Docs available at http://localhost:3000/docs
Triage mode: live
```

**Requirements:** Node.js 18+, a Supabase project (free tier), and an [OpenRouter](https://openrouter.ai) key or a local [Ollama](https://ollama.com).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase Project URL |
| `SUPABASE_KEY` | Yes | Supabase **anon** key (never the service role key) |
| `PORT` | No | Defaults to `3000` |
| `LLM_BASE_URL` | Live mode | `https://openrouter.ai/api/v1` or `http://localhost:11434/v1` |
| `LLM_API_KEY` | Live mode | Provider API key |
| `LLM_MODEL` | Live mode | e.g. `openrouter/free` or `gemma3:1b` |
| `LLM_STUB` | No | `1` = return a fixed test answer, no model call |
| `LLM_ENABLED` | No | `false` = kill switch, `/triage` returns `503` |

The server refuses to start if a required value is missing. Restart after changing `.env`.

---

## 1. Task CRUD (SQLite)

`tasks.db` is created on first start and seeded with three sample tasks. All queries use prepared statements with `?` placeholders, which prevents SQL injection.

| Method | Endpoint | Body | Status codes |
| --- | --- | --- | --- |
| `GET` | `/tasks` | — | `200` |
| `GET` | `/tasks/:id` | — | `200`, `404` |
| `POST` | `/tasks` | `{ "title": "Buy milk" }` | `201`, `400` |
| `PUT` | `/tasks/:id` | `{ "title": "...", "done": true }` (either or both) | `200`, `400`, `404` |
| `DELETE` | `/tasks/:id` | — | `204`, `404` |

```bash
curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Buy milk"}'
```

```json
{ "id": 4, "title": "Buy milk", "done": false }
```

---

## 2. Authentication (Supabase)

Supabase handles password hashing and issues JWTs; this code never stores or sees a password hash. A reusable `requireAuth` middleware verifies each token with Supabase before a protected route runs.

| Method | Endpoint | Auth | Status codes |
| --- | --- | --- | --- |
| `POST` | `/auth/signup` | — | `201`, `400` |
| `POST` | `/auth/login` | — | `200`, `400`, `401` |
| `GET` | `/protected/profile` | Bearer | `200`, `401` |
| `GET` | `/protected/dashboard` | Bearer | `200`, `401` |
| `POST` | `/auth/logout` | Bearer | `204`, `401` |
| `GET` | `/`, `/health`, `/public/info` | — | `200` |

```bash
# Log in and copy access_token from the response
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"secret123"}'

# Use it on a protected route
curl http://localhost:3000/protected/profile -H "Authorization: Bearer <access_token>"
```

| `401` response | Meaning |
| --- | --- |
| `Access token required` | Header missing or not `Bearer <token>` |
| `Invalid or expired token` | Supabase rejected the token |

In Swagger UI, click **Authorize** and paste only the token (without `Bearer `).

---

## 3. Support Triage (LLM)

### Summary

`POST /triage` takes one support message and returns a closed JSON answer, `category`, `priority` and `confidence`, by calling an OpenAI-compatible model with the versioned prompt [`prompts/triage-v1.md`](prompts/triage-v1.md). Every reply is validated with Zod before it reaches the caller. An invalid reply gets one repair retry, and if that also fails it is quarantined to `logs/quarantine.jsonl` and the caller receives `422`.

### Runnable verification

```bash
curl -s -X POST http://localhost:3000/triage -H "Content-Type: application/json" -d '{"text":"I was charged twice for my subscription this month. Please refund one payment."}'
```

Actual response (`200 OK`):

```json
{
  "category": "billing",
  "priority": "high",
  "confidence": 0.95
}
```

### Job specification

Full version: [`JOB-CARD.md`](JOB-CARD.md).

**Input:** `{ "text": "string, 1-2000 characters" }`. Anything else returns `400`.

**Output:** exactly these keys, nothing more:

| Key | Type | Allowed values |
| --- | --- | --- |
| `category` | string | `billing`, `technical`, `account`, `feedback`, `other` |
| `priority` | string | `low`, `medium`, `high` |
| `confidence` | number | `0.0` – `1.0` |

**It must never:** invent a category or priority, add free text or extra keys, wrap JSON in code fences, return more than one category, or follow instructions written inside the user's text.

**When unsure:** `{ "category": "other", "priority": "low", "confidence": 0 }`

### Safeguards

| Safeguard | Behaviour |
| --- | --- |
| Prompt injection | User text is sent as a JSON-encoded **user** message, never inside the system prompt |
| Validation | Code fences and filler are stripped, then the reply is parsed and checked against the Zod schema. Raw model text is never returned. |
| Repair | One retry with the broken answer and the exact error, then quarantine + `422` |
| Timeout | 30 s per call. If it still times out after retries, the caller gets `504` |
| Retries | Up to 2, with exponential backoff and jitter, only for timeouts, `429` and `5xx`. Never for `400`/`401`/`403`. |
| Kill switch | `LLM_ENABLED=false` returns `503` with no model call |
| Stub mode | `LLM_STUB=1` returns a fixed valid answer for offline work |

**Status codes:** `200` ok · `400` bad input · `422` invalid model output · `502` provider error · `503` disabled · `504` timeout

### Evaluation results

**7/8 cases matched (87.5%) on prompt version `triage-v1.md`** (`openrouter/free`, 2026-10-16).

[`evals/cases.json`](evals/cases.json) holds 8 hand-labeled cases: 6 clear, 1 ambiguous and 1 "when unsure". Run it with `npm run eval` while the server is running. The single miss was a priority judgement: the model returned `high` for *"The app crashes… but everything else works"*, which the label marks as `medium`.

### Cost analysis

Each model call logs one JSON line to stdout. A real entry:

```json
{"type":"llm_call","timestamp":"2026-10-16T11:48:32.047Z","prompt_version":"triage-v1","model":"openrouter/free","prompt_tokens":714,"completion_tokens":168,"total_tokens":882,"duration_ms":2168,"repair_triggered":false,"attempts":1,"status":"ok"}
```

**Projection:** 10,000 calls/day × ~880 tokens ≈ 8.8M tokens/day. That is **$0 on `openrouter/free`**, or about **$2.08/day** at example paid rates of $0.15 per 1M input and $0.60 per 1M output tokens.

---

## Security & repository checks

- API keys are read only from environment variables. `.env` is git-ignored, and `.env.example` (placeholders only) is committed.
- `.env`, `logs/`, `cache/`, `node_modules/` and `tasks.db` are git-ignored. Verified with `git check-ignore -v`.
- The repo has one commit per triage stage, from `Stage 0: job card, provider working, key in .env` through `Stage 6: README and final repository checks`.

## Project structure

```
week2_6/
├── server.js              # Express app: tasks, auth, triage
├── src/llm/
│   ├── hello.js           # npm run hello: provider check
│   ├── schema.js          # Zod input/output schemas
│   └── validate.js        # parse, validate, quarantine
├── prompts/triage-v1.md   # versioned system prompt
├── evals/                 # cases.json + run-eval.js (npm run eval)
├── JOB-CARD.md            # triage job specification
└── .env.example           # configuration template
```

## Production limitations

With more time, I would pin a specific model instead of `openrouter/free`, whose router sometimes picks a model that ignores the prompt, and add automated tests (Jest + Supertest) plus a larger labeled eval set running in CI. The task routes are also still public, and `/triage` has no rate limiting.

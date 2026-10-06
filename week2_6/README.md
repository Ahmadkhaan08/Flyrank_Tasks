# Auth API — Express + Supabase Auth

A REST API with **user authentication** built on [Node.js](https://nodejs.org), [Express](https://expressjs.com) and [Supabase Auth](https://supabase.com/docs/guides/auth), plus a small task list to practise CRUD against a local [SQLite](https://sqlite.org) database.

Users can register and log in. Supabase issues a **JWT access token**, and protected endpoints only answer requests that carry a valid one. Passwords are never hashed, stored or seen by this code — every credential is forwarded straight to Supabase, which is the whole point of using an auth provider.

Interactive documentation is served at `/docs`, with an **Authorize** button for pasting a token and trying the protected routes in the browser.

---

## Table of contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Examples with curl](#examples-with-curl)
- [Swagger UI](#swagger-ui)
- [Security](#security)
- [Project structure](#project-structure)
- [How the code is organised](#how-the-code-is-organised)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

---

## What it does

| Area | Detail |
| --- | --- |
| **Registration & login** | `POST /auth/signup` and `POST /auth/login`, handled entirely by Supabase Auth |
| **Token verification** | A reusable `requireAuth` middleware verifies every token with Supabase |
| **Protected routes** | `/protected/profile`, `/protected/dashboard` and `/auth/logout` require a Bearer token |
| **Public routes** | `/`, `/health` and `/public/info` need no token |
| **Task CRUD** | Seven endpoints over a local SQLite file, kept from an earlier stage of the project |
| **Documentation** | Swagger UI at `/docs`, with padlocks on the protected routes |

---

## Tech stack

| Package | Role |
| --- | --- |
| [`express`](https://expressjs.com) | Web framework — routing and HTTP handling |
| [`@supabase/supabase-js`](https://www.npmjs.com/package/@supabase/supabase-js) | Supabase client — sign up, log in, verify tokens |
| [`dotenv`](https://www.npmjs.com/package/dotenv) | Loads credentials from `.env` into `process.env` |
| [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) | Local database for the task list (synchronous, no callbacks) |
| [`swagger-ui-express`](https://www.npmjs.com/package/swagger-ui-express) | Serves the interactive docs at `/docs` |

---

## Prerequisites

| Requirement | Notes | How to check |
| --- | --- | --- |
| Node.js 18+ | Developed on v24 | `node -v` |
| npm | Ships with Node.js | `npm -v` |
| A Supabase project | Free tier is fine — [supabase.com](https://supabase.com) | — |

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Ahmadkhaan08/Flyrank_Tasks.git
cd Flyrank_Tasks/week2_6
```

### 2. Create your `.env` file

Copy the template that ships with the repo:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Now open `.env` and replace the placeholders with your own values:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_anon_key
PORT=3000
```

Both values come from your Supabase dashboard under **Project Settings → API**:

- `SUPABASE_URL` is the **Project URL**.
- `SUPABASE_KEY` is the **anon / public** key.

> **Use the anon key, not the service role key.** The dashboard shows both. The anon key is designed to be used with Row Level Security. The service role key bypasses those rules completely and must never be committed or sent to a browser.

The server refuses to start if either value is missing, rather than failing later with a confusing error.

### 3. Install dependencies

```bash
npm install
```

### 4. Run the server

```bash
npm start
```

That is the single command needed to run the project. The first start also creates `tasks.db` and seeds it with three sample tasks:

```
Seeded 3 default tasks
Server running and connected to Supabase
Server running on http://localhost:3000
Docs available at http://localhost:3000/docs
```

The `Seeded` line appears only once — later starts find rows already there and skip it.

Open <http://localhost:3000/docs> to explore the API, and press `Ctrl + C` to stop the server.

---

## Configuration

Every setting lives in `.env`. Nothing secret belongs in `server.js`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL, e.g. `https://xxxxx.supabase.co` |
| `SUPABASE_KEY` | Yes | Supabase **anon** key |
| `PORT` | No | Port to listen on. Defaults to `3000`. |

`.env.example` is committed and holds placeholders only; `.env` holds the real values and is never committed. See [Security](#security).

---

## API reference

Base URL: `http://localhost:3000`

**Authentication** column: `None` means the endpoint is open. `Bearer Token` means the request must carry a header shaped `Authorization: Bearer <access_token>`.

| Method | Endpoint | Authentication | Status codes |
| --- | --- | --- | --- |
| `GET` | `/` | None | `200` |
| `GET` | `/health` | None | `200` |
| `GET` | `/public/info` | None | `200` |
| `POST` | `/auth/signup` | None | `201`, `400` |
| `POST` | `/auth/login` | None | `200`, `400`, `401` |
| `POST` | `/auth/logout` | **Bearer Token** | `204`, `401` |
| `GET` | `/protected/profile` | **Bearer Token** | `200`, `401` |
| `GET` | `/protected/dashboard` | **Bearer Token** | `200`, `401` |
| `GET` | `/tasks` | None | `200` |
| `GET` | `/tasks/:id` | None | `200`, `404` |
| `POST` | `/tasks` | None | `201`, `400` |
| `PUT` | `/tasks/:id` | None | `200`, `400`, `404` |
| `DELETE` | `/tasks/:id` | None | `204`, `404` |

### What each status code means here

| Code | Meaning |
| --- | --- |
| `200 OK` | Request succeeded and a body is returned |
| `201 Created` | A user or task was created |
| `204 No Content` | Succeeded with nothing to return (logout, task delete) |
| `400 Bad Request` | Missing or malformed input, or Supabase rejected the signup |
| `401 Unauthorized` | No usable token, an invalid token, or wrong login credentials |
| `404 Not Found` | No task exists with that id |

### The two different 401 messages

Telling them apart saves a lot of debugging time:

| Response | Meaning |
| --- | --- |
| `{"error": "Access token required"}` | The `Authorization` header was missing or the wrong shape. Supabase was never contacted. |
| `{"error": "Invalid or expired token"}` | The header was fine, but Supabase rejected the token — tampered, expired or made up. |

### Request bodies

**`POST /auth/signup`** and **`POST /auth/login`**

```json
{ "email": "test@example.com", "password": "secret123" }
```

Both fields are required and must be non-empty strings.

**`POST /tasks`**

```json
{ "title": "Buy milk" }
```

**`PUT /tasks/:id`** — send `title`, `done`, or both. Omitted fields keep their current value.

```json
{ "title": "Buy oat milk", "done": true }
```

---

## Examples with curl

All examples use Git Bash. In **PowerShell**, use `curl.exe` instead of `curl`. In **cmd.exe**, use double quotes only — single quotes are not string quotes there, and the header name arrives mangled.

### 1. Sign up

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'
```

**`201 Created`** — the created user object (shortened here):

```json
{
  "id": "0c8f1a2b-3d4e-5f60-7a8b-9c0d1e2f3a4b",
  "email": "test@example.com",
  "created_at": "2026-10-06T10:15:30.123Z",
  "email_confirmed_at": null,
  "role": "authenticated"
}
```

Missing or empty fields give **`400`**:

```json
{ "error": "Email and password are required" }
```

A password Supabase considers too weak, or another signup problem, also gives **`400`** with Supabase's own wording:

```json
{ "error": "Password should be at least 6 characters" }
```

### 2. Log in

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'
```

**`200 OK`** — two tokens (shortened):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50...",
  "refresh_token": "v1.Mr7xK2pQ..."
}
```

Copy the `access_token` — that is the Bearer token. It is valid for one hour by default.

Wrong credentials give **`401`**:

```json
{ "error": "Invalid login credentials" }
```

The exact reason is printed in the server terminal (`Login failed: ...`) but deliberately kept out of the response, so a stranger cannot learn which emails have accounts.

### 3. Call a protected endpoint with a Bearer token

```bash
curl -X GET http://localhost:3000/protected/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50..."
```

**`200 OK`**:

```json
{
  "id": "0c8f1a2b-3d4e-5f60-7a8b-9c0d1e2f3a4b",
  "email": "test@example.com",
  "created_at": "2026-10-06T10:15:30.123Z"
}
```

Same token on the dashboard:

```bash
curl -X GET http://localhost:3000/protected/dashboard \
  -H "Authorization: Bearer <access_token>"
```

**`200 OK`**:

```json
{ "message": "Welcome to dashboard", "user_id": "0c8f1a2b-3d4e-5f60-7a8b-9c0d1e2f3a4b" }
```

And logging out:

```bash
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <access_token>"
```

**`204 No Content`** with an empty body.

> The header must read exactly `Authorization: Bearer <token>` — capital `B`, one space, no colon after `Bearer`. Sending the token on its own is the most common mistake and returns `401`.

### 4. Call a protected endpoint with a bad token

Tampering with any character — here the signature at the end — breaks verification:

```bash
curl -X GET http://localhost:3000/protected/profile \
  -H "Authorization: Bearer tampered.token.here"
```

**`401 Unauthorized`**:

```json
{ "error": "Invalid or expired token" }
```

The same `401` comes back for an expired token, a made-up string, or a token whose payload was edited. Supabase checks the signature, so claims inside a token cannot be rewritten.

With **no** header at all, the message is the other one:

```bash
curl -X GET http://localhost:3000/protected/profile
```

```json
{ "error": "Access token required" }
```

---

## Swagger UI

Interactive documentation is served at **<http://localhost:3000/docs>**.

Protected routes show a **padlock icon**, and the **Authorize** button at the top right accepts a JWT.

![Swagger UI showing the Authorize padlock](docs/screenshots/swagger-authorize.png)

> **Screenshot placeholder** — save a capture of `/docs` showing the Authorize button and the padlocked routes as `docs/screenshots/swagger-authorize.png`, and this image will render.

### How to authorize and run a request

1. Open <http://localhost:3000/docs>. If the padlocks are missing, hard-refresh with `Ctrl + Shift + R` — browsers cache the API spec.
2. Expand **POST /auth/login** → **Try it out** → enter your email and password → **Execute**. Copy the `access_token` from the response.
3. Click **Authorize** (top right), paste the token into the `Value` field, click **Authorize**, then **Close**.
4. Expand **GET /protected/profile** → **Try it out** → **Execute**. You should see `200` with your `id`, `email` and `created_at`.
5. The same token now works on `/protected/dashboard` and `/auth/logout` — one Authorize covers every padlocked route.

> **Paste only the token, with no `Bearer ` prefix.** Swagger UI adds that itself, because the spec declares `scheme: "bearer"`. Pasting `Bearer eyJ...` sends `Bearer Bearer eyJ...` and returns `401`.

The token survives a page refresh, thanks to `persistAuthorization` in the Swagger setup. Click **Authorize → Logout** to clear it.

---

## Security

**No secrets are tracked in git.** Verified with `git ls-files`, which lists only:

```
.gitignore
week2_6/.env.example
week2_6/README.md
week2_6/package-lock.json
week2_6/package.json
week2_6/server.js
```

**`.env` is ignored by git.** The repository root `.gitignore` contains:

```gitignore
*node_modules
*.db
*.env
```

Confirmed directly with git:

```bash
$ git check-ignore -v week2_6/.env
.gitignore:3:*.env      week2_6/.env
```

### How credentials are handled

| Practice | Where |
| --- | --- |
| Credentials read from the environment, never hard-coded | `server.js` reads `process.env.SUPABASE_URL` and `process.env.SUPABASE_KEY` |
| `.env` ignored by git; `.env.example` committed with placeholders only | Root `.gitignore` + `.env.example` |
| Anon key used, not the service role key | Documented in [Setup](#setup) |
| Passwords never hashed or stored by this code | Both auth routes forward straight to Supabase |
| Tokens verified by Supabase, not by hand-written crypto | `supabase.auth.getUser(token)` in `requireAuth` |
| Only safe fields returned from protected routes | `/protected/profile` returns `id`, `email`, `created_at` — not the full user object |
| Login failures stay vague to the client | Response is `Invalid login credentials`; the real reason goes to the server log only |
| Tokens never written to logs in full | Diagnostics log at most the first 15 characters of the header |

> **If a key is ever committed, rotate it.** Deleting it in a later commit is not enough, because the old value stays in the git history. Regenerate the key in the Supabase dashboard.

---

## Project structure

```
week2_6/
├── server.js          # The whole application
├── .env               # YOUR credentials — created by you, never committed
├── .env.example       # Committed template with placeholders
├── tasks.db           # SQLite database — created on first start, not committed
├── package.json       # Metadata, scripts and dependencies
├── package-lock.json  # Exact dependency versions (commit this; do not edit)
├── README.md          # This file
└── node_modules/      # Installed packages, not committed
```

---

## How the code is organised

Everything lives in `server.js`, in order:

1. **Configuration** — `dotenv` runs first, because it is what fills `process.env`. Credentials are read, checked, and used to create the Supabase client.
2. **Database setup** — opens `tasks.db`, creates the `tasks` table if absent, and seeds three rows only when the table is empty, so restarting never duplicates them.
3. **Prepared statements** — each SQL query is prepared once at startup. All user input is passed through `?` placeholders, never string concatenation, which is what prevents SQL injection.
4. **Helpers** — `toTask` converts a database row (SQLite stores `done` as `0`/`1`) into JSON with a real boolean, and `isNonEmptyString` backs every "missing or empty" check.
5. **`requireAuth` middleware** — the single auth guard. It checks the header shape, calls `supabase.auth.getUser(token)`, attaches `req.user`, and calls `next()`. If it answers `401`, the route handler never runs, so every guarded handler can rely on `req.user` existing.
6. **Swagger document** — an inline OpenAPI 3.0 object, including the `bearerAuth` security scheme that produces the Authorize button.
7. **Routes** — public, then auth, then protected, then tasks.

Adding `requireAuth` to any new route is all that is needed to protect it:

```js
app.get("/protected/something", requireAuth, (req, res) => {
  res.status(200).json({ hello: req.user.email });
});
```

---

## Troubleshooting

**`Missing SUPABASE_URL or SUPABASE_KEY.`**
The server stopped on purpose. Either `.env` does not exist yet (`cp .env.example .env`) or it still holds the placeholder text.

**Login returns `401` right after a successful signup**
Supabase projects have **Confirm email** enabled by default, so a new account cannot log in until the emailed link is clicked. Either click it, or turn the setting off while developing under **Authentication → Providers → Email**. Check the server terminal: it prints `Login failed: Email not confirmed`.

**A protected route returns `401` even though a token was sent**
Check the server terminal. `(no Authorization header at all)` means the header never arrived — a browser address bar cannot send one, and in `cmd.exe` single quotes mangle the header name. Anything else is printed so the wrong shape is visible.

**Swagger UI has no padlocks or Authorize button**
Hard-refresh with `Ctrl + Shift + R`. The browser caches the old API spec.

**`Error: listen EADDRINUSE: address already in use :::3000`**
Another copy of the server is still running. Stop it, or set a different `PORT` in `.env`.

**`Cannot find module 'express'`**
`npm install` has not been run yet.

**Tasks disappeared**
If `tasks.db` is deleted, the next start creates a fresh one and re-seeds the three samples.

---

## Known limitations

Honest notes on what this project does *not* do yet.

- **Logout does not invalidate the access token.** `supabase.auth.signOut()` acts on the session stored in this server's shared Supabase client, which belongs to whoever logged in most recently rather than the caller. Even when targeted correctly, signing out revokes the *refresh* token while the access token stays valid until it expires. Revoking a specific session needs `supabase.auth.admin.signOut(token)` and the service role key, or a per-request client.
- **The task endpoints are not protected.** All seven are public and the table has no owner column, so tasks are shared by everyone. Adding `requireAuth` plus a `user_id` column is the natural next step.
- **`GET /` lists only `/tasks`** in its `endpoints` array. It predates the auth routes and was specified that way.
- **Every protected request costs a round trip.** `getUser()` asks Supabase about the token on each call. That is the safe default — a revoked session is caught immediately — but production APIs often verify the signature locally instead.
- **No automated tests.** `npm test` is still the placeholder. [Jest](https://jestjs.io) with [Supertest](https://www.npmjs.com/package/supertest) would fit well here.

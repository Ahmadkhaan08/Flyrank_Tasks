# Task API (Todo App)

A small REST API for managing a todo list, built with [Node.js](https://nodejs.org) and [Express](https://expressjs.com).

You can create tasks, read them, update them, and delete them — the four basic operations usually called **CRUD** (Create, Read, Update, Delete). The API also ships with interactive documentation you can click through in your browser.

Tasks are saved in a **SQLite** database file called `tasks.db`, which sits right next to `server.js`. Your data survives restarts, and there is no database server to install or configure — SQLite is just a file.

---

## Table of contents

- [What you need](#what-you-need)
- [Getting started](#getting-started)
- [Try it out](#try-it-out)
- [API reference](#api-reference)
- [The task object](#the-task-object)
- [Errors](#errors)
- [Project structure](#project-structure)
- [How the code works](#how-the-code-works)
- [Troubleshooting](#troubleshooting)
- [Ideas for next steps](#ideas-for-next-steps)

---

## What you need

| Tool | Version | How to check |
| --- | --- | --- |
| Node.js | 18 or newer (developed on 24) | `node -v` |
| npm | Comes with Node.js | `npm -v` |

If either command says "not recognized", install Node.js from [nodejs.org](https://nodejs.org) and reopen your terminal.

---

## Getting started

**1. Open a terminal in this folder** (`week2_6`).

**2. Install the dependencies.** This downloads Express, the SQLite driver, and the docs viewer into a `node_modules` folder:

```bash
npm install
```

**3. Start the server:**

```bash
npm start
```

The first time, you should see:

```
Seeded 3 default tasks
Server running on http://localhost:3000
Docs available at http://localhost:3000/docs
```

That first line appears only once. On every later start the database already has rows, so the server skips seeding and your own tasks are still there.

**4. Open <http://localhost:3000/docs> in your browser.**

This is the **Swagger UI** — a page that lists every endpoint with a "Try it out" button, so you can send real requests without writing any code. It's the easiest way to explore the API.

**5. To stop the server,** press `Ctrl + C` in the terminal.

---

## Try it out

If you prefer the command line, here are the same requests using [`curl`](https://curl.se) (already installed on most systems).

Get every task:

```bash
curl http://localhost:3000/tasks
```

Get a single task by its id:

```bash
curl http://localhost:3000/tasks/1
```

Create a new task:

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Water the plants"}'
```

Mark task 1 as done:

```bash
curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'
```

Delete task 1:

```bash
curl -X DELETE http://localhost:3000/tasks/1
```

> **Tip:** The `-H "Content-Type: application/json"` header tells the server "the data I'm sending is JSON". Without it, the server can't read your request body and you'll get a `400` error.
>
> **Windows users:** In PowerShell, `curl` is an alias for a different command. Use `curl.exe` instead of `curl` — or just use the `/docs` page, which is easier.

---

## API reference

Base URL: `http://localhost:3000`

| Method | Path | What it does | Success | Possible errors |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Returns the API name, version, and available endpoints | `200` | — |
| `GET` | `/health` | Health check — confirms the server is alive | `200` | — |
| `GET` | `/tasks` | Returns all tasks as an array | `200` | — |
| `GET` | `/tasks/:id` | Returns one task | `200` | `404` |
| `POST` | `/tasks` | Creates a task | `201` | `400` |
| `PUT` | `/tasks/:id` | Updates a task's `title`, `done`, or both | `200` | `400`, `404` |
| `DELETE` | `/tasks/:id` | Deletes a task | `204` (empty body) | `404` |

### `POST /tasks`

Request body:

```json
{ "title": "Water the plants" }
```

`title` is required and must be a non-empty string. The server assigns the `id` and sets `done` to `false` for you — don't send those.

Response (`201 Created`):

```json
{ "id": 4, "title": "Water the plants", "done": false }
```

### `PUT /tasks/:id`

Send `title`, `done`, or both. Fields you leave out keep their current value.

```json
{ "title": "Water the plants twice", "done": true }
```

Response (`200 OK`) is the full updated task:

```json
{ "id": 4, "title": "Water the plants twice", "done": true }
```

An empty body `{}` is rejected with `400` — there would be nothing to update.

---

## The task object

Every task looks like this:

```json
{
  "id": 1,
  "title": "Buy milk",
  "done": false
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Unique, assigned by SQLite (`AUTOINCREMENT`). Never reused, even after a delete. |
| `title` | string | What needs doing. Cannot be empty or whitespace only. |
| `done` | boolean | `true` if the task is finished. New tasks start at `false`. |

The first time you start the server it inserts three sample tasks (ids `1`, `2`, and `3`) so there's something to look at right away.

### How it's stored

Inside the database, the table looks like this:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
)
```

SQLite has no boolean type, so `done` is an integer: `0` for false, `1` for true. The server converts it back to a real `true`/`false` before sending JSON, so this detail never leaks out to anyone using the API.

---

## Errors

Errors come back as JSON with an `error` message, plus an HTTP status code that tells you the category of problem.

| Status | Meaning | Example response |
| --- | --- | --- |
| `400 Bad Request` | Your data was missing or the wrong type | `{ "error": "Title is required" }` |
| `404 Not Found` | No task exists with that id | `{ "error": "Task not found" }` |

A `400` means *fix your request*; a `404` means *that thing isn't here*.

---

## Project structure

```
week2_6/
├── server.js          # The whole application
├── tasks.db           # SQLite database (created on first start, not committed)
├── package.json       # Project metadata, scripts, and dependencies
├── package-lock.json  # Exact dependency versions (commit this; don't edit it)
└── node_modules/      # Installed packages (created by npm install, not committed)
```

### Dependencies

| Package | Why it's here |
| --- | --- |
| [`express`](https://expressjs.com) | The web framework. Handles routing and HTTP requests. |
| [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) | Talks to the SQLite file. Its methods are synchronous, so there are no callbacks or promises to manage. |
| [`swagger-ui-express`](https://www.npmjs.com/package/swagger-ui-express) | Serves the interactive docs page at `/docs`. |

### Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Runs `node server.js` |
| `npm test` | Placeholder — no tests yet |

---

## How the code works

Everything lives in `server.js`, in five sections:

**1. Database setup.** Opens `tasks.db` (creating the file if it's missing), runs `CREATE TABLE IF NOT EXISTS`, then counts the rows. Only when the count is `0` does it insert the three sample tasks — that check is what stops a restart from duplicating them.

**2. Prepared statements.** Each SQL query is prepared once at startup and stored in a variable like `selectAllTasks`. Preparing up front is faster, and it keeps the route handlers down to one readable line of database work each.

**3. Helpers.** Two small functions:

- `toTask(row)` — converts a database row into the shape the API returns. SQLite has no boolean type, so `done` is stored as `0` or `1` and translated to `false`/`true` here.
- `isValidTitle(title)` — checks the title is a string with actual characters in it

**4. Swagger document.** A large object describing every endpoint. `swagger-ui-express` turns it into the `/docs` page.

**5. Routes.** One `app.METHOD(path, handler)` call per endpoint. Each handler follows the same shape: validate the input, run a query, send a response with the right status code.

### Two details worth understanding

**`app.use(express.json())`** near the top matters more than it looks — it's what lets Express read JSON request bodies. Without it, `req.body` would be undefined on every POST and PUT.

**The `?` in every query** is a placeholder, and the values go in as separate arguments:

```js
selectTaskById.get(req.params.id);   // safe
```

This is called a *parameterized query*. SQLite treats whatever arrives as plain data, never as SQL to run. Building the same query by gluing strings together would be a [SQL injection](https://owasp.org/www-community/attacks/SQL_Injection) hole — a visitor could put SQL in the URL and the database would obey it. Always use `?`.

---

## Troubleshooting

**`Error: listen EADDRINUSE: address already in use :::3000`**
Something else is already using port 3000 — probably another copy of this server you forgot to stop. Close it, or change the port number at the bottom of `server.js`.

**`Cannot find module 'express'`**
You skipped `npm install`. Run it and try again.

**My tasks disappeared!**
Check that `tasks.db` is still in the folder. If you delete it, the server creates a fresh one on the next start and seeds it with the three sample tasks again.

**I want to start over with clean data**
Stop the server, delete `tasks.db`, and start it again.

**POST or PUT returns `400` even though my data looks right**
Check that you sent the `Content-Type: application/json` header, and that your JSON is valid (double quotes around keys and string values, no trailing commas).

---

## Ideas for next steps

Once this makes sense, these are natural things to add:

- **Tests** — try [Jest](https://jestjs.io) with [Supertest](https://www.npmjs.com/package/supertest) to check each endpoint automatically
- **A configurable port** — read `process.env.PORT` instead of hardcoding `3000`
- **`PATCH`** — a method meant for partial updates, which is arguably a better fit here than `PUT`
- **Filtering** — support `GET /tasks?done=true` with a `WHERE done = ?` clause
- **Timestamps** — add `created_at` and `updated_at` columns so you can sort by recency

# Task API (Todo App)

A small REST API for managing a todo list, built with [Node.js](https://nodejs.org) and [Express](https://expressjs.com).

You can create tasks, read them, update them, and delete them — the four basic operations usually called **CRUD** (Create, Read, Update, Delete). The API also ships with interactive documentation you can click through in your browser.

> **Note:** Tasks are stored **in memory**, which means they live only inside the running program. Stop the server and everything resets to the three starter tasks. This is intentional — it keeps the project simple while you learn. There is no database to install.

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

**2. Install the dependencies.** This downloads Express and the docs viewer into a `node_modules` folder:

```bash
npm install
```

**3. Start the server:**

```bash
npm start
```

You should see:

```
Server running on http://localhost:3000
Docs available at http://localhost:3000/docs
```

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
| `id` | number | Unique, assigned by the server. One higher than the current largest id. |
| `title` | string | What needs doing. Cannot be empty or whitespace only. |
| `done` | boolean | `true` if the task is finished. New tasks start at `false`. |

The server starts with three sample tasks (ids `1`, `2`, and `3`) so there's something to look at right away.

---

## Errors

Errors come back as JSON with an `error` message, plus an HTTP status code that tells you the category of problem.

| Status | Meaning | Example response |
| --- | --- | --- |
| `400 Bad Request` | Your data was missing or the wrong type | `{ "error": "Title is required" }` |
| `404 Not Found` | No task exists with that id | `{ "error": "Task 99 not found" }` |

A `400` means *fix your request*; a `404` means *that thing isn't here*.

---

## Project structure

```
week2_6/
├── server.js          # The whole application
├── package.json       # Project metadata, scripts, and dependencies
├── package-lock.json  # Exact dependency versions (commit this; don't edit it)
└── node_modules/      # Installed packages (created by npm install, not committed)
```

### Dependencies

| Package | Why it's here |
| --- | --- |
| [`express`](https://expressjs.com) | The web framework. Handles routing and HTTP requests. |
| [`swagger-ui-express`](https://www.npmjs.com/package/swagger-ui-express) | Serves the interactive docs page at `/docs`. |

### Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Runs `node server.js` |
| `npm test` | Placeholder — no tests yet |

---

## How the code works

Everything lives in `server.js`, in four sections:

**1. Storage.** A plain JavaScript array named `tasks` holds the data. That's the entire "database".

**2. Helpers.** Three small functions keep the routes short:

- `getNextId()` — finds the largest existing id and adds one
- `findTask(id)` — looks up a task, converting the id from text to a number (URL parameters always arrive as strings)
- `isValidTitle(title)` — checks the title is a string with actual characters in it

**3. Swagger document.** A large object describing every endpoint. `swagger-ui-express` turns it into the `/docs` page.

**4. Routes.** One `app.METHOD(path, handler)` call per endpoint. Each handler follows the same shape: validate the input, do the work, send a response with the right status code.

The line `app.use(express.json())` near the top matters more than it looks — it's what lets Express read JSON request bodies. Without it, `req.body` would be undefined on every POST and PUT.

---

## Troubleshooting

**`Error: listen EADDRINUSE: address already in use :::3000`**
Something else is already using port 3000 — probably another copy of this server you forgot to stop. Close it, or change the port number at the bottom of `server.js`.

**`Cannot find module 'express'`**
You skipped `npm install`. Run it and try again.

**My tasks disappeared!**
Expected. Restarting the server resets everything to the three starter tasks, because the data only exists in memory.

**POST or PUT returns `400` even though my data looks right**
Check that you sent the `Content-Type: application/json` header, and that your JSON is valid (double quotes around keys and string values, no trailing commas).

---

## Ideas for next steps

Once this makes sense, these are natural things to add:

- **Persistence** — save tasks to a JSON file or a real database so they survive a restart
- **Tests** — try [Jest](https://jestjs.io) with [Supertest](https://www.npmjs.com/package/supertest) to check each endpoint automatically
- **A configurable port** — read `process.env.PORT` instead of hardcoding `3000`
- **`PATCH`** — a method meant for partial updates, which is arguably a better fit here than `PUT`
- **Filtering** — support `GET /tasks?done=true`
- **Sturdier ids** — `getNextId()` can hand out a number that was used before if the newest task is deleted; [UUIDs](https://www.npmjs.com/package/uuid) avoid that

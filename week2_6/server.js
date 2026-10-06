// Load the variables from .env into process.env.
// This must run before we read any of them.
// quiet: true stops dotenv from printing its own startup banner.
require("dotenv").config({ quiet: true });

const express = require("express");
const swaggerUi = require("swagger-ui-express");
const Database = require("better-sqlite3");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Settings come from the environment, never hard-coded here.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const port = process.env.PORT || 3000;

// Stop early with a clear message if the credentials are missing,
// instead of failing later with a confusing error.
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY.");
  console.error("Copy .env.example to .env and fill in your values.");
  process.exit(1);
}

// Initialize the Supabase client.
// The tasks below still use SQLite; this client is ready for the next step.
const supabase = createClient(supabaseUrl, supabaseKey);

// Database setup
// Opens tasks.db, or creates the file if it does not exist yet.
const db = new Database("tasks.db");

db.prepare(
  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )`
).run();

// Seed the table only when it is empty, so restarting never duplicates tasks.
const taskCount = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();
if (taskCount.count === 0) {
  const insertSeed = db.prepare("INSERT INTO tasks (title, done) VALUES (?, ?)");
  insertSeed.run("Buy milk", 0);
  insertSeed.run("Read book", 1);
  insertSeed.run("Write code", 0);
  console.log("Seeded 3 default tasks");
}

// Prepared statements (reused by the routes below)
const selectAllTasks = db.prepare("SELECT id, title, done FROM tasks");
const selectTaskById = db.prepare("SELECT id, title, done FROM tasks WHERE id = ?");
const insertTask = db.prepare("INSERT INTO tasks (title, done) VALUES (?, 0)");
const updateTask = db.prepare("UPDATE tasks SET title = ?, done = ? WHERE id = ?");
const deleteTask = db.prepare("DELETE FROM tasks WHERE id = ?");

// Helpers
// SQLite stores done as 0 or 1, but the API sends true or false.
function toTask(row) {
  return {
    id: row.id,
    title: row.title,
    done: row.done === 1
  };
}

function isValidTitle(title) {
  return typeof title === "string" && title.trim() !== "";
}

// Swagger documentation
const swaggerDocument = {
  openapi: "3.0.0",
  info: { title: "Task API", version: "1.0" },
  servers: [{ url: "http://localhost:" + port }],
  paths: {
    "/": {
      get: {
        summary: "API information",
        responses: { 200: { description: "API information" } }
      }
    },
    "/health": {
      get: {
        summary: "Health check",
        responses: { 200: { description: "Server is healthy" } }
      }
    },
    "/tasks": {
      get: {
        summary: "Get all tasks",
        responses: { 200: { description: "List of tasks" } }
      },
      post: {
        summary: "Create a task",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: { title: { type: "string", example: "New task" } }
              }
            }
          }
        },
        responses: {
          201: { description: "Task created" },
          400: { description: "Title is required" }
        }
      }
    },
    "/tasks/{id}": {
      get: {
        summary: "Get one task",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" }
          }
        ],
        responses: {
          200: { description: "The task" },
          404: { description: "Task not found" }
        }
      },
      put: {
        summary: "Update a task",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", example: "Updated task" },
                  done: { type: "boolean", example: true }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Task updated" },
          400: { description: "Invalid update data" },
          404: { description: "Task not found" }
        }
      },
      delete: {
        summary: "Delete a task",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" }
          }
        ],
        responses: {
          204: { description: "Task deleted" },
          404: { description: "Task not found" }
        }
      }
    }
  }
};

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    name: "Task API",
    version: "1.0",
    endpoints: ["/tasks"]
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/tasks", (req, res) => {
  const rows = selectAllTasks.all();
  res.status(200).json(rows.map(toTask));
});

app.get("/tasks/:id", (req, res) => {
  const row = selectTaskById.get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: "Task not found" });
  }
  res.status(200).json(toTask(row));
});

app.post("/tasks", (req, res) => {
  const body = req.body || {};
  if (!isValidTitle(body.title)) {
    return res.status(400).json({ error: "Title is required" });
  }

  const result = insertTask.run(body.title);
  const row = selectTaskById.get(result.lastInsertRowid);
  res.status(201).json(toTask(row));
});

app.put("/tasks/:id", (req, res) => {
  const row = selectTaskById.get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: "Task not found" });
  }

  const body = req.body || {};
  const hasTitle = body.title !== undefined;
  const hasDone = body.done !== undefined;

  if (!hasTitle && !hasDone) {
    return res.status(400).json({ error: "Invalid update data" });
  }
  if (hasTitle && !isValidTitle(body.title)) {
    return res.status(400).json({ error: "Invalid update data" });
  }
  if (hasDone && typeof body.done !== "boolean") {
    return res.status(400).json({ error: "Invalid update data" });
  }

  // Keep the current value for any field the request left out.
  const newTitle = hasTitle ? body.title : row.title;
  const newDone = hasDone ? (body.done ? 1 : 0) : row.done;

  updateTask.run(newTitle, newDone, row.id);

  const updatedRow = selectTaskById.get(row.id);
  res.status(200).json(toTask(updatedRow));
});

app.delete("/tasks/:id", (req, res) => {
  const result = deleteTask.run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Task not found" });
  }
  res.status(204).send();
});

app.listen(port, () => {
  console.log("Server running and connected to Supabase");
  console.log("Server running on http://localhost:" + port);
  console.log("Docs available at http://localhost:" + port + "/docs");
});

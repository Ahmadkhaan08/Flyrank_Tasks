const express = require("express");
const swaggerUi = require("swagger-ui-express");

const app = express();
app.use(express.json());

// In-memory storage
let tasks = [
  { id: 1, title: "Buy milk", done: false },
  { id: 2, title: "Read book", done: true },
  { id: 3, title: "Write code", done: false }
];

// Helpers
function getNextId() {
  let maxId = 0;
  for (const task of tasks) {
    if (task.id > maxId) {
      maxId = task.id;
    }
  }
  return maxId + 1;
}

function findTask(id) {
  return tasks.find((task) => task.id === Number(id));
}

function isValidTitle(title) {
  return typeof title === "string" && title.trim() !== "";
}

// Swagger documentation
const swaggerDocument = {
  openapi: "3.0.0",
  info: { title: "Task API", version: "1.0" },
  servers: [{ url: "http://localhost:3000" }],
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
  res.status(200).json(tasks);
});

app.get("/tasks/:id", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "Task " + req.params.id + " not found" });
  }
  res.status(200).json(task);
});

app.post("/tasks", (req, res) => {
  const body = req.body || {};
  if (!isValidTitle(body.title)) {
    return res.status(400).json({ error: "Title is required" });
  }
  const newTask = {
    id: getNextId(),
    title: body.title,
    done: false
  };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.put("/tasks/:id", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "Task " + req.params.id + " not found" });
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

  if (hasTitle) {
    task.title = body.title;
  }
  if (hasDone) {
    task.done = body.done;
  }
  res.status(200).json(task);
});

app.delete("/tasks/:id", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "Task " + req.params.id + " not found" });
  }
  tasks = tasks.filter((item) => item.id !== task.id);
  res.status(204).send();
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("Docs available at http://localhost:3000/docs");
});

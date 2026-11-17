import express, { type NextFunction, type Request, type Response } from "express";
import type { Store } from "./db.ts";

export const MAX_TITLE = 200;

function parseId(raw: string): number | undefined {
  return /^\d+$/.test(raw) ? Number(raw) : undefined;
}

export function createApp(store: Store) {
  const app = express();
  app.use(express.json());

  const api = express.Router();

  api.get("/todos", (_req, res) => {
    res.json(store.list());
  });

  api.post("/todos", (req, res) => {
    const raw = req.body?.title;
    if (typeof raw !== "string" || raw.trim() === "") {
      res.status(400).json({ error: "Title is required." });
      return;
    }
    const title = raw.trim();
    if (title.length > MAX_TITLE) {
      res.status(400).json({ error: `Title must be ${MAX_TITLE} characters or fewer.` });
      return;
    }
    res.status(201).json(store.create(title));
  });

  api.patch("/todos/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (id === undefined) {
      res.status(400).json({ error: "Invalid todo id." });
      return;
    }
    if (typeof req.body?.completed !== "boolean") {
      res.status(400).json({ error: "'completed' must be a boolean." });
      return;
    }
    const todo = store.setCompleted(id, req.body.completed);
    if (!todo) {
      res.status(404).json({ error: "Todo not found." });
      return;
    }
    res.json(todo);
  });

  api.delete("/todos/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (id === undefined) {
      res.status(400).json({ error: "Invalid todo id." });
      return;
    }
    if (!store.remove(id)) {
      res.status(404).json({ error: "Todo not found." });
      return;
    }
    res.status(204).end();
  });

  api.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  app.use("/api", api);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status && err.status < 500 ? err.status : 500;
    res.status(status).json({ error: status === 500 ? "Internal server error." : "Invalid request." });
  });

  return app;
}

import express from "express";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { createStore } from "./db.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbFile = process.env.DB_FILE ?? path.join(root, "data", "todos.db");
mkdirSync(path.dirname(dbFile), { recursive: true });

const app = createApp(createStore(dbFile));

if (process.env.NODE_ENV === "production") {
  const dist = path.join(root, "dist");
  app.use(express.static(dist));
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Todo app listening on http://localhost:${port}`);
});

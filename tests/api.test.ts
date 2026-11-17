import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.ts";
import { createStore, type Store } from "../server/db.ts";

let dir: string;
let file: string;
let store: Store;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "todo-"));
  file = path.join(dir, "t.db");
  store = createStore(file);
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("todos API", () => {
  it("creates, lists, completes, uncompletes and deletes", async () => {
    const app = createApp(store);
    const created = await request(app).post("/api/todos").send({ title: "  Buy milk  " });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: "Buy milk", completed: false });

    const done = await request(app).patch(`/api/todos/${created.body.id}`).send({ completed: true });
    expect(done.body.completed).toBe(true);
    const undone = await request(app).patch(`/api/todos/${created.body.id}`).send({ completed: false });
    expect(undone.body.completed).toBe(false);

    expect((await request(app).get("/api/todos")).body).toHaveLength(1);
    expect((await request(app).delete(`/api/todos/${created.body.id}`)).status).toBe(204);
    expect((await request(app).get("/api/todos")).body).toEqual([]);
  });

  it.each([
    [{}],
    [{ title: "   " }],
    [{ title: 5 }],
    [{ title: "x".repeat(201) }],
  ])("rejects invalid title %j", async (body) => {
    const res = await request(createApp(store)).post("/api/todos").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("validates ids and bodies, and returns 404 for missing todos", async () => {
    const app = createApp(store);
    expect((await request(app).patch("/api/todos/abc").send({ completed: true })).status).toBe(400);
    expect((await request(app).patch("/api/todos/1").send({ completed: "yes" })).status).toBe(400);
    expect((await request(app).patch("/api/todos/999").send({ completed: true })).status).toBe(404);
    expect((await request(app).delete("/api/todos/999")).status).toBe(404);
  });

  it("returns a JSON error for malformed JSON", async () => {
    const res = await request(createApp(store))
      .post("/api/todos")
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("persists across a store restart", async () => {
    await request(createApp(store)).post("/api/todos").send({ title: "Persist me" });
    await request(createApp(store)).patch("/api/todos/1").send({ completed: true });
    store.close();
    store = createStore(file);
    const res = await request(createApp(store)).get("/api/todos");
    expect(res.body).toMatchObject([{ title: "Persist me", completed: true }]);
  });

  const DUE_ERR = "Due date must be a valid date in YYYY-MM-DD format.";

  it("creates todos with optional due dates and validates them", async () => {
    const app = createApp(store);
    expect((await request(app).post("/api/todos").send({ title: "A" })).body.dueDate).toBeNull();
    const ok = await request(app).post("/api/todos").send({ title: "B", dueDate: "2030-01-15" });
    expect(ok.status).toBe(201);
    expect(ok.body.dueDate).toBe("2030-01-15");
    for (const bad of ["2030-13-01", "2025-02-30", "15/01/2030", "", 20300115, true]) {
      const res = await request(app).post("/api/todos").send({ title: "C", dueDate: bad });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(DUE_ERR);
    }
    const title = await request(app).post("/api/todos").send({ title: " ", dueDate: "bad" });
    expect(title.body.error).toBe("Title is required.");
    expect((await request(app).get("/api/todos")).body).toHaveLength(2);
  });

  it("patches dueDate and completed independently or together", async () => {
    const app = createApp(store);
    await request(app).post("/api/todos").send({ title: "A", dueDate: "2030-01-15" });
    let res = await request(app).patch("/api/todos/1").send({ completed: true });
    expect(res.body).toMatchObject({ completed: true, dueDate: "2030-01-15" });
    res = await request(app).patch("/api/todos/1").send({ dueDate: "2030-02-01" });
    expect(res.body).toMatchObject({ completed: true, dueDate: "2030-02-01" });
    res = await request(app).patch("/api/todos/1").send({ completed: false, dueDate: "2030-03-03" });
    expect(res.body).toMatchObject({ completed: false, dueDate: "2030-03-03" });
    res = await request(app).patch("/api/todos/1").send({ dueDate: null });
    expect(res.body.dueDate).toBeNull();
    res = await request(app).patch("/api/todos/1").send({ dueDate: "bad" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(DUE_ERR);
    expect((await request(app).patch("/api/todos/1").send({})).body.error).toBe("'completed' must be a boolean.");
    expect((await request(app).patch("/api/todos/999").send({ dueDate: null })).status).toBe(404);
  });

  it("migrates an old-schema database and persists due dates", async () => {
    const old = path.join(dir, "old.db");
    const raw = new DatabaseSync(old);
    raw.exec(`CREATE TABLE todos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
      INSERT INTO todos (title) VALUES ('old')`);
    raw.close();
    createStore(old).close();
    const s = createStore(old);
    const app = createApp(s);
    expect((await request(app).get("/api/todos")).body).toMatchObject([{ title: "old", dueDate: null }]);
    await request(app).post("/api/todos").send({ title: "new", dueDate: "2030-01-01" });
    s.close();
    const s2 = createStore(old);
    expect((await request(createApp(s2)).get("/api/todos")).body[1].dueDate).toBe("2030-01-01");
    s2.close();
  });
});

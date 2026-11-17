import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
});

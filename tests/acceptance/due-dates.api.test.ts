import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.ts";
import { createStore, type Store } from "../../server/db.ts";

const DUE_MSG = "Due date must be a valid date in YYYY-MM-DD format.";

let dir: string;
let file: string;
const stores: Store[] = [];

function open(f = file): Store {
  const s = createStore(f);
  stores.push(s);
  return s;
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "due-"));
  file = path.join(dir, "t.db");
});
afterEach(() => {
  for (const s of stores.splice(0)) {
    try {
      s.close();
    } catch {
      /* already closed */
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

async function add(app: ReturnType<typeof createApp>, body: object) {
  const res = await request(app).post("/api/todos").send(body);
  expect(res.status).toBe(201);
  return res.body as { id: number; title: string; completed: boolean; createdAt: string; dueDate: string | null };
}

describe("due dates: POST", () => {
  it("AC1 omitted dueDate -> null", async () => {
    const app = createApp(open());
    const res = await request(app).post("/api/todos").send({ title: "A" });
    expect(res.status).toBe(201);
    expect(res.body.dueDate).toBeNull();
  });

  it("AC2 accepts a dueDate and lists it", async () => {
    const app = createApp(open());
    const res = await request(app).post("/api/todos").send({ title: "A", dueDate: "2030-01-15" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "A", completed: false, dueDate: "2030-01-15" });
    const list = await request(app).get("/api/todos");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].dueDate).toBe("2030-01-15");
  });

  it("AC3 null dueDate behaves like omitted", async () => {
    const app = createApp(open());
    const res = await request(app).post("/api/todos").send({ title: "A", dueDate: null });
    expect(res.status).toBe(201);
    expect(res.body.dueDate).toBeNull();
  });

  it.each(["2030-13-01", "2025-02-30", "15/01/2030", "", 20300115, true])(
    "AC4 rejects invalid dueDate %j and creates nothing",
    async (bad) => {
      const app = createApp(open());
      const res = await request(app).post("/api/todos").send({ title: "A", dueDate: bad });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: DUE_MSG });
      expect((await request(app).get("/api/todos")).body).toEqual([]);
    },
  );

  it("AC5 title error wins over dueDate error", async () => {
    const app = createApp(open());
    const empty = await request(app).post("/api/todos").send({ title: "  ", dueDate: "nope" });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: "Title is required." });
    const long = await request(app).post("/api/todos").send({ title: "x".repeat(201), dueDate: "nope" });
    expect(long.status).toBe(400);
    expect(long.body).toEqual({ error: "Title must be 200 characters or fewer." });
  });
});

describe("due dates: PATCH", () => {
  it("AC6 updates dueDate, completed unchanged", async () => {
    const app = createApp(open());
    const t = await add(app, { title: "A", dueDate: "2030-01-15" });
    const res = await request(app).patch(`/api/todos/${t.id}`).send({ dueDate: "2030-02-01" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, title: "A", completed: false, dueDate: "2030-02-01" });
  });

  it("AC7 null clears the date and keeps completed", async () => {
    const app = createApp(open());
    const t = await add(app, { title: "A", dueDate: "2030-01-15" });
    await request(app).patch(`/api/todos/${t.id}`).send({ completed: true });
    const res = await request(app).patch(`/api/todos/${t.id}`).send({ dueDate: null });
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBeNull();
    expect(res.body.completed).toBe(true);
    const list = await request(app).get("/api/todos");
    expect(list.body[0].dueDate).toBeNull();
  });

  it("AC8 completed alone leaves dueDate", async () => {
    const app = createApp(open());
    const t = await add(app, { title: "A", dueDate: "2030-01-15" });
    const res = await request(app).patch(`/api/todos/${t.id}`).send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ completed: true, dueDate: "2030-01-15" });
  });

  it("AC9 completed and dueDate together", async () => {
    const app = createApp(open());
    const t = await add(app, { title: "A" });
    const res = await request(app).patch(`/api/todos/${t.id}`).send({ completed: true, dueDate: "2030-03-03" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ completed: true, dueDate: "2030-03-03" });
    expect((await request(app).get("/api/todos")).body[0]).toMatchObject({ completed: true, dueDate: "2030-03-03" });
  });

  it("AC10 validation and error ordering", async () => {
    const app = createApp(open());
    const t = await add(app, { title: "A", dueDate: "2030-01-15" });
    const url = `/api/todos/${t.id}`;

    for (const body of [{}, { completed: "yes" }]) {
      const res = await request(app).patch(url).send(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "'completed' must be a boolean." });
    }

    for (const bad of ["bad", "2025-02-30", 5, true, ""]) {
      const res = await request(app).patch(url).send({ dueDate: bad });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: DUE_MSG });
    }
    // invalid dueDate alongside valid completed must not partially apply
    const mixed = await request(app).patch(url).send({ completed: true, dueDate: "bad" });
    expect(mixed.status).toBe(400);
    const list = await request(app).get("/api/todos");
    expect(list.body[0]).toMatchObject({ completed: false, dueDate: "2030-01-15" });

    const badId = await request(app).patch("/api/todos/abc").send({ dueDate: null });
    expect(badId.status).toBe(400);
    expect(badId.body).toEqual({ error: "Invalid todo id." });

    const missing = await request(app).patch("/api/todos/999").send({ dueDate: null });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "Todo not found." });
  });
});

describe("due dates: persistence and migration", () => {
  it("AC11 persists across store restart", async () => {
    const s1 = open();
    const t = await add(createApp(s1), { title: "A", dueDate: "2030-01-15" });
    s1.close();
    const app2 = createApp(open());
    const list = await request(app2).get("/api/todos");
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: t.id, dueDate: "2030-01-15" });
  });

  it("AC12 migrates an old-schema database idempotently", async () => {
    const raw = new DatabaseSync(file);
    raw.exec(`CREATE TABLE todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    raw.exec("INSERT INTO todos (title, completed) VALUES ('old one', 0), ('old two', 1)");
    raw.close();

    const s1 = open();
    const app = createApp(s1);
    const list = await request(app).get("/api/todos");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.map((t: { title: string }) => t.title)).toEqual(["old one", "old two"]);
    for (const t of list.body) expect(t.dueDate).toBeNull();
    expect(list.body[1].completed).toBe(true);

    const created = await add(app, { title: "new", dueDate: "2031-05-06" });
    expect(created.dueDate).toBe("2031-05-06");
    s1.close();

    const app2 = createApp(open());
    const again = await request(app2).get("/api/todos");
    expect(again.body).toHaveLength(3);
    expect(again.body[0].dueDate).toBeNull();
    expect(again.body[2].dueDate).toBe("2031-05-06");
  });
});

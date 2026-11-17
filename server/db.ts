import { DatabaseSync } from "node:sqlite";

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
  dueDate: string | null;
}

interface Row {
  id: number;
  title: string;
  completed: number;
  created_at: string;
  due_date: string | null;
}

const toTodo = (r: Row): Todo => ({
  id: r.id,
  title: r.title,
  completed: r.completed === 1,
  createdAt: r.created_at,
  dueDate: r.due_date ?? null,
});

export function createStore(file: string) {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);
  const cols = db.prepare("PRAGMA table_info(todos)").all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === "due_date")) {
    db.exec("ALTER TABLE todos ADD COLUMN due_date TEXT");
  }

  const getStmt = db.prepare("SELECT * FROM todos WHERE id = ?");
  const store = {
    list: () =>
      (db.prepare("SELECT * FROM todos ORDER BY id").all() as unknown as Row[]).map(toTodo),
    get: (id: number) => {
      const r = getStmt.get(id) as unknown as Row | undefined;
      return r ? toTodo(r) : undefined;
    },
    create: (title: string, dueDate?: string | null) => {
      const res = db.prepare("INSERT INTO todos (title, due_date) VALUES (?, ?)").run(title, dueDate ?? null);
      return toTodo(getStmt.get(Number(res.lastInsertRowid)) as unknown as Row);
    },
    update: (id: number, patch: { completed?: boolean; dueDate?: string | null }) => {
      const sets: string[] = [];
      const args: (number | string | null)[] = [];
      if (patch.completed !== undefined) {
        sets.push("completed = ?");
        args.push(patch.completed ? 1 : 0);
      }
      if (patch.dueDate !== undefined) {
        sets.push("due_date = ?");
        args.push(patch.dueDate);
      }
      if (sets.length === 0) return getStmt.get(id) ? toTodo(getStmt.get(id) as unknown as Row) : undefined;
      const res = db.prepare(`UPDATE todos SET ${sets.join(", ")} WHERE id = ?`).run(...args, id);
      if (res.changes === 0) return undefined;
      return toTodo(getStmt.get(id) as unknown as Row);
    },
    setCompleted: (id: number, completed: boolean) => store.update(id, { completed }),
    remove: (id: number) => db.prepare("DELETE FROM todos WHERE id = ?").run(id).changes > 0,
    close: () => db.close(),
  };
  return store;
}

export type Store = ReturnType<typeof createStore>;

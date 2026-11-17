import { DatabaseSync } from "node:sqlite";

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface Row {
  id: number;
  title: string;
  completed: number;
  created_at: string;
}

const toTodo = (r: Row): Todo => ({
  id: r.id,
  title: r.title,
  completed: r.completed === 1,
  createdAt: r.created_at,
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

  const getStmt = db.prepare("SELECT * FROM todos WHERE id = ?");
  return {
    list: () =>
      (db.prepare("SELECT * FROM todos ORDER BY id").all() as unknown as Row[]).map(toTodo),
    get: (id: number) => {
      const r = getStmt.get(id) as unknown as Row | undefined;
      return r ? toTodo(r) : undefined;
    },
    create: (title: string) => {
      const res = db.prepare("INSERT INTO todos (title) VALUES (?)").run(title);
      return toTodo(getStmt.get(Number(res.lastInsertRowid)) as unknown as Row);
    },
    setCompleted: (id: number, completed: boolean) => {
      const res = db.prepare("UPDATE todos SET completed = ? WHERE id = ?").run(completed ? 1 : 0, id);
      if (res.changes === 0) return undefined;
      return toTodo(getStmt.get(id) as unknown as Row);
    },
    remove: (id: number) => db.prepare("DELETE FROM todos WHERE id = ?").run(id).changes > 0,
    close: () => db.close(),
  };
}

export type Store = ReturnType<typeof createStore>;

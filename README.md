# Todo app

Node 24, TypeScript, Vite, Express, SQLite (built-in `node:sqlite`). Data lives in `data/todos.db` (git-ignored).

- `npm install`
- `npm start` — builds, then serves the app at http://localhost:3000
- `npm run dev` — Vite (http://localhost:5173) + API with reload
- `npm test` — API/persistence tests; `npm run typecheck`

Env: `PORT` (default 3000), `DB_FILE` (default `data/todos.db`).

## API

Todo: `{ id, title, completed, createdAt, dueDate }` where `dueDate` is `YYYY-MM-DD` or `null`.

- `GET /api/todos` — list todos.
- `POST /api/todos` `{ title, dueDate? }` — create (201). `dueDate` optional/nullable.
- `PATCH /api/todos/:id` `{ completed?, dueDate? }` — update supplied fields; `dueDate: null` clears it. At least one key is required.
- `DELETE /api/todos/:id` — delete (204).

Invalid dates return 400 `Due date must be a valid date in YYYY-MM-DD format.` Existing databases are migrated automatically (nullable `due_date` column).

# Todo app

Node 24, TypeScript, Express, SQLite (built-in `node:sqlite`). Data lives in `data/todos.db` (git-ignored).

Frontend: React 19 + Vite + TypeScript. `index.html` mounts `<div id="root">`; `src/main.tsx` renders `<App/>` in `StrictMode`. See [docs/react-architecture.md](docs/react-architecture.md) for the component tree and file map.

- `npm install` (or `npm ci` in a fresh worktree)
- `npm start` — builds, then serves the built React app from `dist/` at http://127.0.0.1:3000
- `npm run dev` — Vite (http://localhost:5173) + API with reload
- `npm test` — Vitest; `npm run typecheck`; `npm run build`

Tests: `tests/**/*.test.ts` run in the `node` project (API/persistence); `tests/**/*.test.tsx` run in the `dom` project (jsdom, setup `tests/setup-dom.ts`) using `@testing-library/react` with `fireEvent` and plain `expect`.

Env: `HOST` (default `127.0.0.1`, localhost-only), `PORT` (default 3000), `DB_FILE` (default `data/todos.db`).

## API

Todo: `{ id, title, completed, createdAt, dueDate }` where `dueDate` is `YYYY-MM-DD` or `null`.

- `GET /api/todos` — list todos.
- `POST /api/todos` `{ title, dueDate? }` — create (201). `dueDate` optional/nullable.
- `PATCH /api/todos/:id` `{ completed?, dueDate? }` — update supplied fields; `dueDate: null` clears it. At least one key is required.
- `DELETE /api/todos/:id` — delete (204).

Invalid dates return 400 `Due date must be a valid date in YYYY-MM-DD format.` Existing databases are migrated automatically (nullable `due_date` column).

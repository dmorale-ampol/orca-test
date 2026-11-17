# Todo app

Node 24, TypeScript, Vite, Express, SQLite (built-in `node:sqlite`). Data lives in `data/todos.db` (git-ignored).

- `npm install`
- `npm start` — builds, then serves the app at http://localhost:3000
- `npm run dev` — Vite (http://localhost:5173) + API with reload
- `npm test` — API/persistence tests; `npm run typecheck`

Env: `PORT` (default 3000), `DB_FILE` (default `data/todos.db`).

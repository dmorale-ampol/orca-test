# Due dates release (v1.1) — approved contract

Optional due date per todo, with an Overdue indicator and editing/clearing of the date.
Not included: title edit, filters, clear-completed. No new dependencies; `package.json`,
`package-lock.json`, `vite.config.ts` and `tsconfig.json` are untouched.

## 1. API contract

Todo JSON in all responses: `{ id:number, title:string, completed:boolean, createdAt:string, dueDate:string|null }`.
`dueDate` is a calendar date `YYYY-MM-DD` (no time/timezone) or `null`.

**Migration** (`server/db.ts`, in `createStore` after `CREATE TABLE IF NOT EXISTS`): read
`PRAGMA table_info(todos)`; if there is no `due_date` column run
`ALTER TABLE todos ADD COLUMN due_date TEXT` (nullable, no default). Idempotent; existing rows
get `dueDate: null`; an existing `data/todos.db` keeps working. Map `due_date` -> `dueDate`.

**dueDate validation:** must be a string matching `/^\d{4}-\d{2}-\d{2}$/` AND a real calendar
date (e.g. `2025-02-30` is invalid; verify with a `Date.UTC` round trip). Error (exact, 400):
`Due date must be a valid date in YYYY-MM-DD format.`

- `GET /api/todos` -> 200 array of Todo, ordered by id.
- `POST /api/todos` body `{title:string, dueDate?:string|null}`. Title rules unchanged
  (`Title is required.`, `Title must be 200 characters or fewer.`). Title validated first, then
  dueDate. Omitted/null dueDate -> null. Invalid dueDate -> 400. Success 201 Todo.
- `PATCH /api/todos/:id` body may contain `completed` (boolean) and/or `dueDate` (string|null).
  Check order: invalid id -> 400 `Invalid todo id.`; neither key present, or `completed` present
  and not boolean -> 400 `'completed' must be a boolean.`; dueDate present and invalid
  (non-string non-null, bad format, impossible date) -> 400 due-date message; missing todo -> 404
  `Todo not found.`; success 200 full Todo. Only supplied keys change (`{dueDate:null}` clears the
  date and leaves `completed`; `{completed:true}` leaves `dueDate`). Both together are applied
  atomically; validate everything before writing.
- `DELETE /api/todos/:id` unchanged (204 / 400 / 404). Unknown `/api` route 404
  `{error:"Not found."}`; malformed JSON 400 `{error:"Invalid request."}` unchanged.

Store (`server/db.ts`): `create(title, dueDate?: string|null)`;
`update(id, {completed?: boolean, dueDate?: string|null}) -> Todo|undefined`; `setCompleted`
may stay as a thin wrapper. `createStore(file)` / `createApp(store)` signatures are unchanged.

## 2. UI contract (`index.html`, `src/main.ts`, `src/api.ts`, `src/style.css`)

- Add form: keep `#new-title`; add `<label for="new-due">Due date (optional)</label>` and
  `<input id="new-due" name="dueDate" type="date" aria-describedby="form-error">`. Submit sends
  `dueDate` = input value or `null` when empty; `#new-due` is cleared after a successful add.
  Server errors appear in `#form-error` (hidden attr toggled, `aria-invalid` on the input).
- Each `<li>` in `#list` contains, in order: checkbox `#todo-<id>` + `<label for>` title
  (unchanged), `<input type="date" id="due-<id>" class="due" aria-label='Due date for "<title>"'
  value=dueDate||"">`, delete button (unchanged, `aria-label='Delete "<title>"'`).
- On `change` of `#due-<id>`, call PATCH `{dueDate: value||null}`; clearing sets null. On success
  replace the todo and re-render; on failure show the message in `#status` (role=status, existing
  `run()` pattern) and re-render to restore the previous value.
- Overdue: if `dueDate` < today's **local** date (`YYYY-MM-DD` from the local clock, not UTC)
  AND the todo is not completed, the `<li>` gets class `overdue` and contains
  `<span class="badge overdue-badge">Overdue</span>` after the title label. Completed todos and
  todos due today/future/none never show it. Style `.overdue` in `style.css`; no layout break on
  narrow widths.
- `src/api.ts`: `Todo` gains `dueDate: string|null`; `create(title, dueDate?)`; new
  `setDueDate(id, dueDate|null)`; `setCompleted` unchanged.
- Existing ids/behaviours (`#add-form`, `#new-title`, `#form-error`, `#status`, `#empty`,
  `#list`, Delete buttons, checkbox toggle) must be preserved.

## 3. Acceptance criteria

- AC1 POST `{title:"A"}` -> 201 with `dueDate:null`.
- AC2 POST `{title:"A",dueDate:"2030-01-15"}` -> 201 with that dueDate; GET lists it.
- AC3 POST with `dueDate:null` behaves like omitted.
- AC4 POST with dueDate `"2030-13-01"`, `"2025-02-30"`, `"15/01/2030"`, `""`, `20300115`, or `true`
  -> 400 with the exact due-date message, and no todo is created.
- AC5 POST with invalid title AND invalid dueDate -> the title error.
- AC6 PATCH `{dueDate:"2030-02-01"}` -> 200, dueDate updated, completed unchanged.
- AC7 PATCH `{dueDate:null}` clears the date; GET confirms null.
- AC8 PATCH `{completed:true}` leaves dueDate unchanged.
- AC9 PATCH `{completed:true,dueDate:"2030-03-03"}` updates both.
- AC10 PATCH `{}` -> 400 `'completed' must be a boolean.`; `{completed:"yes"}` -> same;
  `{dueDate:"bad"}` -> 400 due-date message and the todo is unchanged; `/api/todos/abc` -> 400
  `Invalid todo id.`; `/api/todos/999` with `{dueDate:null}` -> 404 `Todo not found.`
- AC11 dueDate persists across a store restart (`createStore` on the same file).
- AC12 Migration: a DB file created with the OLD schema (no `due_date`) containing rows opens via
  `createStore` without error; rows list with dueDate null; opening twice is fine; new todos can
  take a dueDate.
- AC13 Existing `tests/api.test.ts` cases pass unchanged.
- AC14 UI: add form has a labelled date input "Due date (optional)"; adding a todo with a date
  shows it in `#due-<id>`.
- AC15 UI: changing `#due-<id>` persists across reload; clearing persists null.
- AC16 UI: an incomplete todo with a past due date shows the "Overdue" badge and class `overdue`;
  ticking its checkbox removes the badge; today/future/none never show it.
- AC17 UI: a server error on due-date change or add is displayed (`#status` / `#form-error`) and
  the input reverts.
- AC18 `npm run typecheck`, `npm test`, `npm run build` all pass.

## 4. File ownership (disjoint)

| Worker | Owns |
|---|---|
| BACKEND | `server/db.ts`, `server/app.ts`, append-only new cases in `tests/api.test.ts`, `README.md` |
| FRONTEND | `index.html`, `src/main.ts`, `src/api.ts`, `src/style.css` |
| QA | new files only under `tests/acceptance/` |

Nobody edits `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `docs/` or
`.github/`. Vitest's include `tests/**/*.test.ts` already discovers `tests/acceptance/*.test.ts`.

## 5. Tasks

- **BACKEND — "Due date column and API":** migration, `Todo.dueDate`, validation, POST/PATCH,
  `store.create/update`, README API docs, a few appended tests. DoD: AC1–AC13, exact error strings.
- **FRONTEND — "Due date UI":** section 2. DoD: AC14–AC17 verified manually in a browser with
  `npm run dev` (state exactly what was and was not checked), existing UI intact.
- **QA — "Acceptance tests":** `tests/acceptance/due-dates.api.test.ts` for AC1–AC13 via supertest
  with `createApp`/`createStore` (old-schema DB built with `node:sqlite` `DatabaseSync` in a temp
  dir, cleaned up). Written from this contract only; tests must fail meaningfully on the
  baseline and pass once BACKEND is merged. Report ambiguities to the coordinator instead of
  editing implementation files. Do not add dependencies.

Each worker runs `npm run typecheck`, `npm test`, `npm run build` as applicable, commits its work
on its own branch (do not push; no remotes exist), and reports through Orca.

## 6. Risks

QA tests fail until BACKEND merges (expected); import with `.ts` extensions like existing tests;
strict date validation; compute "today" locally on the client (not `toISOString`); keep the old
empty-body PATCH message; guard `ALTER TABLE` with the PRAGMA check; README only touched by BACKEND.

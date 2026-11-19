# React conversion (release: react-conversion) — plan / contract

Summary: I read the current app and wrote a plan to convert it to React 19 using a serial FOUNDATION step, then 8 parallel workers (5 frontend, QA, DOCS, E2E), then review and integration. The current UI has 4 tabs, an add form with an optional due date, and a todo list with toggle, due-date edit, Overdue badge and delete. It has **no filters**, so this plan does not invent any. Open questions are at the end.

## 0. Baseline facts (inspected)
- Scripts already exist in package.json: `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `build` (`tsc --noEmit && vite build`), plus `dev` and `start`. FOUNDATION keeps all of them unchanged.
- Tooling: TypeScript ^7, Vite ^8, Vitest ^5 and Node >=24. `node_modules` is not installed in this worktree, so every worktree must run `npm ci` (or `npm install` for FOUNDATION) first.
- vitest `include` is currently `tests/**/*.test.ts` and the tests run in the node environment. tsconfig `include` is `server, src, tests, vite.config.ts` and has no `jsx` setting.
- Current frontend files: `index.html` (static markup), `src/main.ts` (all list and form logic), `src/tabs/tab1.ts` (tabs logic), `src/api.ts` (fetch client with `interface Todo`), `src/style.css` and `src/vite-env.d.ts`.
- The server serves `dist/` in production (`server/index.ts`).

## 1. API contract
**API UNCHANGED.** `server/` is frozen and `tests/api.test.ts` and `tests/acceptance/due-dates.api.test.ts` stay untouched and must pass. The client keeps the same endpoints:
- `GET /api/todos`
- `POST /api/todos {title, dueDate|null}`
- `PATCH /api/todos/:id {completed}` or `{dueDate}`
- `DELETE /api/todos/:id`

Todo shape: `{ id:number, title:string, completed:boolean, createdAt:string, dueDate:string|null }`.

## 2. Shared types (FOUNDATION writes `src/types.ts`; it is FROZEN during phase 1)
```ts
// src/types.ts
export type Todo = {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
  readonly createdAt: string;
  readonly dueDate: string | null; // YYYY-MM-DD
};
export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

export type TodosState = {
  readonly todos: readonly Todo[];
  readonly loaded: boolean;          // true only after the initial GET succeeded
  readonly status: string | null;    // message for #status; null = hidden
  readonly add: (title: string, dueDate: string | null) => Promise<ActionResult>;
  readonly setCompleted: (id: number, completed: boolean) => Promise<boolean>; // false = failed
  readonly setDueDate: (id: number, dueDate: string | null) => Promise<boolean>;
  readonly remove: (id: number) => Promise<boolean>;
};

export type AddTodoFormProps = {
  readonly onAdd: (title: string, dueDate: string | null) => Promise<ActionResult>;
};
export type TodoListProps = {
  readonly todos: readonly Todo[];
  readonly onToggle: (id: number, completed: boolean) => Promise<boolean>;
  readonly onDueDateChange: (id: number, dueDate: string | null) => Promise<boolean>;
  readonly onDelete: (id: number) => Promise<boolean>;
};
export type TodoItemProps = {
  readonly todo: Todo;
  readonly today: string; // local YYYY-MM-DD
  readonly onToggle: (completed: boolean) => Promise<boolean>;
  readonly onDueDateChange: (dueDate: string | null) => Promise<boolean>;
  readonly onDelete: () => Promise<boolean>;
};
export type TabDef = { readonly id: string; readonly panelId: string; readonly label: string };
export type TabsProps = {
  readonly tabs: readonly TabDef[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
};
```

### Exported signatures (named exports only; `.ts`/`.tsx` import extensions; `import type { ReactNode } from "react"`)
- `src/api.ts`:
  - `export type { Todo } from "./types.ts"`
  - `export const api: { list(): Promise<Todo[]>; create(title: string, dueDate?: string | null): Promise<Todo>; setDueDate(id: number, dueDate: string | null): Promise<Todo>; setCompleted(id: number, completed: boolean): Promise<Todo>; remove(id: number): Promise<void> }`
  - These are the same names and behaviour as today, including the error messages.
- `src/hooks/useTodos.ts`: `export function useTodos(): TodosState`
- `src/lib/dates.ts`:
  - `export function localToday(now?: Date): string`
  - `export function isOverdue(todo: Todo, today: string): boolean`
- `src/components/AddTodoForm.tsx`: `export function AddTodoForm(props: AddTodoFormProps): ReactNode`
- `src/components/TodoList.tsx`: `export function TodoList(props: TodoListProps): ReactNode`
- `src/components/TodoItem.tsx`: `export function TodoItem(props: TodoItemProps): ReactNode`
- `src/components/Tabs.tsx`: `export function Tabs(props: TabsProps): ReactNode`
- `src/App.tsx`: `export function App(): ReactNode`

## 3. UI contract: component responsibilities
- **index.html** keeps `lang="en"`, the charset and viewport meta tags and `<title>Todos</title>`. Its body becomes `<div id="root"></div>` plus `<script type="module" src="/src/main.tsx">`. All markup moves into React.
- **main.tsx**: `createRoot(root).render(<StrictMode><App/></StrictMode>)` and `import "./style.css"`. If `#root` is missing it throws a clear Error (no `!` and no `any`).
- **App** renders, in order:
  1. `<main>`
  2. `<Tabs>` with the 4 tabs (`tab-todos`/`panel-todos`/"Todos", `tab-1`/`panel-1`/"Tab 1", `tab-2`/`panel-2`/"Tab 2", `tab-3`/`panel-3`/"Tab 3")
  3. Four `<section role="tabpanel" id=… aria-labelledby=…>`. All four are always rendered; inactive ones get `hidden` and are never unmounted.
  - The todos panel contains: `<h1>Todos</h1>`, `<AddTodoForm>`, `#status`, `#empty`, `<TodoList>`.
  - Panels 1/2/3 contain the buttons `#btn-a` "A", `#btn-b` "B" and `#btn-c` "C" (they have no handlers).
  - App owns the selected-tab state (initially 0) and calls `useTodos()`.
- **Tabs** renders only `<div role="tablist" aria-label="Sections" id="tabs">` with its buttons. It handles click, ArrowLeft/ArrowRight and focus using refs.
- **AddTodoForm** renders all of `#add-form`, owns the form-error state and calls `onAdd`.
- **TodoList** renders `<ul id="list" aria-label="Todo list">`, computes `today = localToday()` once per render and maps todos to `TodoItem` with `key=todo.id`.
- **TodoItem** renders one `<li>`.

## 4. Acceptance criteria
These are numbered and must all hold on the merged result. The QA worker covers the items marked [T] with jsdom tests, and the E2E worker checks every item in a browser.

### Document and tabs
- **UI1** The document has `lang="en"` and title "Todos". A single `<main>` wraps everything. [T]
- **UI2** `#tabs` is a `div` with `role="tablist"` and `aria-label="Sections"`. It contains 4 `<button type="button" role="tab">` elements in this order, with these ids and texts:
  - `#tab-todos` "Todos", `aria-controls="panel-todos"`
  - `#tab-1` "Tab 1", `aria-controls="panel-1"`
  - `#tab-2` "Tab 2", `aria-controls="panel-2"`
  - `#tab-3` "Tab 3", `aria-controls="panel-3"`
  [T]
- **UI3** Initially `#tab-todos` has `aria-selected="true"` and `tabIndex` 0, and the other tabs have `aria-selected="false"` and `tabindex="-1"`. `#panel-todos` is visible and `#panel-1`, `#panel-2` and `#panel-3` have the `hidden` attribute. [T]
- **UI4** Each panel is a `<section role="tabpanel">` with `aria-labelledby` set to its tab id. They are `#panel-todos`, `#panel-1` (contains `<button type="button" id="btn-a">A</button>`), `#panel-2` (`#btn-b` "B") and `#panel-3` (`#btn-c` "C"). [T]
- **UI5** Clicking a tab selects it:
  - It gets `aria-selected="true"` and `tabIndex` 0.
  - Every other tab gets `aria-selected="false"` and `tabIndex` -1.
  - Only its panel is shown; the others get `hidden`.
  [T]
- **UI6** With focus on a tab:
  - ArrowRight selects and focuses the next tab, wrapping from Tab 3 to Todos.
  - ArrowLeft selects and focuses the previous tab, wrapping from Todos to Tab 3.
  - Both call preventDefault.
  - Other keys (including Home and End) do nothing.
  [T]
- **UI7** The todos panel state (form input text, list) persists when switching tabs and back, because panels are hidden and never unmounted. [T]

### Add form
- **UI8** The form is `<form id="add-form" noValidate>` and contains, in DOM order:
  1. `<label for="new-title">New todo</label>`
  2. `<div class="row">` containing `<input id="new-title" name="title" type="text" maxLength=200 autoComplete="off" aria-describedby="form-error">` and `<button type="submit">Add</button>`
  3. `<label for="new-due" class="due-label">Due date (optional)</label>`
  4. `<input id="new-due" name="dueDate" type="date" aria-describedby="form-error">`
  5. `<p id="form-error" class="error">`, which is `hidden` when there is no error
  [T]
- **UI9** Submitting with an empty or whitespace-only title shows "Please enter a todo." in `#form-error` (not hidden). Both inputs get `aria-invalid` and focus moves to `#new-title`. No request is sent. [T]
- **UI10** Submitting a valid title:
  - Clears `#status`.
  - Sends `POST` with `{title: trimmed, dueDate: value || null}`.
  - On success, appends the todo at the end of the list, clears both inputs, focuses `#new-title` and hides `#form-error`.
  [T]
- **UI11** If the create request fails:
  - The server or client error message (for example "Title must be 200 characters or fewer." or "Could not reach the server. Check your connection and try again.") appears in `#form-error`, not in `#status`.
  - Both inputs keep their values and get `aria-invalid`, and focus moves to `#new-title`.
  - A non-Error failure shows "Could not add todo.".
  [T]
- **UI12** Typing in `#new-title` or changing `#new-due` hides `#form-error` and removes `aria-invalid` from both inputs. [T]
- **UI13** `aria-invalid` is present only while a form error is shown. It renders as `aria-invalid="true"`; see open question Q1. The CSS `input[aria-invalid]` red border applies. [T]

### Status and empty
- **UI14** `<p id="status" role="status" aria-live="polite" class="error">` is `hidden` and empty when there is no message. Every action (load, add, toggle, due-date change, delete) clears it when it starts. A failed load, toggle, due-date change or delete shows the error message there; a non-Error failure shows "Something went wrong.". [T]
- **UI15** `<p id="empty">No todos yet. Add one above.</p>` is visible only after a **successful** initial load with zero todos. It is hidden before the load finishes, after a failed load and whenever todos exist. [T]

### List and items
- **UI16** The list is `<ul id="list" aria-label="Todo list">`. Each todo is an `<li>` whose children are, in order:
  1. `<input type="checkbox" id="todo-{id}">`
  2. `<label for="todo-{id}">{title}</label>`
  3. (only when overdue) `<span class="badge overdue-badge">Overdue</span>`
  4. `<input type="date" id="due-{id}" class="due" aria-label='Due date for "{title}"'>`, with value `dueDate` or ""
  5. `<button type="button" class="delete" aria-label='Delete "{title}"'>Delete</button>`
  
  Todos appear in server order. [T]
- **UI17** The `li` class list:
  - contains `done` if the todo is completed
  - contains `overdue` if `!completed && dueDate && dueDate < localToday()` (string comparison against the local calendar date)
  - has no class attribute content when neither applies (an empty or absent class is acceptable)
  
  The Overdue badge appears exactly when the `li` is overdue. [T]
- **UI18** Toggling the checkbox:
  - The checkbox shows the new state immediately.
  - It sends `PATCH {completed}` and, on success, the `li` takes the server state (done class and overdue update).
  - On failure the checkbox reverts to its previous state and `#status` shows the error.
  [T]
- **UI19** Changing the date input sends `PATCH {dueDate: value || null}`, so clearing it sends null. This happens on the native **change** event, as today; see risk R3. On success the item updates (overdue state and badge). On failure the input reverts to the previous server value and `#status` shows the error. [T]
- **UI20** Delete sends `DELETE`. On success the `li` is removed, and when the list becomes empty `#empty` shows. On failure the `li` stays and `#status` shows the error. [T]
- **UI21** Titles are rendered as text, never as HTML: no `dangerouslySetInnerHTML` anywhere. A title like `<img src=x onerror=alert(1)>` shows literally. [T]
- **UI22** On mount the app sends `GET /api/todos` and renders the result. StrictMode's double mount must not render duplicate todos or set state after unmount (use an ignore flag). [T]

### Styling and build
- **UI23** Visual appearance is unchanged. Every selector in `src/style.css` still matches the same elements, including `.row`, `.due-label`, `#new-due`, `li.done`, `li.overdue`, `.badge`, `[role="tab"][aria-selected="true"]` and `[hidden]`.
- **UI24** No `any`, `type` is preferred over `interface` (there is no `interface` in `src/`), and the app uses function components and hooks only. `npm run typecheck`, `npm test` and `npm run build` pass. `server/`, `tests/api.test.ts` and `tests/acceptance/due-dates.api.test.ts` are unchanged (`git diff main -- server tests/api.test.ts tests/acceptance` is empty).
- **UI25** `npm start` serves the built React app from `dist/` at http://127.0.0.1:3000 and it works end-to-end. Data persists after a reload.

## 5. Phases, workers and ownership

### Phase 0 — FOUNDATION (serial, one worker) — task `rc-foundation`
**Owned files:**
- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- `src/main.tsx` (new) and `src/types.ts` (new)
- `tests/setup-dom.ts` (new) and `tests/ui/foundation-smoke.test.tsx` (new)
- Stubs it creates (ownership passes to phase-1 workers): `src/hooks/useTodos.ts`, `src/lib/dates.ts`, `src/components/{AddTodoForm,TodoList,TodoItem,Tabs}.tsx`, `src/App.tsx`
- A one-line edit to `src/api.ts`: replace `export interface Todo {…}` with `import type { Todo } from "./types.ts"; export type { Todo } from "./types.ts";`
- **Deletes** `src/main.ts` and `src/tabs/tab1.ts` (the `src/tabs/` directory). FOUNDATION is the only worker that deletes old files.

`src/vite-env.d.ts` and `src/style.css` are not touched.

**Dependencies.** Only FOUNDATION may add dependencies, all as devDependencies, at the latest stable versions compatible with Vite 8 and TypeScript 7:
- `react`, `react-dom` (19.x) and `@types/react`, `@types/react-dom`
- `@vitejs/plugin-react`
- `jsdom`
- `@testing-library/react`
- `@testing-library/dom`: this is a required peer dependency of @testing-library/react v16+, so it is justified.

Excluded: `@testing-library/user-event` and `@testing-library/jest-dom`. Tests use `fireEvent` and plain `expect`. Nothing else is added. React may go in `dependencies` instead; see Q2.

**Config:**
- tsconfig: add `"jsx": "react-jsx"` and keep everything else, including `include`.
- vite.config.ts: add `plugins: [react()]`, keep `server` and `build`, and set up `test.projects`:
  - `{ extends: true, test: { name: "node", environment: "node", include: ["tests/**/*.test.ts"] } }`
  - `{ extends: true, test: { name: "dom", environment: "jsdom", include: ["tests/**/*.test.tsx"], setupFiles: ["tests/setup-dom.ts"] } }`

  Convention: **`.tsx` tests run in jsdom and `.ts` tests run in node.**
- `tests/setup-dom.ts`: `afterEach(cleanup)` (vitest globals are off) and `vi.unstubAllGlobals()`/`vi.restoreAllMocks()`.
- Smoke test: render `<div>ok</div>` and assert it is in `document`.

**Stubs.** Every stub must typecheck, build and be runtime-safe:
- Components return `null`, except App, which renders `<main>` with nothing inside.
- `useTodos` returns `{ todos: [], loaded: false, status: null }` with actions that resolve `{ok:true}` or `true`.
- `dates.ts` either has a real implementation or returns `""`/`false` (C replaces it either way).

**Definition of done:**
- `npm install` has run and the lockfile is committed.
- `npm run typecheck && npm test && npm run build` pass, and the test run shows both the node and dom projects running.
- Commit on the `rc-foundation` branch. The coordinator fast-forwards or merges it into the base before phase 1. Every phase-1 branch is created from that commit, and every worktree runs `npm ci`.

### Phase 1 — parallel (one worktree and branch each; file ownership is disjoint)
In phase 1, `src/types.ts` and all FOUNDATION config files are **read-only for everyone**. A worker that needs a type change asks the coordinator instead of editing.

| Task | Worker | Owned files (exact) |
|---|---|---|
| `rc-a` | FRONTEND-A | `src/api.ts`, `src/hooks/useTodos.ts` |
| `rc-b` | FRONTEND-B | `src/components/AddTodoForm.tsx` |
| `rc-c` | FRONTEND-C | `src/components/TodoList.tsx`, `src/components/TodoItem.tsx`, `src/lib/dates.ts` |
| `rc-d` | FRONTEND-D | `src/App.tsx`, `src/style.css` |
| `rc-e` | FRONTEND-E | `src/components/Tabs.tsx` |
| `rc-qa` | QA | new files under `tests/ui/` except `foundation-smoke.test.tsx` |
| `rc-docs` | DOCS | `README.md`, `docs/react-architecture.md` (new). Not the contract file and not `docs/due-dates-contract.md`. |
| `rc-e2e` | E2E | `tests/e2e/react-conversion-checklist.md` (new) |

**rc-a: api client and hook (FRONTEND-A)**
- `api.ts` keeps the same request and error semantics:
  - It sets the `Content-Type` header only when there is a body.
  - A network failure throws "Could not reach the server. Check your connection and try again.".
  - A non-ok response throws `body.error` if it is a string, otherwise "Request failed (NNN).".
  - A 204 response returns undefined.
  - It narrows `unknown` instead of using any.
- `useTodos`:
  - Loads once on mount with an ignore flag (UI22).
  - Clears `status` at the start of every action.
  - `add` returns `{ok:false, error}` (using the "Could not add todo." fallback) and does **not** set status on a failed create (UI11).
  - Other actions set status on failure (using the "Something went wrong." fallback) and return false.
  - Success paths update state with the server Todo through functional `setState` and `map`/`filter`.
  - `loaded` becomes true only after a successful list.
- Covers UI10, UI11 (data side), UI14, UI15 (state), UI18–UI20 (data side) and UI22.

**rc-b: AddTodoForm (FRONTEND-B)**
- Covers UI8–UI13 exactly.
- Uses controlled inputs and a ref to focus the title input.
- Trims the title and passes `dueDate || null`.

**rc-c: TodoList, TodoItem and dates (FRONTEND-C)**
- Covers UI16–UI21.
- `localToday` uses the local date with zero padding. `isOverdue` is a pure function.
- Checkbox: keep local draft state so the click shows immediately, revert when the action returns false, and re-sync from `todo.completed` with an effect.
- Date input: same draft approach, but commit on the native `change` event (attach a listener through a ref in `useEffect`). React's `onChange` alone is not enough because it fires on `input`; see R3.

**rc-d: App and styles (FRONTEND-D)**
- Covers UI1–UI4 (markup), UI7, UI14, UI15 and UI23.
- Holds the tab state and renders the panels, `#status` and `#empty` from `useTodos`.
- `style.css` keeps every existing rule. Only change a rule if a React markup difference requires it, and justify the change.

**rc-e: Tabs (FRONTEND-E)**
- Covers UI2, UI3, UI5 and UI6.
- Generic over `tabs`; it has no knowledge of the todo app.

**rc-qa: QA**
- Writes jsdom tests (`tests/ui/*.test.tsx`) for every [T] criterion **from this contract only**:
  - Render `<App/>` (and individual components through their props).
  - Stub `fetch` with `vi.stubGlobal`.
  - Use `fireEvent` and `findBy*`/`waitFor`.
  - Pin the date with `vi.setSystemTime` (or `vi.useFakeTimers({ toFake: ["Date"] })`) for the overdue tests.
- Pure `dates.ts` tests may go in `tests/ui/dates.test.ts` (node project).
- On the QA branch the tests are expected to FAIL against the stubs. Report which ones fail and why, and that they pass after integration if possible. `npm run typecheck` must pass.

**rc-docs: DOCS**
- Updates the README with the React stack and dev/test notes: `.tsx` tests run in jsdom, and the scripts are unchanged.
- Keeps the API section as is.
- `docs/react-architecture.md` gives a component tree and a file map.

**rc-e2e: E2E (phase 1)**
- Writes a step-by-step browser checklist for UI1–UI25.
- Runs it only after integration.

**Definition of done for every phase-1 frontend worker:**
- The owned files implement the contract and nothing outside them changes (`git diff --name-only base...HEAD` is a subset of the owned files).
- `npm run typecheck`, `npm test` and `npm run build` pass on the branch. Other components are still stubs there, so browser checks are optional, and a worker must not claim browser checks it did not run.
- No `any`, `interface`, `innerHTML` or `dangerouslySetInnerHTML`.
- Commit with the Copilot co-author trailer. Everything stays local.

The agent files at `.github/agents/*.agent.md` list default ownership (for example, frontend.agent.md lists `src/main.ts` and forbids dependencies). The ownership in **this contract overrides them**, and the coordinator should say so in each dispatch.

### Phase 2 — REVIEW (parallel, read-only)
- One `reviewer` per branch (`rc-a` … `rc-e`, `rc-qa`, `rc-docs`). It checks the diff against this contract, ownership and the ACs.
- One `security` worker over the frontend branches (or the merged result). It checks for XSS (no `dangerouslySetInnerHTML`), that `server/` is untouched, and that no new runtime dependencies were added beyond Q2.

### Phase 3 — INTEGRATION (integrator), merge order
Base = `rc-foundation`, already merged. Then merge, in order:
1. `rc-a`
2. `rc-c`
3. `rc-b`
4. `rc-e`
5. `rc-d`
6. `rc-qa`
7. `rc-docs`
8. `rc-e2e`

This order merges leaves first and App last. The files are disjoint, so there should be no conflicts. If one occurs, keep each owner's file version and escalate if that is not possible. After each frontend merge `npm run typecheck` must pass. After the final merge `npm run typecheck && npm test && npm run build` must pass with all QA tests green, plus the UI24 diff check.

### Phase 4 — E2E on the merged result
- Run `DB_FILE=/tmp/e2e-react.db npm run dev` and check UI1–UI23 in Orca's browser.
- Check UI25 with `npm run build`, then `DB_FILE=/tmp/e2e-react.db PORT=<free> tsx server/index.ts`.
- Produce a pass/fail table with screenshots.
- Clean up the database and stop the servers.

## 6. Risks
- **R1** Version compatibility between Vite 8, Vitest 5, TypeScript 7 (native tsc), @vitejs/plugin-react and React 19 types. FOUNDATION must verify peer ranges and that the `test.projects` and `extends: true` syntax works on the installed Vitest. If it does not, the fallback is a per-file `// @vitest-environment jsdom` docblock plus a single include of `tests/**/*.test.{ts,tsx}`. FOUNDATION must record the chosen convention in its report.
- **R2** React's controlled checkbox snaps back until the server responds unless TodoItem keeps a draft. Without a draft this would be a visible regression of UI18.
- **R3** On date inputs, React's `onChange` maps to the `input` event. While a user types a year digit by digit, that could PATCH intermediate dates such as `0002-…`. The current app listens to native `change`. FRONTEND-C must preserve that, and E2E must test keyboard date entry.
- **R4** StrictMode double-mounts in dev, which causes a double GET. This is harmless only if the hook ignores stale results.
- **R5** Focus: the old code re-rendered the whole list after every action, which lost focus. React keeps focus. This is an improvement, not a regression; the reviewer should not flag it.
- **R6** QA tests fail on the QA branch by design. The reviewer and integrator must judge them after the merge.
- **R7** Agent files still point at `docs/due-dates-contract.md`. The coordinator must commit `docs/react-conversion-contract.md` to the base before phase 1 and name it in every dispatch.
- **R8** Every new worktree needs `npm ci`; `node_modules` is absent.
- **R9** If `@types/react` exposes no global `JSX` namespace, use `ReactNode` return types as specified.

## 7. Open questions for the coordinator
- **Q1** `aria-invalid`: today it is set as an empty attribute through `toggleAttribute`, which assistive tech treats as "false". React will render `aria-invalid="true"`. The CSS selector matches either way. I recommend accepting `"true"` as an a11y fix. Alternatively, require `aria-invalid=""` to preserve the old output exactly.
- **Q2** `react` and `react-dom` are runtime libraries, so they arguably belong in `dependencies` rather than devDependencies. Vite bundles them either way. I recommend `dependencies`.
- **Q3** Splitting Tabs into its own worker (rc-e) adds parallelism. Alternatively, fold Tabs into rc-d to reduce reviews.
- **Q4** Should FRONTEND workers also add their own unit tests? The plan says no (QA owns `tests/`, to keep ownership disjoint).

## 8. Coordinator decisions (approved 2026-11-19)
- **Q1** Accept `aria-invalid="true"` (a11y fix). UI13 is satisfied by `aria-invalid="true"` while an error is shown and no attribute otherwise.
- **Q2** `react` and `react-dom` go in `dependencies`; everything else (types, plugin, jsdom, testing-library) in `devDependencies`.
- **Q3** Tabs stays a separate worker (`rc-e`).
- **Q4** Frontend workers do not write tests; QA owns `tests/ui/` (FOUNDATION owns only `tests/setup-dom.ts` and `tests/ui/foundation-smoke.test.tsx`).
- Base branch for this release is `dmorale-ampol/react-update`; read `main` in UI24's diff check as this base's pre-foundation commit `88172c0`.
- Everything is local: no push, PR or deploy. `release` is not run.

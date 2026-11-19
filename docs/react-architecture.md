# React architecture

The frontend is React 19 + Vite + TypeScript, using function components and hooks only. The API is unchanged. Source of truth: [react-conversion-contract.md](react-conversion-contract.md).

## Component tree

```
index.html            <div id="root"> + <script type="module" src="/src/main.tsx">
└─ main.tsx           createRoot(root).render(<StrictMode><App/></StrictMode>), imports style.css
   └─ App             <main>; owns selected-tab state (initially 0); calls useTodos()
      ├─ Tabs         <div role="tablist" aria-label="Sections" id="tabs">, 4 tab buttons
      ├─ section#panel-todos (role="tabpanel", aria-labelledby="tab-todos")
      │  ├─ <h1>Todos</h1>
      │  ├─ AddTodoForm   #add-form; owns form-error state; calls onAdd
      │  ├─ p#status      role="status", aria-live="polite"
      │  ├─ p#empty       "No todos yet. Add one above."
      │  └─ TodoList      ul#list; computes today = localToday() once per render
      │     └─ TodoItem   one <li> per todo (key = todo.id)
      ├─ section#panel-1  button#btn-a "A"
      ├─ section#panel-2  button#btn-b "B"
      └─ section#panel-3  button#btn-c "C"
```

All four panels are always rendered; inactive ones get `hidden` and are never unmounted, so todos panel state persists across tab switches.

Tabs: `tab-todos`/`panel-todos`/"Todos", `tab-1`/`panel-1`/"Tab 1", `tab-2`/`panel-2`/"Tab 2", `tab-3`/`panel-3`/"Tab 3". Tabs handles click, ArrowLeft/ArrowRight (wrapping) and focus using refs, and is generic over its `tabs` prop.

## File map

| File | Exports | Role |
|---|---|---|
| `src/types.ts` | `Todo`, `ActionResult`, `TodosState`, `AddTodoFormProps`, `TodoListProps`, `TodoItemProps`, `TabDef`, `TabsProps` | Shared types |
| `src/api.ts` | `api`, `type Todo` | Fetch client: `list`, `create`, `setDueDate`, `setCompleted`, `remove` |
| `src/hooks/useTodos.ts` | `useTodos(): TodosState` | Loads todos on mount, holds `todos`/`loaded`/`status`, exposes `add`, `setCompleted`, `setDueDate`, `remove` |
| `src/lib/dates.ts` | `localToday(now?)`, `isOverdue(todo, today)` | Local `YYYY-MM-DD` date and overdue check |
| `src/components/AddTodoForm.tsx` | `AddTodoForm(props: AddTodoFormProps)` | Add form and form error |
| `src/components/TodoList.tsx` | `TodoList(props: TodoListProps)` | Todo list |
| `src/components/TodoItem.tsx` | `TodoItem(props: TodoItemProps)` | One todo row |
| `src/components/Tabs.tsx` | `Tabs(props: TabsProps)` | Tab list |
| `src/App.tsx` | `App()` | Layout, tab state, panels, `#status`, `#empty` |
| `src/main.tsx` | — | Entry point; throws a clear Error if `#root` is missing |
| `src/style.css` | — | Styles (unchanged selectors) |

Components return `ReactNode`; all exports are named and imports use `.ts`/`.tsx` extensions.

## Data flow

- `useTodos` sends `GET /api/todos` on mount, ignoring stale results (safe under StrictMode's double mount). `loaded` becomes true only after a successful load.
- Every action clears `status` when it starts. `add` returns `ActionResult` and shows failures in `#form-error`, not `#status`. `setCompleted`, `setDueDate` and `remove` return `false` on failure and set `status`.
- `TodoItem` keeps local drafts for the checkbox and due date so changes show immediately and revert on failure. The due date is committed on the native `change` event.
- Titles are rendered as text; `dangerouslySetInnerHTML` is not used.

## Tests

- `tests/**/*.test.ts` run in the `node` project (API, persistence, pure `dates.ts` tests).
- `tests/**/*.test.tsx` run in the `dom` project (jsdom, setup `tests/setup-dom.ts`) and render components with `@testing-library/react`, stubbing `fetch` with `vi.stubGlobal`.

import { useState, type ReactNode } from "react";
import { AddTodoForm } from "./components/AddTodoForm.tsx";
import { Tabs } from "./components/Tabs.tsx";
import { TodoList } from "./components/TodoList.tsx";
import { useTodos } from "./hooks/useTodos.ts";
import type { TabDef } from "./types.ts";

const TODOS_TAB: TabDef = { id: "tab-todos", panelId: "panel-todos", label: "Todos" };

type ButtonPanel = { readonly tab: TabDef; readonly buttonId: string; readonly buttonLabel: string };

const BUTTON_PANELS: readonly ButtonPanel[] = [
  { tab: { id: "tab-1", panelId: "panel-1", label: "Tab 1" }, buttonId: "btn-a", buttonLabel: "A" },
  { tab: { id: "tab-2", panelId: "panel-2", label: "Tab 2" }, buttonId: "btn-b", buttonLabel: "B" },
  { tab: { id: "tab-3", panelId: "panel-3", label: "Tab 3" }, buttonId: "btn-c", buttonLabel: "C" },
];

const TABS: readonly TabDef[] = [TODOS_TAB, ...BUTTON_PANELS.map((panel) => panel.tab)];

export function App(): ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { todos, loaded, status, add, setCompleted, setDueDate, remove } = useTodos();

  return (
    <main>
      <Tabs tabs={TABS} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
      <section
        role="tabpanel"
        id={TODOS_TAB.panelId}
        aria-labelledby={TODOS_TAB.id}
        hidden={selectedIndex !== 0}
      >
        <h1>Todos</h1>
        <AddTodoForm onAdd={add} />
        <p id="status" role="status" aria-live="polite" className="error" hidden={status === null}>
          {status ?? ""}
        </p>
        <p id="empty" hidden={!loaded || todos.length > 0}>
          No todos yet. Add one above.
        </p>
        <TodoList
          todos={todos}
          onToggle={setCompleted}
          onDueDateChange={setDueDate}
          onDelete={remove}
        />
      </section>
      {BUTTON_PANELS.map(({ tab, buttonId, buttonLabel }, i) => (
        <section
          key={tab.id}
          role="tabpanel"
          id={tab.panelId}
          aria-labelledby={tab.id}
          hidden={selectedIndex !== i + 1}
        >
          <button type="button" id={buttonId}>
            {buttonLabel}
          </button>
        </section>
      ))}
    </main>
  );
}

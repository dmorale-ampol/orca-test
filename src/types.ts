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

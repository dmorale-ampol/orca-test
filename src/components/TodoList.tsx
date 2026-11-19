import type { ReactNode } from "react";
import type { TodoListProps } from "../types.ts";
import { localToday } from "../lib/dates.ts";
import { TodoItem } from "./TodoItem.tsx";

export function TodoList({ todos, onToggle, onDueDateChange, onDelete }: TodoListProps): ReactNode {
  const today = localToday();
  return (
    <ul id="list" aria-label="Todo list">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          today={today}
          onToggle={(completed) => onToggle(todo.id, completed)}
          onDueDateChange={(dueDate) => onDueDateChange(todo.id, dueDate)}
          onDelete={() => onDelete(todo.id)}
        />
      ))}
    </ul>
  );
}

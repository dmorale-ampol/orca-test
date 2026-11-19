import type { Todo } from "../types.ts";

const pad2 = (n: number): string => String(n).padStart(2, "0");

export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// Dates are YYYY-MM-DD, so string comparison matches calendar order.
export function isOverdue(todo: Todo, today: string): boolean {
  return !todo.completed && todo.dueDate !== null && todo.dueDate !== "" && todo.dueDate < today;
}

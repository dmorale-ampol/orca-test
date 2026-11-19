import type { TodosState } from "../types.ts";

// FOUNDATION stub: implemented by rc-a.
export function useTodos(): TodosState {
  return {
    todos: [],
    loaded: false,
    status: null,
    add: async () => ({ ok: true }),
    setCompleted: async () => true,
    setDueDate: async () => true,
    remove: async () => true,
  };
}

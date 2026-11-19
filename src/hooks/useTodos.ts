import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.ts";
import type { ActionResult, Todo, TodosState } from "../types.ts";

const ACTION_FALLBACK = "Something went wrong.";
const ADD_FALLBACK = "Could not add todo.";

const messageOf = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const replaceTodo =
  (updated: Todo) =>
  (todos: readonly Todo[]): readonly Todo[] =>
    todos.map((t) => (t.id === updated.id ? updated : t));

export function useTodos(): TodosState {
  const [todos, setTodos] = useState<readonly Todo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api.list().then(
      (list) => {
        if (ignore) return;
        setTodos(list);
        setLoaded(true);
      },
      (err: unknown) => {
        if (!ignore) setStatus(messageOf(err, ACTION_FALLBACK));
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    setStatus(null);
    try {
      await action();
      return true;
    } catch (err) {
      setStatus(messageOf(err, ACTION_FALLBACK));
      return false;
    }
  }, []);

  const add = useCallback(async (title: string, dueDate: string | null): Promise<ActionResult> => {
    setStatus(null);
    try {
      const created = await api.create(title, dueDate);
      setTodos((prev) => [...prev, created]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: messageOf(err, ADD_FALLBACK) };
    }
  }, []);

  const setCompleted = useCallback(
    (id: number, completed: boolean) =>
      run(async () => {
        const updated = await api.setCompleted(id, completed);
        setTodos(replaceTodo(updated));
      }),
    [run],
  );

  const setDueDate = useCallback(
    (id: number, dueDate: string | null) =>
      run(async () => {
        const updated = await api.setDueDate(id, dueDate);
        setTodos(replaceTodo(updated));
      }),
    [run],
  );

  const remove = useCallback(
    (id: number) =>
      run(async () => {
        await api.remove(id);
        setTodos((prev) => prev.filter((t) => t.id !== id));
      }),
    [run],
  );

  return useMemo(
    () => ({ todos, loaded, status, add, setCompleted, setDueDate, remove }),
    [todos, loaded, status, add, setCompleted, setDueDate, remove],
  );
}

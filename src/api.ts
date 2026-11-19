import type { Todo } from "./types.ts";
export type { Todo } from "./types.ts";

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

const errorMessageOf = (body: unknown): string | null =>
  typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
    ? body.error
    : null;

async function readErrorMessage(res: Response): Promise<string> {
  const fallback = `Request failed (${res.status}).`;
  try {
    const body: unknown = await res.json();
    return errorMessageOf(body) ?? fallback;
  } catch {
    return fallback;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json();
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api: {
  list(): Promise<Todo[]>;
  create(title: string, dueDate?: string | null): Promise<Todo>;
  setDueDate(id: number, dueDate: string | null): Promise<Todo>;
  setCompleted(id: number, completed: boolean): Promise<Todo>;
  remove(id: number): Promise<void>;
} = {
  list: () => request<Todo[]>("/api/todos"),
  create: (title, dueDate) => request<Todo>("/api/todos", json("POST", { title, dueDate: dueDate ?? null })),
  setDueDate: (id, dueDate) => request<Todo>(`/api/todos/${id}`, json("PATCH", { dueDate })),
  setCompleted: (id, completed) => request<Todo>(`/api/todos/${id}`, json("PATCH", { completed })),
  remove: (id) => request<void>(`/api/todos/${id}`, { method: "DELETE" }),
};

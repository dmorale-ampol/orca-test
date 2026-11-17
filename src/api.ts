export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  list: () => request<Todo[]>("/api/todos"),
  create: (title: string) =>
    request<Todo>("/api/todos", { method: "POST", body: JSON.stringify({ title }) }),
  setCompleted: (id: number, completed: boolean) =>
    request<Todo>(`/api/todos/${id}`, { method: "PATCH", body: JSON.stringify({ completed }) }),
  remove: (id: number) => request<void>(`/api/todos/${id}`, { method: "DELETE" }),
};

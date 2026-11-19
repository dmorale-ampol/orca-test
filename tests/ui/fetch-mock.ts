import { vi } from "vitest";
import type { Todo } from "../../src/types.ts";

export type FetchCall = { readonly method: string; readonly url: string; readonly body: unknown };
export type Route = (call: FetchCall) => Promise<Response> | Response | undefined;

export type MockApi = {
  readonly calls: FetchCall[];
  readonly todos: () => readonly Todo[];
  readonly use: (route: Route) => void;
  readonly callsTo: (method: string) => FetchCall[];
};

export const CREATED_AT = "2026-06-01T09:00:00.000Z";

export function makeTodo(partial: Partial<Todo> & Pick<Todo, "id" | "title">): Todo {
  return { completed: false, createdAt: CREATED_AT, dueDate: null, ...partial };
}

export function json(status: number, body: unknown): Response {
  return status === 204
    ? new Response(null, { status })
    : new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
};

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed;
  } catch {
    return body;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** In-memory fake of the todo API, installed as global fetch. Routes added with `use` run first. */
export function mockApi(initial: readonly Todo[] = []): MockApi {
  let store: Todo[] = [...initial];
  const routes: Route[] = [];
  const calls: FetchCall[] = [];

  const fallback = (call: FetchCall): Response => {
    const match = /^\/api\/todos(?:\/(\d+))?$/.exec(call.url.replace(/^https?:\/\/[^/]+/, ""));
    if (!match) return json(404, { error: "Not found." });
    const id = match[1] === undefined ? undefined : Number(match[1]);
    if (id === undefined && call.method === "GET") return json(200, store);
    if (id === undefined && call.method === "POST" && isRecord(call.body)) {
      const nextId = store.reduce((max, t) => Math.max(max, t.id), 0) + 1;
      const title = typeof call.body.title === "string" ? call.body.title : "";
      const dueDate = typeof call.body.dueDate === "string" ? call.body.dueDate : null;
      const created = makeTodo({ id: nextId, title, dueDate });
      store = [...store, created];
      return json(201, created);
    }
    const existing = store.find((t) => t.id === id);
    if (!existing) return json(404, { error: "Todo not found." });
    if (call.method === "PATCH" && isRecord(call.body)) {
      const body = call.body;
      const updated: Todo = {
        ...existing,
        ...(typeof body.completed === "boolean" ? { completed: body.completed } : {}),
        ...("dueDate" in body ? { dueDate: typeof body.dueDate === "string" ? body.dueDate : null } : {}),
      };
      store = store.map((t) => (t.id === id ? updated : t));
      return json(200, updated);
    }
    if (call.method === "DELETE") {
      store = store.filter((t) => t.id !== id);
      return json(204, null);
    }
    return json(400, { error: "Bad request." });
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const call: FetchCall = {
      method: (init?.method ?? "GET").toUpperCase(),
      url: urlOf(input),
      body: parseBody(init?.body),
    };
    calls.push(call);
    for (const route of routes) {
      const result = route(call);
      if (result !== undefined) return result;
    }
    return fallback(call);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    todos: () => store,
    use: (route) => {
      routes.unshift(route);
    },
    callsTo: (method) => calls.filter((c) => c.method === method),
  };
}

/** A Response-like object whose json() rejects with a non-Error value. */
export function nonErrorResponse(status: number): Response {
  const fake: Pick<Response, "ok" | "status" | "json"> = {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject("not-an-error"),
  };
  return fake as Response;
}

import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "../../src/App.tsx";
import { TodoItem } from "../../src/components/TodoItem.tsx";
import { TodoList } from "../../src/components/TodoList.tsx";
import type { Todo } from "../../src/types.ts";
import { byId, deleteButton, inputById, isHidden, itemFor, items, statusText, tick, waitForItems } from "./dom.ts";
import { deferred, json, makeTodo, mockApi, nonErrorResponse } from "./fetch-mock.ts";

// Local "today" is pinned to 2026-06-15 for every test in this file.
const TODAY = "2026-06-15";
const YESTERDAY = "2026-06-14";
const TOMORROW = "2026-06-16";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

const noop = async (): Promise<boolean> => true;

function expectStatus(message: string): void {
  const status = byId("status");
  expect(isHidden(status)).toBe(false);
  expect(status.textContent).toBe(message);
}

function expectStatusCleared(): void {
  const status = byId("status");
  expect(status.hasAttribute("hidden")).toBe(true);
  expect(status.textContent).toBe("");
}

function checkbox(id: number): HTMLInputElement {
  return inputById(`todo-${id}`);
}

function dueInput(id: number): HTMLInputElement {
  return inputById(`due-${id}`);
}

function badge(li: Element): Element | null {
  return li.querySelector(".overdue-badge");
}

describe("UI14 #status", () => {
  test("UI14 markup: role=status, aria-live=polite, class error, hidden and empty with no message", async () => {
    mockApi([]);
    render(<App />);
    const status = byId("status");
    expect(status.tagName).toBe("P");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.classList.contains("error")).toBe(true);
    await waitFor(() => expect(isHidden(document.getElementById("empty"))).toBe(false));
    expectStatusCleared();
  });

  test("UI14 failed load shows the server error", async () => {
    const server = mockApi([]);
    server.use((call) => (call.method === "GET" ? json(500, { error: "Database unavailable." }) : undefined));
    render(<App />);
    await waitFor(() => expectStatus("Database unavailable."));
  });

  test("UI14 failed load with no error body shows 'Request failed (NNN).'", async () => {
    const server = mockApi([]);
    server.use((call) => (call.method === "GET" ? new Response("oops", { status: 503 }) : undefined));
    render(<App />);
    await waitFor(() => expectStatus("Request failed (503)."));
  });

  test("UI14 a non-Error failure shows 'Something went wrong.'", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A" })]);
    render(<App />);
    await waitForItems(1);
    server.use((call) => (call.method === "PATCH" ? nonErrorResponse(200) : undefined));
    fireEvent.click(checkbox(1));
    await waitFor(() => expectStatus("Something went wrong."));
  });

  test("UI14 every action clears #status when it starts", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A" }), makeTodo({ id: 2, title: "B" })]);
    render(<App />);
    await waitForItems(2);

    const fail = (): void => {
      server.use((call) => (call.method !== "GET" ? json(500, { error: "Boom." }) : undefined));
    };
    const pending = deferred<Response>();
    const hold = (): void => {
      server.use((call) => (call.method !== "GET" ? pending.promise : undefined));
    };

    // toggle starts → cleared
    fail();
    fireEvent.click(deleteButton(itemFor(1)));
    await waitFor(() => expectStatus("Boom."));
    hold();
    fireEvent.click(checkbox(2));
    await waitFor(() => expectStatusCleared());

    // due-date change starts → cleared
    fail();
    fireEvent.click(deleteButton(itemFor(1)));
    await waitFor(() => expectStatus("Boom."));
    hold();
    fireEvent.change(dueInput(1), { target: { value: TOMORROW } });
    await waitFor(() => expectStatusCleared());

    // delete starts → cleared
    fail();
    fireEvent.click(checkbox(1));
    await waitFor(() => expectStatus("Boom."));
    hold();
    fireEvent.click(deleteButton(itemFor(1)));
    await waitFor(() => expectStatusCleared());

    // add starts → cleared
    fail();
    fireEvent.click(checkbox(1));
    await waitFor(() => expectStatus("Boom."));
    hold();
    fireEvent.change(inputById("new-title"), { target: { value: "C" } });
    fireEvent.submit(byId("add-form"));
    await waitFor(() => expectStatusCleared());
  });
});

describe("UI15 #empty", () => {
  test("UI15 hidden while the initial load is pending, visible after an empty successful load", async () => {
    const server = mockApi([]);
    const gate = deferred<Response>();
    server.use((call) => (call.method === "GET" ? gate.promise : undefined));
    render(<App />);
    await tick();
    expect(isHidden(document.getElementById("empty"))).toBe(true);
    await act(async () => gate.resolve(json(200, [])));
    await waitFor(() => expect(isHidden(document.getElementById("empty"))).toBe(false));
    const empty = byId("empty");
    expect(empty.tagName).toBe("P");
    expect(empty.textContent).toBe("No todos yet. Add one above.");
  });

  test("UI15 hidden after a failed load", async () => {
    const server = mockApi([]);
    server.use((call) => (call.method === "GET" ? json(500, { error: "Down." }) : undefined));
    render(<App />);
    await waitFor(() => expectStatus("Down."));
    expect(isHidden(document.getElementById("empty"))).toBe(true);
  });

  test("UI15 visible after an empty load, hidden once a todo is added", async () => {
    mockApi([]);
    render(<App />);
    await waitFor(() => expect(isHidden(document.getElementById("empty"))).toBe(false));
    fireEvent.change(inputById("new-title"), { target: { value: "One" } });
    fireEvent.submit(byId("add-form"));
    await waitForItems(1);
    expect(isHidden(document.getElementById("empty"))).toBe(true);
  });
});

describe("UI16 list and item markup", () => {
  const todos: readonly Todo[] = [
    makeTodo({ id: 3, title: "Third by id", dueDate: YESTERDAY }),
    makeTodo({ id: 1, title: "First by id", dueDate: TOMORROW }),
    makeTodo({ id: 2, title: "No date" }),
  ];

  function expectItem(li: HTMLLIElement, todo: Todo, overdue: boolean): void {
    const kids = Array.from(li.children);
    expect(kids).toHaveLength(overdue ? 5 : 4);
    const [cb, label, ...rest] = kids;
    const maybeBadge = overdue ? rest.shift() : undefined;
    const [date, del] = rest;

    expect(cb instanceof HTMLInputElement && cb.type === "checkbox").toBe(true);
    expect(cb?.id).toBe(`todo-${todo.id}`);
    expect(label?.tagName).toBe("LABEL");
    expect(label?.getAttribute("for")).toBe(`todo-${todo.id}`);
    expect(label?.textContent).toBe(todo.title);
    if (overdue) {
      expect(maybeBadge?.tagName).toBe("SPAN");
      expect(maybeBadge?.classList.contains("badge")).toBe(true);
      expect(maybeBadge?.classList.contains("overdue-badge")).toBe(true);
      expect(maybeBadge?.textContent).toBe("Overdue");
    }
    expect(date instanceof HTMLInputElement && date.type === "date").toBe(true);
    expect(date?.id).toBe(`due-${todo.id}`);
    expect(date?.classList.contains("due")).toBe(true);
    expect(date?.getAttribute("aria-label")).toBe(`Due date for "${todo.title}"`);
    expect(date instanceof HTMLInputElement ? date.value : null).toBe(todo.dueDate ?? "");
    expect(del?.tagName).toBe("BUTTON");
    expect(del?.getAttribute("type")).toBe("button");
    expect(del?.classList.contains("delete")).toBe(true);
    expect(del?.getAttribute("aria-label")).toBe(`Delete "${todo.title}"`);
    expect(del?.textContent).toBe("Delete");
  }

  test("UI16 TodoList renders <ul id=list aria-label> with items in given order", () => {
    const { container } = render(
      <TodoList todos={todos} onToggle={noop} onDueDateChange={noop} onDelete={noop} />,
    );
    const ul = container.querySelector("ul");
    expect(ul?.id).toBe("list");
    expect(ul?.getAttribute("aria-label")).toBe("Todo list");
    const lis = items();
    expect(lis).toHaveLength(3);
    expectItem(lis[0] as HTMLLIElement, todos[0] as Todo, true);
    expectItem(lis[1] as HTMLLIElement, todos[1] as Todo, false);
    expectItem(lis[2] as HTMLLIElement, todos[2] as Todo, false);
  });

  test("UI16 App renders todos in server order", async () => {
    mockApi(todos);
    render(<App />);
    const lis = await waitForItems(3);
    expect(lis.map((li) => li.querySelector("label")?.textContent)).toEqual(todos.map((t) => t.title));
    expectItem(lis[0] as HTMLLIElement, todos[0] as Todo, true);
  });

  test("UI16 TodoItem renders one <li>", () => {
    const { container } = render(
      <ul>
        <TodoItem todo={todos[2] as Todo} today={TODAY} onToggle={noop} onDueDateChange={noop} onDelete={noop} />
      </ul>,
    );
    const lis = container.querySelectorAll("li");
    expect(lis).toHaveLength(1);
    expectItem(lis[0] as HTMLLIElement, todos[2] as Todo, false);
  });
});

describe("UI17 classes and badge", () => {
  const cases: ReadonlyArray<readonly [string, Todo, boolean, boolean]> = [
    ["overdue", makeTodo({ id: 1, title: "late", dueDate: YESTERDAY }), false, true],
    ["due today", makeTodo({ id: 2, title: "today", dueDate: TODAY }), false, false],
    ["due tomorrow", makeTodo({ id: 3, title: "later", dueDate: TOMORROW }), false, false],
    ["done and past", makeTodo({ id: 4, title: "done", completed: true, dueDate: YESTERDAY }), true, false],
    ["no date", makeTodo({ id: 5, title: "none" }), false, false],
  ];

  test.each(cases)("UI17 TodoItem (%s) via today prop", (_name, todo, done, overdue) => {
    render(
      <ul>
        <TodoItem todo={todo} today={TODAY} onToggle={noop} onDueDateChange={noop} onDelete={noop} />
      </ul>,
    );
    const li = itemFor(todo.id);
    expect(li.classList.contains("done")).toBe(done);
    expect(li.classList.contains("overdue")).toBe(overdue);
    expect(badge(li) !== null).toBe(overdue);
    if (!done && !overdue) expect(li.className.trim()).toBe("");
  });

  test("UI17 TodoItem compares against the today prop, not the clock", () => {
    const todo = makeTodo({ id: 9, title: "x", dueDate: TODAY });
    render(
      <ul>
        <TodoItem todo={todo} today={TOMORROW} onToggle={noop} onDueDateChange={noop} onDelete={noop} />
      </ul>,
    );
    expect(itemFor(9).classList.contains("overdue")).toBe(true);
    expect(badge(itemFor(9))?.textContent).toBe("Overdue");
  });

  test("UI17 TodoList and App use the local date (pinned clock)", async () => {
    mockApi(cases.map(([, t]) => t));
    render(<App />);
    await waitForItems(cases.length);
    cases.forEach(([name, todo, done, overdue]) => {
      const li = itemFor(todo.id);
      expect(li.classList.contains("done"), name).toBe(done);
      expect(li.classList.contains("overdue"), name).toBe(overdue);
      expect(badge(li) !== null, name).toBe(overdue);
    });
  });
});

describe("UI18 toggle", () => {
  test("UI18 the checkbox updates immediately, PATCHes {completed}, then takes the server state", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "late", dueDate: YESTERDAY })]);
    render(<App />);
    await waitForItems(1);
    const gate = deferred<void>();
    server.use((call) => {
      if (call.method !== "PATCH") return undefined;
      return gate.promise.then(() => json(200, { ...makeTodo({ id: 1, title: "late", dueDate: YESTERDAY }), completed: true }));
    });

    expect(itemFor(1).classList.contains("overdue")).toBe(true);
    fireEvent.click(checkbox(1));
    expect(checkbox(1).checked).toBe(true);
    await waitFor(() => expect(server.callsTo("PATCH")).toHaveLength(1));
    expect(server.callsTo("PATCH")[0]).toMatchObject({ url: "/api/todos/1", body: { completed: true } });
    expect(checkbox(1).checked).toBe(true);

    await act(async () => gate.resolve());
    await waitFor(() => expect(itemFor(1).classList.contains("done")).toBe(true));
    expect(itemFor(1).classList.contains("overdue")).toBe(false);
    expect(badge(itemFor(1))).toBeNull();
    expect(checkbox(1).checked).toBe(true);
  });

  test("UI18 unchecking sends {completed:false} and removes done", async () => {
    mockApi([makeTodo({ id: 1, title: "done", completed: true })]);
    render(<App />);
    await waitForItems(1);
    expect(checkbox(1).checked).toBe(true);
    fireEvent.click(checkbox(1));
    await waitFor(() => expect(itemFor(1).classList.contains("done")).toBe(false));
    expect(checkbox(1).checked).toBe(false);
  });

  test("UI18 on failure the checkbox reverts and #status shows the error", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A" })]);
    render(<App />);
    await waitForItems(1);
    server.use((call) => (call.method === "PATCH" ? json(500, { error: "Could not save." }) : undefined));
    fireEvent.click(checkbox(1));
    await waitFor(() => expectStatus("Could not save."));
    expect(checkbox(1).checked).toBe(false);
    expect(itemFor(1).classList.contains("done")).toBe(false);
  });

  test("UI18 TodoItem reverts its draft when onToggle resolves false", async () => {
    const onToggle = vi.fn(async () => false);
    render(
      <ul>
        <TodoItem todo={makeTodo({ id: 1, title: "A" })} today={TODAY} onToggle={onToggle} onDueDateChange={noop} onDelete={noop} />
      </ul>,
    );
    fireEvent.click(checkbox(1));
    expect(onToggle).toHaveBeenCalledWith(true);
    await waitFor(() => expect(checkbox(1).checked).toBe(false));
  });
});

describe("UI19 due-date change", () => {
  test("UI19 change PATCHes {dueDate} and updates overdue state and badge", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A", dueDate: TOMORROW })]);
    render(<App />);
    await waitForItems(1);
    expect(itemFor(1).classList.contains("overdue")).toBe(false);
    fireEvent.change(dueInput(1), { target: { value: YESTERDAY } });
    await waitFor(() => expect(server.callsTo("PATCH")).toHaveLength(1));
    expect(server.callsTo("PATCH")[0]).toMatchObject({ url: "/api/todos/1", body: { dueDate: YESTERDAY } });
    await waitFor(() => expect(itemFor(1).classList.contains("overdue")).toBe(true));
    expect(badge(itemFor(1))?.textContent).toBe("Overdue");
    expect(dueInput(1).value).toBe(YESTERDAY);
  });

  test("UI19 clearing the date sends null", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A", dueDate: YESTERDAY })]);
    render(<App />);
    await waitForItems(1);
    expect(itemFor(1).classList.contains("overdue")).toBe(true);
    fireEvent.change(dueInput(1), { target: { value: "" } });
    await waitFor(() => expect(server.callsTo("PATCH")).toHaveLength(1));
    expect(server.callsTo("PATCH")[0]?.body).toEqual({ dueDate: null });
    await waitFor(() => expect(itemFor(1).classList.contains("overdue")).toBe(false));
    expect(badge(itemFor(1))).toBeNull();
    expect(dueInput(1).value).toBe("");
  });

  test("UI19 an input event alone (no native change) sends nothing (R3)", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A", dueDate: TOMORROW })]);
    render(<App />);
    await waitForItems(1);
    fireEvent.input(dueInput(1), { target: { value: "0002-06-10" } });
    await tick();
    expect(server.callsTo("PATCH")).toHaveLength(0);
  });

  test("UI19 on failure the input reverts to the server value and #status shows the error", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A", dueDate: TOMORROW })]);
    render(<App />);
    await waitForItems(1);
    server.use((call) => (call.method === "PATCH" ? json(400, { error: "Invalid date." }) : undefined));
    fireEvent.change(dueInput(1), { target: { value: YESTERDAY } });
    await waitFor(() => expectStatus("Invalid date."));
    await waitFor(() => expect(dueInput(1).value).toBe(TOMORROW));
    expect(itemFor(1).classList.contains("overdue")).toBe(false);
  });

  test("UI19 TodoItem calls onDueDateChange with value || null on change", async () => {
    const onDueDateChange = vi.fn(async () => true);
    render(
      <ul>
        <TodoItem todo={makeTodo({ id: 1, title: "A", dueDate: TOMORROW })} today={TODAY} onToggle={noop} onDueDateChange={onDueDateChange} onDelete={noop} />
      </ul>,
    );
    fireEvent.change(dueInput(1), { target: { value: "" } });
    await waitFor(() => expect(onDueDateChange).toHaveBeenLastCalledWith(null));
    fireEvent.change(dueInput(1), { target: { value: YESTERDAY } });
    await waitFor(() => expect(onDueDateChange).toHaveBeenLastCalledWith(YESTERDAY));
  });
});

describe("UI20 delete", () => {
  test("UI20 DELETE removes the li; #empty shows when the list becomes empty", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A" }), makeTodo({ id: 2, title: "B" })]);
    render(<App />);
    await waitForItems(2);
    fireEvent.click(deleteButton(itemFor(1)));
    await waitForItems(1);
    expect(server.callsTo("DELETE")[0]?.url).toBe("/api/todos/1");
    expect(document.getElementById("todo-1")).toBeNull();
    expect(isHidden(document.getElementById("empty"))).toBe(true);
    fireEvent.click(deleteButton(itemFor(2)));
    await waitForItems(0);
    await waitFor(() => expect(isHidden(document.getElementById("empty"))).toBe(false));
  });

  test("UI20 on failure the li stays and #status shows the error", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A" })]);
    render(<App />);
    await waitForItems(1);
    server.use((call) => (call.method === "DELETE" ? json(404, { error: "Todo not found." }) : undefined));
    fireEvent.click(deleteButton(itemFor(1)));
    await waitFor(() => expectStatus("Todo not found."));
    expect(items()).toHaveLength(1);
    expect(isHidden(document.getElementById("empty"))).toBe(true);
  });

  test("UI20 TodoItem delete button calls onDelete", () => {
    const onDelete = vi.fn(async () => true);
    render(
      <ul>
        <TodoItem todo={makeTodo({ id: 1, title: "A" })} today={TODAY} onToggle={noop} onDueDateChange={noop} onDelete={onDelete} />
      </ul>,
    );
    fireEvent.click(deleteButton(itemFor(1)));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("UI21 titles render as text", () => {
  test("UI21 an HTML-looking title is shown literally and creates no elements", async () => {
    const title = "<img src=x onerror=alert(1)>";
    mockApi([makeTodo({ id: 1, title })]);
    render(<App />);
    await waitForItems(1);
    const li = itemFor(1);
    expect(li.querySelector("label")?.textContent).toBe(title);
    expect(li.querySelector("img")).toBeNull();
    expect(document.querySelector("#list img")).toBeNull();
    expect(deleteButton(li).getAttribute("aria-label")).toBe(`Delete "${title}"`);
    expect(dueInput(1).getAttribute("aria-label")).toBe(`Due date for "${title}"`);
  });
});

describe("UI22 initial load", () => {
  test("UI22 on mount the app GETs /api/todos and renders the result", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A" }), makeTodo({ id: 2, title: "B" })]);
    render(<App />);
    await waitForItems(2);
    expect(server.callsTo("GET")[0]?.url).toBe("/api/todos");
  });

  test("UI22 StrictMode double mount renders no duplicate todos", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "A" }), makeTodo({ id: 2, title: "B" })]);
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await waitForItems(2);
    await tick();
    expect(items()).toHaveLength(2);
    expect(document.querySelectorAll("#todo-1")).toHaveLength(1);
    expect(server.callsTo("GET").length).toBeGreaterThanOrEqual(1);
  });

  test("UI22 StrictMode: a stale first GET resolving last does not override or duplicate", async () => {
    const server = mockApi([]);
    const first = deferred<Response>();
    server.use((call) => (call.method === "GET" && server.callsTo("GET").length === 1 ? first.promise : undefined));
    server.use((call) =>
      call.method === "GET" && server.callsTo("GET").length > 1 ? json(200, [makeTodo({ id: 2, title: "fresh" })]) : undefined,
    );
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await waitForItems(1);
    await act(async () => first.resolve(json(200, [makeTodo({ id: 1, title: "stale" }), makeTodo({ id: 2, title: "fresh" })])));
    await tick();
    expect(items().map((li) => li.querySelector("label")?.textContent)).toEqual(["fresh"]);
  });

  test("UI22 unmounting before the GET resolves does not throw or log errors", async () => {
    const server = mockApi([]);
    const gate = deferred<Response>();
    server.use((call) => (call.method === "GET" ? gate.promise : undefined));
    const errors = vi.spyOn(console, "error");
    const { unmount } = render(<App />);
    await waitFor(() => expect(server.callsTo("GET")).not.toHaveLength(0));
    unmount();
    await act(async () => gate.resolve(json(200, [makeTodo({ id: 1, title: "late" })])));
    await tick();
    expect(errors).not.toHaveBeenCalled();
  });
});

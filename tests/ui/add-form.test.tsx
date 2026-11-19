import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { App } from "../../src/App.tsx";
import { AddTodoForm } from "../../src/components/AddTodoForm.tsx";
import type { ActionResult } from "../../src/types.ts";
import { byId, formById, inputById, isHidden, items, statusText, tick, waitForItems } from "./dom.ts";
import { json, makeTodo, mockApi, nonErrorResponse } from "./fetch-mock.ts";

const ok: ActionResult = { ok: true };

function renderForm(onAdd: (title: string, dueDate: string | null) => Promise<ActionResult>): void {
  render(<AddTodoForm onAdd={onAdd} />);
}

function typeTitle(value: string): void {
  fireEvent.change(inputById("new-title"), { target: { value } });
}

function setDue(value: string): void {
  fireEvent.change(inputById("new-due"), { target: { value } });
}

function submit(): void {
  fireEvent.submit(formById("add-form"));
}

function expectError(message: string): void {
  const error = byId("form-error");
  expect(isHidden(error)).toBe(false);
  expect(error.textContent).toBe(message);
  expect(inputById("new-title").getAttribute("aria-invalid")).toBe("true");
  expect(inputById("new-due").getAttribute("aria-invalid")).toBe("true");
}

function expectNoError(): void {
  expect(isHidden(byId("form-error"))).toBe(true);
  expect(inputById("new-title").hasAttribute("aria-invalid")).toBe(false);
  expect(inputById("new-due").hasAttribute("aria-invalid")).toBe(false);
}

describe("UI8 form markup", () => {
  test("UI8 #add-form has the required controls in DOM order with the required attributes", () => {
    renderForm(async () => ok);
    const form = formById("add-form");
    expect(form.noValidate).toBe(true);

    const titleLabel = form.querySelector('label[for="new-title"]');
    const row = form.querySelector("div.row");
    const title = inputById("new-title");
    const addButton = row?.querySelector('button[type="submit"]');
    const dueLabel = form.querySelector('label[for="new-due"]');
    const due = inputById("new-due");
    const error = byId("form-error");

    expect(titleLabel?.textContent).toBe("New todo");
    expect(row?.contains(title)).toBe(true);
    expect(addButton?.textContent).toBe("Add");
    expect(dueLabel?.textContent).toBe("Due date (optional)");
    expect(dueLabel?.classList.contains("due-label")).toBe(true);
    expect(error.tagName).toBe("P");
    expect(error.classList.contains("error")).toBe(true);
    expect(error.hasAttribute("hidden")).toBe(true);

    const ordered = [titleLabel, row, dueLabel, due, error];
    ordered.forEach((el) => expect(el && form.contains(el)).toBe(true));
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const next = ordered[i];
      if (!prev || !next) throw new Error("missing element");
      expect(prev.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    expect(title.name).toBe("title");
    expect(title.type).toBe("text");
    expect(title.maxLength).toBe(200);
    expect(title.getAttribute("autocomplete")).toBe("off");
    expect(title.getAttribute("aria-describedby")).toBe("form-error");
    expect(due.name).toBe("dueDate");
    expect(due.type).toBe("date");
    expect(due.getAttribute("aria-describedby")).toBe("form-error");
  });
});

describe("UI9 empty title validation", () => {
  test.each(["", "   "])("UI9 title %j shows the error, marks inputs invalid, focuses title, no onAdd", (value) => {
    const onAdd = vi.fn(async () => ok);
    renderForm(onAdd);
    typeTitle(value);
    setDue("2026-07-01");
    submit();
    expectError("Please enter a todo.");
    expect(document.activeElement).toBe(inputById("new-title"));
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("UI9 in App no request is sent", async () => {
    const server = mockApi([]);
    render(<App />);
    await waitFor(() => expect(server.callsTo("GET")).not.toHaveLength(0));
    typeTitle("  ");
    submit();
    expectError("Please enter a todo.");
    await tick();
    expect(server.callsTo("POST")).toHaveLength(0);
  });
});

describe("UI10 successful add", () => {
  test("UI10 onAdd receives the trimmed title and dueDate || null; inputs clear and title is focused", async () => {
    const onAdd = vi.fn(async () => ok);
    renderForm(onAdd);
    typeTitle("  Buy milk  ");
    submit();
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Buy milk", null));
    typeTitle("Pay rent");
    setDue("2026-07-01");
    submit();
    await waitFor(() => expect(onAdd).toHaveBeenLastCalledWith("Pay rent", "2026-07-01"));
    await waitFor(() => expect(inputById("new-title").value).toBe(""));
    expect(inputById("new-due").value).toBe("");
    expect(document.activeElement).toBe(inputById("new-title"));
    expectNoError();
  });

  test("UI10 in App: clears #status, POSTs {title, dueDate}, appends the todo at the end", async () => {
    const server = mockApi([makeTodo({ id: 1, title: "First" })]);
    server.use((call) => (call.method === "GET" && server.callsTo("GET").length === 1 ? json(500, { error: "Load failed." }) : undefined));
    render(<App />);
    await waitFor(() => expect(statusText()).toBe("Load failed."));

    typeTitle("  Second  ");
    setDue("2026-07-01");
    submit();
    await waitFor(() => expect(server.callsTo("POST")).toHaveLength(1));
    expect(server.callsTo("POST")[0]).toMatchObject({ url: "/api/todos", body: { title: "Second", dueDate: "2026-07-01" } });
    await waitFor(() => expect(items().map((li) => li.querySelector("label")?.textContent)).toContain("Second"));
    expect(isHidden(byId("status"))).toBe(true);
    expect(statusText()).toBe("");
    expect(inputById("new-title").value).toBe("");
    expect(inputById("new-due").value).toBe("");
    expect(document.activeElement).toBe(inputById("new-title"));
    expectNoError();

    typeTitle("Third");
    submit();
    await waitFor(() => expect(server.callsTo("POST")).toHaveLength(2));
    expect(server.callsTo("POST")[1]?.body).toEqual({ title: "Third", dueDate: null });
    await waitFor(() => expect(items().map((li) => li.querySelector("label")?.textContent)).toEqual(["Second", "Third"]));
  });

  test("UI10 in App: appended after existing todos", async () => {
    mockApi([makeTodo({ id: 1, title: "First" })]);
    render(<App />);
    await waitForItems(1);
    typeTitle("Second");
    submit();
    const list = await waitForItems(2);
    expect(list.map((li) => li.querySelector("label")?.textContent)).toEqual(["First", "Second"]);
  });
});

describe("UI11 failed add", () => {
  test("UI11 onAdd {ok:false} shows its error; inputs keep values, invalid, title focused", async () => {
    renderForm(async () => ({ ok: false, error: "Title must be 200 characters or fewer." }));
    typeTitle("Too long");
    setDue("2026-07-01");
    submit();
    await waitFor(() => expectError("Title must be 200 characters or fewer."));
    expect(inputById("new-title").value).toBe("Too long");
    expect(inputById("new-due").value).toBe("2026-07-01");
    expect(document.activeElement).toBe(inputById("new-title"));
  });

  test("UI11 in App: server error message goes to #form-error, not #status", async () => {
    const server = mockApi([]);
    server.use((call) => (call.method === "POST" ? json(400, { error: "Title must be 200 characters or fewer." }) : undefined));
    render(<App />);
    await waitFor(() => expect(server.callsTo("GET")).not.toHaveLength(0));
    typeTitle("Something");
    setDue("2026-07-01");
    submit();
    await waitFor(() => expectError("Title must be 200 characters or fewer."));
    expect(statusText()).toBe("");
    expect(isHidden(byId("status"))).toBe(true);
    expect(inputById("new-title").value).toBe("Something");
    expect(inputById("new-due").value).toBe("2026-07-01");
    expect(document.activeElement).toBe(inputById("new-title"));
  });

  test("UI11 in App: network failure shows the client message", async () => {
    const server = mockApi([]);
    server.use((call) => (call.method === "POST" ? Promise.reject(new TypeError("Failed to fetch")) : undefined));
    render(<App />);
    await waitFor(() => expect(server.callsTo("GET")).not.toHaveLength(0));
    typeTitle("Offline");
    submit();
    await waitFor(() => expectError("Could not reach the server. Check your connection and try again."));
    expect(statusText()).toBe("");
  });

  test("UI11 in App: a non-Error failure shows 'Could not add todo.'", async () => {
    const server = mockApi([]);
    server.use((call) => (call.method === "POST" ? nonErrorResponse(201) : undefined));
    render(<App />);
    await waitFor(() => expect(server.callsTo("GET")).not.toHaveLength(0));
    typeTitle("Weird");
    submit();
    await waitFor(() => expectError("Could not add todo."));
    expect(statusText()).toBe("");
  });
});

describe("UI12/UI13 clearing the error and aria-invalid", () => {
  test("UI13 no aria-invalid before any error", () => {
    renderForm(async () => ok);
    expectNoError();
  });

  test("UI12 typing in #new-title hides the error and removes aria-invalid", () => {
    renderForm(async () => ok);
    submit();
    expectError("Please enter a todo.");
    typeTitle("a");
    expectNoError();
  });

  test("UI12 changing #new-due hides the error and removes aria-invalid", () => {
    renderForm(async () => ok);
    submit();
    expectError("Please enter a todo.");
    setDue("2026-07-01");
    expectNoError();
  });

  test("UI13 aria-invalid is exactly 'true' only while an error is shown", async () => {
    renderForm(async () => ({ ok: false, error: "Nope." }));
    typeTitle("x");
    submit();
    await waitFor(() => expectError("Nope."));
    typeTitle("xy");
    expectNoError();
  });
});

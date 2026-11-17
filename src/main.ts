import { api, type Todo } from "./api.ts";
import "./style.css";

const form = document.querySelector<HTMLFormElement>("#add-form")!;
const input = document.querySelector<HTMLInputElement>("#new-title")!;
const dueInput = document.querySelector<HTMLInputElement>("#new-due")!;
const formError = document.querySelector<HTMLElement>("#form-error")!;
const status = document.querySelector<HTMLElement>("#status")!;
const empty = document.querySelector<HTMLElement>("#empty")!;
const list = document.querySelector<HTMLUListElement>("#list")!;

let todos: Todo[] = [];

function showStatus(message?: string) {
  status.hidden = !message;
  status.textContent = message ?? "";
}

function showFormError(message?: string) {
  formError.hidden = !message;
  formError.textContent = message ?? "";
  input.toggleAttribute("aria-invalid", !!message);
  dueInput.toggleAttribute("aria-invalid", !!message);
}

function localToday() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function render() {
  const today = localToday();
  empty.hidden = todos.length > 0;
  list.replaceChildren(
    ...todos.map((todo) => {
      const li = document.createElement("li");
      const overdue = !todo.completed && !!todo.dueDate && todo.dueDate < today;
      li.className = [todo.completed ? "done" : "", overdue ? "overdue" : ""].filter(Boolean).join(" ");

      const id = `todo-${todo.id}`;
      const box = document.createElement("input");
      box.type = "checkbox";
      box.id = id;
      box.checked = todo.completed;
      box.addEventListener("change", () => toggle(todo, box));

      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = todo.title;

      const due = document.createElement("input");
      due.type = "date";
      due.id = `due-${todo.id}`;
      due.className = "due";
      due.value = todo.dueDate ?? "";
      due.setAttribute("aria-label", `Due date for "${todo.title}"`);
      due.addEventListener("change", () => changeDue(todo, due));

      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete";
      del.textContent = "Delete";
      del.setAttribute("aria-label", `Delete "${todo.title}"`);
      del.addEventListener("click", () => remove(todo));

      if (overdue) {
        const badge = document.createElement("span");
        badge.className = "badge overdue-badge";
        badge.textContent = "Overdue";
        li.append(box, label, badge, due, del);
      } else {
        li.append(box, label, due, del);
      }
      return li;
    }),
  );
}

async function run(action: () => Promise<void>) {
  try {
    showStatus();
    await action();
  } catch (err) {
    showStatus(err instanceof Error ? err.message : "Something went wrong.");
  }
}

async function toggle(todo: Todo, box: HTMLInputElement) {
  await run(async () => {
    try {
      const updated = await api.setCompleted(todo.id, box.checked);
      todos = todos.map((t) => (t.id === updated.id ? updated : t));
    } finally {
      render();
    }
  });
}

async function changeDue(todo: Todo, due: HTMLInputElement) {
  await run(async () => {
    try {
      const updated = await api.setDueDate(todo.id, due.value || null);
      todos = todos.map((t) => (t.id === updated.id ? updated : t));
    } finally {
      render();
    }
  });
}

async function remove(todo: Todo) {
  await run(async () => {
    await api.remove(todo.id);
    todos = todos.filter((t) => t.id !== todo.id);
    render();
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) {
    showFormError("Please enter a todo.");
    input.focus();
    return;
  }
  showFormError();
  await run(async () => {
    try {
      todos = [...todos, await api.create(title, dueInput.value || null)];
    } catch (err) {
      showFormError(err instanceof Error ? err.message : "Could not add todo.");
      input.focus();
      return;
    }
    input.value = "";
    dueInput.value = "";
    render();
    input.focus();
  });
});

input.addEventListener("input", () => showFormError());
dueInput.addEventListener("input", () => showFormError());

run(async () => {
  todos = await api.list();
  render();
});

const tabs = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'));

function selectTab(tab: HTMLElement, focus = false) {
  for (const t of tabs) {
    const active = t === tab;
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")!)!.hidden = !active;
  }
  if (focus) tab.focus();
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    selectTab(tabs[(i + step + tabs.length) % tabs.length], true);
  });
});

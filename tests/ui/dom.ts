import { waitFor } from "@testing-library/react";
import { expect } from "vitest";

export function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

export function inputById(id: string): HTMLInputElement {
  const el = byId(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`#${id} is not an <input>`);
  return el;
}

export function formById(id: string): HTMLFormElement {
  const el = byId(id);
  if (!(el instanceof HTMLFormElement)) throw new Error(`#${id} is not a <form>`);
  return el;
}

/** Hidden = not rendered, or itself / an ancestor carries the `hidden` attribute. */
export function isHidden(el: Element | null): boolean {
  return el === null || el.closest("[hidden]") !== null;
}

export function items(): HTMLLIElement[] {
  return Array.from(document.querySelectorAll<HTMLLIElement>("#list > li"));
}

export function itemFor(id: number): HTMLLIElement {
  const checkbox = document.getElementById(`todo-${id}`);
  const li = checkbox?.closest("li");
  if (!(li instanceof HTMLLIElement)) throw new Error(`no <li> for todo ${id}`);
  return li;
}

export function deleteButton(li: HTMLLIElement): HTMLButtonElement {
  const btn = li.querySelector("button.delete");
  if (!(btn instanceof HTMLButtonElement)) throw new Error("delete button not found");
  return btn;
}

export async function waitForItems(count: number): Promise<HTMLLIElement[]> {
  await waitFor(() => expect(items()).toHaveLength(count));
  return items();
}

export function statusText(): string {
  return document.getElementById("status")?.textContent ?? "";
}

export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

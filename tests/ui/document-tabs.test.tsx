import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { App } from "../../src/App.tsx";
import { Tabs } from "../../src/components/Tabs.tsx";
import type { TabDef } from "../../src/types.ts";
import { byId, inputById, isHidden, waitForItems } from "./dom.ts";
import { makeTodo, mockApi } from "./fetch-mock.ts";

const TAB_IDS = ["tab-todos", "tab-1", "tab-2", "tab-3"] as const;
const PANEL_IDS = ["panel-todos", "panel-1", "panel-2", "panel-3"] as const;
const TAB_LABELS = ["Todos", "Tab 1", "Tab 2", "Tab 3"] as const;

function tabs(): HTMLButtonElement[] {
  return Array.from(byId("tabs").querySelectorAll<HTMLButtonElement>('[role="tab"]'));
}

function expectSelected(index: number): void {
  TAB_IDS.forEach((id, i) => {
    const tab = byId(id);
    expect(tab.getAttribute("aria-selected"), id).toBe(i === index ? "true" : "false");
    expect(tab.tabIndex, id).toBe(i === index ? 0 : -1);
    expect(tab.getAttribute("tabindex"), id).toBe(i === index ? "0" : "-1");
  });
  PANEL_IDS.forEach((id, i) => {
    const panel = byId(id);
    expect(panel.hasAttribute("hidden"), id).toBe(i !== index);
  });
}

function renderApp(): void {
  mockApi([]);
  render(<App />);
}

describe("UI1 document", () => {
  test("UI1 index.html has lang=en and title Todos", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.documentElement.getAttribute("lang")).toBe("en");
    expect(doc.title).toBe("Todos");
  });

  test("UI1 a single <main> wraps everything App renders", () => {
    mockApi([]);
    const { container } = render(<App />);
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild?.tagName).toBe("MAIN");
  });
});

describe("UI2–UI7 tabs in App", () => {
  test("UI2 #tabs is a labelled tablist with the 4 tab buttons in order", () => {
    renderApp();
    const list = byId("tabs");
    expect(list.tagName).toBe("DIV");
    expect(list.getAttribute("role")).toBe("tablist");
    expect(list.getAttribute("aria-label")).toBe("Sections");
    const found = tabs();
    expect(found.map((t) => t.id)).toEqual([...TAB_IDS]);
    expect(found.map((t) => t.textContent)).toEqual([...TAB_LABELS]);
    expect(found.map((t) => t.getAttribute("aria-controls"))).toEqual([...PANEL_IDS]);
    found.forEach((t) => {
      expect(t.tagName).toBe("BUTTON");
      expect(t.getAttribute("type")).toBe("button");
    });
  });

  test("UI3 initially Todos is selected and only its panel is visible", () => {
    renderApp();
    expectSelected(0);
  });

  test("UI4 panels are tabpanel sections labelled by their tabs, with A/B/C buttons", () => {
    renderApp();
    PANEL_IDS.forEach((id, i) => {
      const panel = byId(id);
      expect(panel.tagName).toBe("SECTION");
      expect(panel.getAttribute("role")).toBe("tabpanel");
      expect(panel.getAttribute("aria-labelledby")).toBe(TAB_IDS[i]);
    });
    const buttons: ReadonlyArray<readonly [string, string, string]> = [
      ["panel-1", "btn-a", "A"],
      ["panel-2", "btn-b", "B"],
      ["panel-3", "btn-c", "C"],
    ];
    buttons.forEach(([panelId, btnId, text]) => {
      const btn = byId(btnId);
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.getAttribute("type")).toBe("button");
      expect(btn.textContent).toBe(text);
      expect(btn.closest("section")?.id).toBe(panelId);
    });
  });

  test("UI5 clicking a tab selects it and shows only its panel", () => {
    renderApp();
    [2, 1, 3, 0].forEach((index) => {
      fireEvent.click(byId(TAB_IDS[index]));
      expectSelected(index);
    });
  });

  test("UI6 ArrowRight/ArrowLeft select and focus next/previous tab with wrap and preventDefault", () => {
    renderApp();
    byId("tab-todos").focus();
    const steps: ReadonlyArray<readonly [string, number]> = [
      ["ArrowRight", 1],
      ["ArrowRight", 2],
      ["ArrowRight", 3],
      ["ArrowRight", 0],
      ["ArrowLeft", 3],
      ["ArrowLeft", 2],
    ];
    steps.forEach(([key, expected]) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) throw new Error("no focused tab");
      const notCancelled = fireEvent.keyDown(active, { key });
      expect(notCancelled, `${key} should call preventDefault`).toBe(false);
      expectSelected(expected);
      expect(document.activeElement).toBe(byId(TAB_IDS[expected]));
    });
  });

  test("UI6 other keys (Home, End, Enter, ArrowDown) do nothing", () => {
    renderApp();
    fireEvent.click(byId("tab-1"));
    byId("tab-1").focus();
    ["Home", "End", "ArrowDown", "ArrowUp", "a"].forEach((key) => {
      const notCancelled = fireEvent.keyDown(byId("tab-1"), { key });
      expect(notCancelled, key).toBe(true);
      expectSelected(1);
      expect(document.activeElement).toBe(byId("tab-1"));
    });
  });

  test("UI7 todos panel state persists across tab switches (never unmounted)", async () => {
    mockApi([makeTodo({ id: 1, title: "Keep me" })]);
    render(<App />);
    await waitForItems(1);
    const title = inputById("new-title");
    fireEvent.change(title, { target: { value: "draft text" } });
    fireEvent.change(inputById("new-due"), { target: { value: "2026-07-01" } });
    fireEvent.click(byId("tab-2"));
    expect(isHidden(byId("panel-todos"))).toBe(true);
    expect(byId("panel-todos").contains(title)).toBe(true);
    fireEvent.click(byId("tab-todos"));
    expect(inputById("new-title")).toBe(title);
    expect(inputById("new-title").value).toBe("draft text");
    expect(inputById("new-due").value).toBe("2026-07-01");
    expect(await waitForItems(1)).toHaveLength(1);
  });
});

const DEFS: readonly TabDef[] = [
  { id: "t-a", panelId: "p-a", label: "Alpha" },
  { id: "t-b", panelId: "p-b", label: "Beta" },
  { id: "t-c", panelId: "p-c", label: "Gamma" },
];

function Harness(props: { readonly onSelect: (i: number) => void }): ReactNode {
  const [selected, setSelected] = useState(0);
  return (
    <Tabs
      tabs={DEFS}
      selectedIndex={selected}
      onSelect={(i) => {
        props.onSelect(i);
        setSelected(i);
      }}
    />
  );
}

describe("UI2/UI5/UI6 Tabs component via props", () => {
  test("UI2 renders only the tablist with one tab button per def", () => {
    const { container } = render(<Tabs tabs={DEFS} selectedIndex={1} onSelect={() => undefined} />);
    expect(container.children).toHaveLength(1);
    const list = container.firstElementChild;
    expect(list?.id).toBe("tabs");
    expect(list?.getAttribute("role")).toBe("tablist");
    expect(list?.getAttribute("aria-label")).toBe("Sections");
    const buttons = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(buttons.map((b) => [b.id, b.textContent, b.getAttribute("aria-controls")])).toEqual(
      DEFS.map((d) => [d.id, d.label, d.panelId]),
    );
    expect(buttons.map((b) => b.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(buttons.map((b) => b.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
  });

  test("UI5 click calls onSelect with the tab index", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.click(byId("t-c"));
    expect(onSelect).toHaveBeenLastCalledWith(2);
    expect(byId("t-c").getAttribute("aria-selected")).toBe("true");
  });

  test("UI6 arrows wrap and move focus", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    byId("t-a").focus();
    fireEvent.keyDown(byId("t-a"), { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenLastCalledWith(2);
    await waitFor(() => expect(document.activeElement).toBe(byId("t-c")));
    fireEvent.keyDown(byId("t-c"), { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith(0);
    await waitFor(() => expect(document.activeElement).toBe(byId("t-a")));
    onSelect.mockClear();
    fireEvent.keyDown(byId("t-a"), { key: "End" });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

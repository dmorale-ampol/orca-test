export function initTabs() {
  const tabs = Array.from(document.querySelectorAll<HTMLElement>('[role="tablist"] [role="tab"]'));

  function select(tab: HTMLElement, focus = false) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls")!);
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      select(tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length], true);
    });
  }
}

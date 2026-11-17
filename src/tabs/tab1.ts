export function initTabs() {
  const tabs = Array.from(document.querySelectorAll<HTMLElement>('#tabs [role="tab"]'));

  function select(tab: HTMLElement, focus = false) {
    for (const t of tabs) {
      const active = t === tab;
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")!)!.hidden = !active;
    }
    if (focus) tab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const i = tabs.indexOf(tab);
      let next: HTMLElement | undefined;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      else return;
      e.preventDefault();
      select(next!, true);
    });
  }
}

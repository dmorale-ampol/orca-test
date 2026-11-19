import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { TabsProps } from "../types.ts";

const wrap = (index: number, length: number): number => (index + length) % length;

const keyOffset = (key: string): number | null =>
  key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : null;

export function Tabs({ tabs, selectedIndex, onSelect }: TabsProps): ReactNode {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>): void => {
    const offset = keyOffset(event.key);
    if (offset === null || tabs.length === 0) return;
    event.preventDefault();
    const next = wrap(index + offset, tabs.length);
    onSelect(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Sections" id="tabs">
      {tabs.map((tab, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={tab.id}
            aria-controls={tab.panelId}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(index)}
            onKeyDown={handleKeyDown(index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

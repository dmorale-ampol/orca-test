import { describe, expect, test } from "vitest";
import { isOverdue, localToday } from "../../src/lib/dates.ts";
import type { Todo } from "../../src/types.ts";

const todo = (completed: boolean, dueDate: string | null): Todo => ({
  id: 1,
  title: "t",
  completed,
  createdAt: "2026-06-01T09:00:00.000Z",
  dueDate,
});

describe("UI17 localToday", () => {
  test("UI17 formats the local calendar date as zero-padded YYYY-MM-DD", () => {
    expect(localToday(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05");
    expect(localToday(new Date(2026, 11, 31, 12, 0, 0))).toBe("2026-12-31");
  });

  test("UI17 uses the local date at the edges of the local day", () => {
    expect(localToday(new Date(2026, 2, 9, 0, 0, 1))).toBe("2026-03-09");
    expect(localToday(new Date(2026, 2, 9, 23, 59, 59))).toBe("2026-03-09");
  });

  test("UI17 defaults to the current date", () => {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    expect(localToday()).toBe(expected);
  });
});

describe("UI17 isOverdue", () => {
  const today = "2026-06-15";

  test("UI17 incomplete with a due date before today is overdue", () => {
    expect(isOverdue(todo(false, "2026-06-14"), today)).toBe(true);
    expect(isOverdue(todo(false, "2025-12-31"), today)).toBe(true);
  });

  test("UI17 due today or later is not overdue", () => {
    expect(isOverdue(todo(false, "2026-06-15"), today)).toBe(false);
    expect(isOverdue(todo(false, "2026-06-16"), today)).toBe(false);
  });

  test("UI17 completed or undated todos are never overdue", () => {
    expect(isOverdue(todo(true, "2026-06-14"), today)).toBe(false);
    expect(isOverdue(todo(false, null), today)).toBe(false);
  });
});

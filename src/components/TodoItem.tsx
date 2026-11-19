import { useEffect, useEffectEvent, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { TodoItemProps } from "../types.ts";
import { isOverdue } from "../lib/dates.ts";

const classNames = (...names: readonly (string | false)[]): string | undefined =>
  names.filter(Boolean).join(" ") || undefined;

export function TodoItem({ todo, today, onToggle, onDueDateChange, onDelete }: TodoItemProps): ReactNode {
  const serverDue = todo.dueDate ?? "";
  const [checkedDraft, setCheckedDraft] = useState(todo.completed);
  const [dueDraft, setDueDraft] = useState(serverDue);
  const dueRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCheckedDraft(todo.completed), [todo.completed]);
  useEffect(() => setDueDraft(serverDue), [serverDue]);

  const handleToggle = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const previous = checkedDraft;
    const next = e.currentTarget.checked;
    setCheckedDraft(next);
    if (!(await onToggle(next))) setCheckedDraft(previous);
  };

  // Commit only on the native "change" event: React's onChange fires on every
  // "input", which would PATCH partial dates while a year is being typed (R3).
  const commitDue = useEffectEvent(async (value: string): Promise<void> => {
    if (!(await onDueDateChange(value || null))) setDueDraft(serverDue);
  });

  useEffect(() => {
    const input = dueRef.current;
    if (!input) return;
    const onNativeChange = (): void => void commitDue(input.value);
    input.addEventListener("change", onNativeChange);
    return () => input.removeEventListener("change", onNativeChange);
  }, []);

  const overdue = isOverdue(todo, today);
  const checkboxId = `todo-${todo.id}`;

  return (
    <li className={classNames(todo.completed && "done", overdue && "overdue")}>
      <input type="checkbox" id={checkboxId} checked={checkedDraft} onChange={(e) => void handleToggle(e)} />
      <label htmlFor={checkboxId}>{todo.title}</label>
      {overdue && <span className="badge overdue-badge">Overdue</span>}
      <input
        ref={dueRef}
        type="date"
        id={`due-${todo.id}`}
        className="due"
        aria-label={`Due date for "${todo.title}"`}
        value={dueDraft}
        onChange={(e) => setDueDraft(e.currentTarget.value)}
      />
      <button type="button" className="delete" aria-label={`Delete "${todo.title}"`} onClick={() => void onDelete()}>
        Delete
      </button>
    </li>
  );
}

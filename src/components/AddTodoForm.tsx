import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import type { AddTodoFormProps } from "../types.ts";

const EMPTY_TITLE_ERROR = "Please enter a todo.";

export function AddTodoForm({ onAdd }: AddTodoFormProps): ReactNode {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const invalid = error !== null ? true : undefined;
  const focusTitle = (): void => titleRef.current?.focus();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError(EMPTY_TITLE_ERROR);
      focusTitle();
      return;
    }
    setError(null);
    const result = await onAdd(trimmed, dueDate || null);
    if (result.ok) {
      setTitle("");
      setDueDate("");
    } else {
      setError(result.error);
    }
    focusTitle();
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setTitle(e.target.value);
    setError(null);
  };

  const handleDueChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setDueDate(e.target.value);
    setError(null);
  };

  return (
    <form id="add-form" noValidate onSubmit={handleSubmit}>
      <label htmlFor="new-title">New todo</label>
      <div className="row">
        <input
          ref={titleRef}
          id="new-title"
          name="title"
          type="text"
          maxLength={200}
          autoComplete="off"
          aria-describedby="form-error"
          aria-invalid={invalid}
          value={title}
          onChange={handleTitleChange}
        />
        <button type="submit">Add</button>
      </div>
      <label htmlFor="new-due" className="due-label">
        Due date (optional)
      </label>
      <input
        id="new-due"
        name="dueDate"
        type="date"
        aria-describedby="form-error"
        aria-invalid={invalid}
        value={dueDate}
        onChange={handleDueChange}
      />
      <p id="form-error" className="error" hidden={error === null}>
        {error ?? ""}
      </p>
    </form>
  );
}

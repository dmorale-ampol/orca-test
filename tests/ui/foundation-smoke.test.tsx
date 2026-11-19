import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

test("renders React into the jsdom document", () => {
  render(<div>ok</div>);
  expect(document.body.contains(screen.getByText("ok"))).toBe(true);
});

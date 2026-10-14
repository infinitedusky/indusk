import "@/app/globals.css";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { NewProjectStart } from "./NewProjectStart";

// promise: a-project-starts-as-a-conversation

/**
 * new-project-flow A1: New project opens a page with only the "What do you want
 * to build?" box and a way to add documents - no field to fill first, and no
 * project needed.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("A1 — New project asks only what you want to build", () => {
  it("A1 shows the question, one box and a way to add documents, and needs no project", async () => {
    const screen = await render(<NewProjectStart />);
    await expect
      .element(screen.getByRole("heading", { name: "What do you want to build?" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /add documents/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("textbox").elements()).toHaveLength(1);
  });
});

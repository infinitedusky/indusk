import "@/app/globals.css";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { type CreatingStep, NewProjectCreating } from "./NewProjectCreating";

// promise: a-new-project-is-made-by-the-agent

/**
 * new-project-flow A5: the creation shows each step as it runs and ends with
 * a way into the new project.
 */

// next/link needs Next's runtime (`process`); a link is an anchor for this test.
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const done = (label: string): CreatingStep => ({ label, state: "done" });
const working = (label: string): CreatingStep => ({ label, state: "working" });

describe("A5 — the creation shows each step and ends with a way in", () => {
  it("A5 lists each step as it runs, and offers the way into the project once there is one", async () => {
    const screen = await render(
      <NewProjectCreating
        name="homework-gate"
        href="/p/homework-gate-workbench/"
        steps={[done("Workbench created"), working("InDusk installed")]}
      />,
    );
    expect(screen.getByRole("listitem").elements()).toHaveLength(2);
    await expect.element(screen.getByText("Workbench created")).toBeVisible();
    await expect.element(screen.getByText("InDusk installed")).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: /open the project/i }))
      .toHaveAttribute("href", "/p/homework-gate-workbench/");
  });

  it("A5 offers no way in before the project exists", async () => {
    const screen = await render(
      <NewProjectCreating
        name="homework-gate"
        steps={[done("Workbench created"), working("InDusk installed")]}
      />,
    );
    expect(screen.getByRole("link").elements()).toHaveLength(0);
    await expect
      .element(screen.getByRole("button", { name: /open the project/i }))
      .toBeDisabled();
  });

  it("A5 says which step failed and why", async () => {
    const screen = await render(
      <NewProjectCreating
        name="homework-gate"
        steps={[
          done("Workbench created"),
          { label: "InDusk installed", state: "failed" },
        ]}
        problem="indusk init exited with 1"
      />,
    );
    await expect
      .element(screen.getByText("indusk init exited with 1"))
      .toBeVisible();
  });
});

// promise: every-plan-is-one-click-away
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PlanRow } from "./PlanRow";

/** nav-row-legible A11: an empty worktree slot is no worktree. */
describe("PlanRow — an empty worktree slot (A11)", () => {
  it.each([
    ["null", null],
    ["false", false],
  ])("worktree={%s} is drawn as a row without one: one link", async (_label, worktree) => {
    const { container } = await render(
      <PlanRow
        initials="NS"
        state="needs"
        name="A plan"
        stage="Approve the brief"
        href="/plan/a"
        worktree={worktree}
      />,
    );
    const row = container.querySelector('[data-component="plan-row"]');
    expect(row?.matches("a[href='/plan/a']")).toBe(true);
  });
});

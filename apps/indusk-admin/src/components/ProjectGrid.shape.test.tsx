import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// `next/link` references Node-only globals in the browser test runtime.
vi.mock("next/link", () => {
  function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return { default: MockLink, __esModule: true };
});

import { ProjectGrid } from "./ProjectGrid";

/**
 * admin-ui-phase-progress — A23.
 *
 * The folded `project-list-workbenches-only` plan wanted the list filtered to
 * workbenches. That was an over-simplification (Sandy, 2026-09-16): a
 * normal-mode project is a real project. So the list shows every registered
 * project whose path exists, LABELLED by shape, and an entry whose path is
 * gone is not shown as a project — it is named in a collapsed note that
 * points at `indusk ui prune`. Authored RED in Test Phase 1; Build Phase 6.
 */

const live = {
  path: "/mock/x",
  lastSeenAt: "2026-09-16T00:00:00.000Z",
  activePlanCount: 1,
  hasInProgress: false,
};

describe("A23 — the project list labels shape and hides dead entries", () => {
  it("two cards labelled workbench / normal-mode, no card for the entry whose path is gone", async () => {
    // `shape` and `notFound` land with Build Phase 6; until then the props are
    // widened through `unknown` so the type-check gate (A25) stays green while
    // this row is red on its assertion, not on a compile error.
    const props = {
      projects: [
        { ...live, name: "bench", shape: "workbench" },
        { ...live, name: "plain", shape: "normal-mode" },
      ],
      notFound: ["dead"],
    } as unknown as Parameters<typeof ProjectGrid>[0];
    const { container } = await render(<ProjectGrid {...props} />);
    const grid = container.querySelector('[data-testid="project-grid"]');
    expect(grid?.children).toHaveLength(2);
    const bench = Array.from(grid?.children ?? []).find((c) =>
      c.textContent?.includes("bench"),
    );
    const plain = Array.from(grid?.children ?? []).find((c) =>
      c.textContent?.includes("plain"),
    );
    expect(
      bench?.querySelector('[data-testid="project-shape"]')?.textContent,
    ).toBe("workbench");
    expect(
      plain?.querySelector('[data-testid="project-shape"]')?.textContent,
    ).toBe("normal-mode");
    expect(grid?.textContent).not.toContain("dead");
    const note = container.querySelector('[data-testid="project-not-found"]');
    expect(note?.textContent).toContain("not found (1)");
    expect(note?.textContent).toContain("indusk ui prune");
  });
});

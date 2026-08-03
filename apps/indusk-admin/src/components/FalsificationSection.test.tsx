import type { Trajectory } from "@infinitedusky/indusk-mcp/trajectory/parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";

// PlanDetail imports next/link (subplan cards) — stub it like every other
// browser test; see PlanList.test.tsx for the canonical reason.
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

import { PlanDetail } from "./PlanDetail";

// CollapsibleSection persists state to localStorage (1.27.7+). Clear between
// tests so earlier test toggles don't bleed into later tests' initial state.
beforeEach(() => {
  if (typeof window !== "undefined") localStorage.clear();
});

/**
 * Falsification-section rendering (T10 of the admin-ui plan). Moved here from
 * PlanDetail.test.tsx alongside the FalsificationSection extraction
 * (dawn-ui-plan-grouping cleanup) — the tests exercise the unit through
 * PlanDetail, exactly as before; assertions are verbatim.
 */

function mockTrajectory(): Trajectory {
  return {
    rows: [
      {
        id: "T1",
        asserts: "Dropdown renders in header",
        writableAt: 1,
        passesAt: 1,
        state: "passing",
      },
      {
        id: "T2",
        asserts: "Selecting an option re-orders the rows",
        writableAt: 1,
        passesAt: 2,
        state: "written",
      },
    ],
    deferred: [],
    present: true,
  };
}

function mockPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    name: "alpha-feature",
    status: "in-progress",
    archived: false,
    brief: {
      frontmatter: { title: "Alpha", status: "accepted" },
      content:
        "# Alpha — Brief\n\n## Problem\n\nCustomers can't sort.\n\n## Proposed Direction\n\nAdd a header dropdown.",
    },
    impl: {
      frontmatter: { title: "Alpha — Impl", status: "in-progress" },
      content: `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | Dropdown renders | Phase 1 | Phase 1 | passing |
| T2 | Selecting re-orders | Phase 1 | Phase 2 | written |

## Checklist

### Phase 1: Dropdown shell

- [x] Add dropdown component
- [ ] Wire to URL state

#### Phase 1 Verification
- [x] T1 passes

### Phase 2: Sort logic

- [ ] Implement sort comparators

#### Phase 2 Verification
- [ ] T2 passes
`,
      trajectory: mockTrajectory(),
    },
    ...overrides,
  };
}

describe("PlanDetail — falsification section (T10)", () => {
  it("T10 — renders one entry per hypothesis with outcome-colored badges", async () => {
    const plan = mockPlan({
      falsification: {
        complete: true,
        entries: [
          {
            kind: "hypothesis",
            timestamp: "2026-04-19T10:00:00Z",
            hypothesis: "the dropdown leaks state on unmount",
            testPath: "src/dropdown.test.tsx",
            outcome: "fix-in-scope",
          },
          {
            kind: "hypothesis",
            timestamp: "2026-04-19T10:05:00Z",
            hypothesis: "race condition between two callers",
            testPath: null,
            outcome: "spawn-plan",
          },
          {
            kind: "hypothesis",
            timestamp: "2026-04-19T10:10:00Z",
            hypothesis: "overflow on extreme input",
            testPath: null,
            outcome: "accept-finding",
          },
          {
            kind: "terminator",
            timestamp: "2026-04-19T10:15:00Z",
            reason: "investigated all three; no further attack vector",
          },
        ],
      },
    });
    const { container } = await render(<PlanDetail plan={plan} />);
    const section = container.querySelector(
      '[data-testid="falsification-section"]',
    );
    expect(section).not.toBeNull();

    // One entry per hypothesis, outcomes color-coded by data-testid
    expect(
      section?.querySelector('[data-testid="hypothesis-fix-in-scope"]'),
    ).not.toBeNull();
    expect(
      section?.querySelector('[data-testid="hypothesis-spawn-plan"]'),
    ).not.toBeNull();
    expect(
      section?.querySelector('[data-testid="hypothesis-accept-finding"]'),
    ).not.toBeNull();

    // Terminator entry rendered as the closer
    const terminator = section?.querySelector(
      '[data-testid="falsification-terminator"]',
    );
    expect(terminator?.textContent).toContain("investigated all three");

    // Each hypothesis surfaces its prose
    expect(section?.textContent).toContain(
      "the dropdown leaks state on unmount",
    );
    expect(section?.textContent).toContain("race condition");
    expect(section?.textContent).toContain("overflow on extreme input");
  });

  it("T10 — renders 'no falsification ritual run' when the log is missing", async () => {
    const plan = mockPlan({ falsification: undefined });
    const { container } = await render(<PlanDetail plan={plan} />);
    const empty = container.querySelector(
      '[data-testid="falsification-empty"]',
    );
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain("No falsification ritual run");
  });
});

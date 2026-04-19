import type { Trajectory } from "@infinitedusky/indusk-mcp/trajectory/parser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";
import { PlanDetail } from "./PlanDetail";

/**
 * Trajectory tests for PlanDetail behavior:
 *
 *   - T5 (Phase 4): clicking a plan in the sidebar shows the plan's content in the main pane
 *     (here: rendering PlanDetail with a Plan yields a populated main pane)
 *   - T6 (Phase 4): main pane shows the plan's brief — Problem and Proposed Direction at minimum
 *   - T7 (Phase 4): main pane lists the plan's impl phases as collapsible sections
 *   - T8 (Phase 4): expanding a phase shows its trajectory rows in a table with all columns
 *
 * The route (`src/app/plan/[name]/page.tsx`) is a thin wrapper that loads the
 * Plan via planning-reader and renders <PlanDetail plan={...} />. End-to-end
 * routing tests are deferred to Phase 6's CLI smoke; here we test the
 * rendered output against a hand-built Plan.
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

describe("PlanDetail — main pane renders plan content (T5)", () => {
  it("T5 — rendering PlanDetail with a Plan produces a populated detail container with the plan's name", async () => {
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    const detail = container.querySelector('[data-testid="plan-detail"]');
    expect(detail).not.toBeNull();
    expect(detail?.getAttribute("data-plan-name")).toBe("alpha-feature");
    const header = container.querySelector('[data-testid="plan-header"]');
    expect(header?.textContent).toContain("alpha-feature");
  });
});

describe("PlanDetail — brief section (T6)", () => {
  it("T6 — main pane renders the brief content with Problem and Proposed Direction headings visible", async () => {
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    const brief = container.querySelector('[data-testid="brief-section"]');
    expect(brief).not.toBeNull();
    // Markdown-rendered headings
    const text = brief?.textContent ?? "";
    expect(text).toContain("Problem");
    expect(text).toContain("Proposed Direction");
    // Body content makes it through too
    expect(text).toContain("Customers can't sort");
    expect(text).toContain("Add a header dropdown");
  });

  it("brief section omitted entirely when the plan has no brief.md", async () => {
    const plan = mockPlan({ brief: undefined });
    const { container } = await render(<PlanDetail plan={plan} />);
    expect(container.querySelector('[data-testid="brief-section"]')).toBeNull();
  });
});

describe("PlanDetail — impl phases as collapsible sections (T7)", () => {
  it("T7 — main pane lists each phase as a collapsible section, defaulted to closed", async () => {
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    const phases = container.querySelector('[data-testid="phases-section"]');
    expect(phases).not.toBeNull();

    // Two phase headers — both collapsible (have aria-expanded), both closed
    const collapsibles = Array.from(
      phases?.querySelectorAll("[aria-expanded]") ?? [],
    );
    expect(collapsibles.length).toBeGreaterThanOrEqual(2);
    for (const c of collapsibles) {
      expect(c.getAttribute("aria-expanded")).toBe("false");
    }

    // Phase titles include "Phase 1" and "Phase 2"
    const titles = collapsibles.map((c) => c.textContent ?? "");
    expect(titles.some((t) => t.includes("Phase 1"))).toBe(true);
    expect(titles.some((t) => t.includes("Phase 2"))).toBe(true);
  });

  it("phases-section omitted when the plan has no impl.md", async () => {
    const plan = mockPlan({ impl: undefined });
    const { container } = await render(<PlanDetail plan={plan} />);
    expect(
      container.querySelector('[data-testid="phases-section"]'),
    ).toBeNull();
  });
});

describe("PlanDetail — trajectory table inside expanded phase (T8)", () => {
  it("T8 — when a phase is expanded, its trajectory rows render in a table with ID, Asserts, Writable at, Passes at, State columns", async () => {
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    const phasesSection = container.querySelector(
      '[data-testid="phases-section"]',
    );
    expect(phasesSection).not.toBeNull();

    // Click the Phase 1 header to expand it
    const phase1Header = Array.from(
      phasesSection?.querySelectorAll("[aria-expanded]") ?? [],
    ).find((el) => el.textContent?.includes("Phase 1")) as
      | HTMLElement
      | undefined;
    expect(phase1Header).toBeDefined();
    phase1Header?.click();

    // Wait a tick for state update
    await new Promise((r) => setTimeout(r, 50));

    const trajectory = container.querySelector(
      '[data-testid="phase-1-trajectory"]',
    );
    expect(trajectory).not.toBeNull();

    // Header cells named correctly
    const headerCells = Array.from(
      trajectory?.querySelectorAll("th") ?? [],
    ).map((th) => th.textContent?.trim() ?? "");
    expect(headerCells).toEqual([
      "ID",
      "Asserts",
      "Writable at",
      "Passes at",
      "State",
    ]);

    // T1 row appears (the trajectory row whose Passes at = 1)
    expect(trajectory?.textContent).toContain("T1");
    expect(trajectory?.textContent).toContain("Dropdown renders");
    expect(trajectory?.textContent).toContain("passing");
  });

  it("only includes trajectory rows whose Passes at matches the phase number", async () => {
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    const phasesSection = container.querySelector(
      '[data-testid="phases-section"]',
    );
    const phase1Header = Array.from(
      phasesSection?.querySelectorAll("[aria-expanded]") ?? [],
    ).find((el) => el.textContent?.includes("Phase 1")) as
      | HTMLElement
      | undefined;
    phase1Header?.click();
    await new Promise((r) => setTimeout(r, 50));

    const trajectory = container.querySelector(
      '[data-testid="phase-1-trajectory"]',
    );
    // Phase 1 has only T1 (Passes at: Phase 1). T2 (Passes at: Phase 2) should NOT appear.
    expect(trajectory?.textContent).toContain("T1");
    expect(trajectory?.textContent).not.toContain("T2");
  });
});

describe("PlanDetail — malformed banner (T13 prep)", () => {
  it("renders a malformed banner when the plan has malformed: true", async () => {
    const plan = mockPlan({ malformed: true });
    const { container } = await render(<PlanDetail plan={plan} />);
    expect(
      container.querySelector('[data-testid="malformed-banner"]'),
    ).not.toBeNull();
  });

  it("omits the malformed banner for normal plans", async () => {
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    expect(
      container.querySelector('[data-testid="malformed-banner"]'),
    ).toBeNull();
  });
});

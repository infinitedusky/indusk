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

// T11 (scorecards rendered) was originally tested as a per-plan section here.
// PlanDetail no longer renders scorecards — they moved to the global
// /scorecards page (`apps/indusk-admin/src/components/Scorecards.tsx`).
// Per-plan scorecard attribution proved noisy (date-range overlap surfaced
// unrelated commits under every plan) and missed the framing: scorecards
// are a system-improvement signal, not plan-specific data.
//
// New T11 coverage lives in src/components/Scorecards.test.tsx.

describe("PlanDetail — does not render scorecards section", () => {
  it("never includes a scorecards section regardless of plan shape", async () => {
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    expect(
      container.querySelector('[data-testid="scorecards-section"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="scorecards-list"]'),
    ).toBeNull();
  });
});

describe("PlanDetail — malformed plan (T13)", () => {
  it("T13 — malformed plan still renders, with a banner indicating the malformed state", async () => {
    const plan = mockPlan({
      malformed: true,
      brief: undefined, // typical: malformed brief gets dropped
      status: "unknown",
    });
    const { container } = await render(<PlanDetail plan={plan} />);
    expect(
      container.querySelector('[data-testid="plan-detail"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="malformed-banner"]'),
    ).not.toBeNull();
    // Header still appears (with whatever name + status came through)
    const header = container.querySelector('[data-testid="plan-header"]');
    expect(header?.textContent).toContain("alpha-feature");
  });

  it("T13 — malformed plan with rawDocuments shows raw markdown so the user can inspect it", async () => {
    const plan = mockPlan({
      malformed: true,
      brief: undefined,
      status: "unknown",
      rawDocuments: {
        "brief.md":
          '---\ntitle: "Bad Brief\nstatus: draft\n---\n\n# This brief had unterminated YAML',
      },
    });
    const { container } = await render(<PlanDetail plan={plan} />);
    const rawSection = container.querySelector(
      '[data-testid="raw-documents-section"]',
    );
    expect(rawSection).not.toBeNull();
    expect(rawSection?.textContent).toContain("brief.md");

    // The raw <pre> appears once expanded — but it's a CollapsibleSection
    // (defaultOpen=false), so click the brief.md header to expand
    const briefHeader = Array.from(
      rawSection?.querySelectorAll("[aria-expanded]") ?? [],
    ).find((el) => el.textContent?.includes("brief.md")) as
      | HTMLElement
      | undefined;
    briefHeader?.click();
    await new Promise((r) => setTimeout(r, 50));

    const rawPre = container.querySelector('[data-testid="raw-brief.md"]');
    expect(rawPre).not.toBeNull();
    expect(rawPre?.textContent).toContain('title: "Bad Brief');
    expect(rawPre?.textContent).toContain("# This brief had unterminated YAML");
  });

  it("malformed plan WITHOUT rawDocuments only shows the banner (no raw section)", async () => {
    const plan = mockPlan({
      malformed: true,
      brief: undefined,
      status: "unknown",
    });
    const { container } = await render(<PlanDetail plan={plan} />);
    expect(
      container.querySelector('[data-testid="malformed-banner"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="raw-documents-section"]'),
    ).toBeNull();
  });
});

describe("PlanDetail — missing-document graceful render (T14)", () => {
  it("T14 — plan with only a brief renders the brief, omits all other sections", async () => {
    const plan: Plan = {
      name: "brief-only",
      status: "draft",
      archived: false,
      brief: {
        frontmatter: { title: "Brief Only" },
        content: "## Problem\n\nFoo.\n\n## Proposed Direction\n\nBar.",
      },
    };
    const { container } = await render(<PlanDetail plan={plan} />);
    expect(
      container.querySelector('[data-testid="brief-section"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="phases-section"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="malformed-banner"]'),
    ).toBeNull();
  });

  it("T14 — plan with no documents at all still renders header + falsification empty state", async () => {
    const plan: Plan = {
      name: "empty-plan",
      status: "draft",
      archived: false,
    };
    const { container } = await render(<PlanDetail plan={plan} />);
    expect(
      container.querySelector('[data-testid="plan-detail"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="plan-header"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="falsification-empty"]'),
    ).not.toBeNull();
  });
});

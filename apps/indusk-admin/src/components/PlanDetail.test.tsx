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

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

// CollapsibleSection persists state to localStorage (1.27.7+). Clear between
// tests so earlier test toggles don't bleed into later tests' initial state.
beforeEach(() => {
  if (typeof window !== "undefined") localStorage.clear();
});

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

describe("PlanDetail — copy-as-markdown affordances", () => {
  it("plan header exposes a copy-whole-plan button that copies planMarkdown output", async () => {
    const writeText = stubClipboard();
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    const copyPlanButton = container.querySelector(
      '[data-testid="copy-plan-button"]',
    ) as HTMLButtonElement;
    expect(copyPlanButton).not.toBeNull();
    copyPlanButton.click();

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied.startsWith("# alpha-feature\n\nStatus: in-progress")).toBe(
      true,
    );
    expect(copied).toContain("## Brief");
    expect(copied).toContain("## Phase 1: Dropdown shell");
  });

  it("the Brief section's copy button copies just that section, heading included", async () => {
    const writeText = stubClipboard();
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    const brief = container.querySelector('[data-testid="brief-section"]');
    const copyButton = brief?.querySelector(
      '[data-testid="copy-button"]',
    ) as HTMLButtonElement;
    expect(copyButton).not.toBeNull();
    copyButton.click();

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied.startsWith("## Brief")).toBe(true);
    expect(copied).toContain("Customers can't sort");
    // Only the Brief section's text — not the whole plan.
    expect(copied).not.toContain("## Phase 1");
  });
});

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

describe("PlanDetail — brief section is collapsible (T21, Phase 6)", () => {
  it("T21 — Brief section is rendered inside a CollapsibleSection with aria-expanded control, defaulting to open", async () => {
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    const brief = container.querySelector('[data-testid="brief-section"]');
    expect(brief).not.toBeNull();
    // The collapsible control is the CollapsibleSection's header button — it
    // carries aria-expanded. The Brief section must contain exactly one such
    // control wrapping its content (parity with Test Plan and ADR sections).
    const toggle = brief?.querySelector("[aria-expanded]");
    expect(
      toggle,
      "Brief section must contain an aria-expanded toggle (CollapsibleSection) — currently rendered inline without collapse control",
    ).not.toBeNull();
    // Default state is expanded (defaultOpen={true}).
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    // Clicking collapses the section.
    (toggle as HTMLElement | null)?.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  });

  it("T21 — collapsing the Brief section hides its content", async () => {
    const { container } = await render(<PlanDetail plan={mockPlan()} />);
    const brief = container.querySelector('[data-testid="brief-section"]');
    expect(brief?.textContent).toContain("Customers can't sort");

    const toggle = brief?.querySelector(
      "[aria-expanded]",
    ) as HTMLElement | null;
    expect(toggle).not.toBeNull();
    toggle?.click();
    await new Promise((r) => setTimeout(r, 50));

    // After collapse the brief markdown is not rendered.
    expect(brief?.textContent ?? "").not.toContain("Customers can't sort");
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

  // Originally asserted the falsification empty state also renders here; that
  // pinned the pre-grouping bug where a doc-less plan (e.g. a parent carrying
  // only master.md) showed a stray "Falsification" heading on an otherwise
  // blank page. dawn-ui-plan-grouping Phase 3 declares that a bug: a plan
  // with no documents renders header-only.
  it("T14 — plan with no documents at all renders header only, no stray empty sections", async () => {
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
      container.querySelector('[data-testid="falsification-section"]'),
    ).toBeNull();
  });
});

/**
 * T26/T27 (Phase 8) — when an impl.md contains a falsification phase (title
 * contains "Falsification" case-insensitively), PlanDetail splits the phase
 * list into three positional groups:
 *   - pre phases      → main Phases section (`data-testid="phases-section"`)
 *   - falsification   → FalsificationSection rendering phase-sourced content
 *   - post phases     → Follow-up Phases section (`data-testid="followup-phases-section"`)
 *
 * T28 — legacy plans (no falsification phase in impl, but `plan.falsification`
 * populated from `falsification.md`) continue to render via the log-based path.
 */
describe("PlanDetail — falsification phase-authoring rendering (T27, Phase 8)", () => {
  function mockMixedPhasePlan(): Plan {
    return {
      name: "mixed-phase-plan",
      status: "in-progress",
      archived: false,
      impl: {
        frontmatter: { title: "Mixed", status: "in-progress" },
        content: `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | Regular Phase 1 assertion | Phase 0 | Phase 1 | passing |
| T2 | Falsification hypothesis A | Phase 0 | Phase 2 | passing |
| T3 | Follow-up Phase 3 assertion | Phase 0 | Phase 3 | passing |

## Checklist

### Phase 1: Regular pre-phase

- [x] Do initial work

#### Phase 1 Verification
- [x] T1 passes

### Phase 2: Falsification — hypotheses that matter

- [x] Fix a thing found by the ritual
- [ ] Second fix still open

#### Phase 2 Verification
- [x] T2 passes

### Phase 3: Follow-up polish

- [x] Cleanup derived from the falsification

#### Phase 3 Verification
- [x] T3 passes
`,
        trajectory: {
          present: true,
          deferred: [],
          rows: [
            {
              id: "T1",
              asserts: "Regular Phase 1 assertion",
              writableAt: 0,
              passesAt: 1,
              state: "passing",
            },
            {
              id: "T2",
              asserts: "Falsification hypothesis A",
              writableAt: 0,
              passesAt: 2,
              state: "passing",
            },
            {
              id: "T3",
              asserts: "Follow-up Phase 3 assertion",
              writableAt: 0,
              passesAt: 3,
              state: "passing",
            },
          ],
        },
      },
    };
  }

  it("T27 — Phase 2 (Falsification) is EXTRACTED from the Phases section and rendered as Falsification", async () => {
    const { container } = await render(
      <PlanDetail plan={mockMixedPhasePlan()} />,
    );

    // Main Phases section contains Phase 1 only (Phase 2 hoisted out)
    const phasesSection = container.querySelector(
      '[data-testid="phases-section"]',
    );
    expect(phasesSection).not.toBeNull();
    const phasesText = phasesSection?.textContent ?? "";
    expect(phasesText).toContain("Phase 1");
    expect(phasesText).not.toContain("Phase 2: Falsification");
  });

  it("T27 — Falsification section renders Phase 2's trajectory rows as hypotheses + checklist as fix items", async () => {
    const { container } = await render(
      <PlanDetail plan={mockMixedPhasePlan()} />,
    );

    const falsification = container.querySelector(
      '[data-testid="falsification-section"]',
    );
    expect(falsification).not.toBeNull();

    // Hypotheses table (trajectory rows passing at Phase 2)
    const hypotheses = container.querySelector(
      '[data-testid="falsification-hypotheses"]',
    );
    expect(hypotheses).not.toBeNull();
    expect(hypotheses?.textContent).toContain("T2");
    expect(hypotheses?.textContent).toContain("Falsification hypothesis A");

    // Fix items list from the phase's checklist
    const fixItems = container.querySelector(
      '[data-testid="falsification-fix-items"]',
    );
    expect(fixItems).not.toBeNull();
    expect(fixItems?.textContent).toContain("Fix a thing found by the ritual");
    expect(fixItems?.textContent).toContain("Second fix still open");
  });

  it("T27 — Follow-up Phases section contains Phase 3 (after the falsification phase)", async () => {
    const { container } = await render(
      <PlanDetail plan={mockMixedPhasePlan()} />,
    );

    const followup = container.querySelector(
      '[data-testid="followup-phases-section"]',
    );
    expect(followup).not.toBeNull();
    expect(followup?.textContent).toContain("Phase 3");
    expect(followup?.textContent).toContain("Follow-up polish");
  });

  it("T27 — Follow-up Phases section is absent when no post-falsification phases exist", async () => {
    const plan = mockMixedPhasePlan();
    // Trim impl so Phase 3 is gone — falsification is now the last phase
    if (plan.impl) {
      plan.impl = {
        ...plan.impl,
        content: plan.impl.content
          .split("### Phase 3")[0]
          .trimEnd()
          .concat("\n"),
      };
    }
    const { container } = await render(<PlanDetail plan={plan} />);
    expect(
      container.querySelector('[data-testid="followup-phases-section"]'),
    ).toBeNull();
  });
});

describe("PlanDetail — collapsible section state persists (T30, Phase 9)", () => {
  it("T30 — PlanDetail wires a plan-scoped persistKey into the Brief section, so pre-seeded localStorage renders the Brief closed on first render", async () => {
    // Simulate "user closed Brief on a prior visit"
    localStorage.setItem("plan:alpha-feature:section:brief", "0");

    const { container } = await render(<PlanDetail plan={mockPlan()} />);

    // Brief section is present but its button reports closed state — even
    // though the in-code defaultOpen={true} would otherwise render it open.
    const briefButton = container.querySelector(
      '[data-testid="brief-section"] button',
    );
    expect(briefButton).not.toBeNull();
    expect(briefButton?.getAttribute("aria-expanded")).toBe("false");
  });

  it("T30 — absent localStorage value falls back to defaultOpen (Brief open on first-ever visit)", async () => {
    // No prior storage — fresh user
    expect(localStorage.getItem("plan:alpha-feature:section:brief")).toBeNull();

    const { container } = await render(<PlanDetail plan={mockPlan()} />);

    const briefButton = container.querySelector(
      '[data-testid="brief-section"] button',
    );
    expect(briefButton?.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("PlanDetail — legacy falsification.md rendering still works (T28, Phase 8)", () => {
  it("T28 — legacy plan (no falsification phase in impl, falsification.md present) renders hypothesis items from the log", async () => {
    const legacyPlan: Plan = {
      name: "legacy-falsification",
      status: "completed",
      archived: true,
      impl: {
        frontmatter: { title: "Legacy", status: "completed" },
        content: `### Phase 1: Regular work

- [x] Item one

#### Phase 1 Verification
- [x] All good
`,
      },
      falsification: {
        complete: true,
        entries: [
          {
            kind: "hypothesis",
            timestamp: "2026-04-15T12:00:00.000Z",
            hypothesis: "Something could be broken here",
            outcome: "fix-in-scope",
            testPath: "src/legacy.test.ts",
          },
          {
            kind: "terminator",
            timestamp: "2026-04-15T12:30:00.000Z",
            reason: "No more hypotheses",
          },
        ],
      },
    };
    const { container } = await render(<PlanDetail plan={legacyPlan} />);

    // Falsification section renders — not the empty state, not the phase path
    expect(
      container.querySelector('[data-testid="falsification-section"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="falsification-empty"]'),
    ).toBeNull();

    // Log-based rendering: hypothesis-{outcome} items present
    expect(
      container.querySelector('[data-testid="hypothesis-fix-in-scope"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="falsification-terminator"]'),
    ).not.toBeNull();

    // Phase-based fix-items marker is absent (we're on the log path)
    expect(
      container.querySelector('[data-testid="falsification-fix-items"]'),
    ).toBeNull();
  });
});

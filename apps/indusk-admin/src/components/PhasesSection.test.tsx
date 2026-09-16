import type { Trajectory } from "@infinitedusky/indusk-mcp/trajectory/parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";

// PlanDetail imports next/link — stub it like every other browser test.
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

beforeEach(() => {
  if (typeof window !== "undefined") localStorage.clear();
});

/**
 * admin-ui-phase-progress — A1, A2, A4, A5.
 *
 * Authored RED in Test Phase 1 against the admin's private phase regex, which
 * matches only `### Phase N`: `### Test Phase 1` and `### Build Phase N` both
 * fail to match and fold into the previous phase's markdown, gate headings are
 * not parsed, and rows attach by bare number. Build Phase 3 replaces the
 * regex with the package parser; these go green there.
 *
 * The fixture is the shape every impl in this repository has had since
 * test-phase-structure (2026-08-12): one test phase, then build phases, each
 * with its gate blocks, one of them carrying an OTel gate.
 */

const IMPL = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | Test phase row | Test Phase 1 | Test Phase 1 | passing |
| A2 | Build row | Test Phase 1 | Build Phase 2 | written |

## Checklist

### Test Phase 1: Author red

- [x] author A1
- [x] author A2

#### Test Phase 1 Verification
- [x] A1 red

#### Test Phase 1 Context
- [ ] a note for CLAUDE.md

#### Test Phase 1 Document
- [x] (none needed — asked: "skip the test-phase doc?" — user: "yes")

### Build Phase 1: First

- [x] item one
- [x] item two
- [ ] item three

#### Build Phase 1 OTel
- [ ] add spans to the thing

#### Build Phase 1 Verification
- [x] A1 passes

#### Build Phase 1 Context
- [ ] a CLAUDE.md line

#### Build Phase 1 Document
- [x] (none needed — asked: "Build Phase 1 is internal; skip the document gate?" — user: "yes, skip it")

### Build Phase 2: Second

- [ ] only item

#### Build Phase 2 Verification
- [ ] A2 passes

#### Build Phase 2 Context
- [ ] ctx

#### Build Phase 2 Document
- [ ] doc
`;

function trajectory(): Trajectory {
  return {
    present: true,
    deferred: [],
    rows: [
      {
        id: "A1",
        asserts: "Test phase row",
        writableAt: 1,
        writableAtKind: "test",
        passesAt: 1,
        passesAtKind: "test",
        state: "passing",
      },
      {
        id: "A2",
        asserts: "Build row",
        writableAt: 1,
        writableAtKind: "test",
        passesAt: 2,
        passesAtKind: "build",
        state: "written",
      },
    ],
  };
}

function plan(): Plan {
  return {
    name: "two-sequences",
    status: "in-progress",
    archived: false,
    impl: {
      frontmatter: { title: "Two sequences", status: "in-progress" },
      content: IMPL,
      trajectory: trajectory(),
    },
  };
}

/** The Implementation Plan section is closed by default; open it so the phases render. */
async function openImplPlan(container: Element) {
  const button = container.querySelector(
    '[data-testid="phases-section"] [aria-expanded="false"]',
  ) as HTMLElement | null;
  button?.click();
  await new Promise((r) => setTimeout(r, 50));
}

/** Every phase is a collapsible; open them all so content assertions see the body. */
async function openAllPhases(container: Element) {
  for (const button of container.querySelectorAll(
    '[data-testid="phases-section"] button[aria-expanded="false"]',
  )) {
    (button as HTMLButtonElement).click();
  }
  await new Promise((r) => setTimeout(r, 50));
}

function phases(container: Element): HTMLElement[] {
  return Array.from(
    container.querySelectorAll(
      '[data-testid="phases-section"] [data-testid="phase"]',
    ),
  );
}

describe("A1 — Test and Build phases render as their own phases, in document order", () => {
  it("shows three phases keyed test-1, build-1, build-2, each with only its own items", async () => {
    const { container } = await render(<PlanDetail plan={plan()} />);
    await openImplPlan(container);
    await openAllPhases(container);
    const found = phases(container);
    expect(found.map((p) => p.getAttribute("data-phase"))).toEqual([
      "test-1",
      "build-1",
      "build-2",
    ]);
    const [test1, build1, build2] = found;
    expect(test1.textContent).toContain("author A1");
    expect(test1.textContent).not.toContain("item one");
    expect(build1.textContent).toContain("item three");
    expect(build1.textContent).not.toContain("only item");
    expect(build2.textContent).toContain("only item");
    expect(build2.textContent).not.toContain("item three");
  });
});

describe("A2 — rows attach to the phase they pass at, by kind", () => {
  it("A1 (passes at Test Phase 1) sits under test-1 and not under build-1", async () => {
    const { container } = await render(<PlanDetail plan={plan()} />);
    await openImplPlan(container);
    await openAllPhases(container);
    expect(phases(container)).toHaveLength(3);
    const [test1, build1, build2] = phases(container);
    expect(test1.textContent).toContain("Test phase row");
    expect(build1.textContent).not.toContain("Test phase row");
    expect(build2.textContent).toContain("Build row");
  });
});

describe("A4 — each phase shows its stages with a state", () => {
  it("build-1: implementation 2 of 3, Verification done, Context pending, Document opted-out with proof", async () => {
    const { container } = await render(<PlanDetail plan={plan()} />);
    await openImplPlan(container);
    expect(phases(container)).toHaveLength(3);
    const build1 = phases(container)[1];
    const stage = (name: string) =>
      build1.querySelector(`[data-stage="${name}"]`);
    expect(stage("implementation")?.textContent).toContain("2 of 3");
    expect(stage("Verification")?.getAttribute("data-state")).toBe("done");
    expect(stage("Context")?.getAttribute("data-state")).toBe("pending");
    expect(stage("Document")?.getAttribute("data-state")).toBe("opted-out");
    expect(stage("Document")?.textContent).toContain(
      "Build Phase 1 is internal; skip the document gate?",
    );
  });
});

describe("A5 — an OTel gate is its own stage", () => {
  it("build-1's OTel items appear under an OTel stage, not inside implementation", async () => {
    const { container } = await render(<PlanDetail plan={plan()} />);
    await openImplPlan(container);
    expect(phases(container)).toHaveLength(3);
    const build1 = phases(container)[1];
    const otel = build1.querySelector('[data-stage="OTel"]');
    expect(otel).not.toBeNull();
    expect(otel?.getAttribute("data-state")).toBe("pending");
    expect(
      build1.querySelector('[data-stage="implementation"]')?.textContent,
    ).not.toContain("add spans");
  });
});

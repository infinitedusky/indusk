import type { Trajectory } from "@infinitedusky/indusk-mcp/trajectory/parser";
import { describe, expect, it } from "vitest";
import {
  checklistMarkdown,
  falsificationLogMarkdown,
  falsificationPhaseMarkdown,
  phaseMarkdown,
  planMarkdown,
  sectionMarkdown,
  trajectoryTableMarkdown,
} from "./markdown-export";
import { extractPhases } from "./phases";
import type { Plan } from "./planning-reader";

function trajectoryWith(rows: Trajectory["rows"]): Trajectory {
  return { rows, deferred: [], present: true };
}

describe("sectionMarkdown", () => {
  it("prefixes the body with a level-2 heading", () => {
    expect(sectionMarkdown("Brief", "Some content.")).toBe(
      "## Brief\n\nSome content.",
    );
  });

  it("omits the blank body when there is no content", () => {
    expect(sectionMarkdown("Falsification", "")).toBe("## Falsification");
  });
});

describe("trajectoryTableMarkdown", () => {
  it("returns an empty string for no rows", () => {
    expect(trajectoryTableMarkdown([])).toBe("");
  });

  it("renders a pipe table matching the UI's column order", () => {
    const md = trajectoryTableMarkdown([
      {
        id: "T1",
        asserts: "does the thing",
        writableAt: 1,
        passesAt: 2,
        state: "passing",
      },
    ]);
    expect(md).toBe(
      [
        "| ID | Asserts | Writable at | Passes at | State |",
        "| --- | --- | --- | --- | --- |",
        "| T1 | does the thing | Phase 1 | Phase 2 | passing |",
      ].join("\n"),
    );
  });
});

describe("checklistMarkdown", () => {
  it("renders checked and unchecked items as GFM task list items", () => {
    const md = checklistMarkdown([
      { text: "done thing", checked: true },
      { text: "todo thing", checked: false },
    ]);
    expect(md).toBe("- [x] done thing\n- [ ] todo thing");
  });
});

describe("phaseMarkdown", () => {
  it("includes the phase heading, trajectory table, and body content", () => {
    const [phase] = extractPhases(
      "### Phase 1: First\nSome phase content.",
      trajectoryWith([
        {
          id: "T1",
          asserts: "asserts thing",
          writableAt: 1,
          passesAt: 1,
          state: "passing",
        },
      ]),
    );
    const md = phaseMarkdown(phase);
    expect(md.startsWith("## Phase 1: First\n\n")).toBe(true);
    expect(md).toContain("| T1 |");
    expect(md).toContain("Some phase content.");
  });

  it("omits the table when the phase has no trajectory rows", () => {
    const [phase] = extractPhases("### Phase 2: Second\nBody only.");
    const md = phaseMarkdown(phase);
    expect(md).toBe("## Phase 2: Second\n\nBody only.");
  });
});

describe("falsificationLogMarkdown", () => {
  it("renders the empty state when no falsification data exists", () => {
    expect(falsificationLogMarkdown(undefined)).toBe(
      "## Falsification\n\nNo falsification ritual run for this plan.",
    );
  });

  it("renders hypotheses and a terminator when present", () => {
    const md = falsificationLogMarkdown({
      complete: true,
      entries: [
        {
          kind: "hypothesis",
          hypothesis: "Something is broken",
          testPath: "src/foo.test.ts",
          outcome: "fix-in-scope",
          timestamp: "2026-01-01T00:00:00Z",
        },
        {
          kind: "terminator",
          reason: "No more hypotheses",
          timestamp: "2026-01-01T00:01:00Z",
        },
      ],
    });
    expect(md).toContain("## Falsification");
    expect(md).toContain("**Hypothesis (fix-in-scope)**");
    expect(md).toContain("Something is broken");
    expect(md).toContain("`src/foo.test.ts`");
    expect(md).toContain("**Terminated:** No more hypotheses");
  });
});

describe("falsificationPhaseMarkdown", () => {
  it("renders hypotheses table and fix items from a falsification phase", () => {
    const [phase] = extractPhases(
      "### Phase 3: Falsification — hunt\n- [x] fixed one\n- [ ] fix two",
      trajectoryWith([
        {
          id: "H1",
          asserts: "hypothesis one",
          writableAt: 3,
          passesAt: 3,
          state: "passing",
        },
      ]),
    );
    const md = falsificationPhaseMarkdown(phase);
    expect(
      md.startsWith("## Falsification (Phase 3: Falsification — hunt)"),
    ).toBe(true);
    expect(md).toContain("### Hypotheses");
    expect(md).toContain("| H1 |");
    expect(md).toContain("### Fix items");
    expect(md).toContain("- [x] fixed one");
    expect(md).toContain("- [ ] fix two");
  });
});

describe("planMarkdown", () => {
  function makePlan(overrides: Partial<Plan> = {}): Plan {
    return {
      name: "demo-plan",
      status: "in-progress",
      archived: false,
      ...overrides,
    };
  }

  it("always includes a title and status line", () => {
    const md = planMarkdown(makePlan());
    expect(md.startsWith("# demo-plan\n\nStatus: in-progress")).toBe(true);
  });

  it("concatenates present sections in render order, separated by rules", () => {
    const plan = makePlan({
      brief: { frontmatter: {}, content: "The brief body." },
      testPlan: { frontmatter: {}, content: "The test plan body." },
    });
    const md = planMarkdown(plan);
    const briefIdx = md.indexOf("## Brief");
    const testPlanIdx = md.indexOf("## Test Plan");
    expect(briefIdx).toBeGreaterThan(-1);
    expect(testPlanIdx).toBeGreaterThan(briefIdx);
    expect(md).toContain("---");
  });

  it("omits sections whose document is absent", () => {
    const md = planMarkdown(makePlan());
    expect(md).not.toContain("## Brief");
    expect(md).not.toContain("## Research");
  });

  it("splits impl phases around the falsification phase like PlanDetail does", () => {
    const plan = makePlan({
      impl: {
        frontmatter: {},
        content: [
          "### Phase 1: First",
          "First content.",
          "",
          "### Phase 2: Falsification — hunt",
          "- [x] fixed",
          "",
          "### Phase 3: Follow-up",
          "Follow-up content.",
        ].join("\n"),
      },
    });
    const md = planMarkdown(plan);
    const pre = md.indexOf("## Phase 1: First");
    const fals = md.indexOf("## Falsification");
    const post = md.indexOf("## Phase 3: Follow-up");
    expect(pre).toBeGreaterThan(-1);
    expect(fals).toBeGreaterThan(pre);
    expect(post).toBeGreaterThan(fals);
  });
});

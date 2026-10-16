// promise: a-master-plan-tells-its-story
// promise: the-nav-says-where-a-plan-is
import { derivePlanPosition } from "@infinitedusky/indusk-mcp/lifecycle";
import { planSteps } from "@infinitedusky/indusk-mcp/plans/steps";
import { describe, expect, it } from "vitest";
import { snapshotOf } from "@/lib/plan-snapshot";
import { planStage } from "@/lib/plan-stage";
import type { Plan } from "@/lib/planning-reader";

const plan = (over: Partial<Plan> = {}): Plan =>
  ({
    name: "p",
    title: "P",
    description: null,
    status: "in-progress",
    archived: false,
    ...over,
  }) as Plan;

interface Life {
  /** The document the plan is at, and its status. */
  stage: "brief" | "test-plan" | "impl";
  status: string;
  /** What the retrospective gate still misses, for a completed impl. */
  missing?: string[];
  /** The review accepted the built plan. */
  accepted?: boolean;
}

/** A bugfix plan at one point of its life, positioned by the real `derivePlanPosition`. */
function planAt(life: Life): Plan {
  const documents = ["brief.md", "test-plan.md", "impl.md"].slice(
    0,
    life.stage === "brief" ? 1 : life.stage === "test-plan" ? 2 : 3,
  );
  const position = derivePlanPosition({
    summary: {
      name: "p",
      stage: life.stage,
      stageStatus: life.status,
      nextStep: "",
      dependencies: [],
      documents,
      workflow: "bugfix",
    },
    impl: life.accepted ? ({ accepted: true, phases: [] } as never) : null,
    readiness: {
      missing: life.missing ?? [],
      nonTerminalRows: [],
      unprovenPromises: [],
      longSkipReasons: [],
    } as never,
    archived: false,
  });
  const fm = (status: string) => ({ frontmatter: { status } }) as never;
  const done = life.stage !== "brief" ? "accepted" : life.status;
  return plan({
    status: life.stage === "impl" ? life.status : "unknown",
    workflow: "bugfix",
    position,
    brief: fm(life.stage === "brief" ? life.status : "accepted"),
    ...(life.stage !== "brief"
      ? { testPlan: fm(life.stage === "test-plan" ? life.status : done) }
      : {}),
    ...(life.stage === "impl" ? { impl: fm(life.status) } : {}),
  });
}

/** What the page shows: the first step of either workflow worked on or waiting on the person, else the next. */
function pageStep(p: Plan): string | undefined {
  const { planning, release } = planSteps(snapshotOf(p));
  const all = [...planning, ...release];
  return (
    all.find((s) => s.state === "current" || s.state === "needs-you")?.name ??
    all.find((s) => s.state === "not-yet")?.name
  );
}

/** A23 - the one rule the nav row and the master page both ask. */
describe("planStage", () => {
  it("reads what the plan waits on before anything else", () => {
    expect(planStage(plan(), true, { p: "Review" })).toBe("Review");
  });

  it("reads Released for a released plan that waits on nothing", () => {
    expect(planStage(plan(), true, {})).toBe("Released");
    expect(planStage(plan(), true, undefined)).toBe("Released");
  });

  // A1 - the nav names the step the page shows at every point before release.
  const lives: Array<[string, Life]> = [
    ["an accepted brief", { stage: "brief", status: "accepted" }],
    ["a proposed test plan", { stage: "test-plan", status: "proposed" }],
    ["a draft impl", { stage: "impl", status: "draft" }],
    ["an approved impl not yet built", { stage: "impl", status: "approved" }],
    ["an impl being built", { stage: "impl", status: "in-progress" }],
    [
      "a built plan missing falsification",
      {
        stage: "impl",
        status: "completed",
        missing: ["falsification", "cleanup", "audit"],
      },
    ],
    [
      "a falsified plan missing cleanup",
      { stage: "impl", status: "completed", missing: ["cleanup", "audit"] },
    ],
    [
      "a cleaned plan missing its audit",
      { stage: "impl", status: "completed", missing: ["audit"] },
    ],
    ["an audited plan awaiting review", { stage: "impl", status: "completed" }],
    [
      "an accepted plan awaiting its release",
      { stage: "impl", status: "completed", accepted: true },
    ],
  ];

  for (const [what, life] of lives) {
    it(`A1 — ${what} reads the step its page shows`, () => {
      const p = planAt(life);
      const shown = pageStep(p);
      expect(shown, "the page shows a step").toBeDefined();
      expect(planStage(p, false, {})).toBe(shown);
    });
  }

  it("A1 — a built plan that has not been falsified reads Falsify, never completed", () => {
    const p = planAt({
      stage: "impl",
      status: "completed",
      missing: ["falsification", "cleanup", "audit"],
    });
    expect(planStage(p, false, {})).toBe("Falsify");
    expect(planStage(p, false, {})).not.toBe("completed");
  });

  // A4 - a plan waiting on the person reads what it waits at, ahead of its step and of Released.
  it("A4 — what the plan waits on comes before its step and before Released", () => {
    const built = planAt({
      stage: "impl",
      status: "completed",
      missing: ["falsification", "cleanup", "audit"],
    });
    expect(planStage(built, false, { p: "Review" })).toBe("Review");
    expect(planStage(built, true, { p: "Review" })).toBe("Review");
  });

  // A6 - a released plan reads Released, archived or not.
  it("A6 — a released plan reads Released, archived or not", () => {
    expect(
      planStage(plan({ archived: true, status: "completed" }), true, {}),
    ).toBe("Released");
    expect(
      planStage(plan({ archived: false, status: "completed" }), true, {}),
    ).toBe("Released");
  });
});

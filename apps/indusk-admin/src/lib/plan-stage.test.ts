// promise: a-master-plan-tells-its-story
import { describe, expect, it } from "vitest";
import { statusToNavMark } from "@/components/ui/badge-variant";
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

/** A23 - the one rule the nav row and the master page both ask. */
describe("planStage", () => {
  it("reads what the plan waits on before anything else", () => {
    expect(planStage(plan(), true, { p: "Review" })).toBe("Review");
  });

  it("reads Released for a released plan that waits on nothing", () => {
    expect(planStage(plan(), true, {})).toBe("Released");
    expect(planStage(plan(), true, undefined)).toBe("Released");
  });

  it("reads each status as the nav mark says it", () => {
    for (const status of ["draft", "in-progress", "completed"]) {
      const p = plan({ status } as Partial<Plan>);
      expect(planStage(p, false, { other: "Review" })).toBe(
        statusToNavMark(p.status, p.archived).stage,
      );
    }
  });
});

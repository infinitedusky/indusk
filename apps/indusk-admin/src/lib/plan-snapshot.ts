import type { PlanSnapshot } from "@infinitedusky/indusk-mcp/plans/steps";
import type { Plan } from "@/lib/planning-reader";

/**
 * The page's `Plan` as the package's snapshot — facts only, no derivation.
 * What `plans/steps` and `plans/waiting` read; fs-to-props glue, shared by the
 * plan page's workflows and the nav's Needs you.
 */
export function snapshotOf(plan: Plan): PlanSnapshot & { name: string } {
  return {
    name: plan.name,
    workflow: plan.workflow ?? null,
    position: plan.position,
    documents: {
      research: plan.research?.frontmatter,
      brief: plan.brief?.frontmatter,
      "test-plan": plan.testPlan?.frontmatter,
      adr: plan.adr?.frontmatter,
      impl: plan.impl?.frontmatter,
    } as PlanSnapshot["documents"],
    skippedRituals: plan.skippedRituals,
    finishedRituals: plan.finishedRituals,
    planReview: plan.planReview,
    ...(plan.live ? { live: plan.live } : {}),
  };
}

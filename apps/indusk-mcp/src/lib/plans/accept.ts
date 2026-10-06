import { implPath, planBranch, refuseInsideBuildStep, setImplKeys } from "./plan-branch.js";

/**
 * `indusk plans accept <name>` (admin-plan-authoring, ADR D3): the person, or
 * a workflow set to accept on its own, says the build may ship. Recorded in
 * the impl's frontmatter and committed on the plan's branch, where `plans
 * land` reads it.
 */

export type AcceptedBy = "person" | "auto";

export interface AcceptedPlan {
	plan: string;
	accepted: string;
	acceptedBy: AcceptedBy;
}

export async function acceptPlan(
	anyCheckout: string,
	plan: string,
	by: AcceptedBy = "person",
	now: Date = new Date(),
): Promise<AcceptedPlan> {
	refuseInsideBuildStep("accepted", plan);
	const pb = await planBranch(anyCheckout, plan);
	const accepted = now.toISOString();
	await setImplKeys(
		pb,
		implPath(pb),
		{ accepted, accepted_by: by },
		`plan(${plan}): accepted${by === "auto" ? " by its workflow" : ""}`,
	);
	return { plan, accepted, acceptedBy: by };
}

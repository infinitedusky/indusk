import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
	implPath,
	planBranch,
	refuseInsideBuildStep,
	setFrontmatterKeys,
	setImplKeys,
} from "./plan-branch.js";
import { commitAtRoot, workbenchPlan } from "./workbench-plan.js";

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
	const accepted = now.toISOString();
	const message = `plan(${plan}): accepted${by === "auto" ? " by its workflow" : ""}`;
	// A workbench plan's impl lives at the workbench root, committed there.
	const wp = await workbenchPlan(anyCheckout, plan);
	if (wp) {
		const impl = join(wp.dir, "impl.md");
		writeFileSync(
			impl,
			setFrontmatterKeys(readFileSync(impl, "utf-8"), { accepted, accepted_by: by }),
		);
		await commitAtRoot(wp.root, [relative(wp.root, impl)], message);
		return { plan, accepted, acceptedBy: by };
	}
	const pb = await planBranch(anyCheckout, plan);
	await setImplKeys(pb, implPath(pb), { accepted, accepted_by: by }, message);
	return { plan, accepted, acceptedBy: by };
}

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseBriefContract } from "../promises/brief-contract.js";
import {
	describeInterfaceFiles,
	interfaceFilesAmong,
	listsALook,
} from "../promises/interface-files.js";
import {
	branchFileChanges,
	implPath,
	type PlanBranch,
	PlanCommandRefusal,
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
 *
 * Refused, with nothing written, when the branch changed files under an app's
 * declared interface while its brief lists no look (brief-as-the-contract ADR
 * D2): approval caught the plan that said what it would change; this catches
 * the one that changed more than it said.
 *
 * promise: a-brief-lists-its-looks
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
	await refuseUnlistedInterfaceChanges(pb);
	await setImplKeys(pb, implPath(pb), { accepted, accepted_by: by }, message);
	return { plan, accepted, acceptedBy: by };
}

/**
 * The branch's real diff against the trunk, held to the brief: a file under an
 * app's interface changed while the brief lists no look is refused, naming the
 * files. The way forward is an amendment — the brief gains the look and a
 * person approves it — not accepting over the gap. A brief written before
 * promises were part of one is not held to it, as at approval.
 */
async function refuseUnlistedInterfaceChanges(pb: PlanBranch): Promise<void> {
	const briefPath = join(pb.dir, "brief.md");
	if (!existsSync(briefPath)) return;
	const brief = parseBriefContract(readFileSync(briefPath, "utf-8"));
	if (brief.shape !== "contract" || listsALook(brief.looks)) return;
	const changed = await branchFileChanges(pb.trunk, pb.trunkBranch, pb.branch);
	const files = interfaceFilesAmong(
		pb.worktree,
		changed.map((f) => f.path),
	);
	if (files.length === 0) return;
	const said = brief.looks === null ? "has no Looks section" : "says None for its looks";
	throw new PlanCommandRefusal(
		`${pb.plan} changed ${describeInterfaceFiles(files)}, which changes how something looks, and its brief ${said} — amend the brief to list each look the change makes, changes or replaces, and have a person approve the amendment, before the plan is accepted`,
	);
}

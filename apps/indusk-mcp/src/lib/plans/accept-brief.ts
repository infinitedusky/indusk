import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { checkPlanContract } from "../promises/contract.js";
import {
	PlanCommandRefusal,
	planBranch,
	refuseInsideBuildStep,
	setFrontmatterKeys,
	setImplKeys,
} from "./plan-branch.js";
import { commitAtRoot, workbenchPlan } from "./workbench-plan.js";

/**
 * `indusk plans accept-brief <name>` (a-brief-is-planned-unasked, ADR decision
 * 1): the person says the brief is settled. Until now that was a hand edit of
 * the brief's status, with no moment to start anything from; this is the
 * moment. It is refused, with nothing written, when the brief is not a draft
 * or when the plan's contract check refuses, with the check's own messages: a
 * brief whose promises the registry does not hold, or whose expectations have
 * no measure, is not ready to plan from.
 *
 * Refused inside any build step: a session that plans or builds does not
 * decide the brief is settled.
 *
 * promise: an-accepted-brief-is-planned-unasked
 */

export interface AcceptedBrief {
	plan: string;
}

export async function acceptBrief(anyCheckout: string, plan: string): Promise<AcceptedBrief> {
	refuseInsideBuildStep("given an accepted brief", plan);
	const message = `plan(${plan}): brief accepted`;
	const wp = await workbenchPlan(anyCheckout, plan);
	if (wp) {
		const brief = readDraftBrief(wp.dir, plan);
		refuseFailingContract(wp.root, plan);
		writeFileSync(brief.path, setFrontmatterKeys(brief.text, acceptedKeys()));
		await commitAtRoot(wp.root, [relative(wp.root, brief.path)], message);
		return { plan };
	}
	const pb = await planBranch(anyCheckout, plan);
	const brief = readDraftBrief(pb.dir, plan);
	refuseFailingContract(pb.worktree, plan);
	// `setImplKeys` sets frontmatter keys in any plan document and commits that file alone.
	await setImplKeys(pb, brief.path, acceptedKeys(), message);
	return { plan };
}

/**
 * `accepted_at` is written beside the status, quoted (a bare timestamp is a
 * date to YAML). It sits in the brief, so the approval's hash of the brief
 * covers it: acceptance always precedes approval, so the hash is taken of a
 * brief that already holds it and nothing writes it afterwards.
 */
const acceptedKeys = (): Record<string, string> => ({
	status: "accepted",
	accepted_at: JSON.stringify(new Date().toISOString()),
});

function readDraftBrief(dir: string, plan: string): { path: string; text: string } {
	const path = join(dir, "brief.md");
	if (!existsSync(path)) throw new PlanCommandRefusal(`${plan} has no brief.md in ${dir}`);
	const text = readFileSync(path, "utf-8");
	const status = matter(text).data.status;
	if (status !== "draft") {
		throw new PlanCommandRefusal(
			`${plan}'s brief is ${status === undefined ? "without a status" : status}, not a draft: only a draft brief is accepted`,
		);
	}
	return { path, text };
}

function refuseFailingContract(checkout: string, plan: string): void {
	const contract = checkPlanContract(checkout, plan);
	if (!contract.ok) {
		throw new PlanCommandRefusal(
			[
				`${plan}'s brief cannot be accepted; its contract check refuses:`,
				...contract.refusals.map((r) => `  ${r.message}`),
			].join("\n"),
		);
	}
}

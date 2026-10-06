import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { getPlanningDir } from "../config.js";
import { git } from "../git.js";
import { isUsableSegment } from "../path-segment.js";
import { WORKFLOW_TYPES, type WorkflowType } from "../workflow-types.js";
import { createPlanWorktree, PlanWorktreeRefusal } from "../worktree/plan-worktree-commands.js";
import { canonical, resolvePlanCopies } from "../worktree/plan-worktrees.js";
import { PlanCommandRefusal } from "./plan-branch.js";

/**
 * `indusk plans start <type> <name>` (admin-plan-authoring, ADR D3): a plan
 * begins on its own branch, in its own worktree, with its first document
 * declaring its type. Nothing is written on the trunk; the documents reach it
 * when the plan is approved.
 */

export interface StartedPlan {
	plan: string;
	type: WorkflowType;
	worktree: string;
	branch: string;
	/** The document written, relative to the worktree. */
	document: string;
}

export async function startPlan(
	anyCheckout: string,
	type: string,
	plan: string,
	now: Date = new Date(),
): Promise<StartedPlan> {
	if (!(WORKFLOW_TYPES as readonly string[]).includes(type)) {
		throw new PlanCommandRefusal(`${type} is not a workflow type (${WORKFLOW_TYPES.join(", ")})`);
	}
	if (!isUsableSegment(plan)) throw new PlanCommandRefusal(`"${plan}" is not a usable plan name`);

	const copies = await resolvePlanCopies(anyCheckout);
	if (!copies.ok) {
		throw new PlanCommandRefusal(
			`the worktree record ${copies.file} cannot be read: ${copies.problem}`,
		);
	}
	const trunk = copies.projectRoot;
	const existing = copies.copies.get(plan);
	if (existing?.source === "worktree") {
		throw new PlanCommandRefusal(
			`${plan} is already started, in its worktree ${existing.worktree.path} on ${existing.worktree.branch}`,
		);
	}
	const folder = join(getPlanningDir(trunk), plan);
	if (existsSync(folder)) {
		throw new PlanCommandRefusal(
			`${plan} already has a folder on the trunk, ${relative(trunk, folder)}`,
		);
	}
	const branch = `plan/${plan}`;
	const hasBranch = await git(trunk, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`)
		.then(() => true)
		.catch(() => false);
	if (hasBranch) throw new PlanCommandRefusal(`the branch ${branch} already exists`);

	const document = join(".indusk", "planning", plan, type === "spike" ? "research.md" : "brief.md");
	try {
		const { created } = await createPlanWorktree(trunk, plan, {
			seed: (worktree) => {
				const path = join(worktree, document);
				mkdirSync(join(worktree, ".indusk", "planning", plan), { recursive: true });
				writeFileSync(path, firstDocument(plan, type as WorkflowType, now));
			},
		});
		await git(created, "add", "--", document);
		await git(created, "commit", "-q", "-m", `plan(${plan}): started, ${type}`, "--", document);
		return { plan, type: type as WorkflowType, worktree: canonical(created), branch, document };
	} catch (err) {
		if (err instanceof PlanWorktreeRefusal) throw new PlanCommandRefusal(err.message);
		throw err;
	}
}

/** The plan's first document: a draft that declares the plan's type, for the planner to fill. */
function firstDocument(plan: string, type: WorkflowType, now: Date): string {
	const kind = type === "spike" ? "Research" : "Brief";
	return [
		"---",
		`title: "${plan}"`,
		`date: ${now.toISOString().slice(0, 10)}`,
		"status: draft",
		`workflow: ${type}`,
		"---",
		"",
		`# ${plan} — ${kind}`,
		"",
	].join("\n");
}

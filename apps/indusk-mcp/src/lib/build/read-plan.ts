import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { AUDIT_QUESTIONS, isAnswered, readAuditAnswers } from "../audit/answers.js";
import { registryClauses } from "../audit/clauses.js";
import { checkRetrospectiveReadiness } from "../cleanup/gate.js";
import { parseImplString } from "../impl-parser-core.js";
import { AmendmentsUnreadable, amendmentsOf } from "../plans/amendments.js";
import { parseTrajectory } from "../trajectory/parser.js";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import type { BuildPlan } from "./next-step.js";

/**
 * A plan as the build's decisions read it, from its live copy — its worktree
 * while it has one. The decisions themselves are pure; this is the one place
 * they meet the disk.
 */

export class BuildPlanUnreadable extends Error {}

/**
 * Whether `audit.md` exists and does not read complete: a file with a finding unanswered,
 * a clause naming nothing, or no causes is an audit begun, not done. No file is the
 * retrospective gate's `missing` list, not this. A registry that cannot be read checks
 * the shape alone (the command refuses by name).
 */
function auditIsOpen(dir: string, root: string): boolean {
	const path = join(dir, "audit.md");
	if (!existsSync(path)) return false;
	const held = registryClauses(root);
	const read = readAuditAnswers(readFileSync(path, "utf-8"), {
		questions: AUDIT_QUESTIONS,
		causes: true,
		...(held.ok ? { clauses: held.clauses } : {}),
	});
	return !isAnswered(read);
}

export async function readBuildPlan(
	anyCheckout: string,
	plan: string,
): Promise<BuildPlan & { dir: string; content: string }> {
	const live = await livePlanCopy(anyCheckout, plan);
	if (!live.ok)
		throw new BuildPlanUnreadable(
			`the worktree record ${live.file} cannot be read: ${live.problem}`,
		);
	const dir = live.copy.dir;
	const path = join(dir, "impl.md");
	if (!existsSync(path)) throw new BuildPlanUnreadable(`${plan} has no impl.md in ${dir}`);
	const content = readFileSync(path, "utf-8");
	// An approval that cannot be read is never "no amendments": the build cannot tell, so it stops
	// by name (`approvalUnreadable`) rather than failing the read.
	let approvalUnreadable: string | undefined;
	const amendments = await amendmentsOf(dir).catch((err: unknown) => {
		if (err instanceof AmendmentsUnreadable) {
			approvalUnreadable = err.message;
			return [];
		}
		throw err;
	});
	return {
		dir,
		content,
		amendments: amendments.map((a) => `${a.part} ${a.name}`),
		...(approvalUnreadable ? { approvalUnreadable } : {}),
		auditOpen: auditIsOpen(dir, live.copy.root),
		impl: parseImplString(content),
		trajectory: parseTrajectory(matter(content).content),
		readiness: checkRetrospectiveReadiness(dir, content),
	};
}

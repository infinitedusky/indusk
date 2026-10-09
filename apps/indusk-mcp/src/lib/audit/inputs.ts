import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { git } from "../git.js";
import { branchFileChanges, PlanCommandRefusal, planBranch } from "../plans/plan-branch.js";

/**
 * What the auditor is handed (plan-review-subagent, ADR D2): the plan's
 * documents, the impl as it was merged at approval, the trajectory table as it
 * stands, the branch's diff against the trunk without InDusk's bookkeeping, and
 * a `--stat` of the whole tree. Never the research, the conversation or the
 * builder's own findings — those live in the impl after approval, and git holds
 * the impl from before them.
 *
 * The approved impl is found by the approval merge's subject, never by a line
 * in the plan: `plans approve` writes `plan(<plan>): approved — …`.
 *
 * promise: the-auditor-sees-the-plan-not-the-session
 */

/** The audit cannot be handed its inputs; the message names the plan and what is missing. */
export class AuditInputsRefusal extends PlanCommandRefusal {}

export interface AuditText {
	path: string;
	text: string;
}

export interface AuditInputs {
	plan: string;
	/** The approval merge the impl was read at. */
	approvedAt: string;
	documents: { brief: AuditText; testPlan: AuditText; adr?: AuditText };
	implAsApproved: AuditText;
	trajectoryNow: AuditText;
	/** `git diff <merge-base>...<branch>` over the plan's code and docs. */
	diff: string;
	/** `git diff --stat <merge-base>...<branch>` over the whole tree. */
	stat: string;
}

/** The latest first-parent merge on the trunk whose subject starts `plan(<plan>): approved`, or null. */
export async function approvalMerge(
	trunk: string,
	trunkBranch: string,
	plan: string,
): Promise<string | null> {
	const log = await git(
		trunk,
		"log",
		"--first-parent",
		"--merges",
		"--format=%H%x00%s",
		trunkBranch,
	);
	const prefix = `plan(${plan}): approved`;
	for (const line of log.split("\n")) {
		const [sha, subject] = line.split("\0");
		if (sha && subject?.startsWith(prefix)) return sha;
	}
	return null;
}

/** InDusk's bookkeeping: anything under `.indusk/` that is not the plan's own folder. */
function isBookkeeping(path: string, planDir: string): boolean {
	return path.startsWith(".indusk/") && !path.startsWith(`${planDir}/`);
}

/** The `## Test Trajectory` section of an impl, up to the next second-level heading. */
function trajectorySection(impl: string): string {
	const lines = impl.split("\n");
	const start = lines.findIndex((l) => /^##\s+Test Trajectory\b/.test(l));
	if (start === -1) return "";
	const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
	return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

function readText(worktree: string, rel: string): AuditText {
	return { path: rel, text: readFileSync(join(worktree, rel), "utf-8") };
}

/** The approval merge, named by hand or found by its subject; a refusal when neither is a commit. */
async function resolveApproval(
	pb: Awaited<ReturnType<typeof planBranch>>,
	plan: string,
	approved: string | undefined,
): Promise<string> {
	if (approved !== undefined) {
		await git(pb.trunk, "cat-file", "-e", `${approved}^{commit}`).catch(() => {
			throw new AuditInputsRefusal(`--approved ${approved} is not a commit in ${pb.trunk}`);
		});
		return approved;
	}
	const sha = await approvalMerge(pb.trunk, pb.trunkBranch, plan);
	if (sha === null) {
		throw new AuditInputsRefusal(
			`${plan} has no approval merge on ${pb.trunkBranch} (a merge whose subject starts "plan(${plan}): approved"): an audit of an unapproved plan has no impl "as approved"; if history was rewritten, name the merge with --approved <sha>`,
		);
	}
	return sha;
}

/** The auditor's inputs for `plan`; `approved` names the approval merge by hand when history was rewritten. */
export async function auditInputs(
	checkout: string,
	plan: string,
	approved?: string,
): Promise<AuditInputs> {
	const pb = await planBranch(checkout, plan);
	const sha = await resolveApproval(pb, plan, approved);

	const planDir = relative(pb.worktree, pb.dir).split("\\").join("/");
	const documents: AuditInputs["documents"] = {
		brief: readText(pb.worktree, `${planDir}/brief.md`),
		testPlan: readText(pb.worktree, `${planDir}/test-plan.md`),
	};
	if (existsSync(join(pb.worktree, planDir, "adr.md"))) {
		documents.adr = readText(pb.worktree, `${planDir}/adr.md`);
	}

	const implRel = `${planDir}/impl.md`;
	const implAsApproved = {
		path: implRel,
		text: await git(pb.trunk, "show", `${sha}:${implRel}`).catch(() => {
			throw new AuditInputsRefusal(
				`${plan}'s impl.md is not in the approval merge ${sha.slice(0, 8)}`,
			);
		}),
	};
	const trajectoryNow = {
		path: implRel,
		text: trajectorySection(readFileSync(join(pb.worktree, implRel), "utf-8")),
	};

	const range = `${pb.trunkBranch}...${pb.branch}`;
	const paths = (await branchFileChanges(pb.trunk, pb.trunkBranch, pb.branch))
		.map((f) => f.path)
		.filter((p) => !isBookkeeping(p, planDir));
	const diff = paths.length > 0 ? await git(pb.trunk, "diff", range, "--", ...paths) : "";
	const stat = await git(pb.trunk, "diff", "--stat", range);

	return { plan, approvedAt: sha, documents, implAsApproved, trajectoryNow, diff, stat };
}

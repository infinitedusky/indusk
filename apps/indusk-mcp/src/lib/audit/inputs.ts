import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { git } from "../git.js";
import { branchFileChanges, PlanCommandRefusal, planBranch } from "../plans/plan-branch.js";
import { workbenchPlan } from "../plans/workbench-plan.js";

/**
 * What the auditor is handed (plan-review-subagent, ADR D2): the plan's
 * documents, the impl as it was merged at approval, the trajectory table as it
 * stands, the branch's diff against the trunk without InDusk's bookkeeping, and
 * a `--stat` of what the plan touched and a `tree` of every file it did not.
 * A workbench plan reads its documents and approval at the workbench root and
 * its diff in the repo its code file names. Never the research, the conversation or the
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
	/** Where the text was read: `<sha>:<path>` for a committed version, a working path otherwise. */
	path: string;
	text: string;
}

export interface AuditInputs {
	plan: string;
	/** The approval commit the impl was read at. */
	approvedAt: string;
	documents: { brief: AuditText; testPlan: AuditText; adr?: AuditText };
	implAsApproved: AuditText;
	trajectoryNow: AuditText;
	/** `git diff <merge-base>...<branch>` over the plan's code and docs. */
	diff: string;
	/** `git diff --stat <merge-base>...<branch>` over the whole tree: the files the plan touched. */
	stat: string;
	/** `git ls-tree -r --name-only <branch>` less `.indusk/`: every tracked file, the ones the plan did not touch included. */
	tree: string;
}

/**
 * The latest first-parent commit on `ref` whose subject starts
 * `plan(<plan>): approved`, or null. `merges` is true for a normal plan, whose
 * approval is a merge onto the trunk, and false for a workbench plan, whose
 * approval is a plain commit at the workbench root.
 */
export async function approvalMerge(
	trunk: string,
	ref: string,
	plan: string,
	merges = true,
): Promise<string | null> {
	const log = await git(
		trunk,
		"log",
		"--first-parent",
		...(merges ? ["--merges"] : []),
		"--format=%H%x00%s",
		ref,
	);
	const prefix = `plan(${plan}): approved`;
	for (const line of log.split("\n")) {
		const [sha, subject] = line.split("\0");
		if (sha && subject?.startsWith(prefix)) return sha;
	}
	return null;
}

/** InDusk's bookkeeping: anything under `.indusk/`, the plan's own folder included. */
function isBookkeeping(path: string): boolean {
	return path.startsWith(".indusk/");
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

/** Where a plan's documents, its approval and its code live: one place for a normal plan, two for a workbench's. */
interface AuditSource {
	/** Where the plan's documents are read, and the repository the approval is found in. */
	docsRoot: string;
	/** The plan's folder under `docsRoot`. */
	planDir: string;
	/** The ref the approval is searched on. */
	approvalRef: string;
	/** True when the approval is a merge commit (a normal plan), false for a plain commit (a workbench's). */
	approvalIsMerge: boolean;
	/** The repository holding the code, the trunk branch it lands on and the plan's branch. */
	code: { repo: string; trunkBranch: string; branch: string };
}

async function auditSource(checkout: string, plan: string): Promise<AuditSource> {
	const wp = await workbenchPlan(checkout, plan);
	if (wp) {
		return {
			docsRoot: wp.root,
			planDir: relative(wp.root, wp.dir).split("\\").join("/"),
			approvalRef: "HEAD",
			approvalIsMerge: false,
			code: { repo: wp.repoTrunk, trunkBranch: wp.trunkBranch, branch: wp.code.branch },
		};
	}
	const pb = await planBranch(checkout, plan);
	return {
		docsRoot: pb.worktree,
		planDir: relative(pb.worktree, pb.dir).split("\\").join("/"),
		approvalRef: pb.trunkBranch,
		approvalIsMerge: true,
		code: { repo: pb.trunk, trunkBranch: pb.trunkBranch, branch: pb.branch },
	};
}

/** The approval commit, named by hand or found by its subject; a refusal when neither is a commit. */
async function resolveApproval(
	src: AuditSource,
	plan: string,
	approved: string | undefined,
): Promise<string> {
	if (approved !== undefined) {
		await git(src.docsRoot, "cat-file", "-e", `${approved}^{commit}`).catch(() => {
			throw new AuditInputsRefusal(`--approved ${approved} is not a commit in ${src.docsRoot}`);
		});
		return approved;
	}
	const sha = await approvalMerge(src.docsRoot, src.approvalRef, plan, src.approvalIsMerge);
	if (sha === null) {
		const kind = src.approvalIsMerge ? "merge" : "commit";
		throw new AuditInputsRefusal(
			`${plan} has no approval ${kind} on ${src.approvalRef} (a ${kind} whose subject starts "plan(${plan}): approved"): an audit of an unapproved plan has no impl "as approved"; if history was rewritten, name the commit with --approved <sha>`,
		);
	}
	return sha;
}

/** The auditor's inputs for `plan`; `approved` names the approval commit by hand when history was rewritten. */
export async function auditInputs(
	checkout: string,
	plan: string,
	approved?: string,
): Promise<AuditInputs> {
	const src = await auditSource(checkout, plan);
	const sha = await resolveApproval(src, plan, approved);
	const { docsRoot, planDir } = src;

	const documents: AuditInputs["documents"] = {
		brief: readText(docsRoot, `${planDir}/brief.md`),
		testPlan: readText(docsRoot, `${planDir}/test-plan.md`),
	};
	if (existsSync(join(docsRoot, planDir, "adr.md"))) {
		documents.adr = readText(docsRoot, `${planDir}/adr.md`);
	}

	const implRel = `${planDir}/impl.md`;
	// Named as `git show` reads it, so a reader cannot open the working file by mistake.
	const approvedPath = `${sha}:${implRel}`;
	const implAsApproved = {
		path: approvedPath,
		text: await git(docsRoot, "show", approvedPath).catch(() => {
			throw new AuditInputsRefusal(
				`${plan}'s impl.md is not in the approval commit ${sha.slice(0, 8)}`,
			);
		}),
	};
	const trajectoryNow = {
		path: implRel,
		text: trajectorySection(readFileSync(join(docsRoot, implRel), "utf-8")),
	};

	const { repo, trunkBranch, branch } = src.code;
	const range = `${trunkBranch}...${branch}`;
	// Nothing under `.indusk/` reaches the diff: the plan's documents are handed whole above,
	// and its folder's diff since approval is the builder's own findings.
	const paths = (await branchFileChanges(repo, trunkBranch, branch))
		.map((f) => f.path)
		.filter((p) => !isBookkeeping(p));
	const diff = paths.length > 0 ? await git(repo, "diff", range, "--", ...paths) : "";
	const stat = await git(repo, "diff", "--stat", range);
	const tree = (await git(repo, "ls-tree", "-r", "--name-only", branch))
		.split("\n")
		.filter((p) => p && !isBookkeeping(p))
		.join("\n");

	return { plan, approvedAt: sha, documents, implAsApproved, trajectoryNow, diff, stat, tree };
}

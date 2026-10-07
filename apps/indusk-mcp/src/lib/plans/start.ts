import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { getPlanningDir } from "../config.js";
import { git } from "../git.js";
import { induskMcpPackageRoot } from "../package-root.js";
import { isUsableSegment } from "../path-segment.js";
import { WORKFLOW_TYPES, type WorkflowType } from "../workflow-types.js";
import { createPlanWorktree, PlanWorktreeRefusal } from "../worktree/plan-worktree-commands.js";
import { canonical, resolvePlanCopies } from "../worktree/plan-worktrees.js";
import { isWorkbench } from "../worktree/repos.js";
import { chooseCodeRepo, PLAN_CODE_FILE } from "../worktree/roots.js";
import { PlanCommandRefusal } from "./plan-branch.js";

/**
 * `indusk plans start <type> <name>` (admin-plan-authoring, ADR D3): a plan
 * begins on its own branch, in its own worktree, with its first document
 * declaring its type. Nothing is written on the trunk; the documents reach it
 * when the plan is approved.
 *
 * promise: a-plan-is-written-on-its-own-branch
 */

export interface StartedPlan {
	plan: string;
	type: WorkflowType;
	worktree: string;
	branch: string;
	/** The document written, relative to the worktree. */
	document: string;
	/** In a workbench: the repo, branch and worktree the plan's code lives in (its `code.json`). */
	code?: { repo: string; branch: string; worktree: string };
}

export interface StartOptions {
	/** In a workbench wrapping several repos, the one the plan's code goes in. */
	repo?: string;
}

export async function startPlan(
	anyCheckout: string,
	type: string,
	plan: string,
	now: Date = new Date(),
	opts: StartOptions = {},
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
	if (isWorkbench(trunk)) return startWorkbenchPlan(trunk, type as WorkflowType, plan, now, opts);
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

/**
 * A plan in a workbench (workbench-plan-authoring D1, D2): its documents at
 * the workbench root, on the root's own branch, and its code on
 * `plan/<name>` in the repo it names, made through the worktree extension's
 * setup script so the repo's overlays, env and post-create steps apply. The
 * two are linked by the plan's `code.json`, committed at the root with its
 * first document.
 *
 * promise: a-plan-knows-its-code
 */
async function startWorkbenchPlan(
	root: string,
	type: WorkflowType,
	plan: string,
	now: Date,
	opts: StartOptions,
): Promise<StartedPlan> {
	const folder = join(getPlanningDir(root), plan);
	if (existsSync(folder)) {
		throw new PlanCommandRefusal(
			`${plan} already has a folder in this workbench, ${relative(root, folder)}`,
		);
	}
	const repo = chooseCodeRepo(root, opts.repo);
	if ("error" in repo) throw new PlanCommandRefusal(repo.error);
	const branch = `plan/${plan}`;
	const hasBranch = await git(repo.dir, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`)
		.then(() => true)
		.catch(() => false);
	if (hasBranch)
		throw new PlanCommandRefusal(`the branch ${branch} already exists in ${repo.name}`);

	const worktree = repo.worktrees ? join(root, repo.worktrees, plan) : join(root, plan);
	// The worktree extension's setup script when the workbench configures the
	// repo, so its overlays apply as they do for `indusk worktree create`;
	// a plain worktree when it does not (not every workbench has a config).
	const failed = existsSync(join(root, ".indusk", "worktree-configs", `${repo.name}.json`))
		? setupThroughExtension(root, repo, branch, plan)
		: await git(repo.dir, "worktree", "add", "-q", "-b", branch, worktree).then(
				() => null,
				(err: Error) => err.message,
			);
	if (failed !== null) {
		throw new PlanCommandRefusal(
			`the code worktree for ${plan} could not be made in ${repo.name}: ${failed.trim()}`,
		);
	}

	const document = join(".indusk", "planning", plan, type === "spike" ? "research.md" : "brief.md");
	const codeFile = join(".indusk", "planning", plan, PLAN_CODE_FILE);
	try {
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(root, document), firstDocument(plan, type, now));
		const code = { repo: repo.name, branch, worktree: relative(root, worktree) };
		writeFileSync(join(root, codeFile), `${JSON.stringify(code, null, 2)}\n`);
		const paths = [document, codeFile, ...(await ignoreAtRoot(root, worktree))];
		await git(root, "add", "--", ...paths);
		await git(
			root,
			"commit",
			"-q",
			"-m",
			`plan(${plan}): started, ${type}, code in ${repo.name}`,
			"--",
			...paths,
		);
		return { plan, type, worktree: root, branch, document, code: { ...code, worktree } };
	} catch (err) {
		rmSync(folder, { recursive: true, force: true });
		throw err;
	}
}

/** The worktree extension's setup script for `repo`: null on success, its message otherwise. */
function setupThroughExtension(
	root: string,
	repo: { name: string; worktrees?: string },
	branch: string,
	plan: string,
): string | null {
	const script = join(
		induskMcpPackageRoot(),
		"extensions",
		"worktree",
		"scripts",
		"setup-worktree.sh",
	);
	const made = spawnSync(
		"bash",
		[
			script,
			"--repo",
			repo.name,
			"--branch",
			branch,
			...(repo.worktrees ? ["--worktrees-dir", repo.worktrees] : []),
			plan,
		],
		{ cwd: root, encoding: "utf-8" },
	);
	return made.status === 0 ? null : made.stderr || made.stdout;
}

/**
 * A code worktree placed inside the workbench root must not be swept into
 * the root's own history by its sync loop; when the root's ignore rules do
 * not already cover it, a line for it is added. Returns `.gitignore` when it
 * changed, for the start commit.
 */
async function ignoreAtRoot(root: string, worktree: string): Promise<string[]> {
	const rel = relative(root, worktree);
	if (rel.startsWith("..") || rel.startsWith(sep)) return [];
	const ignored = await git(root, "check-ignore", "-q", rel)
		.then(() => true)
		.catch(() => false);
	if (ignored) return [];
	appendFileSync(join(root, ".gitignore"), `/${rel.split(sep).join("/")}/\n`);
	return [".gitignore"];
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

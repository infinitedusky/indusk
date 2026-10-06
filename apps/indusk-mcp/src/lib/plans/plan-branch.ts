import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { currentBuildStep } from "../build/step-env.js";
import { git, headSha } from "../git.js";
import { currentTrunkBranch } from "../trunk-branch.js";
import { resolvePlanCopies } from "../worktree/plan-worktrees.js";
import { commitTrunkBookkeeping, uncommittedWork } from "./bookkeeping.js";

/**
 * What every `indusk plans` verb after `start` needs (admin-plan-authoring,
 * ADR D3): the plan's own worktree and branch, the trunk it merges into, and
 * a refusal that names what it refused. A plan is acted on in its worktree;
 * one with no live worktree is refused, never read from the trunk.
 */

/** A refusal from a `plans` verb: the message names what was refused; nothing was written. */
export class PlanCommandRefusal extends Error {}

export interface PlanBranch {
	plan: string;
	/** The main working tree. */
	trunk: string;
	/** The branch the trunk is on, one of the project's trunk branches. */
	trunkBranch: string;
	/** The plan's worktree. */
	worktree: string;
	/** `plan/<plan>`, or whatever branch the worktree is on. */
	branch: string;
	/** The plan's folder inside the worktree. */
	dir: string;
}

/**
 * Accepting and landing are the person's, or the release's (A35): refused
 * inside a build step's session, naming the step, before anything is read.
 */
export function refuseInsideBuildStep(verb: string, plan: string): void {
	const step = currentBuildStep();
	if (step) {
		throw new PlanCommandRefusal(
			`${plan} is not ${verb} from inside a build step (${step}): a build stops at review, and acceptance is the person's`,
		);
	}
}

/** The plan's worktree and the trunk it lands on, or a refusal saying which is missing. */
export async function planBranch(anyCheckout: string, plan: string): Promise<PlanBranch> {
	const copies = await resolvePlanCopies(anyCheckout);
	if (!copies.ok) {
		throw new PlanCommandRefusal(
			`the worktree record ${copies.file} cannot be read: ${copies.problem}`,
		);
	}
	const copy = copies.copies.get(plan);
	if (!copy) throw new PlanCommandRefusal(`no plan named ${plan}, on the trunk or in a worktree`);
	if (copy.source !== "worktree") {
		const why = "problem" in copy ? copy.detail : "it has no worktree assigned";
		throw new PlanCommandRefusal(`${plan} is not on its own branch: ${why}`);
	}
	const trunk = copies.projectRoot;
	const { branch: trunkBranch, allowed, onTrunk } = await currentTrunkBranch(trunk);
	if (!onTrunk) {
		throw new PlanCommandRefusal(
			`the trunk at ${trunk} is on ${trunkBranch || "no branch"}, not a trunk branch (${allowed.join(", ")})`,
		);
	}
	return {
		plan,
		trunk,
		trunkBranch,
		worktree: copy.worktree.path,
		branch: copy.worktree.branch,
		dir: copy.dir,
	};
}

/** The plan's impl, or a refusal: approval, acceptance and landing all act on it. */
export function implPath(pb: PlanBranch): string {
	const path = join(pb.dir, "impl.md");
	if (!existsSync(path)) throw new PlanCommandRefusal(`${pb.plan} has no impl.md in ${pb.dir}`);
	return path;
}

/** The files the plan's branch changes against the trunk branch, since they diverged. */
export async function branchChanges(pb: PlanBranch): Promise<string[]> {
	return (await branchFileChanges(pb.trunk, pb.trunkBranch, pb.branch)).map((f) => f.path);
}

/** Each file `branch` changes against `trunkBranch` since they diverged, with git's status letter; a rename by its new path. */
export async function branchFileChanges(
	trunk: string,
	trunkBranch: string,
	branch: string,
): Promise<Array<{ path: string; status: string }>> {
	const out = await git(trunk, "diff", "--name-status", `${trunkBranch}...${branch}`);
	return out
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [status, ...rest] = line.split("\t");
			return { status, path: rest[rest.length - 1] };
		});
}

/**
 * Before a merge onto the trunk: commit InDusk's own uncommitted bookkeeping
 * there (`bookkeeping.ts`), then refuse when anything else uncommitted sits on
 * a path the merge would touch — it may be someone's work, so it is the
 * person's to sort out, and the review lists it first. Never stashes.
 */
export async function refuseDirtyTrunk(
	pb: PlanBranch,
	paths: string[],
	why: string,
): Promise<void> {
	await commitTrunkBookkeeping(pb, why);
	const work = await uncommittedWork(pb.trunk, paths);
	if (work.length > 0) {
		throw new PlanCommandRefusal(
			`the trunk at ${pb.trunk} has uncommitted work on paths ${pb.plan} touches, and it may be someone's — commit or move it first: ${work.join(", ")}`,
		);
	}
}

/** Refuse when the worktree has uncommitted changes: what merges is what is committed. */
export async function refuseDirtyWorktree(pb: PlanBranch): Promise<void> {
	const dirty = await git(pb.worktree, "status", "--porcelain");
	if (dirty) {
		throw new PlanCommandRefusal(
			`${pb.plan}'s worktree ${pb.worktree} has uncommitted changes — commit them first:\n${dirty}`,
		);
	}
}

/** Merge the plan's branch into the trunk with a merge commit; a conflict is aborted and refused. */
export async function mergeIntoTrunk(pb: PlanBranch, message: string): Promise<string> {
	try {
		await git(pb.trunk, "merge", "--no-ff", "-m", message, pb.branch);
	} catch (err) {
		await git(pb.trunk, "merge", "--abort").catch(() => undefined);
		throw new PlanCommandRefusal(
			`merging ${pb.branch} into ${pb.trunkBranch} failed and was aborted: ${(err as Error).message.trim()}`,
		);
	}
	return headSha(pb.trunk);
}

/** Set frontmatter keys in `path` and commit that file alone on the plan's branch. */
export async function setImplKeys(
	pb: PlanBranch,
	path: string,
	keys: Record<string, string>,
	message: string,
): Promise<void> {
	writeFileSync(path, setFrontmatterKeys(readFileSync(path, "utf-8"), keys));
	await git(pb.worktree, "add", "--", path);
	await git(pb.worktree, "commit", "-q", "-m", message, "--", path);
}

/**
 * Set top-level frontmatter keys, editing their lines in place so the rest of
 * the document stays byte-for-byte as written; a key not there is added
 * before the closing `---`.
 */
export function setFrontmatterKeys(text: string, keys: Record<string, string>): string {
	const match = text.match(/^---\n([\s\S]*?)\n---/);
	if (!match) throw new PlanCommandRefusal("the document has no frontmatter");
	let block = match[1];
	for (const [key, value] of Object.entries(keys)) {
		const line = `${key}: ${value}`;
		const existing = new RegExp(`^${key}:.*$`, "m");
		block = existing.test(block) ? block.replace(existing, line) : `${block}\n${line}`;
	}
	return `---\n${block}\n---${text.slice(match[0].length)}`;
}

/** A frontmatter key's value in the impl, or undefined. */
export function implKey(path: string, key: string): unknown {
	return matter(readFileSync(path, "utf-8")).data[key];
}

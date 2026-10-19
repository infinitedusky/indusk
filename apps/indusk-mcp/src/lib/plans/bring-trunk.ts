import { relative } from "node:path";
import { git, headSha } from "../git.js";
import { PlanCommandRefusal, planBranch } from "./plan-branch.js";
import { workbenchPlan } from "./workbench-plan.js";

/**
 * Bring the project's trunk into a plan's branch where its planning can begin
 * (a-brief-is-accepted-on-current-main): when its brief is accepted, and when
 * the admin starts its planning run. The planning run then writes the test
 * plan, ADR and impl against current code, and the person never merges main by
 * hand. A workbench plan's code branch is brought up to its repo's trunk.
 *
 * "Current" is the local trunk branch; nothing is fetched. The branch's own
 * commits are kept (a merge, not a rebase), and a branch already holding the
 * trunk gains no commit. When bringing the trunk in conflicts, would change
 * this plan's own documents, or is stopped by uncommitted files, the merge is
 * undone and the refusal names each file in plain words: the branch is exactly
 * as it was.
 *
 * promise: a-brief-is-accepted-on-current-main
 */

export interface BringTrunkHow {
	/** What was refused: "its brief was not accepted" | "its planning run did not start". */
	refused: string;
	/** What to do once the files are settled: "accept the brief again" | "start its planning again". */
	again: string;
	/** The merge commit reads `plan(<name>): <trunk> merged before <when>`: "its brief was accepted" | "its planning run". */
	when: string;
}

interface Place {
	checkout: string;
	branch: string;
	trunk: string;
	/** The plan's folder relative to the checkout, when the plan's documents are on this branch. */
	planDir: string | null;
}

const lines = (out: string): string[] => out.split("\n").filter(Boolean);
const list = (paths: string[]): string => paths.map((p) => `  ${p}`).join("\n");

/**
 * Bring the trunk into the plan's branch, then run `after` (reads and checks
 * that depend on the merged tree). If anything after the merge refuses or
 * throws, the merge is undone and the error rethrown.
 */
export async function bringTrunkIntoPlan<T>(
	anyCheckout: string,
	plan: string,
	how: BringTrunkHow,
	after?: () => T | Promise<T>,
): Promise<T | undefined> {
	const at = await placeOf(anyCheckout, plan);
	const before = await headSha(at.checkout);
	try {
		await git(
			at.checkout,
			"merge",
			"--no-edit",
			"-m",
			`plan(${plan}): ${at.trunk} merged before ${how.when}`,
			at.trunk,
		);
	} catch (err) {
		throw new PlanCommandRefusal(await whyNotBrought(at, plan, how, err));
	}
	try {
		if (at.planDir) {
			const changed = lines(
				await git(at.checkout, "diff", "--name-only", before, "HEAD", "--", at.planDir),
			);
			if (changed.length > 0)
				throw new PlanCommandRefusal(ownDocumentsMessage(at, plan, how, changed));
		}
		return await after?.();
	} catch (err) {
		// `--merge`, not `--hard`: a person's unrelated uncommitted files survive.
		await git(at.checkout, "reset", "--merge", before);
		throw err;
	}
}

async function placeOf(anyCheckout: string, plan: string): Promise<Place> {
	const wp = await workbenchPlan(anyCheckout, plan);
	if (wp) {
		return {
			checkout: wp.code.worktree,
			branch: wp.code.branch,
			trunk: wp.trunkBranch,
			planDir: null,
		};
	}
	const pb = await planBranch(anyCheckout, plan);
	return {
		checkout: pb.worktree,
		branch: pb.branch,
		trunk: pb.trunkBranch,
		planDir: relative(pb.worktree, pb.dir),
	};
}

const head = (plan: string, how: BringTrunkHow): string =>
	`${plan}: ${how.refused}, and nothing was changed.`;

/** Why the merge did not happen, read from git's state and never from its message; the merge is left undone. */
async function whyNotBrought(
	at: Place,
	plan: string,
	how: BringTrunkHow,
	err: unknown,
): Promise<string> {
	const unmerged = lines(
		await git(at.checkout, "diff", "--name-only", "--diff-filter=U").catch(() => ""),
	);
	const midMerge = await git(at.checkout, "rev-parse", "-q", "--verify", "MERGE_HEAD")
		.then(() => true)
		.catch(() => false);
	if (midMerge) await git(at.checkout, "merge", "--abort").catch(() => undefined);
	if (unmerged.length > 0) {
		return [
			head(plan, how),
			`Bringing ${at.trunk} into ${at.branch} conflicts in these files:`,
			list(unmerged),
			`Resolve them in ${at.checkout} (or on ${at.trunk}) and ${how.again}.`,
		].join("\n");
	}
	// Paths, not `status --porcelain`: `git()` trims its output, which eats the first line's leading column.
	const dirty = [
		...lines(await git(at.checkout, "diff", "--name-only", "HEAD").catch(() => "")),
		...lines(await git(at.checkout, "ls-files", "--others", "--exclude-standard").catch(() => "")),
	];
	const trunkChanges = new Set(
		lines(await git(at.checkout, "diff", "--name-only", `HEAD...${at.trunk}`).catch(() => "")),
	);
	const inTheWay = dirty.filter((p) => trunkChanges.has(p));
	if (inTheWay.length > 0) {
		return [
			head(plan, how),
			`${at.trunk} could not be brought into ${at.branch} because these files in ${at.checkout} have uncommitted changes, which belong to whoever made them:`,
			list(inTheWay),
		].join("\n");
	}
	const reason = ((err as Error).message ?? String(err))
		.split("\n")
		.filter((l) => !/^Command failed:/.test(l) && !/^hint:/.test(l))
		.join("\n")
		.trim();
	return [head(plan, how), `${at.trunk} could not be brought into ${at.branch}: ${reason}`].join(
		"\n",
	);
}

function ownDocumentsMessage(
	at: Place,
	plan: string,
	how: BringTrunkHow,
	changed: string[],
): string {
	return [
		head(plan, how),
		`${at.trunk} changes this plan's own documents:`,
		list(changed),
		`Settle which version is the plan's, on ${at.branch} or on ${at.trunk}, and ${how.again}.`,
	].join("\n");
}

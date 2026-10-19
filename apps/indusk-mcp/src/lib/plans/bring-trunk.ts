import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Tracer } from "@opentelemetry/api";
import { git, headSha } from "../git.js";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import {
	conflictVerdicts,
	type Leftover,
	mergedVerdicts,
	refusalVerdicts,
	reportBring,
} from "./bring-trunk-signals.js";
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
 * Each clause of the promise is reported from here (`bring-trunk-signals.ts`), so the
 * command line and the admin's planning start report alike.
 *
 * promise: a-brief-is-accepted-on-current-main
 */

/** What a caller may hand in: the tracer the clause reports go through, in place of the commands' one. */
export interface BringTrunkOptions {
	tracer?: Tracer;
}

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
	opts: BringTrunkOptions = {},
): Promise<T | undefined> {
	const live = await livePlanCopy(anyCheckout, plan);
	// A plan with no branch of its own is planned on the trunk: already current.
	if (live.ok && live.copy.source === "trunk" && !(await workbenchPlan(anyCheckout, plan)))
		return await after?.();
	const at = await placeOf(anyCheckout, plan);
	const report = (verdicts: Parameters<typeof reportBring>[2]) =>
		reportBring(anyCheckout, plan, verdicts, opts.tracer);
	await refuseUnfinishedWork(at, plan, how).catch(async (err) => {
		if (err instanceof PlanCommandRefusal) await report(refusalVerdicts(at.trunk, err.message));
		throw err;
	});
	const before = await headSha(at.checkout);
	try {
		await git(
			at.checkout,
			"merge",
			"--ff",
			"--no-edit",
			"-m",
			`plan(${plan}): ${at.trunk} merged before ${how.when}`,
			at.trunk,
		);
	} catch (err) {
		const why = await whyNotBrought(at, plan, how, err);
		await report(
			why.conflicted
				? conflictVerdicts(at.trunk, why.message, await leftoverOf(at, before))
				: refusalVerdicts(at.trunk, why.message),
		);
		throw new PlanCommandRefusal(why.message);
	}
	try {
		if (at.planDir) {
			const changed = lines(
				await git(at.checkout, "diff", "--name-only", before, "HEAD", "--", at.planDir),
			);
			if (changed.length > 0)
				throw new PlanCommandRefusal(ownDocumentsMessage(at, plan, how, changed));
		}
		const result = await after?.();
		const current = await git(at.checkout, "merge-base", "--is-ancestor", at.trunk, "HEAD")
			.then(() => true)
			.catch(() => false);
		await report(mergedVerdicts(at.trunk, at.branch, current));
		return result;
	} catch (err) {
		// `--merge`, not `--hard`: a person's unrelated uncommitted files survive.
		await git(at.checkout, "reset", "--merge", before);
		if (err instanceof PlanCommandRefusal) await report(refusalVerdicts(at.trunk, err.message));
		throw err;
	}
}

/** What the checkout still holds of a merge that was meant to be undone, read from git. */
async function leftoverOf(at: Place, before: string): Promise<Leftover> {
	const midMerge = await git(at.checkout, "rev-parse", "-q", "--verify", "MERGE_HEAD")
		.then(() => true)
		.catch(() => false);
	const unmerged = lines(
		await git(at.checkout, "diff", "--name-only", "--diff-filter=U").catch(() => ""),
	);
	const moved = (await headSha(at.checkout).catch(() => before)) !== before;
	return { midMerge, unmerged, moved };
}

/** Another change that git left half done in the checkout: the merge, rebase, cherry-pick or revert belongs to whoever started it. */
const UNFINISHED = [
	"MERGE_HEAD",
	"CHERRY_PICK_HEAD",
	"REVERT_HEAD",
	"rebase-merge",
	"rebase-apply",
];

async function refuseUnfinishedWork(at: Place, plan: string, how: BringTrunkHow): Promise<void> {
	for (const name of UNFINISHED) {
		const path = await git(at.checkout, "rev-parse", "--git-path", name);
		if (!existsSync(isAbsolute(path) ? path : resolve(at.checkout, path))) continue;
		const unresolved = lines(
			await git(at.checkout, "diff", "--name-only", "--diff-filter=U").catch(() => ""),
		);
		throw new PlanCommandRefusal(
			[
				head(plan, how),
				`${at.checkout} is partway through bringing other changes in, which belongs to whoever started it${unresolved.length > 0 ? "; these files are unresolved:" : "."}`,
				...(unresolved.length > 0 ? [list(unresolved)] : []),
				`Finish or set that work aside first, then ${how.again}.`,
			].join("\n"),
		);
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
): Promise<{ message: string; conflicted: boolean }> {
	const unmerged = lines(
		await git(at.checkout, "diff", "--name-only", "--diff-filter=U").catch(() => ""),
	);
	const midMerge = await git(at.checkout, "rev-parse", "-q", "--verify", "MERGE_HEAD")
		.then(() => true)
		.catch(() => false);
	if (midMerge) await git(at.checkout, "merge", "--abort").catch(() => undefined);
	if (unmerged.length > 0) {
		return {
			conflicted: true,
			message: [
				head(plan, how),
				`Bringing ${at.trunk} into ${at.branch} conflicts in these files:`,
				list(unmerged),
				`Resolve them in ${at.checkout} (or on ${at.trunk}) and ${how.again}.`,
			].join("\n"),
		};
	}
	// Paths, not `status --porcelain`: `git()` trims its output, which eats the first line's leading column.
	const dirty = [
		...new Set([
			...lines(await git(at.checkout, "diff", "--name-only", "HEAD").catch(() => "")),
			...lines(await git(at.checkout, "diff", "--name-only", "--cached").catch(() => "")),
		]),
		...lines(await git(at.checkout, "ls-files", "--others", "--exclude-standard").catch(() => "")),
	];
	const trunkChanges = new Set(
		lines(
			await git(at.checkout, "diff", "--name-only", "--no-renames", `HEAD...${at.trunk}`).catch(
				() => "",
			),
		),
	);
	// Git also refuses a merge for a staged file the trunk never touches, so a dirty tree explains any refusal that is no conflict.
	const inTheWay = dirty.filter((p) => trunkChanges.has(p));
	const named = inTheWay.length > 0 ? inTheWay : dirty;
	if (named.length > 0) {
		return {
			conflicted: false,
			message: [
				head(plan, how),
				`${at.trunk} could not be brought into ${at.branch} because these files in ${at.checkout} have uncommitted changes, which belong to whoever made them:`,
				list(named),
			].join("\n"),
		};
	}
	const reason = ((err as Error).message ?? String(err))
		.split("\n")
		.filter((l) => !/^Command failed:/.test(l) && !/^hint:/.test(l))
		.join("\n")
		.trim();
	return {
		conflicted: false,
		message: [
			head(plan, how),
			`${at.trunk} could not be brought into ${at.branch}: ${reason}`,
		].join("\n"),
	};
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

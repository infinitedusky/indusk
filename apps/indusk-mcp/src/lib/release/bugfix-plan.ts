import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { git } from "../git.js";
import { startPlan } from "../plans/start.js";
import { type Suspects, suspectsBlock } from "../promises/incidents.js";
import { resolvePlanCopies } from "../worktree/plan-worktrees.js";
import type { RoutingRow } from "./route.js";

/**
 * A failing slow-test file no promise claims becomes a draft bugfix plan
 * (release-records-its-failures D8): `fix-<file stem>`, started the way
 * `indusk plans start bugfix` starts one — its own branch and worktree, nothing
 * written on the trunk — with a brief naming the file, the failing tests, the
 * release, the suspects and, for a row that tests it without a promise, that
 * plan and row. While that plan is open a later failure of the file is added
 * to its `research.md` instead of opening another.
 *
 * promise: an-unclaimed-failure-opens-a-bugfix-plan
 */

export interface UnclaimedFailure {
	file: string;
	/** The failed tests' names from the report. */
	names: string[];
	/** Every row whose Test cell names the file. */
	rows: RoutingRow[];
	release: { version: string; commit: string };
	suspects: Suspects;
	now: Date;
}

export interface BugfixPlan {
	plan: string;
	kind: "opened" | "extended";
	worktree: string;
}

/** `src/__tests__/orphan-flow.test.ts` → `fix-orphan-flow`. */
export function bugfixPlanName(file: string): string {
	const stem = basename(file)
		.replace(/\.(test|spec)\.[cm]?[jt]sx?$/, "")
		.replace(/\.[^.]+$/, "");
	return `fix-${stem
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")}`;
}

export async function openOrExtendBugfixPlan(
	root: string,
	failure: UnclaimedFailure,
): Promise<BugfixPlan> {
	const plan = bugfixPlanName(failure.file);
	const copies = await resolvePlanCopies(root);
	if (!copies.ok)
		throw new Error(`the worktree record ${copies.file} cannot be read: ${copies.problem}`);
	const open = copies.copies.get(plan);
	if (open?.source === "worktree" && !open.archivedInWorktree) {
		const research = join(open.dir, "research.md");
		const header = existsSync(research) ? "" : `# ${plan} — Research\n`;
		appendFileSync(research, `${header}\n${release(failure)}\n`);
		await commitDoc(
			open.root,
			research,
			`plan(${plan}): failed again in ${failure.release.version}`,
		);
		return { plan, kind: "extended", worktree: open.root };
	}

	const started = await startPlan(root, "bugfix", plan, failure.now);
	const brief = join(started.worktree, started.document);
	writeFileSync(brief, `${readFileSync(brief, "utf-8").trimEnd()}\n\n${briefBody(failure)}\n`);
	await commitDoc(
		started.worktree,
		brief,
		`plan(${plan}): brief from release ${failure.release.version}`,
	);
	return { plan, kind: "opened", worktree: started.worktree };
}

async function commitDoc(worktree: string, path: string, message: string): Promise<void> {
	const rel = relative(worktree, path);
	await git(worktree, "add", "--", rel);
	await git(worktree, "commit", "-q", "-m", message, "--", rel);
}

function briefBody(f: UnclaimedFailure): string {
	const tested = f.rows.map(
		(r) =>
			`- \`${r.plan}\`${r.archived ? " (archived)" : ""}, row \`${r.id}\` — names this file and proves no promise`,
	);
	return [
		"## What failed",
		"",
		`\`${f.file}\` failed in the slow tests of release ${f.release.version} and still failed when run again. No promise's test row names it, so no incident was opened; this plan is where it is fixed.`,
		"",
		...(tested.length > 0 ? ["It was being tested by:", "", ...tested, ""] : []),
		release(f),
	].join("\n");
}

function release(f: UnclaimedFailure): string {
	const names = f.names.length > 0 ? f.names : ["(no test named in the report)"];
	return [
		`## Release ${f.release.version} (${f.release.commit.slice(0, 7)}) — ${f.file}`,
		"",
		"Failing tests:",
		"",
		...names.map((n) => `- ${n.replace(/\s+/g, " ")}`),
		"",
		suspectsBlock({
			tests: [{ file: f.file, names: f.names }],
			release: f.release,
			suspects: f.suspects,
			now: f.now,
		}),
	].join("\n");
}

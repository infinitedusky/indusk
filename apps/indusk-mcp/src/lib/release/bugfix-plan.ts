import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { getPlanningDir } from "../config.js";
import { git } from "../git.js";
import { startPlan } from "../plans/start.js";
import { type Suspects, suspectsBlock } from "../promises/test-incident.js";
import { type PlanCopy, resolvePlanCopies } from "../worktree/plan-worktrees.js";
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

/** Directories that say nothing about which package a test file belongs to. */
const GENERIC_DIRS = new Set(["src", "lib", "test", "tests", "__tests__", "spec", "specs", "."]);

/** The nearest directory above `file` that names something: `apps/a/src/__tests__/x.test.ts` → `a`. */
function packageLabel(file: string): string {
	for (
		let dir = dirname(file.replaceAll("\\", "/"));
		dir !== "." && dir !== "/";
		dir = dirname(dir)
	) {
		const name = basename(dir);
		if (!GENERIC_DIRS.has(name)) return slug(name);
	}
	return "";
}

/** A leftover `plan/<name>` branch: `startPlan` refuses the name while it exists. */
const hasBranch = (trunk: string, plan: string): Promise<boolean> =>
	git(trunk, "rev-parse", "--verify", "--quiet", `refs/heads/plan/${plan}`)
		.then(() => true)
		.catch(() => false);

const slug = (text: string): string =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

/** An open plan's own documents name the file it is for. */
function namesFile(open: PlanCopy, file: string): boolean {
	return ["brief.md", "research.md"].some((doc) => {
		const path = join(open.dir, doc);
		return existsSync(path) && readFileSync(path, "utf-8").includes(file);
	});
}

/**
 * The plan a failing file goes to (D8). `fix-<stem>` unless taken: an open
 * plan for a different file moves on to `fix-<stem>-<package>`, then
 * `-2`, `-3`…; an archived plan of that name is never reused, and the plan
 * after it follows it. A name held on the trunk with no worktree, or by a
 * `plan/<name>` branch, is skipped too and named in the brief. A plan open for this very file is the one to extend.
 */
async function chooseName(
	trunk: string,
	copies: Map<string, PlanCopy>,
	file: string,
): Promise<{ plan: string; open?: PlanCopy; follows?: string; collided?: string }> {
	const base = bugfixPlanName(file);
	const label = packageLabel(file);
	let plan = base;
	let follows: string | undefined;
	let collided: string | undefined;
	let labelled = false;
	let seq = 1;
	for (;;) {
		const open = copies.get(plan);
		if (open?.source === "worktree" && !open.archivedInWorktree) {
			if (namesFile(open, file)) return { plan, open };
			if (label && !labelled) {
				labelled = true;
				plan = `${base}-${label}`;
				continue;
			}
		} else if (
			open?.source === "worktree" ||
			existsSync(join(getPlanningDir(trunk), "archive", plan))
		) {
			follows ??= plan;
		} else if (open || (await hasBranch(trunk, plan))) {
			collided ??= plan;
		} else {
			return { plan, follows, collided };
		}
		seq++;
		plan = `${base}-${seq}`;
	}
}

export async function openOrExtendBugfixPlan(
	root: string,
	failure: UnclaimedFailure,
): Promise<BugfixPlan> {
	const copies = await resolvePlanCopies(root);
	if (!copies.ok)
		throw new Error(`the worktree record ${copies.file} cannot be read: ${copies.problem}`);
	const { plan, open, follows, collided } = await chooseName(
		copies.projectRoot,
		copies.copies,
		failure.file,
	);
	if (open?.source === "worktree") {
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
	writeFileSync(
		brief,
		`${readFileSync(brief, "utf-8").trimEnd()}\n\n${briefBody(failure, follows, collided)}\n`,
	);
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

function briefBody(f: UnclaimedFailure, follows?: string, collided?: string): string {
	const tested = f.rows.map(
		(r) =>
			`- \`${r.plan}\`${r.archived ? " (archived)" : ""}, row \`${r.id}\` — names this file and proves no promise`,
	);
	return [
		"## What failed",
		"",
		`\`${f.file}\` failed in the slow tests of release ${f.release.version} and still failed when run again. No promise's test row names it, so no incident was opened; this plan is where it is fixed.`,
		"",
		...(follows
			? [
					`It follows \`archive/${follows}\`, the bugfix plan that fixed an earlier failure of this file and was archived: it broke again after that fix.`,
					"",
				]
			: []),
		...(collided
			? [
					`The name \`${collided}\` is already held — by a plan folder on the trunk or a \`plan/${collided}\` branch with no worktree — so this plan took the next free one.`,
					"",
				]
			: []),
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

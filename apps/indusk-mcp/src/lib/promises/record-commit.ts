import { existsSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { getTrunkBranches } from "../config.js";
import { git } from "../git.js";
import type { RecordedBy } from "./record.js";
import { readPromises } from "./registry.js";
import type { WatchChange } from "./watch.js";

/**
 * The writer's commit half (incident-recording; split from `record.ts` at
 * cleanup): what a pass wrote is committed on the trunk, by path, as
 * InDusk's own, and what a pass could not commit is finished by the next.
 *
 * promise: a-production-break-is-recorded-unasked
 */

/** The paths a pass wrote and could not commit, kept in the project's home for the next pass. */
export const PENDING_FILE = "pending-commit.json";

/**
 * Commit what a pass wrote — each incident file, each promise that now lists
 * it, and each reopened owner's impl — in the repository holding the file, one
 * commit per repository. A file in a plan worktree is the plan's to commit:
 * only the repositories holding the registry and the plan root are written.
 *
 * What an earlier pass wrote and could not commit is committed first (A27):
 * its paths are kept in the home until they are, so a later pass with nothing
 * new still finishes the job, and only those paths are swept — never a
 * developer's other edits. Recording commits on a trunk branch only (A29);
 * anywhere else the paths wait, and the pass says where it is.
 */
export async function commitRecorded(
	planRoot: string,
	home: string,
	changes: WatchChange[],
	by: RecordedBy,
): Promise<string[]> {
	const owed = new Set(readPending(home));
	if (changes.length > 0) {
		const read = readPromises(planRoot);
		if (!read.ok) throw new Error(`the registry could not be read after recording: ${planRoot}`);
		const registry = read.registry;
		const allowed = new Set([await topLevel(planRoot), await topLevel(registry.dir)]);
		for (const path of recordedPaths(registry, changes)) {
			// Real paths on both sides: git answers with the real path, and a
			// temp dir or a symlinked checkout names the same file another way.
			if (!existsSync(path)) continue;
			const real = realpathSync(path);
			if (allowed.has(await topLevel(dirname(real)))) owed.add(real);
		}
	}
	if (owed.size === 0) return [];
	writePending(home, [...owed]);

	const byRepo = new Map<string, string[]>();
	for (const real of owed) {
		if (!existsSync(real)) continue;
		const top = await topLevel(dirname(real));
		byRepo.set(top, [...(byRepo.get(top) ?? []), relative(top, real)]);
	}
	const trunks = getTrunkBranches(planRoot);
	for (const repo of byRepo.keys()) {
		const branch = (await git(repo, "branch", "--show-current")).trim();
		if (!trunks.includes(branch)) {
			throw new Error(
				`${repo} is on ${branch ? `branch ${branch}` : "a detached HEAD"}, not a trunk branch (${trunks.join(", ")}): recording commits on the trunk, so nothing was committed — run it from the trunk checkout; ${owed.size} file(s) wait in ${join(home, PENDING_FILE)}`,
			);
		}
	}
	const message = commitMessage(changes, by);
	const committed: string[] = [];
	for (const [repo, rel] of byRepo) {
		const dirty = (await git(repo, "status", "--porcelain", "--", ...rel)).trim();
		if (dirty) {
			await git(repo, "add", "--", ...rel);
			await git(repo, "commit", "-q", "-m", message, "--", ...rel);
			committed.push(...rel);
		}
	}
	writePending(home, []);
	return committed;
}

/** Each incident file, the promise that lists it, and each reopened owner's impl. */
function recordedPaths(
	registry: { dir: string; promises: { name: string; file: string }[] },
	changes: WatchChange[],
): string[] {
	const paths = new Set<string>();
	for (const change of changes) {
		if (change.kind !== "unowned") {
			paths.add(join(registry.dir, "incidents", `${change.id}.md`));
			const promise = registry.promises.find((p) => p.name === change.promise);
			if (promise) paths.add(join(registry.dir, promise.file));
		}
		if (change.reopen.reopened) paths.add(change.reopen.impl);
	}
	return [...paths];
}

function readPending(home: string): string[] {
	const path = join(home, PENDING_FILE);
	if (!existsSync(path)) return [];
	try {
		const data: unknown = JSON.parse(readFileSync(path, "utf-8"));
		return Array.isArray(data) ? data.filter((p): p is string => typeof p === "string") : [];
	} catch {
		return [];
	}
}

function writePending(home: string, paths: string[]): void {
	const path = join(home, PENDING_FILE);
	if (paths.length === 0) {
		rmSync(path, { force: true });
		return;
	}
	writeFileSync(`${path}.tmp`, `${JSON.stringify(paths, null, 2)}\n`);
	renameSync(`${path}.tmp`, path);
}

function commitMessage(changes: WatchChange[], by: RecordedBy): string {
	const recorded = changes.filter((c) => c.kind !== "unowned");
	if (recorded.length === 1) {
		return `chore(indusk): incident ${recorded[0].id} — ${recorded[0].promise}, recorded by ${by}`;
	}
	if (recorded.length === 0) {
		return changes.length === 0
			? `chore(indusk): incident files an earlier pass left uncommitted, recorded by ${by}`
			: `chore(indusk): incidents reopened, recorded by ${by}`;
	}
	return `chore(indusk): incidents ${recorded.map((c) => c.id).join(", ")}, recorded by ${by}`;
}

async function topLevel(dir: string): Promise<string> {
	return (await git(dir, "rev-parse", "--show-toplevel")).trim();
}

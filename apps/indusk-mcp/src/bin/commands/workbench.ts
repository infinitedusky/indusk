import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import {
	isWorkbench,
	readSiblingParent,
	readWorkbenchRepos,
	type WorkbenchRepo,
} from "../../lib/worktree/repos.js";
import { ensureShareableScaffolding, untrackNowIgnored } from "../../lib/worktree/shareable.js";

/**
 * `indusk workbench restore` — materialize a workbench that has only been
 * cloned.
 *
 * A workbench context repo carries `.indusk/`, `.claude/` and its docs, but
 * NOT the repos it wraps: those are siblings with their own remotes, and the
 * trunk symlinks pointing at them dangle on a fresh clone. Before this command
 * the only way through was to clone each repo and recreate each link by hand —
 * `init` refuses an already-initialized workbench by design, and `update` is a
 * hot path that must stay fast and offline-tolerant, so neither is the place
 * for a network clone.
 *
 * Idempotent: re-running reports what is already there and writes nothing.
 *
 * FAILS LOUD AND PARTIAL. One unreachable remote does not abort the others,
 * and the command exits non-zero naming everything it could not do. Half a
 * workbench that exits 0 is indistinguishable from a whole one from the
 * outside, and that shape — a checker that cannot tell "could not" from
 * "did" — is the failure this codebase has three separate mechanisms to avoid.
 */

interface RestoreFailure {
	repo: string;
	reason: string;
}

/** Files a restore can never supply. Printed every run, not only on failure. */
const OUT_OF_BAND = [
	"env/*.env and per-app .env.<profile> pulls",
	".indusk/extensions/doppler/.env (the service token)",
	"any repo-local config (e.g. a database config.sh)",
	"SSH host aliases your remotes depend on (e.g. `github-<org>` in ~/.ssh/config)",
];

function git(args: string[], cwd: string): { ok: boolean; stderr: string } {
	const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
	return { ok: r.status === 0, stderr: r.stderr ?? "" };
}

function expandHome(p: string): string {
	return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

/**
 * Point `<workbench>/<name>` at the sibling clone, with a RELATIVE target.
 *
 * Relative so the workbench survives being cloned to a different absolute path
 * on the next machine — an absolute link works perfectly on the machine that
 * created it and breaks silently everywhere else, which is the worst place for
 * this to be wrong.
 */
function linkTrunk(workbenchRoot: string, name: string, target: string): void {
	const link = join(workbenchRoot, name);
	const rel = relative(workbenchRoot, target);
	if (existsSync(link) || isDanglingLink(link)) {
		// Repair a link that points somewhere else; leave a correct one alone.
		if (isSymlink(link) && readlinkSync(link) === rel) return;
		if (isSymlink(link)) rmSync(link);
		else return; // a real directory here is not ours to remove
	}
	symlinkSync(rel, link);
}

function isSymlink(p: string): boolean {
	try {
		return lstatSync(p).isSymbolicLink();
	} catch {
		return false;
	}
}

/**
 * Where the sibling clones live.
 *
 * `sibling_parent` is an ABSOLUTE path committed to a SHARED context repo,
 * which is a contradiction this plan has to absorb rather than inherit: the
 * avoca workbench's committed value is `/Users/sandycorsillo/...`, so on any
 * other machine it names a directory that does not exist and every repo reads
 * as missing. No fixture catches this — a fixture writes its own tmpdir there.
 *
 * The fallback is the workbench's PARENT, which is not a guess: `indusk setup`
 * builds exactly `<parent>/<repo>` beside `<parent>/<repo>-workbench`, so the
 * parent IS the sibling directory. A declared path that exists still wins, so
 * nothing changes for a workbench sitting on the machine that wrote it.
 */
function resolveSiblingParent(projectRoot: string): { siblingParent: string; note?: string } {
	const parent = resolve(projectRoot, "..");
	const declared = readSiblingParent(projectRoot);
	if (!declared) return { siblingParent: parent };

	const expanded = resolve(expandHome(declared));
	if (existsSync(expanded)) return { siblingParent: expanded };

	return {
		siblingParent: parent,
		note:
			`Note: worktree.sibling_parent points at ${expanded}, which does not exist here — ` +
			`it is an absolute path from whichever machine wrote it.\n` +
			`      Using this workbench's parent instead: ${parent}`,
	};
}

/** A symlink whose target is missing — `existsSync` follows links and says no. */
function isDanglingLink(p: string): boolean {
	return isSymlink(p) && !existsSync(p);
}

function restoreOne(
	repo: WorkbenchRepo,
	workbenchRoot: string,
	siblingParent: string,
): { status: "present" | "cloned"; failure?: RestoreFailure } {
	const target = join(siblingParent, repo.name);

	if (existsSync(join(target, ".git"))) {
		linkTrunk(workbenchRoot, repo.name, target);
		return { status: "present" };
	}

	// Declared but unrestorable. Reported by name — a repo silently absent from
	// a "successful" restore is the thing A12 exists to forbid.
	if (!repo.remote) {
		return {
			status: "present",
			failure: {
				repo: repo.name,
				reason:
					"declared with no `remote`, and not present on disk — add a remote to .indusk/config.json or clone it yourself",
			},
		};
	}

	mkdirSync(siblingParent, { recursive: true });
	const { ok, stderr } = git(["clone", "--quiet", repo.remote, target], siblingParent);
	if (!ok) {
		return {
			status: "present",
			failure: {
				repo: repo.name,
				reason: `clone failed from ${repo.remote}${stderr.trim() ? ` — ${stderr.trim().split("\n")[0]}` : ""}`,
			},
		};
	}
	linkTrunk(workbenchRoot, repo.name, target);
	return { status: "cloned" };
}

export function workbenchRestore(projectRoot: string, opts: { worktrees?: boolean } = {}): never {
	const repos = readWorkbenchRepos(projectRoot);
	if (!isWorkbench(projectRoot) || repos.length === 0) {
		console.error(
			'Error: this project is not a workbench (needs worktree.shape="workbench" and worktree.repos[] in .indusk/config.json).',
		);
		process.exit(1);
	}

	const { siblingParent, note } = resolveSiblingParent(projectRoot);
	if (note) console.info(note);

	console.info(`Workbench: ${projectRoot}`);
	console.info(`Repos (${repos.length}): ${repos.map((r) => r.name).join(", ")}`);

	// Scaffolded here rather than at git-init time so a workbench that was
	// made shareable by hand (the POC's path) still gets the rules, and so the
	// ignore file exists BEFORE anything can be committed. Never overwrites.
	const scaffold = ensureShareableScaffolding(projectRoot);
	if (scaffold.created.length > 0) {
		console.info(`Scaffolded: ${scaffold.created.join(", ")}`);
	}
	// Ignoring a path does not untrack it. A workbench git-initialized before
	// these rules existed keeps publishing its symlinks and secrets while
	// `git status` looks clean.
	const untracked = untrackNowIgnored(projectRoot);
	if (untracked.length > 0) {
		console.info(`Untracked ${untracked.length} now-ignored path(s) (index only, files kept)`);
	}
	console.info("");

	// Every repo is attempted. A first failure must not decide the fate of the
	// rest, or restoring an N-repo workbench becomes a lottery decided by
	// declaration order.
	const failures: RestoreFailure[] = [];
	for (const repo of repos) {
		const { status, failure } = restoreOne(repo, projectRoot, siblingParent);
		if (failure) {
			failures.push(failure);
			console.error(`  ✗ ${repo.name} — ${failure.reason}`);
			continue;
		}
		console.info(
			status === "cloned"
				? `  ✓ ${repo.name} — cloned into ${siblingParent} and linked`
				: `  ✓ ${repo.name} — already present, trunk linked`,
		);
	}

	if (opts.worktrees) {
		console.info("");
		console.info("Worktrees: none declared (a worktrees[] manifest is not read yet).");
	}

	console.info("");
	console.info("Supply these out-of-band — restore cannot and never will:");
	for (const item of OUT_OF_BAND) console.info(`  - ${item}`);

	if (failures.length > 0) {
		console.error("");
		console.error(`Restore incomplete — ${failures.length} of ${repos.length} repo(s) unresolved:`);
		for (const f of failures) console.error(`  - ${f.repo}: ${f.reason}`);
		console.error("Fix the above and re-run `indusk workbench restore` — it is idempotent.");
		process.exit(1);
	}

	console.info("");
	console.info("Workbench restored. Next: supply the out-of-band set, then `indusk update`.");
	process.exit(0);
}

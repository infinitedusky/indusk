import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { isUsableRelPath } from "../../lib/path-segment.js";
import { linkTrunk, listWorkbenchSubdirs, worktreeOwner } from "../../lib/worktree/layout.js";
import {
	isWorkbench,
	readReposRoot,
	readSiblingParent,
	readWorkbenchRepos,
	repoDir,
	type WorkbenchRepo,
} from "../../lib/worktree/repos.js";
import {
	allLocationsDeclared,
	ensureShareableScaffolding,
	missingIgnoreRules,
	topUpManagedIgnore,
	untrackNowIgnored,
} from "../../lib/worktree/shareable.js";
import { ensureContextRepo, repoPublishState, syncWorkbench } from "../../lib/worktree/sync.js";

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

/**
 * What restore did to one repo, including whether the trunk link happened.
 *
 * The `-unlinked` variants exist because `linkTrunk` deliberately refuses to
 * remove a real directory sitting at the trunk path — and reporting that as
 * "linked" is a claim about something that never happened.
 */
export type RestoreStatus =
	| "present"
	| "present-unlinked"
	| "cloned"
	| "cloned-unlinked"
	| "nested"
	| "nested-cloned";

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
 * Where the sibling clones live.
 *
 * `sibling_parent` is an ABSOLUTE path committed to a SHARED context repo,
 * which is a contradiction this plan has to absorb rather than inherit. One
 * real workbench's committed value was another machine's home directory, so
 * on this machine it named a directory that did not exist and every repo read
 * as missing. No fixture catches this — a fixture writes its own tmpdir there.
 *
 * The fallback is the workbench's PARENT, which is not a guess: `indusk setup`
 * builds exactly `<parent>/<repo>` beside `<parent>/<repo>-workbench`, so the
 * parent IS the sibling directory. A declared path that exists still wins, so
 * nothing changes for a workbench sitting on the machine that wrote it.
 */
function resolveSiblingParent(projectRoot: string): { siblingParent: string; note?: string } {
	const parent = resolve(projectRoot, "..");
	const declared = readReposRoot(projectRoot);
	if (!declared) return { siblingParent: parent };

	// RELATIVE resolves against the workbench, and that is the whole point: a
	// relative value means the same place on every machine, so the layout it
	// describes reproduces when the workbench is cloned. `repos_root: "."` is
	// how a workbench says its repos live inside it.
	//
	// An ABSOLUTE value keeps its old meaning, and its old problem — it names
	// whichever machine wrote it. It is still honored where it resolves, and
	// still falls back loudly where it does not, because silently cloning
	// somewhere unexpected is worse than saying so.
	if (!declared.startsWith("/") && !declared.startsWith("~")) {
		if (!isUsableRelPath(declared)) {
			return {
				siblingParent: parent,
				note:
					`Note: worktree.repos_root is "${declared}", which is not a usable location ` +
					`inside the workbench (it must not escape it, or name .git/.indusk/.claude).\n` +
					`      Using this workbench's parent instead: ${parent}`,
			};
		}
		return { siblingParent: resolve(projectRoot, declared) };
	}

	const expanded = resolve(expandHome(declared));
	if (existsSync(expanded)) return { siblingParent: expanded };

	return {
		siblingParent: parent,
		note:
			`Note: worktree.repos_root points at ${expanded}, which does not exist here — ` +
			`it is an absolute path from whichever machine wrote it. A path relative to the ` +
			`workbench (e.g. "." or "repos") reproduces on every machine.\n` +
			`      Using this workbench's parent instead: ${parent}`,
	};
}

/**
 * Refuse when a workbench's own ignore file cannot carry the sharing contract.
 *
 * Found by pointing the tool at a real pre-existing workbench: scaffolding only
 * TOPS UP an existing `.gitignore`, so one written before this plan never
 * receives the deny-by-default rule — and `sync` then commits worktree
 * contents. On a real workbench that is dozens of checkouts of someone else's
 * repo entering a shared context repo.
 *
 * **Refuse rather than rewrite.** Appending `/*` plus an allow-list to a file
 * somebody else wrote inverts its meaning: every root entry becomes denied
 * unless listed. Given what is at stake, a loud stop beats an opinionated
 * rewrite of a human's decision.
 *
 * `missingIgnoreRules` has existed and been correct since Phase 4 — it was
 * simply never consulted at the moment it mattered.
 */
function refuseIfIgnoreCannotHold(
	projectRoot: string,
	repos: WorkbenchRepo[],
	skip: boolean,
): void {
	if (skip) return;
	// A declared layout names its worktree directories exactly, so no
	// deny-by-default rule is required and nothing to refuse.
	if (allLocationsDeclared(repos)) return;

	// InDusk wrote this file, so InDusk may extend it. Every freshly created
	// workbench lands here — `init` scaffolds a `.gitignore`, so without this
	// the refusal fires on the product's own output.
	if (topUpManagedIgnore(projectRoot)) {
		console.info("Added the workbench rules to the InDusk-managed .gitignore.");
	}

	const gaps = missingIgnoreRules(projectRoot);
	if (gaps.length === 0) return;

	console.error(
		"Error: this workbench's .gitignore cannot keep worktrees out of the shared remote.",
	);
	console.error("");
	for (const gap of gaps) console.error(`  missing: ${gap}`);
	console.error("");
	console.error(
		"Worktree directories are created at runtime, so they cannot be named in advance —",
	);
	console.error("a flat workbench needs the deny-by-default rule to keep them out.");
	console.error("");
	console.error("Fix it one of these ways:");
	console.error(
		"  - declare where worktrees live (worktree.repos[].worktrees), which names them precisely",
	);
	console.error("  - add the missing rule(s) to .gitignore yourself");
	console.error("  - re-run with --no-ignore-check to proceed anyway");
	process.exit(1);
}

/**
 * Phrase one repo's outcome.
 *
 * Separated from the loop that prints it so the four cases can be read — and
 * tested — without spawning the CLI. The loop decides what happened; this says
 * it. They are two jobs, and the four-way ternary that used to sit inline made
 * that hard to see.
 */
export function restoreLine(
	repo: WorkbenchRepo,
	status: RestoreStatus,
	siblingParent: string,
): string {
	// `linkTrunk` deliberately refuses to replace a real directory sitting at
	// the trunk path, so both `-unlinked` cases are correct behavior that the
	// message must not describe as a link.
	const unlinked = `a real directory occupies ${repoDir(repo)}/ in the workbench, so no trunk symlink was made — left as is`;
	switch (status) {
		// The repo lives inside the workbench at its own trunk path. No link is
		// possible and none is wanted — `repos_root: "."` exists to say so.
		case "nested":
			return `${repo.name} — present in the workbench at ${repoDir(repo)}/`;
		case "nested-cloned":
			return `${repo.name} — cloned into the workbench at ${repoDir(repo)}/`;
		case "cloned":
			return `${repo.name} — cloned into ${siblingParent} and linked`;
		case "cloned-unlinked":
			return `${repo.name} — cloned into ${siblingParent}/${repo.name}, but ${unlinked}`;
		case "present-unlinked":
			return `${repo.name} — already present, but ${unlinked}`;
		case "present":
			return `${repo.name} — already present, trunk linked`;
	}
}

function restoreOne(
	repo: WorkbenchRepo,
	workbenchRoot: string,
	siblingParent: string,
): { status: RestoreStatus; failure?: RestoreFailure } {
	const target = join(siblingParent, repo.name);
	// When the repo lives INSIDE the workbench at its trunk path — the nested
	// layout `repos_root: "."` exists to express — there is no link to make and
	// nothing wrong. Reporting that as "a real directory occupies …" describes
	// a working layout as a collision.
	const isNested = resolve(target) === resolve(join(workbenchRoot, repoDir(repo)));

	if (existsSync(join(target, ".git"))) {
		if (isNested) return { status: "nested" };
		const linked = linkTrunk(workbenchRoot, repoDir(repo), target);
		return { status: linked ? "present" : "present-unlinked" };
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
	// By declared path, and reporting what the link attempt actually did —
	// the clone branch had BOTH bugs the present branch had: it resolved by
	// name rather than declared path, and it discarded the result.
	if (isNested) return { status: "nested-cloned" };
	const linked = linkTrunk(workbenchRoot, repoDir(repo), target);
	return { status: linked ? "cloned" : "cloned-unlinked" };
}

export function workbenchRestore(
	projectRoot: string,
	opts: { worktrees?: boolean; noIgnoreCheck?: boolean } = {},
): never {
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
	const scaffold = ensureShareableScaffolding(projectRoot, repos);
	if (scaffold.created.length > 0) {
		console.info(`Scaffolded: ${scaffold.created.join(", ")}`);
	}
	// The context repo is created lazily, here and in `sync`, rather than
	// demanded up front — a remote is a decision the developer makes, and
	// local commits are useful before one exists. `git init` with no remote is
	// a complete, working state, not a half-configured one.
	if (ensureContextRepo(projectRoot)) {
		console.info("Initialized the workbench context repo (add a remote to share it).");
	}
	refuseIfIgnoreCannotHold(projectRoot, repos, opts.noIgnoreCheck === true);
	// Ignoring a path does not untrack it. A workbench git-initialized before
	// these rules existed keeps publishing its symlinks and secrets while
	// `git status` looks clean.
	// NAMED, never counted. This drops files out of a SHARED repo's index —
	// a workbench's own rules decide which, and "untracked 3 paths" gives a
	// reader no way to notice that one of them was something they wanted.
	// (Found on a real workbench: `.mcp.json` was both tracked AND ignored,
	// so restore untracked it. Correct per their rule, surprising in silence.)
	const untracked = untrackNowIgnored(projectRoot);
	if (untracked.length > 0) {
		console.info(
			`Untracked ${untracked.length} now-ignored path(s) — index only, files kept on disk:`,
		);
		for (const path of untracked) console.info(`  - ${path}`);
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
		console.info(`  ✓ ${restoreLine(repo, status, siblingParent)}`);
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

/**
 * `indusk workbench sync` — one sync point: commit, pull, push, blindly resolved.
 *
 * Exits 0 even when the remote is unreachable. The work is committed locally
 * and goes out on the next sync; someone else's outage must never become your
 * inability to work.
 */
export function workbenchSyncCommand(
	projectRoot: string,
	opts: { noIgnoreCheck?: boolean } = {},
): never {
	const repos = readWorkbenchRepos(projectRoot);
	if (!isWorkbench(projectRoot) && repos.length === 0) {
		console.error(
			'Error: this project is not a workbench (needs worktree.shape="workbench" in .indusk/config.json).',
		);
		process.exit(1);
	}

	// The ignore rules must exist before anything is committed, or the first
	// sync publishes exactly what they were written to keep out.
	const scaffold = ensureShareableScaffolding(projectRoot, repos);
	if (scaffold.created.length > 0) console.info(`Scaffolded: ${scaffold.created.join(", ")}`);
	refuseIfIgnoreCannotHold(projectRoot, repos, opts.noIgnoreCheck === true);
	// Named here too, not only in `restore`. Sync runs unattended on a hook, so
	// a silent index change is the one most likely to go unnoticed.
	const dropped = untrackNowIgnored(projectRoot);
	if (dropped.length > 0) {
		console.info(
			`Untracked ${dropped.length} now-ignored path(s) — index only, files kept on disk:`,
		);
		for (const path of dropped) console.info(`  - ${path}`);
	}

	const result = syncWorkbench(projectRoot);
	for (const note of result.notes) console.info(note);
	if (!result.committed && result.notes.length === 0)
		console.info("Nothing to sync — tree is clean.");
	console.info(
		`sync: committed=${result.committed} pulled=${result.pulled} pushed=${result.pushed}`,
	);
	process.exit(0);
}

/**
 * `indusk workbench status` — is each declared repo materialized, and has its
 * work actually left this machine?
 */
export function workbenchStatusCommand(projectRoot: string): never {
	const repos = readWorkbenchRepos(projectRoot);
	if (repos.length === 0) {
		console.error(
			"Error: this project declares no repos (worktree.repos[] in .indusk/config.json).",
		);
		process.exit(1);
	}
	const { siblingParent } = resolveSiblingParent(projectRoot);

	console.info(`Workbench: ${projectRoot}`);
	console.info("");
	for (const repo of repos) {
		// By DECLARED path, like every other consumer. This was the one place
		// still deriving a location from a name.
		const st = repoPublishState(siblingParent, repoDir(repo));
		if (!st.present) {
			console.info(`  ${repo.name}: not materialized — run \`indusk workbench restore\``);
			continue;
		}
		if (!st.hasRemote) {
			console.info(`  ${repo.name}: present, no remote configured (nothing to publish to)`);
			continue;
		}
		if (!st.published) {
			console.info(
				`  ${repo.name}: has a remote, but this branch has NEVER BEEN PUSHED — none of its work is visible to anyone else`,
			);
			continue;
		}
		console.info(
			st.ahead > 0
				? `  ${repo.name}: ${st.ahead} commit(s) ahead of its remote — NOT PUSHED, so a teammate pulling this workbench cannot see that work yet`
				: `  ${repo.name}: in sync with its remote`,
		);
	}
	process.exit(0);
}

/**
 * `indusk workbench migrate-layout` — move a flat workbench into declared layout.
 *
 * DRY-RUN BY DEFAULT. A command that relocates directories shows its plan
 * before doing anything; `--apply` performs it.
 *
 * Uses `git worktree move`, never a manual rename. A git worktree is two
 * cross-references — the worktree's `.git` file and the repo's
 * `.git/worktrees/<name>/gitdir` pointing back — and moving the directory
 * without repairing both leaves something that looks right and is broken. That
 * is the only failure of this command that would matter, so it is handed to
 * the tool that knows.
 *
 * Wrapped repos are never committed to or modified beyond the worktree
 * bookkeeping: this moves worktrees, not product code.
 */
export function workbenchMigrateLayout(projectRoot: string, opts: { apply?: boolean } = {}): never {
	const repos = readWorkbenchRepos(projectRoot);
	if (repos.length === 0) {
		console.error(
			"Error: this project declares no repos (worktree.repos[] in .indusk/config.json).",
		);
		process.exit(1);
	}

	const alreadyDeclared = repos.filter((r) => r.worktrees);
	if (alreadyDeclared.length === repos.length) {
		console.info("Every repo already declares a worktrees location — nothing to migrate.");
		process.exit(0);
	}

	const repoPaths = new Map(repos.map((r) => [r.name, join(projectRoot, repoDir(r))]));
	const occupied = new Set(repos.map((r) => repoDir(r)));
	const loose = listWorkbenchSubdirs(projectRoot).filter((n) => !occupied.has(n));

	// Attribute each loose directory to a repo, and plan its destination.
	interface Move {
		repo: string;
		slug: string;
		from: string;
		to: string;
	}
	const moves: Move[] = [];
	const unplaceable: string[] = [];
	const unmovable: string[] = [];
	for (const slug of loose) {
		const owner = worktreeOwner(join(projectRoot, slug), repoPaths);
		if (!owner) {
			unplaceable.push(slug);
			continue;
		}
		const dest = `${owner}-worktrees`;
		// A worktree already NAMED `<repo>-worktrees` would be moved inside
		// itself. git refuses that, but only at execution — so the plan would
		// show an impossible move and then fail on `Invalid argument`, which
		// tells the reader nothing. Catch it while planning.
		if (slug === dest) {
			unmovable.push(`${slug}: cannot move — the destination is inside itself`);
			continue;
		}
		moves.push({
			repo: owner,
			slug,
			from: join(projectRoot, slug),
			to: join(projectRoot, dest, slug),
		});
	}

	console.info(`Workbench: ${projectRoot}`);
	console.info(opts.apply ? "Applying layout migration:" : "Dry run — would move:");
	console.info("");
	for (const m of moves) {
		console.info(`  ${m.slug}  ->  ${m.repo}-worktrees/${m.slug}`);
	}
	if (moves.length === 0) console.info("  (no worktrees to move)");
	if (unplaceable.length > 0) {
		console.info("");
		console.info("Left where they are — not resolvable to any declared repo:");
		for (const slug of unplaceable) console.info(`  ${slug}`);
	}
	if (unmovable.length > 0) {
		console.info("");
		console.info("Skipped — cannot be moved:");
		for (const why of unmovable) console.info(`  ${why}`);
	}

	if (!opts.apply) {
		console.info("");
		console.info("Nothing changed. Re-run with --apply to perform the migration.");
		process.exit(0);
	}

	// Perform. Every failure is collected and named; a partial migration that
	// exits 0 is the shape this plan has refused throughout.
	const failures: string[] = [];
	const migrated = new Set<string>();
	for (const m of moves) {
		mkdirSync(join(projectRoot, `${m.repo}-worktrees`), { recursive: true });
		const repoPath = repoPaths.get(m.repo);
		const r = spawnSync("git", ["-C", repoPath ?? projectRoot, "worktree", "move", m.from, m.to], {
			encoding: "utf-8",
		});
		if (r.status === 0) {
			console.info(`  ✓ ${m.slug}`);
			migrated.add(m.repo);
		} else {
			const why = (r.stderr ?? "").trim().split("\n")[0] ?? "unknown error";
			console.error(`  ✗ ${m.slug} — ${why}`);
			failures.push(`${m.slug}: ${why}`);
		}
	}

	// Declare the layout for every repo whose worktrees actually moved, plus
	// any repo that had none — the declaration is what makes the ignore rule
	// precise, and a repo with no worktrees still benefits.
	const declared = declareWorktreeLocations(
		projectRoot,
		repos.filter(
			(r) => !r.worktrees && (migrated.has(r.name) || !moves.some((m) => m.repo === r.name)),
		),
	);
	if (declared.length > 0) {
		console.info("");
		console.info(`Declared worktrees location for: ${declared.join(", ")}`);
	}

	if (failures.length > 0) {
		console.error("");
		console.error(`Migration incomplete — ${failures.length} worktree(s) could not be moved:`);
		for (const f of failures) console.error(`  - ${f}`);
		console.error("Fix those and re-run — the command is safe to repeat.");
		process.exit(1);
	}

	console.info("");
	console.info("Layout migrated. `indusk worktree list` now groups by repo.");
	process.exit(0);
}

/**
 * Write `worktrees` for the given repos. Returns the names it declared.
 *
 * MATERIALIZES the singular shape on the way. A legacy workbench declares
 * `wrapped_repo` and has no `repos[]` at all, so iterating `cfg.worktree.repos`
 * found nothing and the migration recorded nothing — on exactly the workbenches
 * this migration exists for. The moves still happened, so the layout changed
 * and the config did not, and the next `worktree create` put a worktree back at
 * the root.
 *
 * The repo set comes from `readWorkbenchRepos`, never from re-reading the
 * singular field here: the reduction has one definition and this is a caller,
 * not a second copy of it. What this adds is writing that reduction down.
 */
function declareWorktreeLocations(projectRoot: string, repos: readonly WorkbenchRepo[]): string[] {
	if (repos.length === 0) return [];
	const cfgPath = join(projectRoot, ".indusk", "config.json");
	const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
	cfg.worktree ??= {};
	if (!Array.isArray(cfg.worktree.repos)) {
		// Carry every field the reduction produced, so materializing loses
		// nothing a declared entry would have held.
		cfg.worktree.repos = repos.map((r) => ({
			name: r.name,
			...(r.remote ? { remote: r.remote } : {}),
			...(r.path ? { path: r.path } : {}),
			...(r.worktrees ? { worktrees: r.worktrees } : {}),
		}));
	}
	const names = new Set(repos.map((r) => r.name));
	const done: string[] = [];
	for (const entry of cfg.worktree.repos) {
		if (names.has(entry.name) && !entry.worktrees) {
			entry.worktrees = `${entry.name}-worktrees`;
			done.push(entry.name);
		}
	}
	if (done.length > 0) writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
	return done;
}

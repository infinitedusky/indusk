import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** The three scripts `indusk verify` requires before it will run any detector. */
const GATE_SCRIPTS = [
	"validate-impl-structure.js",
	"check-gates.js",
	"claude-md-budget.js",
] as const;

/**
 * Build a throwaway workbench + canonical clone for testing the bash
 * scripts. Both live under one tmpdir so cleanup is a single rm.
 *
 * Shape:
 *
 *   <tmpdir>/<prefix>-XXX/
 *   ├── clone/                  # canonical clone (the "wrapped repo")
 *   │   ├── .git/
 *   │   ├── README.md
 *   │   └── package.json
 *   └── workbench/              # the indusk project
 *       ├── .indusk/
 *       │   ├── config.json     # worktree.{shape, wrapped_repo, sibling_parent}
 *       │   └── worktree-configs/clone.json
 *       ├── package.json
 *       └── clone -> ../clone   # trunk symlink
 *
 * The wrapped repo's name is fixed as `clone` so paths are predictable.
 * Sibling parent is the tmpdir itself.
 */

export interface WorktreeFixture {
	root: string;
	cloneDir: string;
	workbenchDir: string;
	worktreeConfigPath: string;
	cleanup(): void;
}

export interface BuildFixtureOptions {
	/** Per-repo config to write at `<workbench>/.indusk/worktree-configs/clone.json`. */
	worktreeConfig?: Record<string, unknown>;
	/** Extra files to commit on `main` in the canonical clone before fixture returns. */
	extraFiles?: Array<{ path: string; content: string }>;
}

const REPO_NAME = "clone";

function git(cwd: string, args: string[]): void {
	const r = spawnSync("git", args, {
		cwd,
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "test@test.local",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "test@test.local",
		},
		encoding: "utf-8",
	});
	if (r.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed (cwd=${cwd}, code=${r.status}): ${r.stderr}`);
	}
}

export function buildWorktreeFixture(opts: BuildFixtureOptions = {}): WorktreeFixture {
	const root = mkdtempSync(join(tmpdir(), "wt-fixture-"));
	const cloneDir = join(root, REPO_NAME);
	const workbenchDir = join(root, "workbench");

	// --- canonical clone ---
	mkdirSync(cloneDir, { recursive: true });
	git(cloneDir, ["init", "-q", "-b", "main"]);
	writeFileSync(join(cloneDir, "README.md"), `# ${REPO_NAME}\n`);
	writeFileSync(
		join(cloneDir, "package.json"),
		JSON.stringify({ name: REPO_NAME, version: "0.0.0" }, null, 2),
	);
	for (const { path, content } of opts.extraFiles ?? []) {
		const dest = join(cloneDir, path);
		mkdirSync(resolve(dest, ".."), { recursive: true });
		writeFileSync(dest, content);
	}
	git(cloneDir, ["add", "-A"]);
	git(cloneDir, ["commit", "-q", "-m", "initial"]);

	// --- workbench skeleton ---
	mkdirSync(join(workbenchDir, ".indusk", "worktree-configs"), {
		recursive: true,
	});
	writeFileSync(
		join(workbenchDir, ".indusk", "config.json"),
		JSON.stringify(
			{
				mode: "full",
				scm: "git",
				worktree: {
					shape: "workbench",
					wrapped_repo: REPO_NAME,
					sibling_parent: root,
				},
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(workbenchDir, "package.json"),
		JSON.stringify({ name: "test-workbench", version: "0.0.0", private: true }, null, 2),
	);
	const worktreeConfigPath = join(workbenchDir, ".indusk", "worktree-configs", `${REPO_NAME}.json`);
	writeFileSync(
		worktreeConfigPath,
		JSON.stringify(opts.worktreeConfig ?? { trunk_branch: "main" }, null, 2),
	);

	// Trunk symlink: <workbench>/clone -> ../clone
	symlinkSync(`../${REPO_NAME}`, join(workbenchDir, REPO_NAME));

	return {
		root,
		cloneDir,
		workbenchDir,
		worktreeConfigPath,
		cleanup(): void {
			if (existsSync(root)) {
				spawnSync("rm", ["-rf", root]);
			}
		},
	};
}

// ---------------------------------------------------------------------------
// Multi-repo workbench fixture (versioned-workbench)
// ---------------------------------------------------------------------------

/**
 * A workbench that declares TWO repos, each backed by a real bare remote.
 *
 * Lives beside `buildWorktreeFixture` rather than in its own module on
 * purpose: both build the same kind of thing, and two fixture builders that
 * drift apart is how a suite ends up asserting against two different ideas of
 * what a workbench is.
 *
 * Shape:
 *
 *   <tmpdir>/vw-fixture-XXX/
 *   ├── remotes/
 *   │   ├── alpha.git/          # bare — what `restore` clones from
 *   │   ├── beta.git/
 *   │   └── workbench.git/      # bare — the CONTEXT repo's remote
 *   └── workbench/              # the workbench root
 *       ├── .indusk/config.json # worktree.repos[] (name + remote)
 *       └── .indusk/planning/…  # some context worth sharing
 *
 * Deliberately does NOT materialize the sibling clones or the trunk symlinks
 * unless asked — an unmaterialized workbench is precisely the state a fresh
 * `git clone` of the context repo leaves you in, and it is what `restore` has
 * to fix.
 */
export interface TwoRepoFixture {
	root: string;
	workbenchDir: string;
	/** Bare remote paths for the declared repos, in declaration order. */
	remotes: [string, string];
	/** Declared repo names, in declaration order. */
	repoNames: [string, string];
	/** Bare remote for the workbench context repo — null unless `gitInitWorkbench`. */
	workbenchRemote: string | null;
	/** Clone the workbench context repo into `dir`. Requires `gitInitWorkbench`. */
	cloneWorkbenchTo(dir: string): string;
	cleanup(): void;
}

export interface TwoRepoOptions {
	/**
	 * `git init` the workbench root and wire it to a bare remote.
	 *
	 * Load-bearing for two rows rather than a convenience: A8 and A17 both
	 * pass for an accidental reason against a NON-git workbench root (nothing
	 * can leak into a remote that does not exist; `assertGitRepo` refuses
	 * before any detector runs). Authored against a git-initialized root they
	 * go red for the real reason. Flipping this flag is the inverted fixture
	 * the impl's register describes.
	 */
	gitInitWorkbench?: boolean;
	/** Declare this repo with no `remote` field — declared but unrestorable. */
	omitRemoteFor?: string;
	/** Point this repo's remote at a path that does not exist (A12). */
	breakRemoteFor?: string;
	/** Clone the siblings + create trunk symlinks up front (default false). */
	materialize?: boolean;
	/**
	 * Copy this repo's real gate scripts into `<workbench>/.claude/hooks/`.
	 *
	 * Needed by anything that drives `indusk verify`, which refuses up front
	 * with "Gate scripts not found" when they are absent — before a single
	 * detector runs. A test that skips this gets a red (or a green) that is
	 * about the missing scripts and nothing else, which is how an assertion
	 * ends up passing for a reason its author never considered.
	 *
	 * Copies the REAL scripts rather than stubs on purpose: a stub would make
	 * the fixture agree with whatever the test expects.
	 */
	installGateScripts?: boolean;
	/**
	 * Content for `.indusk/planning/sample-plan/impl.md`, written BEFORE the
	 * workbench's initial commit.
	 *
	 * The ordering is the entire point. `detectPhantomWork` reads the impl at
	 * the baseline sha and returns `[]` when the file did not exist there —
	 * so a plan added after the baseline makes phantom no-op silently, and a
	 * test built that way passes without the detector ever comparing anything.
	 * Writing the impl into the initial commit puts an unchecked baseline
	 * behind it, which is what gives the detector something to detect.
	 */
	planImpl?: string;
}

const TWO_REPO_NAMES: [string, string] = ["alpha", "beta"];

/**
 * Copy THIS repo's real gate scripts into a fixture workbench.
 *
 * Real scripts, never stubs: a stub agrees with whatever the test expects,
 * which is how a suite ends up verifying its own fixture. Fails loudly if a
 * script has moved, because the alternative — a fixture that quietly installs
 * two of three — produces a `verify` run that refuses for a reason the test
 * author never sees.
 */
export function installHostGateScripts(workbenchDir: string): void {
	const hostHooks = resolve(__dirname, "../../../../..", ".claude", "hooks");
	const destHooks = join(workbenchDir, ".claude", "hooks");
	mkdirSync(destHooks, { recursive: true });

	for (const script of GATE_SCRIPTS) {
		const src = join(hostHooks, script);
		if (!existsSync(src)) {
			throw new Error(
				`fixture cannot install gate scripts: ${src} not found. The fixture copies this repo's real hooks; if they moved, update GATE_SCRIPTS rather than stubbing them.`,
			);
		}
		copyFileSync(src, join(destHooks, script));
	}

	// `_`-prefixed hook-local modules are imported by the hooks, not registered
	// as hooks — absent, the importing script dies at load.
	for (const entry of readdirSync(hostHooks)) {
		if (entry.startsWith("_") && entry.endsWith(".js")) {
			copyFileSync(join(hostHooks, entry), join(destHooks, entry));
		}
	}
}

/** Seed a bare remote with one commit, so cloning it yields real content. */
function seedBareRemote(barePath: string, repoName: string): void {
	git(resolve(barePath, ".."), ["init", "-q", "--bare", barePath]);
	const staging = `${barePath}-staging`;
	mkdirSync(staging, { recursive: true });
	git(staging, ["init", "-q", "-b", "main"]);
	writeFileSync(join(staging, "README.md"), `# ${repoName}\n`);
	writeFileSync(
		join(staging, "package.json"),
		JSON.stringify({ name: repoName, version: "0.0.0" }, null, 2),
	);
	git(staging, ["add", "-A"]);
	git(staging, ["commit", "-q", "-m", `initial ${repoName}`]);
	git(staging, ["remote", "add", "origin", barePath]);
	git(staging, ["push", "-q", "origin", "main"]);
	spawnSync("rm", ["-rf", staging]);
}

export function buildTwoRepoWorkbench(opts: TwoRepoOptions = {}): TwoRepoFixture {
	const root = mkdtempSync(join(tmpdir(), "vw-fixture-"));
	const remotesDir = join(root, "remotes");
	const workbenchDir = join(root, "workbench");
	mkdirSync(remotesDir, { recursive: true });

	const remotes = TWO_REPO_NAMES.map((name) => {
		const bare = join(remotesDir, `${name}.git`);
		seedBareRemote(bare, name);
		return bare;
	}) as [string, string];

	mkdirSync(join(workbenchDir, ".indusk", "planning", "sample-plan"), { recursive: true });
	writeFileSync(
		join(workbenchDir, ".indusk", "planning", "sample-plan", "brief.md"),
		"---\ntitle: Sample\nstatus: accepted\n---\n\n# Sample — Brief\n\nContext worth sharing.\n",
	);
	if (opts.planImpl !== undefined) {
		writeFileSync(
			join(workbenchDir, ".indusk", "planning", "sample-plan", "impl.md"),
			opts.planImpl,
		);
	}

	const declared = TWO_REPO_NAMES.map((name, i) => {
		if (opts.omitRemoteFor === name) return { name };
		if (opts.breakRemoteFor === name) {
			return { name, remote: join(remotesDir, "does-not-exist.git") };
		}
		return { name, remote: remotes[i] };
	});

	writeFileSync(
		join(workbenchDir, ".indusk", "config.json"),
		JSON.stringify(
			{
				mode: "full",
				worktree: { shape: "workbench", sibling_parent: root, repos: declared },
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(workbenchDir, "package.json"),
		JSON.stringify({ name: "two-repo-workbench", version: "0.0.0", private: true }, null, 2),
	);

	if (opts.materialize) {
		for (const [i, name] of TWO_REPO_NAMES.entries()) {
			git(root, ["clone", "-q", remotes[i], join(root, name)]);
			symlinkSync(`../${name}`, join(workbenchDir, name));
		}
	}

	if (opts.installGateScripts) {
		installHostGateScripts(workbenchDir);
	}

	let workbenchRemote: string | null = null;
	if (opts.gitInitWorkbench) {
		workbenchRemote = join(remotesDir, "workbench.git");
		git(remotesDir, ["init", "-q", "--bare", workbenchRemote]);
		git(workbenchDir, ["init", "-q", "-b", "main"]);
		git(workbenchDir, ["add", "-A"]);
		git(workbenchDir, ["commit", "-q", "-m", "workbench context"]);
		git(workbenchDir, ["remote", "add", "origin", workbenchRemote]);
		git(workbenchDir, ["push", "-q", "origin", "main"]);
	}

	return {
		root,
		workbenchDir,
		remotes,
		repoNames: TWO_REPO_NAMES,
		workbenchRemote,
		cloneWorkbenchTo(dir: string): string {
			if (!workbenchRemote) {
				throw new Error(
					"cloneWorkbenchTo requires gitInitWorkbench: true — there is no context remote to clone.",
				);
			}
			git(resolve(dir, ".."), ["clone", "-q", workbenchRemote, dir]);
			return dir;
		},
		cleanup(): void {
			if (existsSync(root)) {
				spawnSync("rm", ["-rf", root]);
			}
		},
	};
}

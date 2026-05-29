import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

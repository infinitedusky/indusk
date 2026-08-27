import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isUsableRelPath } from "../lib/path-segment.js";
import { readReposRoot, readWorkbenchRepos } from "../lib/worktree/repos.js";
import { CLI_BIN, git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * `repos_root`, and layout paths that can be more than one segment deep.
 *
 * `sibling_parent` named a relationship ("the parent of the siblings") rather
 * than the value, and the relationship stops being true the moment the repos
 * live INSIDE the workbench. It was also resolved as an absolute path against
 * the process cwd, so the only way to express nesting was to point it at the
 * workbench's own absolute path — which is machine-specific by construction
 * and therefore does not survive being cloned. Demonstrated: machine B's
 * restore fell back to the parent and produced the sibling layout instead.
 */

let root: string;
afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

describe("isUsableRelPath — layout values may be nested, never escaping", () => {
	it("accepts one segment and several", () => {
		expect(isUsableRelPath("repos")).toBe(true);
		expect(isUsableRelPath("worktrees/alpha")).toBe(true);
		expect(isUsableRelPath(".")).toBe(true); // the workbench itself
	});

	it("refuses anything that leaves the workbench", () => {
		// The guard that matters: `..` in ANY position, not just the front.
		for (const bad of ["..", "../x", "a/../..", "a/../../b", "/abs", "~/home", "a//b", ""]) {
			expect(isUsableRelPath(bad), `${bad} must be refused`).toBe(false);
		}
	});

	it("refuses machine-owned directories as the first segment", () => {
		// `.git/x` is a clean relative path and still catastrophic.
		for (const bad of [".git", ".git/x", ".indusk/planning", ".claude"]) {
			expect(isUsableRelPath(bad), `${bad} must be refused`).toBe(false);
		}
	});
});

describe("readReposRoot — the new key, the old key, and the default", () => {
	function cfg(worktree: Record<string, unknown>): string {
		root = mkdtempSync(join(tmpdir(), "repos-root-"));
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ worktree }));
		return root;
	}

	it("prefers repos_root", () => {
		expect(readReposRoot(cfg({ repos_root: "repos", sibling_parent: "/somewhere" }))).toBe("repos");
	});

	it("falls back to sibling_parent, so existing workbenches need no edit", () => {
		expect(readReposRoot(cfg({ sibling_parent: "/somewhere" }))).toBe("/somewhere");
	});

	it("is undefined when neither is declared", () => {
		expect(readReposRoot(cfg({ shape: "workbench" }))).toBeUndefined();
	});
});

describe("nested layout is declarable, and survives being cloned", () => {
	it("accepts a relative repos_root and a nested worktrees path", () => {
		const r = cfg2({ repos_root: "repos", worktrees: "worktrees/alpha" });
		const repos = readWorkbenchRepos(r);
		expect(readReposRoot(r)).toBe("repos");
		expect(repos[0]?.worktrees).toBe("worktrees/alpha");
	});

	function cfg2(opts: { repos_root: string; worktrees: string }): string {
		root = mkdtempSync(join(tmpdir(), "nested-"));
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(
			join(root, ".indusk", "config.json"),
			JSON.stringify({
				worktree: {
					shape: "workbench",
					repos_root: opts.repos_root,
					repos: [{ name: "alpha", worktrees: opts.worktrees }],
				},
			}),
		);
		return root;
	}
});

describe.skipIf(SHOULD_SKIP || !existsSync(CLI_BIN))(
	"a relative repos_root reproduces the same layout on another machine",
	() => {
		it("clones into the workbench on both, rather than falling back to the parent", {
			timeout: 60_000,
		}, () => {
			root = mkdtempSync(join(tmpdir(), "portable-"));
			const remote = join(root, "alpha.git");
			const wbRemote = join(root, "wb.git");
			git(root, ["init", "-q", "--bare", remote]);
			git(root, ["init", "-q", "--bare", wbRemote]);
			const seed = join(root, "seed");
			git(root, ["clone", "-q", remote, seed]);
			writeFileSync(join(seed, "README.md"), "# alpha\n");
			git(seed, ["add", "-A"]);
			git(seed, ["commit", "-qm", "init"]);
			git(seed, ["push", "-q", "origin", "HEAD:main"]);
			rmSync(seed, { recursive: true, force: true });

			// Machine A — the repos live INSIDE, expressed relatively.
			const a = join(root, "A", "wb");
			mkdirSync(join(a, ".indusk"), { recursive: true });
			writeFileSync(
				join(a, ".indusk", "config.json"),
				JSON.stringify({
					mode: "local",
					worktree: {
						shape: "workbench",
						repos_root: ".",
						repos: [{ name: "alpha", remote, worktrees: "alpha-worktrees" }],
					},
				}),
			);
			// Run from a SUBDIRECTORY, not the workbench root. `indusk` walks up
			// to find the project either way, but the process cwd differs — and
			// that is what makes this test discriminate. Resolving "." against the
			// cwd happens to give the right answer when cwd IS the workbench, so
			// invoking from the root passed with the fix reverted. Caught by
			// inverting the fix and watching nothing go red.
			const from = join(a, ".indusk");
			expect(runCli(from, ["workbench", "restore"]).code).toBe(0);
			expect(existsSync(join(a, "alpha", ".git")), "A should nest the clone").toBe(true);
			expect(existsSync(join(a, ".indusk", "alpha")), "must not resolve against cwd").toBe(false);

			git(a, ["remote", "add", "origin", wbRemote]);
			expect(runCli(a, ["workbench", "sync"]).code).toBe(0);
			git(a, ["push", "-q", "origin", "HEAD:main"]);

			// Machine B — a different absolute path entirely.
			const b = join(root, "B", "wb");
			mkdirSync(join(root, "B"), { recursive: true });
			git(root, ["clone", "-q", wbRemote, b]);
			expect(runCli(join(b, ".indusk"), ["workbench", "restore"]).code).toBe(0);

			// The whole point: same shape, not the sibling fallback.
			expect(existsSync(join(b, "alpha", ".git")), "B should nest the clone too").toBe(true);
			expect(existsSync(join(root, "B", "alpha")), "B must NOT clone beside the workbench").toBe(
				false,
			);
		});
	},
);

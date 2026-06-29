import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Tests for the workbench-aware path helper at apps/indusk-mcp/hooks/_hook-paths.js.
 *
 * The helper exports `resolveStateAndGitPaths(cwd)` returning `{statePath, gitPath}`:
 *   - `statePath` walks up from cwd looking for `.indusk/`. In workbench mode this
 *     lands at workbench root because that's where `.indusk/` lives. In single-repo
 *     mode it's the project root.
 *   - `gitPath` runs `git rev-parse --show-toplevel` against cwd. In workbench mode
 *     this is the wrapped repo (or a worktree). In single-repo mode it's the project
 *     root (== statePath).
 *
 * The two may differ in workbench mode. Treating them as the same was the root cause
 * of the 2-month numero_workbench dark queue — fixed in 1.31.7 by this helper.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const HELPER_PATH = resolve(__dirname, "../../hooks/_hook-paths.js");

async function loadHelper() {
	const mod = await import(HELPER_PATH);
	return mod.resolveStateAndGitPaths as (
		cwd: string,
	) => { statePath: string | null; gitPath: string | null };
}

function gitInit(dir: string): void {
	execSync("git init -q", { cwd: dir });
	execSync('git config user.email "test@example.com"', { cwd: dir });
	execSync('git config user.name "test"', { cwd: dir });
	writeFileSync(join(dir, "README.md"), "test");
	execSync("git add . && git commit -q -m 'init'", { cwd: dir });
}

describe("resolveStateAndGitPaths — workbench-aware path resolution", () => {
	let tmpRoot: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), "hook-paths-"));
	});

	afterEach(() => {
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	describe("T1: single-repo case", () => {
		it("returns statePath === gitPath when cwd is inside a git repo that also contains .indusk/", async () => {
			// Single-repo shape: project root has BOTH .git/ and .indusk/
			mkdirSync(join(tmpRoot, ".indusk"));
			writeFileSync(join(tmpRoot, ".indusk/config.json"), "{}");
			gitInit(tmpRoot);

			const subDir = join(tmpRoot, "src/foo");
			mkdirSync(subDir, { recursive: true });

			const resolveStateAndGitPaths = await loadHelper();
			const result = resolveStateAndGitPaths(subDir);

			// Both paths should point at the same place: the project root.
			// realpath because macOS tmp resolves to /private/var/...
			const repoReal = execSync("realpath .", { cwd: tmpRoot, encoding: "utf-8" }).trim();
			expect(result.statePath).toBe(repoReal);
			expect(result.gitPath).toBe(repoReal);
		});
	});

	describe("T2: workbench case — state path ≠ git path", () => {
		it("returns statePath at workbench root AND gitPath at wrapped repo when cwd is inside the wrapped repo", async () => {
			// Workbench shape:
			//   tmpRoot/                    ← workbench root (NOT a git repo)
			//     .indusk/                  ← state lives here
			//     numero/                   ← wrapped repo (git repo lives HERE)
			//       .git/
			//       (production code)
			mkdirSync(join(tmpRoot, ".indusk"));
			writeFileSync(join(tmpRoot, ".indusk/config.json"), "{}");

			const wrappedRepo = join(tmpRoot, "numero");
			mkdirSync(wrappedRepo);
			gitInit(wrappedRepo);

			const subDir = join(wrappedRepo, "src/api");
			mkdirSync(subDir, { recursive: true });

			const resolveStateAndGitPaths = await loadHelper();
			const result = resolveStateAndGitPaths(subDir);

			const workbenchReal = execSync("realpath .", { cwd: tmpRoot, encoding: "utf-8" }).trim();
			const wrappedReal = execSync("realpath .", { cwd: wrappedRepo, encoding: "utf-8" }).trim();

			// statePath at workbench root (where .indusk/ lives)
			expect(result.statePath).toBe(workbenchReal);
			// gitPath at wrapped repo (where .git/ lives, found via git rev-parse --show-toplevel)
			expect(result.gitPath).toBe(wrappedReal);
			// Critical: they MUST differ in workbench mode
			expect(result.statePath).not.toBe(result.gitPath);
		});
	});

	describe("T2b: workbench-mode gitPath fallback when cwd is the workbench root (1.31.10)", () => {
		it("resolves gitPath from config when event.cwd is the workbench root (no git repo there)", async () => {
			// Workbench shape with the wrapped repo named in config — Claude Code's
			// PostToolUse hook event.cwd is the SESSION cwd (where Claude Code was
			// launched), not the subprocess cwd that ran `git commit`. When the
			// session is launched from the workbench root, event.cwd points at a
			// directory that's NOT a git repo — `git rev-parse` fails. Pre-1.31.10
			// the hook bailed silently on every commit. The fallback reads
			// `.indusk/config.json`'s `worktree.wrapped_repo` and derives gitPath.
			mkdirSync(join(tmpRoot, ".indusk"));
			writeFileSync(
				join(tmpRoot, ".indusk/config.json"),
				JSON.stringify({ worktree: { wrapped_repo: "numero" } }),
			);

			const wrappedRepo = join(tmpRoot, "numero");
			mkdirSync(wrappedRepo);
			gitInit(wrappedRepo);

			// NB: cwd is the workbench root, NOT the wrapped repo or a worktree
			const resolveStateAndGitPaths = await loadHelper();
			const result = resolveStateAndGitPaths(tmpRoot);

			const workbenchReal = execSync("realpath .", { cwd: tmpRoot, encoding: "utf-8" }).trim();
			const wrappedReal = execSync("realpath .", { cwd: wrappedRepo, encoding: "utf-8" }).trim();

			expect(result.statePath).toBe(workbenchReal);
			// Critical: gitPath resolves from config-derived wrapped repo, NOT null
			expect(result.gitPath).toBe(wrappedReal);
		});

		it("returns gitPath=null when config has no worktree.wrapped_repo and cwd has no git repo", async () => {
			// Workbench-style .indusk/ exists but no worktree config + cwd not in
			// any git repo — fallback gracefully returns null (caller handles).
			mkdirSync(join(tmpRoot, ".indusk"));
			writeFileSync(join(tmpRoot, ".indusk/config.json"), JSON.stringify({}));

			const resolveStateAndGitPaths = await loadHelper();
			const result = resolveStateAndGitPaths(tmpRoot);

			expect(result.statePath).not.toBeNull();
			expect(result.gitPath).toBeNull();
		});

		it("prefers cwd's git repo over the config fallback when both available", async () => {
			// Edge: cwd IS inside a git repo (the wrapped one) AND config has
			// wrapped_repo set. Existing behavior wins — `git rev-parse` against
			// cwd returns the actual repo, fallback never fires.
			mkdirSync(join(tmpRoot, ".indusk"));
			writeFileSync(
				join(tmpRoot, ".indusk/config.json"),
				JSON.stringify({ worktree: { wrapped_repo: "numero" } }),
			);

			const wrappedRepo = join(tmpRoot, "numero");
			mkdirSync(wrappedRepo);
			gitInit(wrappedRepo);

			const resolveStateAndGitPaths = await loadHelper();
			// cwd is INSIDE the wrapped repo
			const result = resolveStateAndGitPaths(join(wrappedRepo, "src"));
			mkdirSync(join(wrappedRepo, "src"), { recursive: true });

			const wrappedReal = execSync("realpath .", { cwd: wrappedRepo, encoding: "utf-8" }).trim();
			// gitPath comes from `git rev-parse` (same answer as fallback in this case,
			// but proves the path was used)
			expect(result.gitPath).toBe(wrappedReal);
		});

		it("returns null when config names a wrapped_repo that doesn't exist on disk", async () => {
			mkdirSync(join(tmpRoot, ".indusk"));
			writeFileSync(
				join(tmpRoot, ".indusk/config.json"),
				JSON.stringify({ worktree: { wrapped_repo: "nonexistent" } }),
			);

			const resolveStateAndGitPaths = await loadHelper();
			const result = resolveStateAndGitPaths(tmpRoot);

			expect(result.gitPath).toBeNull();
		});
	});

	describe("T3: worktree case", () => {
		it("returns statePath at workbench root AND gitPath at the worktree's own git path", async () => {
			// Workbench + worktree shape:
			//   tmpRoot/                    ← workbench root
			//     .indusk/                  ← state at workbench root
			//     numero/                   ← wrapped repo (canonical clone)
			//       .git/
			//     feat-new/                 ← worktree sibling
			//       .git (gitfile pointer to numero/.git/worktrees/feat-new)
			mkdirSync(join(tmpRoot, ".indusk"));
			writeFileSync(join(tmpRoot, ".indusk/config.json"), "{}");

			const canonicalRepo = join(tmpRoot, "numero");
			mkdirSync(canonicalRepo);
			gitInit(canonicalRepo);

			// Create a sibling worktree
			const worktreePath = join(tmpRoot, "feat-new");
			execSync(`git worktree add -q ${worktreePath} -b feat-new`, { cwd: canonicalRepo });

			const subDir = join(worktreePath, "src");
			mkdirSync(subDir, { recursive: true });

			const resolveStateAndGitPaths = await loadHelper();
			const result = resolveStateAndGitPaths(subDir);

			const workbenchReal = execSync("realpath .", { cwd: tmpRoot, encoding: "utf-8" }).trim();
			const worktreeReal = execSync("realpath .", { cwd: worktreePath, encoding: "utf-8" }).trim();

			// statePath at workbench root (walked up past the worktree, past numero/, found .indusk/)
			expect(result.statePath).toBe(workbenchReal);
			// gitPath at the worktree's own path (git rev-parse --show-toplevel inside a worktree returns the worktree path)
			expect(result.gitPath).toBe(worktreeReal);
			expect(result.statePath).not.toBe(result.gitPath);
		});
	});
});

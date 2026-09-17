import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import { git, initRepoWithCommit } from "./helpers/test-git.js";
import { LAYOUTS } from "./helpers/versioned-workbench.js";

/**
 * trunk-guard — A1, A2, A3, A4, A6.
 *
 * No code is edited or committed on `main` by an agent. The hook is run the
 * way Claude Code runs it: a node subprocess fed the PreToolUse event on
 * stdin, against a real git repository on a real branch. Before the hook
 * exists, node exits non-zero on the missing script — a boundary red, not a
 * load error inside this file.
 */

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A normal-mode project: a git repo on `main` with one source file and a planning folder. */
function project(config: object = { mode: "local", verify: {} }): string {
	const root = mkdtempSync(join(tmpdir(), "trunk-guard-"));
	roots.push(root);
	initRepoWithCommit(root);
	mkdirSync(join(root, ".indusk", "planning", "p"), { recursive: true });
	mkdirSync(join(root, ".claude", "lessons"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify(config));
	writeFileSync(join(root, ".indusk", "planning", "p", "brief.md"), "# p\n");
	writeFileSync(join(root, ".indusk", "current.md"), "# Operational State\n");
	writeFileSync(join(root, ".claude", "lessons", "l.md"), "# l\n");
	writeFileSync(join(root, ".claude", "settings.json"), "{}\n");
	writeFileSync(join(root, "CLAUDE.md"), "# c\n");
	writeFileSync(join(root, "AGENTS.md"), "# a\n");
	writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "seed"]);
	return root;
}

const edit = (root: string, rel: string) => ({
	tool_name: "Edit",
	tool_input: { file_path: join(root, rel), old_string: "a", new_string: "b" },
	cwd: root,
});
const bash = (root: string, command: string) => ({
	tool_name: "Bash",
	tool_input: { command },
	cwd: root,
});

describe("A1 — code on main is refused; the same edit on a plan branch is not", () => {
	it("refuses an Edit to a source file on main, naming the way through and the branch", async () => {
		const root = project();
		const r = await runHook("trunk-guard.js", edit(root, "src/a.ts"));
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/indusk worktree create/);
		expect(r.stderr).toMatch(/\bmain\b/);
		expect(r.stderr).toMatch(/src\/a\.ts/);
	});

	it("refuses a Write the same way", async () => {
		const root = project();
		const r = await runHook("trunk-guard.js", {
			tool_name: "Write",
			tool_input: { file_path: join(root, "src/new.ts"), content: "x" },
			cwd: root,
		});
		expect(r.exitCode).toBe(2);
	});

	it("allows the identical Edit on plan/x, silently", async () => {
		const root = project();
		git(root, ["checkout", "-q", "-b", "plan/x"]);
		const r = await runHook("trunk-guard.js", edit(root, "src/a.ts"));
		expect(r.exitCode).toBe(0);
		expect(r.stderr).toBe("");
	});
});

describe("A2 — the writes a plan makes before and after its branch are allowed on main", () => {
	for (const rel of [
		".indusk/planning/p/brief.md",
		".indusk/current.md",
		".indusk/config.json",
		".claude/lessons/l.md",
		".claude/settings.json",
		"CLAUDE.md",
		"AGENTS.md",
	]) {
		it(`allows ${rel}`, async () => {
			const root = project();
			const r = await runHook("trunk-guard.js", edit(root, rel));
			expect(r.exitCode, r.stderr).toBe(0);
		});
	}
});

describe("A3 — git commit on main is judged by what is staged", () => {
	it("refuses a commit with a staged source file, naming it", async () => {
		const root = project();
		writeFileSync(join(root, "src", "a.ts"), "export const a = 2;\n");
		git(root, ["add", "src/a.ts"]);
		const r = await runHook("trunk-guard.js", bash(root, 'git commit -m "change a"'));
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/src\/a\.ts/);
	});

	it("allows a commit whose staged paths are all allow-listed", async () => {
		const root = project();
		writeFileSync(join(root, ".indusk", "planning", "p", "brief.md"), "# p2\n");
		git(root, ["add", ".indusk/planning/p/brief.md"]);
		const r = await runHook("trunk-guard.js", bash(root, 'git commit -m "plan: brief"'));
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("allows a chore(release) commit with packaged files staged — the one packaged edit that belongs on trunk", async () => {
		const root = project();
		writeFileSync(join(root, "src", "a.ts"), "export const a = 3;\n");
		git(root, ["add", "src/a.ts"]);
		const r = await runHook(
			"trunk-guard.js",
			bash(root, 'git commit -q -m "chore(release): 1.51.0 — the trunk guard"'),
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("ignores Bash commands that are not a git commit", async () => {
		const root = project();
		writeFileSync(join(root, "src", "a.ts"), "export const a = 4;\n");
		git(root, ["add", "src/a.ts"]);
		for (const cmd of ["echo git commit", "git commitment", "git status", "ls"]) {
			const r = await runHook("trunk-guard.js", bash(root, cmd));
			expect(r.exitCode, `${cmd}: ${r.stderr}`).toBe(0);
		}
	});
});

describe.each(LAYOUTS)("A4 — versioned workbench, %s", (_label, build) => {
	it("refuses an edit in the code repo on its main and allows the workbench's planning documents", async () => {
		const wb = build();
		try {
			const code = wb.repos[0].dir;
			mkdirSync(join(code, "src"), { recursive: true });
			writeFileSync(join(code, "src", "x.ts"), "export const x = 1;\n");
			git(code, ["add", "-A"]);
			git(code, ["commit", "-q", "-m", "seed"]);
			const refused = await runHook("trunk-guard.js", {
				tool_name: "Edit",
				tool_input: { file_path: join(code, "src", "x.ts"), old_string: "1", new_string: "2" },
				cwd: wb.root,
			});
			expect(refused.exitCode).toBe(2);
			const allowed = await runHook("trunk-guard.js", {
				tool_name: "Edit",
				tool_input: {
					file_path: join(wb.root, ".indusk", "planning", "p", "impl.md"),
					old_string: "a",
					new_string: "b",
				},
				cwd: wb.root,
			});
			expect(allowed.exitCode, allowed.stderr).toBe(0);
		} finally {
			wb.cleanup();
		}
	});
});

describe("A6 — the two off switches allow the edit and say nothing", () => {
	it("worktree.trunk_guard.enabled: false in the project's config", async () => {
		const root = project({
			mode: "local",
			verify: {},
			worktree: { trunk_guard: { enabled: false } },
		});
		const r = await runHook("trunk-guard.js", edit(root, "src/a.ts"));
		expect(r.exitCode).toBe(0);
		expect(r.stderr).toBe("");
	});

	it("INDUSK_TRUNK_GUARD=off in the environment", async () => {
		const root = project();
		const r = await runHook("trunk-guard.js", edit(root, "src/a.ts"), {
			env: { INDUSK_TRUNK_GUARD: "off" },
		});
		expect(r.exitCode).toBe(0);
		expect(r.stderr).toBe("");
	});
});

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import { git, LAYOUTS } from "./helpers/versioned-workbench.js";

/**
 * context-tiers — A16, A14: the budget hook judges growth, not size, and each
 * context file is held by the budget that fits it.
 *
 * Found by the numero promise smoke (2026-10-02): a root `CLAUDE.md` already
 * over budget could not be made smaller through Edit, because the hook judged
 * the post-edit size alone. A plan whose work is mostly shrinking that file
 * cannot run under that rule. The hook is driven as Claude Code drives it — a
 * subprocess fed the PreToolUse envelope — so nothing here imports the hook.
 */

const budget = (event: object, cwd: string) => runHook("claude-md-budget.js", event, { cwd });

const roots: string[] = [];
const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
	for (const c of cleanups.splice(0)) c();
});

/** A normal-mode project whose only config is the `context` block under test. */
function project(context: Record<string, number>): string {
	const root = mkdtempSync(join(tmpdir(), "context-tiers-budget-"));
	roots.push(root);
	mkdirSync(join(root, ".indusk"), { recursive: true });
	writeFileSync(join(root, ".indusk/config.json"), JSON.stringify({ mode: "local", context }));
	return root;
}

describe("A16 — an over-budget context file may always shrink", () => {
	it("allows an Edit that makes an over-budget root smaller, though it stays over budget", async () => {
		const root = project({ claude_md_budget_bytes: 1000 });
		const file = join(root, "CLAUDE.md");
		writeFileSync(file, `# Project\n\n${"x".repeat(1500)}\n`);
		const r = await budget(
			{
				tool_name: "Edit",
				tool_input: { file_path: file, old_string: "x".repeat(200), new_string: "" },
				cwd: root,
			},
			root,
		);
		expect(r.exitCode, `a shrinking edit is allowed at any size — ${r.stderr}`).toBe(0);
	});

	it("still refuses an Edit that grows an over-budget root", async () => {
		const root = project({ claude_md_budget_bytes: 1000 });
		const file = join(root, "CLAUDE.md");
		writeFileSync(file, `# Project\n\n${"x".repeat(1500)}\n`);
		const r = await budget(
			{
				tool_name: "Edit",
				tool_input: { file_path: file, old_string: "# Project", new_string: "# Project grown" },
				cwd: root,
			},
			root,
		);
		expect(r.exitCode, "growth past the budget is what the hook exists to refuse").toBe(2);
	});
});

describe("A14 — the budget that governs a context file", () => {
	it("refuses a Write past the root budget", async () => {
		const root = project({ claude_md_budget_bytes: 1000 });
		const file = join(root, "CLAUDE.md");
		writeFileSync(file, "# Project\n");
		const r = await budget(
			{ tool_name: "Write", tool_input: { file_path: file, content: "x".repeat(2000) }, cwd: root },
			root,
		);
		expect(r.exitCode).toBe(2);
	});

	it("refuses a Write past a nested file's own budget, which is smaller than the root's", async () => {
		const root = project({ claude_md_budget_bytes: 1000, nested_claude_md_budget_bytes: 300 });
		mkdirSync(join(root, "apps/thing"), { recursive: true });
		const file = join(root, "apps/thing/CLAUDE.md");
		writeFileSync(file, "# thing\n");
		const r = await budget(
			{ tool_name: "Write", tool_input: { file_path: file, content: "n".repeat(500) }, cwd: root },
			root,
		);
		expect(r.exitCode, "500 bytes is under the root budget and over the nested one").toBe(2);
		expect(r.stderr, "the refusal names the budget that applied").toMatch(
			/nested_claude_md_budget_bytes/,
		);
	});

	describe.each(LAYOUTS)("in a %s workbench", (_label, build) => {
		it("judges a declared repo's own root CLAUDE.md by the root budget, never as nested", async () => {
			const wb = build();
			cleanups.push(() => wb.cleanup());
			const configPath = join(wb.root, ".indusk/config.json");
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			config.context = { claude_md_budget_bytes: 1000, nested_claude_md_budget_bytes: 300 };
			writeFileSync(configPath, JSON.stringify(config));
			const repo = wb.repos[0];
			const file = join(repo.dir, "CLAUDE.md");
			writeFileSync(file, "# repo\n");
			const r = await budget(
				{
					tool_name: "Write",
					tool_input: { file_path: file, content: "r".repeat(500) },
					cwd: wb.root,
				},
				wb.root,
			);
			expect(
				r.exitCode,
				`${repo.rel}/CLAUDE.md is a repo root, judged by the root budget — ${r.stderr}`,
			).toBe(0);
		});
	});
});

describe.each(LAYOUTS)("A20 — in a %s workbench, a plan worktree's root file", (_label, build) => {
	it("is judged by the root budget, though no declaration names the worktree", async () => {
		const wb = build();
		cleanups.push(() => wb.cleanup());
		const configPath = join(wb.root, ".indusk/config.json");
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		config.context = { claude_md_budget_bytes: 1000, nested_claude_md_budget_bytes: 300 };
		writeFileSync(configPath, JSON.stringify(config));
		const repo = wb.repos[0];
		const worktree = join(wb.root, "worktrees", "feat");
		git(repo.dir, ["worktree", "add", "-q", worktree, "-b", "plan/feat"]);
		const file = join(worktree, "CLAUDE.md");
		writeFileSync(file, "# repo\n");
		const r = await budget(
			{
				tool_name: "Write",
				tool_input: { file_path: file, content: "r".repeat(500) },
				cwd: worktree,
			},
			worktree,
		);
		expect(
			r.exitCode,
			`the worktree's CLAUDE.md is the repo's root file in a plan checkout — ${r.stderr}`,
		).toBe(0);
	});
});

describe("A14 — a workbench that declares no repos_root", () => {
	it("finds the repo where resolveReposRoot does — the workbench's parent — and judges it a root", async () => {
		const parent = mkdtempSync(join(tmpdir(), "context-tiers-noroot-"));
		roots.push(parent);
		const wb = join(parent, "workbench");
		mkdirSync(join(wb, ".indusk"), { recursive: true });
		writeFileSync(
			join(wb, ".indusk/config.json"),
			JSON.stringify({
				worktree: { shape: "workbench", repos: [{ name: "alpha" }] },
				context: { claude_md_budget_bytes: 1000, nested_claude_md_budget_bytes: 300 },
			}),
		);
		// A sibling of the workbench, as `resolveReposRoot` reads an absent
		// `repos_root`; no `.git`, so only the declaration can make it a root.
		mkdirSync(join(parent, "alpha"), { recursive: true });
		const file = join(parent, "alpha", "CLAUDE.md");
		writeFileSync(file, "# repo\n");
		const r = await budget(
			{ tool_name: "Write", tool_input: { file_path: file, content: "r".repeat(500) }, cwd: wb },
			wb,
		);
		expect(r.exitCode, `alpha/CLAUDE.md is the declared repo's root file — ${r.stderr}`).toBe(0);
	});
});

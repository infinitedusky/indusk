import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * indusk-makeover trajectory row A2: editing CLAUDE.md past the budget
 * produces a visible warn/block at write time.
 *
 * Exercises the real hook end-to-end via node subprocess + stdin event JSON
 * (the convention for JS hook ports — they can't import the TS lib).
 */

const HOOK_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../hooks/claude-md-budget.js");

interface HookRun {
	exitCode: number;
	stderr: string;
}

function runHook(event: object): HookRun {
	const res = spawnSync("node", [HOOK_PATH], {
		input: JSON.stringify(event),
		encoding: "utf-8",
	});
	return { exitCode: res.status ?? -1, stderr: res.stderr ?? "" };
}

describe("claude-md-budget hook (A2)", () => {
	let projectRoot: string;
	let claudeMdPath: string;

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "indusk-budget-hook-"));
		mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
		writeFileSync(
			join(projectRoot, ".indusk/config.json"),
			JSON.stringify({ mode: "full", context: { claude_md_budget_bytes: 1000 } }),
		);
		claudeMdPath = join(projectRoot, "CLAUDE.md");
		writeFileSync(claudeMdPath, "# Project\n\nsmall file\n");
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	it("A2: blocks a Write that exceeds the budget, naming the compaction ritual", () => {
		const result = runHook({
			tool_name: "Write",
			tool_input: { file_path: claudeMdPath, content: "x".repeat(2000) },
			cwd: projectRoot,
		});
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toMatch(/budget exceeded/i);
		expect(result.stderr).toMatch(/compaction ritual/i);
		expect(result.stderr).toMatch(/claude_md_budget_bytes/);
	});

	it("A2: blocks an Edit whose replacement pushes the file over budget", () => {
		const result = runHook({
			tool_name: "Edit",
			tool_input: {
				file_path: claudeMdPath,
				old_string: "small file",
				new_string: "y".repeat(2000),
			},
			cwd: projectRoot,
		});
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toMatch(/budget exceeded/i);
	});

	it("A2: warns (but allows) in the 90% band", () => {
		const result = runHook({
			tool_name: "Write",
			tool_input: { file_path: claudeMdPath, content: "z".repeat(950) },
			cwd: projectRoot,
		});
		expect(result.exitCode).toBe(0);
		expect(result.stderr).toMatch(/budget warning/i);
	});

	it("allows an under-budget edit silently", () => {
		const result = runHook({
			tool_name: "Write",
			tool_input: { file_path: claudeMdPath, content: "# tiny\n" },
			cwd: projectRoot,
		});
		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
	});

	it("ignores files not named CLAUDE.md", () => {
		const other = join(projectRoot, "README.md");
		const result = runHook({
			tool_name: "Write",
			tool_input: { file_path: other, content: "x".repeat(5000) },
			cwd: projectRoot,
		});
		expect(result.exitCode).toBe(0);
	});

	it("defaults to 60 KB when the config key is absent", () => {
		writeFileSync(join(projectRoot, ".indusk/config.json"), JSON.stringify({ mode: "full" }));
		const under = runHook({
			tool_name: "Write",
			tool_input: { file_path: claudeMdPath, content: "x".repeat(2000) },
			cwd: projectRoot,
		});
		expect(under.exitCode).toBe(0);
		const over = runHook({
			tool_name: "Write",
			tool_input: { file_path: claudeMdPath, content: "x".repeat(70_000) },
			cwd: projectRoot,
		});
		expect(over.exitCode).toBe(2);
	});

	it("replace_all Edits are measured across every occurrence", () => {
		writeFileSync(claudeMdPath, "marker one\nmarker two\nmarker three\n");
		const result = runHook({
			tool_name: "Edit",
			tool_input: {
				file_path: claudeMdPath,
				old_string: "marker",
				new_string: "m".repeat(500),
				replace_all: true,
			},
			cwd: projectRoot,
		});
		expect(result.exitCode).toBe(2);
	});

	it("never blocks on a malformed event or unpredictable edit", () => {
		const malformed = runHook({ tool_name: "Edit", tool_input: { file_path: claudeMdPath } });
		expect(malformed.exitCode).toBe(0);
		const missingOld = runHook({
			tool_name: "Edit",
			tool_input: { file_path: claudeMdPath, old_string: "not present", new_string: "x" },
			cwd: projectRoot,
		});
		expect(missingOld.exitCode).toBe(0);
	});

	// A16 (indusk-makeover Phase 7 falsification): the prediction must be
	// byte-identical to the Edit tool's LITERAL replacement — String.replace's
	// $-substitution semantics must never leak in.
	it("A16: `$`` in new_string does not inflate the prediction (no spurious block)", () => {
		// literal result ≈ 903 B (under the 1000 B budget); a $`-expanding
		// prediction balloons to ~1800 B and wrongly blocks.
		writeFileSync(claudeMdPath, `${"x".repeat(900)}MARKER`);
		const result = runHook({
			tool_name: "Edit",
			tool_input: { file_path: claudeMdPath, old_string: "MARKER", new_string: "$` y" },
			cwd: projectRoot,
		});
		expect(result.exitCode).toBe(0);
	});

	it("A16: `$$` in new_string does not deflate the prediction (no wrongful allow)", () => {
		// literal result ≈ 1100 B (over budget); a $$-collapsing prediction
		// shrinks to ~800 B and wrongly allows.
		writeFileSync(claudeMdPath, `${"x".repeat(500)}MARKER`);
		const result = runHook({
			tool_name: "Edit",
			tool_input: { file_path: claudeMdPath, old_string: "MARKER", new_string: "$$".repeat(300) },
			cwd: projectRoot,
		});
		expect(result.exitCode).toBe(2);
	});

	it("A16: empty old_string exits 0 (the Edit tool rejects it; never predict against it)", () => {
		const result = runHook({
			tool_name: "Edit",
			tool_input: { file_path: claudeMdPath, old_string: "", new_string: "y", replace_all: true },
			cwd: projectRoot,
		});
		expect(result.exitCode).toBe(0);
	});
});

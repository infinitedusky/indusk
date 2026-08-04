import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGatedWorktreeTools } from "./gate.js";
import {
	execOptions,
	executeOf,
	makeGatedWorktree,
	type TempWorktree,
} from "./harness.test-support.js";

/**
 * A1 (dawn-hook-parity) — budget-hook parity in the thin lane.
 *
 * A thin-lane run that pushes CLAUDE.md past its byte budget must have the
 * write refused, with the SHARED script's own block message ("CLAUDE.md
 * budget exceeded" from hooks/claude-md-budget.js) — not a thin-lane
 * re-implementation of the rule.
 *
 * Deliberately uses the PRODUCTION script resolution (no injected scripts):
 * the temp worktree carries the real .claude/hooks, and the assertion is that
 * the resolved chain includes the budget script. Red at authoring:
 * GATE_SCRIPT_NAMES lists only validate-impl-structure + check-gates, so the
 * over-budget write sails through.
 */

const DEFAULT_BUDGET_BYTES = 61440;

describe("A1 — CLAUDE.md budget enforced identically in the thin lane", () => {
	let tree: TempWorktree;

	beforeEach(async () => {
		tree = await makeGatedWorktree("dawn-parity-a1");
	});

	afterEach(async () => {
		await tree.cleanup();
	});

	it("refuses an over-budget CLAUDE.md write with the shared script's message", async () => {
		const claudeMd = join(tree.root, "CLAUDE.md");
		await writeFile(claudeMd, "# Project\n", "utf8");

		// Resolution is production-path: no scripts injected.
		const tools = createGatedWorktreeTools(tree.root);
		const write = executeOf(tools, "writeFile");

		const oversized = `# Project\n${"x".repeat(DEFAULT_BUDGET_BYTES + 1024)}\n`;
		const result = await write({ path: "CLAUDE.md", content: oversized }, execOptions);

		// The block message IS the shared script's stderr, passed through.
		expect(String(result)).toContain("CLAUDE.md budget exceeded");

		// The write was never applied — the file keeps its original content.
		const after = await readFile(claudeMd, "utf8");
		expect(after).toBe("# Project\n");
	});

	it("still allows an under-budget CLAUDE.md write (the hook self-filters, no over-blocking)", async () => {
		const claudeMd = join(tree.root, "CLAUDE.md");
		await writeFile(claudeMd, "# Project\n", "utf8");

		const tools = createGatedWorktreeTools(tree.root);
		const write = executeOf(tools, "writeFile");

		await write({ path: "CLAUDE.md", content: "# Project\n\nSmall addition.\n" }, execOptions);

		const after = await readFile(claudeMd, "utf8");
		expect(after).toContain("Small addition.");
	});
});

// clause: a-plan-is-found-in-the-archive/one-lookup
// promise: a-plan-is-found-in-the-archive
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * T9 — archived-plans-are-found, Build Phase 2. The cold audit found two
 * modules answering "where is this plan's folder": the original under
 * `lib/promises/` (which refuses the archive folder, files and unusable
 * segments) and a second, laxer one Build Phase 1 added. No behavioural test
 * sees a divergence that has not happened yet, so this pin counts the modules
 * and checks that the callers ask the one.
 */

const SRC = join(REPO_ROOT, "apps/indusk-mcp/src");
const ONE = "lib/promises/plan-folder.ts";

const ASKS = [
	"lib/impl-parser.ts",
	"lib/worktree/plan-worktrees.ts",
	"lib/plans/workbench-plan.ts",
	"lib/worktree/roots.ts",
];

describe("T9 one module says where a plan's folder is", () => {
	it("there is exactly one plan-folder module", () => {
		const found = globSync("**/plan-folder.ts", { cwd: SRC }).sort();
		expect(
			found,
			`lesson: structural-single-definition-test-for-must-agree-invariants — one plan-folder lookup, ${ONE}; found:\n${found.join("\n")}`,
		).toEqual([ONE]);
	});

	it.each(ASKS)("%s asks it", (rel) => {
		expect(readFileSync(join(SRC, rel), "utf-8"), rel).toMatch(
			/from "[./]+\/promises\/plan-folder\.js"/,
		);
	});
});

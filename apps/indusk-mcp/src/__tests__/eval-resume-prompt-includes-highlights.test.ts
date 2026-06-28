import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T3 — eval-agent-mcp-access Phase 4 regression test.
 *
 * The eval agent's persistent session ran 197 evals across 2+ months without
 * draining the highlights queue. Diagnosis: the resume path in
 * `persistent-evaluator.ts`'s `buildArgsAndPrompt()` constructed a minimal
 * "Evaluate a new commit ... output the JSON scorecard" prompt and silently
 * omitted Step 4 (process highlights) — only the fresh-spawn path through
 * `buildEvaluatorPrompt` included it. Three highlights processed in April
 * (that fresh spawn); zero processed since.
 *
 * Fix: extract Step 4 into a `buildHighlightsInstructions` helper in
 * `prompt-builder.ts` and have the resume prompt prepend it. This source-
 * level test pins both halves so a future "let me shrink the resume prompt"
 * edit catches itself before shipping.
 *
 * Source-level grep is the right discipline here — same pattern as the other
 * eval-trigger / scm tests. End-to-end spawning of `claude --print` is
 * impractical in CI; T4 is the manual smoke that covers the runtime path.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const PERSISTENT_EVALUATOR = resolve(
	REPO_ROOT,
	"apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts",
);
const PROMPT_BUILDER = resolve(REPO_ROOT, "apps/indusk-mcp/src/lib/eval/prompt-builder.ts");

describe("T3: resume prompt reaches the Step 4 highlights instructions", () => {
	const persistentSource = readFileSync(PERSISTENT_EVALUATOR, "utf-8");
	const promptBuilderSource = readFileSync(PROMPT_BUILDER, "utf-8");

	it("prompt-builder.ts exports `buildHighlightsInstructions` (shared helper)", () => {
		expect(promptBuilderSource).toMatch(/export function buildHighlightsInstructions\b/);
	});

	it("the shared helper produces the load-bearing MCP tool calls (highlights_unprocessed → graph_capture → mark_processed)", () => {
		expect(promptBuilderSource).toMatch(/mcp__indusk__highlights_unprocessed/);
		expect(promptBuilderSource).toMatch(/mcp__indusk__graph_capture/);
		expect(promptBuilderSource).toMatch(/mcp__indusk__highlight_mark_processed/);
	});

	it("persistent-evaluator.ts imports `buildHighlightsInstructions`", () => {
		expect(persistentSource).toMatch(
			/import\s*\{[^}]*\bbuildHighlightsInstructions\b[^}]*\}\s*from\s*['"]\.\/prompt-builder/,
		);
	});

	it("persistent-evaluator.ts's resume-prompt construction calls `buildHighlightsInstructions`", () => {
		// The fix prepends a highlightsBlock to the resumePrompt template literal.
		// We don't pin the exact variable name; we require the call site exists.
		expect(persistentSource).toMatch(/buildHighlightsInstructions\(\s*\{/);
	});

	it("the resume-prompt construction is NOT the pre-fix minimal shape", () => {
		// Pre-Phase-4 the resume prompt began with the commit-evaluation line as
		// its very first content. The fix prepends the highlights block above it.
		// Assert that `buildHighlightsInstructions` is called BEFORE the commit-
		// evaluation literal in the resume branch.
		const resumeBranchMatch = persistentSource.match(
			/if\s*\(session\)\s*\{[\s\S]{0,3000}?return\s*\{[\s\S]{0,1500}?prompt:\s*\w+,\s*\}/,
		);
		expect(resumeBranchMatch, "could not locate the resume branch in buildArgsAndPrompt").not.toBeNull();
		const resumeBranch = resumeBranchMatch?.[0] ?? "";
		const highlightsCallIdx = resumeBranch.indexOf("buildHighlightsInstructions");
		// Look for the commit-evaluation literal in either case (the fix lowercases the 'e')
		const evaluateLiteralIdx = resumeBranch.search(/[Ee]valuate a new commit/);
		expect(highlightsCallIdx, "buildHighlightsInstructions call missing from resume branch").toBeGreaterThan(-1);
		expect(evaluateLiteralIdx, "commit-evaluation literal missing from resume branch").toBeGreaterThan(-1);
		expect(highlightsCallIdx, "highlights call must appear BEFORE the evaluate literal").toBeLessThan(
			evaluateLiteralIdx,
		);
	});
});

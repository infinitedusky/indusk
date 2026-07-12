import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the eval→Graphiti rail outage (silent 1.31.7–1.31.11).
 *
 * Root cause: the 1.31.7 workbench-aware rewrite of `eval-trigger.js` changed
 * the inline spawn script to pass the state root to the evaluator under the key
 * `statePath`, but both evaluator entry points (`runPersistentEval`,
 * `runEvaluatorSync`) still destructure `opts.projectRoot`. So `projectRoot`
 * arrived `undefined`, and the evaluator's first statement —
 * `initEvalOtel(opts.projectRoot)` → `isEvalOtelEnabled` → `join(undefined,…)` —
 * threw `ERR_INVALID_ARG_TYPE` before any work. With `stdio: "ignore"` + the
 * inline `.catch`, the crash logged to results.log but never surfaced; no
 * scorecard and no highlight ever reached Graphiti for weeks.
 *
 * These are source-level tests (same approach as
 * `eval-trigger-filter-falsepositives.test.ts`): they pin the *contract* that
 * the two sides — the JS hook port and the TS evaluator — must agree on, so a
 * future rename on either side fails CI instead of silently killing the rail.
 */

const HOOK_PATH = resolve(__dirname, "../../hooks/eval-trigger.js");
const RUNNER_PATH = resolve(__dirname, "../lib/eval/evaluator-runner.ts");
const PERSISTENT_PATH = resolve(__dirname, "../lib/eval/persistent-evaluator.ts");

/** The full set of option keys the evaluator entry points accept. */
const EVALUATOR_CONTRACT_KEYS = new Set([
	"projectRoot",
	"gitRoot",
	"changeId",
	"transcriptPath",
	"mode",
	"evalEndpoint",
]);

/**
 * Extract the keys of the object literal the hook's inline script passes to
 * `m.${useFunction}({ ... })`. Operates on the raw source so it exercises the
 * actual arguments the hook will emit, not a re-typed copy.
 */
function extractHookArgKeys(source: string): string[] {
	const m = source.match(/m\.\$\{useFunction\}\(\{([\s\S]*?)\}\);/);
	if (!m) throw new Error("could not find the evaluator-call object literal in eval-trigger.js");
	const body = m[1];
	const keys: string[] = [];
	for (const line of body.split("\n")) {
		const km = line.match(/^\s*([a-zA-Z_]\w*):/);
		if (km) keys.push(km[1]);
	}
	return keys;
}

describe("eval-trigger.js ↔ evaluator argument contract", () => {
	const hookSource = readFileSync(HOOK_PATH, "utf-8");

	it("passes the state root as `projectRoot` (NOT `statePath` — the bug that broke the rail)", () => {
		const keys = extractHookArgKeys(hookSource);
		expect(keys).toContain("projectRoot");
		// The load-bearing assertion: `statePath` as an evaluator arg key is the
		// exact 1.31.7 regression. The evaluator never reads it.
		expect(keys).not.toContain("statePath");
	});

	it("passes `gitRoot` so the inner claude's `git show` resolves in workbench mode", () => {
		const keys = extractHookArgKeys(hookSource);
		expect(keys).toContain("gitRoot");
	});

	it("passes only keys the evaluator actually accepts (no silently-dropped args)", () => {
		const keys = extractHookArgKeys(hookSource);
		for (const key of keys) {
			expect(EVALUATOR_CONTRACT_KEYS.has(key), `hook passes unknown evaluator key "${key}"`).toBe(
				true,
			);
		}
	});
});

describe("evaluator entry points declare the contract the hook relies on", () => {
	const runnerSource = readFileSync(RUNNER_PATH, "utf-8");
	const persistentSource = readFileSync(PERSISTENT_PATH, "utf-8");

	it("EvaluatorRunOptions declares both `projectRoot` and `gitRoot`", () => {
		expect(runnerSource).toMatch(/projectRoot:\s*string/);
		expect(runnerSource).toMatch(/gitRoot\?:\s*string/);
	});

	it("runPersistentEval's opts declares both `projectRoot` and `gitRoot`", () => {
		expect(persistentSource).toMatch(/projectRoot:\s*string/);
		expect(persistentSource).toMatch(/gitRoot\?:\s*string/);
	});

	it("both entry points use `gitRoot ?? projectRoot` for the claude spawn cwd", () => {
		// The git-cwd fallback is what makes single-repo callers (and the
		// baseline CLI, which omits gitRoot) keep working while workbench mode
		// gets the real git repo. If a refactor drops the fallback, true
		// workbenches silently run `git show` in the non-git state root.
		expect(runnerSource).toMatch(/cwd:\s*opts\.gitRoot\s*\?\?\s*opts\.projectRoot/);
		expect(persistentSource).toMatch(/opts\.gitRoot\s*\?\?\s*opts\.projectRoot/);
	});
});

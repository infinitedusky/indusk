import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression for the 1.30.1 → 1.30.2 bug surfaced on dusk: pnpm-global
 * installs of `@infinitedusky/indusk-mcp` don't live under
 * `<indusk-bin>/../lib/node_modules/...`, so the eval-trigger hook's
 * existing candidate paths all miss and every commit logs
 * "Could not find @infinitedusky/indusk-mcp package".
 *
 * 44 highlights backed up over a 22-hour session before this was noticed.
 *
 * The fix extends the candidates list with `pnpm root -g` and `npm root -g`
 * lookups. Source-level grep tests are sufficient — same pattern as the
 * other eval-trigger hook tests; spinning a real subprocess matrix across
 * package managers is overkill for a 10-line candidate-array fix.
 */

const HOOK_PATH = resolve(__dirname, "../../hooks/eval-trigger.js");

describe("eval-trigger.js — pnpm/npm-global candidate lookup", () => {
	const source = readFileSync(HOOK_PATH, "utf-8");

	it("queries `pnpm root -g` as a candidate path source", () => {
		expect(source).toMatch(/pnpm root -g/);
	});

	it("queries `npm root -g` as a candidate path source", () => {
		expect(source).toMatch(/npm root -g/);
	});

	it("constructs the evaluator-runner path under the resolved root", () => {
		// After `pnpm root -g` returns `<root>`, the candidate must be
		// `<root>/@infinitedusky/indusk-mcp/dist/lib/eval/evaluator-runner.js`.
		// Same for npm root.
		expect(source).toMatch(/@infinitedusky\/indusk-mcp\/dist\/lib\/eval\/evaluator-runner\.js/);
		// The candidate-building IIFE must reference pnpmRoot/npmRoot variables
		// (sanity: it actually uses the result, not just calls the command).
		expect(source).toMatch(/pnpmRoot/);
		expect(source).toMatch(/npmRoot/);
	});

	it("guards each root-lookup IIFE with a try/catch (missing pnpm/npm is non-fatal)", () => {
		// Both root lookups must be tolerant — `pnpm` or `npm` may not be on
		// PATH in every environment. The candidate-array entry simply contributes
		// nothing rather than throwing. Match a window that brackets the
		// `pnpm root -g` / `npm root -g` literal: `try { ... <literal> ... } catch {}`.
		expect(source).toMatch(/try\s*\{[\s\S]*?pnpm root -g[\s\S]*?\}\s*catch\s*\{\}/);
		expect(source).toMatch(/try\s*\{[\s\S]*?npm root -g[\s\S]*?\}\s*catch\s*\{\}/);
	});
});

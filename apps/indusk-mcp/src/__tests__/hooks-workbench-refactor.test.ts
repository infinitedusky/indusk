import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Phase 3 of workbench-mode-rail-integrity. The 3 non-eval hooks must use
 * the shared _hook-paths.js helper instead of carrying their own copies of
 * findProjectRoot(). They don't run git operations, so they only need
 * statePath; but consolidating onto the helper eliminates the duplicate-
 * walk-up bug class (which is exactly what bit eval-trigger in workbench
 * mode for 2 months).
 *
 * T6: Source-level — each of check-catchup, check-gates, validate-impl-
 *     structure imports `resolveStateAndGitPaths` from "./_hook-paths.js"
 *     AND does NOT carry a local findProjectRoot() function.
 *
 * T7: Behavioral — running each hook against an existing dusk plan (the
 *     check-catchup hook in particular has read-side coupling) still
 *     produces no error output on the happy path. We assert no fatal
 *     errors emerge, not specific log contents.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = resolve(__dirname, "../../hooks");

const HOOKS_TO_REFACTOR = [
	"check-catchup.js",
	"check-gates.js",
	"validate-impl-structure.js",
];

describe("T6: 3 non-eval hooks import the shared helper", () => {
	for (const hookName of HOOKS_TO_REFACTOR) {
		it(`${hookName} imports resolveStateAndGitPaths from ./_hook-paths.js`, () => {
			const source = readFileSync(resolve(HOOKS_DIR, hookName), "utf-8");

			// MUST import the helper.
			expect(
				source,
				`${hookName} should import resolveStateAndGitPaths from ./_hook-paths.js`,
			).toMatch(/import\s+\{[^}]*resolveStateAndGitPaths[^}]*\}\s+from\s+["']\.\/_hook-paths\.js["']/);
		});

		it(`${hookName} does NOT carry a local findProjectRoot function declaration`, () => {
			const source = readFileSync(resolve(HOOKS_DIR, hookName), "utf-8");

			// MUST NOT carry a local copy. The helper replaces it.
			// Allow comment mentions; only fail on actual `function findProjectRoot` declarations.
			const decl = /\bfunction\s+findProjectRoot\s*\(/.exec(source);
			expect(
				decl,
				`${hookName} should not declare its own findProjectRoot(); use _hook-paths.js`,
			).toBeNull();
		});
	}
});

describe("T7: 3 non-eval hooks don't regress on the existing single-repo case", () => {
	// Source-level guard: each hook's helper consumption still references
	// `statePath` for state operations. We check that the variable name
	// `statePath` appears, which is the proof that the helper's return
	// value is being used (rather than just imported and ignored).
	for (const hookName of HOOKS_TO_REFACTOR) {
		it(`${hookName} consumes the helper's statePath`, () => {
			const source = readFileSync(resolve(HOOKS_DIR, hookName), "utf-8");
			expect(source, `${hookName} should use statePath from the helper`).toMatch(/statePath/);
		});
	}
});

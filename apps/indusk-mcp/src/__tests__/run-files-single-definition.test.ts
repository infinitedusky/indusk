// promise: one-definition-per-shared-rule
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * tests-never-make-us-wait — T20 (cleanup).
 *
 * Running a set of test files, package by package and tier by tier, was done
 * twice: the plan's test set knew a file's package and tier, and phase
 * verification ran every row's file from the repository root, where a
 * system-tier test is not a project and read as failing. This pins the one
 * home, `lib/tests/run-files.ts`, and both users importing it.
 */

const SRC_LIB = join(REPO_ROOT, "apps/indusk-mcp/src/lib");
const CONSUMERS = [
	"apps/indusk-mcp/src/lib/plans/plan-tests.ts",
	"apps/indusk-mcp/src/lib/verify/red-tests.ts",
	"apps/indusk-mcp/src/lib/promises/closing-inputs.ts",
];

describe("T20 — one way to run a test file", () => {
	it("runFiles, packageOf and execRunner are each defined once, in lib/tests/run-files.ts", () => {
		const files = globSync("**/*.ts", { cwd: SRC_LIB, ignore: ["**/*.test.ts"] });
		for (const name of ["runFiles", "packageOf", "execRunner"]) {
			const definers = files.filter((f) =>
				new RegExp(`export (?:async function|function|const) ${name}\\b`).test(
					readFileSync(join(SRC_LIB, f), "utf-8"),
				),
			);
			expect(
				definers,
				`lesson: structural-single-definition-test-for-must-agree-invariants — the plan's test set and phase verification must run a test file the same way (${name})`,
			).toEqual(["tests/run-files.ts"]);
		}
	});

	it("the plan's test set and phase verification each import runFiles from it", () => {
		for (const rel of CONSUMERS) {
			const source = readFileSync(join(REPO_ROOT, rel), "utf-8");
			expect(source, `${rel} does not import runFiles`).toMatch(
				/import \{[^}]*\brunFiles\b[^}]*\} from "[^"]*tests\/run-files\.js"/,
			);
		}
	});
});

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * dawn-workbench-execution — A14.
 *
 * "Where is the plan, where is the code" was answered three times before this
 * plan: `run.ts`, `cleanup/oversized.ts` and `verify/roots.ts` each read the
 * declaration and built the same refusal. Three copies of one answer drift
 * silently — the class `shared-resolution.test.ts` pins for `resolveImplPath`.
 * This pins the fourth: exactly one `resolveExecutionRoots`, the verify-only
 * copy gone, and all three consumers importing the one.
 */

const SRC_LIB = join(REPO_ROOT, "apps/indusk-mcp/src/lib");
const CONSUMERS = [
	"apps/indusk-mcp/src/bin/commands/run.ts",
	"apps/indusk-mcp/src/lib/cleanup/oversized.ts",
	"apps/indusk-mcp/src/lib/verify/verify.ts",
];

describe("A14 — one resolver for the plan root and the code root", () => {
	it("exactly one definition of resolveExecutionRoots exists under src/lib", () => {
		const files = globSync("**/*.ts", { cwd: SRC_LIB, ignore: ["**/*.test.ts"] });
		const definitions = files.filter((f) =>
			/export function resolveExecutionRoots\b/.test(readFileSync(join(SRC_LIB, f), "utf-8")),
		);
		expect(definitions).toEqual(["worktree/roots.ts"]);
	});

	it("the verify-only resolver is gone", () => {
		expect(existsSync(join(SRC_LIB, "verify/roots.ts"))).toBe(false);
	});

	it("run, the cleanup scan and verify each import the one", () => {
		for (const rel of CONSUMERS) {
			const source = readFileSync(join(REPO_ROOT, rel), "utf-8");
			expect(source, `${rel} does not import resolveExecutionRoots`).toMatch(
				/import \{[^}]*\bresolveExecutionRoots\b[^}]*\} from "[^"]*worktree\/roots\.js"/,
			);
		}
	});
});

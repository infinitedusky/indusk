// promise: one-definition-per-shared-rule
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * admin-plan-authoring — Build Phase 2.
 *
 * Which open items a person must judge is decided by Dawn's loop and by an
 * unattended build's next step. Two copies would let one lane stop where the
 * other carries on, so the rule lives once, in `lib/build/judgement.ts`, and
 * both import it.
 */

const SRC_LIB = join(REPO_ROOT, "apps/indusk-mcp/src/lib");
const files = () => globSync("**/*.ts", { cwd: SRC_LIB, ignore: ["**/*.test.ts"] }).sort();

describe("one rule for judgement items", () => {
	it("detectHumanGate and its patterns are defined once, in lib/build/judgement.ts", () => {
		const defining = files().filter((f) =>
			/function detectHumanGate\b|HUMAN_GATE_PATTERNS\s*[:=]/.test(
				readFileSync(join(SRC_LIB, f), "utf-8"),
			),
		);
		expect(defining).toEqual(["build/judgement.ts"]);
	});

	it("Dawn's loop and the build's next step import it", () => {
		for (const consumer of ["run/loop.ts", "build/next-step.ts"]) {
			expect(readFileSync(join(SRC_LIB, consumer), "utf-8"), consumer).toMatch(
				/import \{[^}]*\bdetectHumanGate\b[^}]*\} from "(?:\.\.\/build|\.)\/judgement\.js"/,
			);
		}
	});
});

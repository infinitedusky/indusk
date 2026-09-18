// promise: one-definition-per-shared-rule
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * workbench-trust-fixes A3 — the phase-start nudge has one implementation.
 *
 * The text "Phase N opens with these tests to author" existed twice: inside
 * `hooks/gate-reminder.js` (`writableAtNudge`) and as an exported
 * `getPhaseStartNudge` in `src/lib/trajectory/state-ops.ts` with zero
 * production callers. Two orphaned halves of one feature, neither of which
 * ever reached a user. The hook is the definition that can exist (hooks are
 * plain JS and cannot import the TS lib), so the library copy goes.
 *
 * Pinned by counting files, the way this codebase pins every must-agree
 * definition: a behavioral test cannot catch a divergence that has not
 * happened yet.
 */

const PACKAGE_ROOT = new URL("../../", import.meta.url).pathname;
const NEEDLE = "opens with these tests to author";

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { recursive: true, encoding: "utf-8" })
		.map((rel) => join(dir, rel))
		.filter((p) => /\.(js|ts)$/.test(p) && !/\.test\.ts$/.test(p) && !p.includes("node_modules"));
}

describe("A3 — one definition of the phase-start nudge", () => {
	it("exactly one non-test source file carries the nudge text", () => {
		const files = [
			...sourceFiles(join(PACKAGE_ROOT, "hooks")),
			...sourceFiles(join(PACKAGE_ROOT, "src")),
		];
		const carriers = files
			.filter((p) => readFileSync(p, "utf-8").includes(NEEDLE))
			.map((p) => relative(PACKAGE_ROOT, p));
		expect(carriers, `nudge text defined in: ${carriers.join(", ")}`).toHaveLength(1);
		expect(carriers[0]).toBe("hooks/gate-reminder.js");
	});
});

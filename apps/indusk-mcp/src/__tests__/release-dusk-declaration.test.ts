import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * release-records-its-failures, Test Phase 1 — A18: dusk declares its own
 * release the way the plan says. The slow tests leave the `release` script, so
 * the publish no longer waits on them, and `.indusk/config.json` declares them
 * `after` with a JUnit report for `indusk release` to read.
 *
 * promise: dusk-installs-its-own-build
 *
 * Reads two files of the repository this test runs in, so it is honest red the
 * day it is written and green the day Build Phase 5 edits them.
 */

describe("dusk declares its own release (A18)", () => {
	it("A18: the release script does not run the slow tests before it publishes", () => {
		const pkg = JSON.parse(
			readFileSync(join(REPO_ROOT, "apps/indusk-mcp/package.json"), "utf-8"),
		) as { scripts?: Record<string, string> };
		const script = pkg.scripts?.release;
		expect(script, "apps/indusk-mcp/package.json has no release script").toBeTypeOf("string");
		expect(script).not.toContain("test:system");
	});

	it("A18: .indusk/config.json declares the slow tests `after`, with a JUnit report", () => {
		const config = JSON.parse(readFileSync(join(REPO_ROOT, ".indusk/config.json"), "utf-8")) as {
			workflow?: { steps?: { release?: { slow_tests?: { when?: string; report?: string } } } };
		};
		const slow = config.workflow?.steps?.release?.slow_tests;
		expect(slow, "workflow.steps.release.slow_tests is not declared").toBeDefined();
		expect(slow?.when).toBe("after");
		expect(slow?.report, "no report declared").toEqual(expect.stringMatching(/junit.*\.xml$/));
	});
});

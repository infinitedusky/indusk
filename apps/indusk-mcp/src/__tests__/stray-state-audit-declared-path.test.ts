import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findStrayState } from "../lib/stray-state-audit.js";
import { oneRepoAtPath, type VersionedWorkbench } from "./helpers/versioned-workbench.js";

/**
 * workbench-trust-fixes A12 — the stray-state audit looks where the repo is.
 *
 * It joins `workbenchRoot` with `repo.name`. On a repo declared at a `path`
 * that directory does not exist, the walk is skipped, and the audit reports
 * clean. A `.indusk/` planted inside the real checkout is exactly what it
 * exists to find.
 */
describe("A12 — stray `.indusk/` inside a repo declared at a path", () => {
	let wb: VersionedWorkbench;
	afterEach(() => wb?.cleanup());

	it("is reported, with the path inside code/alpha", () => {
		wb = oneRepoAtPath();
		const stray = join(wb.repos[0].dir, ".indusk");
		mkdirSync(stray, { recursive: true });
		writeFileSync(join(stray, "config.json"), "{}\n");

		const findings = findStrayState(wb.root);
		const hit = findings.find((f) => f.path.includes(join("code", "alpha", ".indusk")));
		expect(hit, `findings: ${JSON.stringify(findings)}`).toBeDefined();
		expect(hit?.type).toBe("wrapped-repo-stray");
	});
});

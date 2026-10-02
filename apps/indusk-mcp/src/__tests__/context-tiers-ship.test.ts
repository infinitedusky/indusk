import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanupGitTmpProject,
	type GitTmpProject,
	REPO_ROOT,
	runCli,
	SHOULD_SKIP,
	setupGitTmpProject,
} from "./helpers/git-tmp-project.js";

/**
 * context-tiers — A4: the planning context file is package-owned and ships.
 *
 * `.indusk/planning/CLAUDE.md` carries the trajectory and gate rules for every
 * consumer, the way a skill does: written by `init`, overwritten by `update`,
 * byte-equal to the package copy. A consumer that edits it by hand loses the
 * edit at the next update, which is the same contract skills have.
 */

const TEMPLATE = join(REPO_ROOT, "apps/indusk-mcp/templates/planning/CLAUDE.md");

let p: GitTmpProject | null = null;
afterEach(() => {
	if (p) cleanupGitTmpProject(p);
	p = null;
});

describe.skipIf(SHOULD_SKIP)("A4 — update ships the planning context file", () => {
	it("writes it byte-identical to the package copy, and a second update changes nothing", () => {
		p = setupGitTmpProject("context-tiers-ship");
		expect(runCli(p, ["init", "--local", "--no-index"]).code).toBe(0);
		expect(runCli(p, ["update"]).code).toBe(0);

		const shipped = join(p.projectDir, ".indusk/planning/CLAUDE.md");
		expect(existsSync(shipped), "update writes .indusk/planning/CLAUDE.md").toBe(true);
		expect(existsSync(TEMPLATE), "the package carries the source copy").toBe(true);
		const first = readFileSync(shipped, "utf-8");
		expect(first).toBe(readFileSync(TEMPLATE, "utf-8"));

		expect(runCli(p, ["update"]).code).toBe(0);
		expect(readFileSync(shipped, "utf-8"), "a second update is a no-op on the bytes").toBe(first);
	});
});

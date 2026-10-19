// promise: a-brief-is-accepted-on-current-main
// clause: a-brief-is-accepted-on-current-main/main-is-merged-first
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	git,
	oneRepoAtPath,
	type VersionedWorkbench,
} from "../../__tests__/helpers/versioned-workbench.js";
import { bringTrunkIntoPlan } from "./bring-trunk.js";
import { startPlan } from "./start.js";

/**
 * a-brief-is-accepted-on-current-main, Build Phase 1 (A29): the admin's
 * planning start reaches a workbench plan through the same package function
 * acceptance does — the repo's trunk comes into the plan's code branch.
 */

let wb: VersionedWorkbench;
beforeEach(() => {
	wb = oneRepoAtPath();
});
afterEach(() => wb.cleanup());

describe("a workbench plan's planning start", () => {
	it("A29: brings the repo's trunk into its code branch", async () => {
		const s = await startPlan(wb.root, "bugfix", "wb-plan", new Date(), {});
		const trunk = wb.repos[0].dir;
		writeFileSync(join(trunk, "trunk-moved.md"), "new\n");
		git(trunk, ["add", "-A"]);
		git(trunk, ["commit", "-q", "-m", "trunk moves"]);
		await bringTrunkIntoPlan(wb.root, "wb-plan", {
			refused: "its planning run did not start",
			again: "start its planning again",
			when: "its planning run",
		});
		// The code worktree may be stored relative to the workbench root.
		expect(existsSync(resolve(wb.root, s.code?.worktree ?? "", "trunk-moved.md"))).toBe(true);
	});
});

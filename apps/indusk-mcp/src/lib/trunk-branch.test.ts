import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, initRepoWithCommit } from "../__tests__/helpers/test-git.js";
import { currentTrunkBranch } from "./trunk-branch.js";

/**
 * promise: one-definition-per-shared-rule — admin-plan-authoring A38.
 *
 * Starting, approving, landing and reviewing a plan each read which branch
 * the trunk is on and whether it is one of the project's trunk branches. One
 * reader answers all four; each keeps its own refusal.
 */

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function repo(): string {
	const dir = realpathSync(mkdtempSync(join(tmpdir(), "trunk-branch-")));
	dirs.push(dir);
	initRepoWithCommit(dir);
	return dir;
}

describe("A38 — the trunk's branch, read once", () => {
	it("a trunk on main is on a trunk branch, by the default list", async () => {
		const dir = repo();
		expect(await currentTrunkBranch(dir)).toEqual({
			branch: "main",
			allowed: ["main", "master"],
			onTrunk: true,
		});
	});

	it("a configured trunk branch counts, and the default list gives way to it", async () => {
		const dir = repo();
		git(dir, ["checkout", "-q", "-b", "trunk"]);
		mkdirSync(join(dir, ".indusk"));
		writeFileSync(
			join(dir, ".indusk", "config.json"),
			JSON.stringify({ worktree: { trunk_guard: { branches: ["trunk"] } } }),
		);
		expect(await currentTrunkBranch(dir)).toEqual({
			branch: "trunk",
			allowed: ["trunk"],
			onTrunk: true,
		});
	});

	it("a trunk checked out on a feature branch is not on a trunk branch, and says which it is on", async () => {
		const dir = repo();
		git(dir, ["checkout", "-q", "-b", "feature/x"]);
		const read = await currentTrunkBranch(dir);
		expect(read.branch).toBe("feature/x");
		expect(read.onTrunk).toBe(false);
	});
});

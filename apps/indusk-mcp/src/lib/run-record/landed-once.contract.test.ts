// clause: admin-pages-load-fast/one-read-per-page
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git, initRepoWithCommit } from "../../__tests__/helpers/test-git.js";
import { readLandings } from "./async-reads.js";
import { resetKept } from "./kept-reads.js";
import { landedAsker } from "./landed.js";

/**
 * A6 (admin-pages-load-fast, Build Phase 1): the single trunk reading answers every plan as the
 * per-plan question does. Real git over temp repositories (a process start), so a contract in
 * the system tier.
 */

let base: string;
beforeEach(() => {
	resetKept();
	base = mkdtempSync(join(tmpdir(), "landed-once-"));
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

/** A plan branch with one commit, merged into the current branch the way `plans land` does. */
function land(repo: string, plan: string, trunk: string) {
	git(repo, ["checkout", "-q", "-b", `plan/${plan}`]);
	writeFileSync(join(repo, `${plan}.ts`), `export const ${plan.replace(/\W/g, "_")} = 1;\n`);
	git(repo, ["add", "-A"]);
	git(repo, ["commit", "-q", "-m", `work ${plan}`]);
	git(repo, ["checkout", "-q", trunk]);
	git(repo, ["merge", "-q", "--no-ff", "-m", `Merge plan/${plan}: ${plan} landed`, `plan/${plan}`]);
	git(repo, ["branch", "-q", "-d", `plan/${plan}`]);
}

async function same(root: string, plans: string[]) {
	const sync = landedAsker(root);
	const once = await readLandings(root);
	for (const plan of plans) expect([plan, once(plan)]).toEqual([plan, sync(plan)]);
	return plans.map((p) => once(p));
}

describe("A6 — one trunk reading equals the per-plan question", () => {
	it("A6 a landed plan, a plan never landed and a plan with a similar name", async () => {
		const root = join(base, "proj");
		initRepoWithCommit(root);
		land(root, "foo", "main");
		const answers = await same(root, ["foo", "bar", "bar-foo", "fo"]);
		expect(answers).toEqual([true, false, false, false]);
	});

	it("A6 a plan landed in an archive folder", async () => {
		const root = join(base, "proj");
		initRepoWithCommit(root);
		mkdirSync(join(root, ".indusk/planning/archive/old-plan"), { recursive: true });
		writeFileSync(join(root, ".indusk/planning/archive/old-plan/impl.md"), "# impl\n");
		git(root, ["add", "-A"]);
		git(root, ["commit", "-q", "-m", "archive old-plan"]);
		const answers = await same(root, ["old-plan", "old", "other"]);
		expect(answers).toEqual([true, false, false]);
	});

	it("A6 a workbench plan landed in its code repository", async () => {
		const root = join(base, "bench");
		const repo = join(base, "app");
		initRepoWithCommit(root, "bench");
		mkdirSync(join(root, ".indusk/planning/wb-plan"), { recursive: true });
		writeFileSync(
			join(root, ".indusk/config.json"),
			JSON.stringify({ worktree: { repos: [{ name: "app" }] } }),
		);
		writeFileSync(join(root, ".indusk/planning/wb-plan/impl.md"), "# impl\n");
		writeFileSync(
			join(root, ".indusk/planning/wb-plan/code.json"),
			JSON.stringify({ repo: "app", branch: "plan/wb-plan", worktree: "../app-worktrees/wb-plan" }),
		);
		git(root, ["add", "-A"]);
		git(root, ["commit", "-q", "-m", "plan documents"]);
		initRepoWithCommit(repo, "app");
		expect(await same(root, ["wb-plan"])).toEqual([false]);
		resetKept();
		land(repo, "wb-plan", "main");
		expect(await same(root, ["wb-plan"])).toEqual([true]);
	});

	it("A6 a project whose trunk is master beside a main branch", async () => {
		const root = join(base, "proj");
		initRepoWithCommit(root);
		git(root, ["branch", "-m", "master"]);
		land(root, "on-master", "master");
		git(root, ["branch", "main"]);
		// checked out elsewhere, the trunk is still read from the trunk branch
		git(root, ["checkout", "-q", "-b", "scratch"]);
		const answers = await same(root, ["on-master", "missing"]);
		expect(answers).toEqual([true, false]);
	});
});

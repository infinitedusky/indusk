import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readPostCreate } from "../bin/commands/worktree.js";
import { twoRepos, type VersionedWorkbench } from "./helpers/versioned-workbench.js";

/**
 * workbench-trust-fixes A15 — in a multi-repo workbench, `worktree create
 * <repo> <slug>` applies THAT repo's config.
 *
 * `readPostCreate` read `repos[0]`'s worktree config for every repo, so beta's
 * fresh worktree ran alpha's install steps. Deferred from Test Phase 1: its
 * subject is the exported per-repo reader this phase introduces, and a test
 * importing it before then fails to load, not to assert.
 */
describe("A15 — post_create comes from the repo being created", () => {
	let wb: VersionedWorkbench;
	afterEach(() => wb?.cleanup());

	it("reads beta's config for beta and alpha's for alpha", () => {
		wb = twoRepos();
		const configs = join(wb.root, ".indusk", "worktree-configs");
		mkdirSync(configs, { recursive: true });
		writeFileSync(join(configs, "alpha.json"), JSON.stringify({ post_create: ["echo alpha"] }));
		writeFileSync(join(configs, "beta.json"), JSON.stringify({ post_create: ["echo beta"] }));

		expect(readPostCreate(wb.root, "beta")).toEqual(["echo beta"]);
		expect(readPostCreate(wb.root, "alpha")).toEqual(["echo alpha"]);
	});

	it("with no repo named there is nothing to run — the script has already refused", () => {
		wb = twoRepos();
		expect(readPostCreate(wb.root, undefined)).toEqual([]);
	});
});

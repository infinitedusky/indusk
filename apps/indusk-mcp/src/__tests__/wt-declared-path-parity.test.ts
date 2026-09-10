import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	git,
	makeVersionedWorkbench,
	type VersionedWorkbench,
} from "./helpers/versioned-workbench.js";

/**
 * workbench-trust-fixes A10 + A11 — the three worktree scripts honor a
 * declared `path` and a declared `worktrees` dir, the way `wt.sh` has since
 * 1.42.0.
 *
 * `setup-worktree.sh` and `refresh-worktree.sh` build `CLIENT_ROOT` from the
 * repo's *name*; `refresh --all` and `preflight.sh` scan the workbench root
 * only. On a workbench whose repo lives at `code/alpha` with worktrees under
 * `wts/`, create fails outright and the others cannot see what exists. These
 * tests reach the scripts over the process boundary, so the red is a real
 * exit code, not a missing import.
 */

const SCRIPTS = resolve(new URL("../../extensions/worktree/scripts/", import.meta.url).pathname);
const SETUP = join(SCRIPTS, "setup-worktree.sh");
const REFRESH = join(SCRIPTS, "refresh-worktree.sh");
const PREFLIGHT = join(SCRIPTS, "preflight.sh");

function sh(script: string, args: string[], cwd: string) {
	const r = spawnSync("bash", [script, ...args], { cwd, encoding: "utf-8", timeout: 30_000 });
	return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

let wb: VersionedWorkbench;

beforeEach(() => {
	wb = makeVersionedWorkbench({
		repos: [{ name: "alpha", path: "code/alpha", worktrees: "wts" }],
		layout: "nested",
		shape: "workbench",
	});
	mkdirSync(join(wb.root, ".indusk", "worktree-configs"), { recursive: true });
	writeFileSync(join(wb.root, ".indusk", "worktree-configs", "alpha.json"), "{}\n");
	mkdirSync(join(wb.root, "wts"), { recursive: true });
});
afterEach(() => wb.cleanup());

describe.skipIf(!existsSync(SETUP))("A10 — create and refresh on a declared `path`", () => {
	it("setup-worktree.sh creates the worktree under the declared worktrees dir", () => {
		const r = sh(SETUP, ["feature-x"], wb.root);
		expect(r.code, r.out).toBe(0);
		expect(existsSync(join(wb.root, "wts", "feature-x", ".git")), r.out).toBe(true);
	});

	it("refresh-worktree.sh <slug> finds a worktree that lives under the declared worktrees dir", () => {
		git(wb.repos[0].dir, [
			"worktree",
			"add",
			"-q",
			join(wb.root, "wts", "feature-y"),
			"-b",
			"feature-y",
		]);
		const r = sh(REFRESH, ["feature-y"], wb.root);
		expect(r.code, r.out).toBe(0);
		// Exit 0 alone is not enough: refresh_one silently skips a directory it
		// cannot find, so a script that looked in the wrong place also exits 0.
		expect(r.out, "did not refresh the worktree at its declared location").toContain(
			join("wts", "feature-y"),
		);
	});
});

describe.skipIf(!existsSync(REFRESH))(
	"A11 — refresh --all and preflight see declared worktrees",
	() => {
		beforeEach(() => {
			git(wb.repos[0].dir, [
				"worktree",
				"add",
				"-q",
				join(wb.root, "wts", "feature-y"),
				"-b",
				"feature-y",
			]);
		});

		it("refresh-worktree.sh --all refreshes the worktree under wts/ and skips the trunk at its declared path", () => {
			const r = sh(REFRESH, ["--all"], wb.root);
			expect(r.code, r.out).toBe(0);
			expect(r.out).toContain("feature-y");
			expect(r.out).not.toMatch(/code\/alpha[^\n]*(refresh|Refreshing)/);
		});

		it("preflight.sh <slug> resolves the worktree under wts/", () => {
			const r = sh(PREFLIGHT, ["feature-y"], wb.root);
			expect(r.code, r.out).toBe(0);
		});
	},
);

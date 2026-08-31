import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * Trunks route from CONFIG, never from scanning.
 *
 * `wt <repo>` used to resolve only when a directory or symlink named after
 * the repo happened to sit at the workbench root — scan-luck, not the
 * declared layout. A sibling-layout workbench whose trunk link was never
 * made (or a nested repo with a declared `path`) had a config that said
 * exactly where the trunk was, and `wt` could not find it. `wt main` did
 * not exist at all.
 *
 * Now `main`, `<repo>/main`, and a declared repo name resolve through
 * `_wt_resolve_trunk_dir`: the declared workbench-side path when it exists,
 * else `<repos_root>/<name>`. And both execution surfaces share ONE
 * resolver — wt-pm2.sh carried a root-only copy whose header claimed
 * "resolution matches wt.sh" for a full release after it stopped being true.
 */

const WT = resolve(REPO_ROOT, "apps/indusk-mcp/extensions/worktree/scripts/wt.sh");
const WT_PM2 = resolve(REPO_ROOT, "apps/indusk-mcp/extensions/worktree/scripts/wt-pm2.sh");
let root: string;

afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

function writeConfig(wb: string, worktree: Record<string, unknown>): void {
	mkdirSync(join(wb, ".indusk"), { recursive: true });
	writeFileSync(
		join(wb, ".indusk", "config.json"),
		JSON.stringify({ mode: "local", worktree: { shape: "workbench", ...worktree } }),
	);
}

function wt(cwd: string, target: string) {
	const r = spawnSync("bash", [WT, target, "--", "pwd"], { cwd, encoding: "utf-8" });
	return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

describe.skipIf(!existsSync(WT))("wt routes trunks from config", () => {
	it("`wt main` and `wt <repo>` reach a sibling trunk with NO symlink at the root", () => {
		// The legacy shape every pre-1.37 workbench still has: wrapped_repo +
		// absolute sibling_parent, trunk as a sibling clone. Without the root
		// symlink the old scan found nothing, though the config named the spot.
		root = mkdtempSync(join(tmpdir(), "wt-trunk-"));
		const wb = join(root, "wb");
		const trunk = join(root, "siblings", "numero");
		mkdirSync(trunk, { recursive: true });
		writeConfig(wb, { wrapped_repo: "numero", sibling_parent: join(root, "siblings") });

		for (const target of ["main", "numero"]) {
			const r = wt(wb, target);
			expect(r.code, `${target}: ${r.out}`).toBe(0);
			expect(r.out).toContain(join("siblings", "numero"));
		}
	});

	it("`wt main` resolves through the trunk symlink when one exists", () => {
		root = mkdtempSync(join(tmpdir(), "wt-trunk-"));
		const wb = join(root, "wb");
		const trunk = join(root, "numero");
		mkdirSync(trunk, { recursive: true });
		writeConfig(wb, { wrapped_repo: "numero", sibling_parent: root });
		symlinkSync(join("..", "numero"), join(wb, "numero"));

		const r = wt(wb, "main");
		expect(r.code, r.out).toBe(0);
		expect(r.out).toContain("numero");
	});

	it("`wt main` with several repos refuses and names the qualified forms", () => {
		root = mkdtempSync(join(tmpdir(), "wt-trunk-"));
		const wb = join(root, "wb");
		writeConfig(wb, { repos_root: ".", repos: [{ name: "alpha" }, { name: "beta" }] });
		for (const name of ["alpha", "beta"]) mkdirSync(join(wb, name), { recursive: true });

		const r = wt(wb, "main");
		expect(r.code).not.toBe(0);
		expect(r.out).toContain("alpha/main");
		expect(r.out).toContain("beta/main");

		const q = wt(wb, "beta/main");
		expect(q.code, q.out).toBe(0);
		expect(q.out.trim().endsWith(join("wb", "beta"))).toBe(true);
	});

	it("a nested repo (`repos_root: \".\"`) resolves at its workbench-side directory", () => {
		root = mkdtempSync(join(tmpdir(), "wt-trunk-"));
		const wb = join(root, "wb");
		writeConfig(wb, { repos_root: ".", repos: [{ name: "alpha" }] });
		mkdirSync(join(wb, "alpha"), { recursive: true });

		const r = wt(wb, "main");
		expect(r.code, r.out).toBe(0);
		expect(r.out.trim().endsWith(join("wb", "alpha"))).toBe(true);
	});

	it("a declared `path` wins over the name-at-root default", () => {
		root = mkdtempSync(join(tmpdir(), "wt-trunk-"));
		const wb = join(root, "wb");
		writeConfig(wb, { repos_root: ".", repos: [{ name: "alpha", path: "checkouts/alpha" }] });
		mkdirSync(join(wb, "checkouts", "alpha"), { recursive: true });

		for (const target of ["main", "alpha"]) {
			const r = wt(wb, target);
			expect(r.code, `${target}: ${r.out}`).toBe(0);
			expect(r.out).toContain(join("checkouts", "alpha"));
		}
	});

	it("a missing trunk fails loud, naming both places it looked", () => {
		root = mkdtempSync(join(tmpdir(), "wt-trunk-"));
		const wb = join(root, "wb");
		writeConfig(wb, { wrapped_repo: "ghost", sibling_parent: join(root, "siblings") });
		mkdirSync(wb, { recursive: true });

		const r = wt(wb, "main");
		expect(r.code).not.toBe(0);
		expect(r.out).toMatch(/trunk for repo 'ghost' not found/);
		expect(r.out).toContain("workbench restore");
	});
});

describe.skipIf(!existsSync(WT_PM2))("wt-pm2 shares the resolver", () => {
	function pm2(cwd: string, args: string[]) {
		const r = spawnSync("bash", [WT_PM2, ...args], {
			cwd,
			encoding: "utf-8",
			env: { ...process.env, WT_PM2_DRY_RUN: "1" },
		});
		return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
	}

	it("finds a worktree in a DECLARED worktrees directory (was root-only)", () => {
		root = mkdtempSync(join(tmpdir(), "wt-pm2-"));
		const wb = join(root, "wb");
		writeConfig(wb, {
			repos_root: ".",
			repos: [{ name: "alpha", worktrees: "alpha-worktrees" }],
		});
		mkdirSync(join(wb, "alpha"), { recursive: true });
		mkdirSync(join(wb, "alpha-worktrees", "feat-x"), { recursive: true });

		const r = pm2(wb, ["feat-x", "dev"]);
		expect(r.code, r.out).toBe(0);
		expect(r.out).toContain(join("alpha-worktrees", "feat-x"));
		expect(r.out).toContain("(dry-run: would invoke pm2)");
	});

	it("`main` targets the trunk here too", () => {
		root = mkdtempSync(join(tmpdir(), "wt-pm2-"));
		const wb = join(root, "wb");
		writeConfig(wb, { repos_root: ".", repos: [{ name: "alpha" }] });
		mkdirSync(join(wb, "alpha"), { recursive: true });

		const r = pm2(wb, ["main", "dev"]);
		expect(r.code, r.out).toBe(0);
		// Suffix-match: the resolver echoes physical paths, and macOS tmpdir is
		// a symlink (/var → /private/var), so the full prefix never matches.
		expect(r.out).toMatch(/cwd: \S*\/wb\/alpha\s/);
		expect(r.out).toContain("→ main-dev");
	});
});

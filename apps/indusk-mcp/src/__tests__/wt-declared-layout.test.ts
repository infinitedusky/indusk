import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, REPO_ROOT } from "./helpers/cli.js";

/**
 * `pnpm wt <slug>` must find worktrees in DECLARED locations.
 *
 * `wt.sh` scanned `$WORKBENCH_ROOT/*` and nothing else, so the moment a repo
 * declared `worktrees`, its worktrees were one level down and invisible — not
 * ambiguous, absent. Declared layouts shipped in 1.37.0 and this was broken by
 * them from the start, because the execution surface was never taught the
 * layout the config had learned to express.
 *
 * With two repos able to hold the same slug, resolution also needs a way to
 * disambiguate. It is `<repo>/<slug>` and not `<dir>/<slug>`: the repo name and
 * the slug are what a person knows, while the directory is a config detail that
 * changes when the layout does.
 */

const WT = resolve(REPO_ROOT, "apps/indusk-mcp/extensions/worktree/scripts/wt.sh");
let root: string;

afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

/** Two repos, each with its own declared worktrees dir, sharing a slug name. */
function buildDeclared(sharedSlug: string): string {
	root = mkdtempSync(join(tmpdir(), "wt-declared-"));
	const wb = join(root, "wb");
	mkdirSync(join(wb, ".indusk"), { recursive: true });
	writeFileSync(
		join(wb, ".indusk", "config.json"),
		JSON.stringify({
			mode: "local",
			worktree: {
				shape: "workbench",
				repos_root: ".",
				repos: [
					{ name: "alpha", worktrees: "alpha-worktrees" },
					{ name: "beta", worktrees: "beta-worktrees" },
				],
			},
		}),
	);
	for (const name of ["alpha", "beta"]) {
		const repo = join(wb, name);
		mkdirSync(repo, { recursive: true });
		git(repo, ["init", "-q", "-b", "main"]);
		writeFileSync(join(repo, "README.md"), `# ${name}\n`);
		git(repo, ["add", "-A"]);
		git(repo, ["commit", "-qm", "init"]);
		git(repo, [
			"worktree",
			"add",
			"-q",
			join(wb, `${name}-worktrees`, sharedSlug),
			"-b",
			sharedSlug,
		]);
	}
	return wb;
}

function wt(cwd: string, target: string) {
	const r = spawnSync("bash", [WT, target, "--", "pwd"], { cwd, encoding: "utf-8" });
	return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

describe.skipIf(!existsSync(WT))("wt.sh finds worktrees in declared locations", () => {
	it("resolves a slug that lives inside a declared worktrees directory", () => {
		const wb = buildDeclared("only-here");
		// Remove beta's copy so the slug is unambiguous.
		rmSync(join(wb, "beta-worktrees", "only-here"), { recursive: true, force: true });

		const r = wt(wb, "only-here");
		expect(r.code, r.out).toBe(0);
		expect(r.out).toContain(join("alpha-worktrees", "only-here"));
	});

	it("refuses an ambiguous slug and names both, rather than guessing", () => {
		const wb = buildDeclared("cool-name");
		const r = wt(wb, "cool-name");
		expect(r.code).not.toBe(0);
		expect(r.out).toMatch(/multiple|ambiguous/i);
		// Actionable: both candidates named in the qualified form that fixes it.
		expect(r.out).toContain("alpha/cool-name");
		expect(r.out).toContain("beta/cool-name");
	});

	it("resolves the qualified `<repo>/<slug>` form", () => {
		const wb = buildDeclared("cool-name");
		const r = wt(wb, "beta/cool-name");
		expect(r.code, r.out).toBe(0);
		expect(r.out).toContain(join("beta-worktrees", "cool-name"));
		expect(r.out).not.toContain(join("alpha-worktrees", "cool-name"));
	});
});

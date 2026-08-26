import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A18 / A19 — the workbench declares its layout instead of the tool inferring it.
 *
 * Red today because nothing reads `path` or `worktrees`: a worktree lands at
 * the workbench root regardless of what config says, and renaming a repo's
 * directory breaks the trunk because the directory name IS the identifier.
 *
 * The property under test is not "nesting works" — it is that **no meaning is
 * derived from a name**. That is the same rule already applied one level down,
 * where `worktree list` asks git for `--git-common-dir` rather than guessing
 * ownership from a slug prefix, because a prefix heuristic attributes
 * `alpha-feature` to `alpha` by luck.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** Rewrite the declared repo entries — the only way layout is expressed. */
function declare(
	workbenchDir: string,
	edits: Record<string, { path?: string; worktrees?: string }>,
): void {
	const p = join(workbenchDir, ".indusk", "config.json");
	const cfg = JSON.parse(readFileSync(p, "utf-8"));
	for (const repo of cfg.worktree.repos as Array<{ name: string; [k: string]: unknown }>) {
		const edit = edits[repo.name];
		if (edit) Object.assign(repo, edit);
	}
	writeFileSync(p, JSON.stringify(cfg, null, 2));
}

describe.skipIf(SHOULD_SKIP)("A18 — a declared worktrees location is where worktrees go", () => {
	it("puts a new worktree in the declared directory, not the root", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ materialize: true });
		declare(fixture.workbenchDir, { alpha: { worktrees: "alpha-worktrees" } });

		const { code, stderr } = runCli(fixture.workbenchDir, [
			"worktree",
			"create",
			"alpha",
			"feature-x",
		]);
		expect(code, stderr).toBe(0);

		expect(existsSync(join(fixture.workbenchDir, "alpha-worktrees", "feature-x"))).toBe(true);
		// The point of declaring a location is that the root stops accumulating.
		expect(existsSync(join(fixture.workbenchDir, "feature-x"))).toBe(false);
	});

	it("leaves a repo that declares nothing exactly where it is today", { timeout: 30_000 }, () => {
		// Absence means flat. This is the entire migration story — an existing
		// workbench gains nothing it did not ask for.
		fixture = buildTwoRepoWorkbench({ materialize: true });

		const { code, stderr } = runCli(fixture.workbenchDir, ["worktree", "create", "beta", "flat-x"]);
		expect(code, stderr).toBe(0);
		expect(existsSync(join(fixture.workbenchDir, "flat-x"))).toBe(true);
	});
});

describe.skipIf(SHOULD_SKIP)("A19 — nothing infers layout from a name", () => {
	it("follows a renamed repo directory when config is updated", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ materialize: true });

		// Rename the TRUNK ENTRY inside the workbench, then say so in config.
		// `path` is relative to the workbench, so this is the entry that moves —
		// the sibling checkout it points at is untouched. If the tool derives
		// anything from `name`, this breaks; if it reads `path`, it does not.
		renameSync(join(fixture.workbenchDir, "alpha"), join(fixture.workbenchDir, "alpha-renamed"));
		declare(fixture.workbenchDir, { alpha: { path: "alpha-renamed" } });

		const { code, stdout, stderr } = runCli(fixture.workbenchDir, ["worktree", "list"]);
		expect(code, stderr).toBe(0);

		// Assert the trunk RESOLVES at the renamed path — not merely that the
		// string appears. An earlier version checked only that "alpha-renamed"
		// was somewhere in the output, and passed even with the path derived
		// from `name`: the renamed directory simply showed up as an
		// unattributed entry. The claim is that the repo is FOUND there.
		const alphaBlock = stdout.slice(stdout.indexOf("\nalpha\n"));
		expect(alphaBlock).toMatch(/Trunk:\s+alpha-renamed .*resolves/);
		// …and it is a trunk, not loose content mistaken for a worktree.
		expect(stdout).not.toMatch(/^\s+alpha-renamed$/m);
	});

	it("refuses a declared path that escapes the workbench", { timeout: 30_000 }, () => {
		// `path` and `worktrees` are joined into filesystem paths, so they are
		// boundary values exactly as `name` is. Degrade to structure-loss, never
		// to a traversal.
		fixture = buildTwoRepoWorkbench({ materialize: true });
		declare(fixture.workbenchDir, { alpha: { worktrees: "../escaped" } });

		const { code } = runCli(fixture.workbenchDir, ["worktree", "create", "alpha", "nope"]);

		// However it degrades, nothing may be created outside the workbench.
		expect(existsSync(join(fixture.root, "escaped"))).toBe(false);
		expect(code).not.toBe(-1);
	});
});

describe.skipIf(SHOULD_SKIP)("A20 — listing groups by repo, disk stays the inventory", () => {
	it("lists a declared repo's worktrees under that repo", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ materialize: true });
		declare(fixture.workbenchDir, { alpha: { worktrees: "alpha-worktrees" } });

		expect(runCli(fixture.workbenchDir, ["worktree", "create", "alpha", "feature-x"]).code).toBe(0);

		const { stdout } = runCli(fixture.workbenchDir, ["worktree", "list"]);
		const alphaBlock = stdout.slice(stdout.indexOf("\nalpha\n"), stdout.indexOf("\nbeta\n"));
		expect(alphaBlock).toContain("feature-x");
		// The worktrees directory itself is structure, not a worktree.
		expect(stdout).not.toMatch(/^\s+alpha-worktrees$/m);
	});

	it("shows a worktree outside every declared location as UNATTRIBUTED, never dropped", {
		timeout: 30_000,
	}, () => {
		// The standing rule: declarations add structure and can never subtract.
		// A directory renamed on disk without updating config must still be
		// visible — a declaration that silently removes work from the listing is
		// worse than one that admits it cannot place it.
		fixture = buildTwoRepoWorkbench({ materialize: true });
		declare(fixture.workbenchDir, { alpha: { worktrees: "alpha-worktrees" } });
		expect(runCli(fixture.workbenchDir, ["worktree", "create", "alpha", "feature-x"]).code).toBe(0);

		// Rename the declared directory WITHOUT telling config.
		renameSync(
			join(fixture.workbenchDir, "alpha-worktrees"),
			join(fixture.workbenchDir, "moved-elsewhere"),
		);

		const { stdout } = runCli(fixture.workbenchDir, ["worktree", "list"]);

		expect(stdout).toMatch(/Unattributed/i);
		expect(stdout).toContain("moved-elsewhere");
		// Not just the container — the WORKTREES inside it, each named, with the
		// repo they belong to. Reporting only the folder is its own subtraction:
		// a reader sees a directory and cannot tell it holds work.
		expect(stdout).toContain("feature-x");
		expect(stdout).toMatch(/feature-x\s+\(a worktree of alpha\)/);
	});
});

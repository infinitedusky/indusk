import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
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

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

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

describe.skipIf(SHOULD_SKIP)("A23 — a flat workbench opts in with one command", () => {
	function flatWorkbenchWithWorktrees(): TwoRepoFixture {
		const f = buildTwoRepoWorkbench({ materialize: true });
		// Flat: nothing declared, worktrees at the root — a workbench that
		// predates declared layout.
		expect(runCli(f.workbenchDir, ["worktree", "create", "alpha", "feat-a"]).code).toBe(0);
		expect(runCli(f.workbenchDir, ["worktree", "create", "beta", "feat-b"]).code).toBe(0);
		return f;
	}

	it("moves worktrees under the declared location, and each still works", {
		timeout: 60_000,
	}, () => {
		fixture = flatWorkbenchWithWorktrees();
		const wb = fixture.workbenchDir;

		const r = runCli(wb, ["workbench", "migrate-layout", "--apply"]);
		expect(r.code, r.stderr).toBe(0);

		// Moved…
		expect(existsSync(join(wb, "alpha-worktrees", "feat-a"))).toBe(true);
		expect(existsSync(join(wb, "beta-worktrees", "feat-b"))).toBe(true);
		expect(existsSync(join(wb, "feat-a"))).toBe(false);

		// …and STILL A WORKING WORKTREE. Moving the directory without repairing
		// git's back-reference leaves something that looks right and is broken —
		// which is the only failure mode of this command that matters.
		const st = spawnSync(
			"git",
			["-C", join(wb, "alpha-worktrees", "feat-a"), "status", "--porcelain"],
			{
				encoding: "utf-8",
			},
		);
		expect(st.status, st.stderr).toBe(0);

		// The declaration was written, so the layout is now the config's.
		const cfg = JSON.parse(readFileSync(join(wb, ".indusk", "config.json"), "utf-8"));
		const alpha = cfg.worktree.repos.find((x: { name: string }) => x.name === "alpha");
		expect(alpha.worktrees).toBe("alpha-worktrees");
	});

	it("dry-runs by default, changing nothing", { timeout: 60_000 }, () => {
		fixture = flatWorkbenchWithWorktrees();
		const wb = fixture.workbenchDir;
		const before = readFileSync(join(wb, ".indusk", "config.json"), "utf-8");

		const r = runCli(wb, ["workbench", "migrate-layout"]);

		expect(r.code).toBe(0);
		expect(r.stdout).toMatch(/would move|dry.run/i);
		// A command that relocates directories shows its plan before doing it.
		expect(existsSync(join(wb, "feat-a"))).toBe(true);
		expect(existsSync(join(wb, "alpha-worktrees"))).toBe(false);
		expect(readFileSync(join(wb, ".indusk", "config.json"), "utf-8")).toBe(before);
	});

	it("names what it could not move, moves the rest, and exits non-zero", {
		timeout: 60_000,
	}, () => {
		// A partial migration that exits 0 is the shape this plan has refused
		// throughout: half-done work reported as success.
		fixture = buildTwoRepoWorkbench({ materialize: true });
		const wb = fixture.workbenchDir;
		expect(runCli(wb, ["worktree", "create", "alpha", "movable"]).code).toBe(0);
		expect(runCli(wb, ["worktree", "create", "alpha", "locked-one"]).code).toBe(0);
		spawnSync(
			"git",
			["-C", join(fixture.root, "alpha"), "worktree", "lock", join(wb, "locked-one")],
			{
				encoding: "utf-8",
			},
		);

		const r = runCli(wb, ["workbench", "migrate-layout", "--apply"]);

		expect(r.code).not.toBe(0);
		expect(`${r.stdout}${r.stderr}`).toContain("locked-one");
		// The one that could move, moved; the one that could not, stayed put.
		expect(existsSync(join(wb, "alpha-worktrees", "movable"))).toBe(true);
		expect(existsSync(join(wb, "locked-one"))).toBe(true);
	});

	it("leaves the wrapped repos untouched", { timeout: 60_000 }, () => {
		fixture = flatWorkbenchWithWorktrees();
		const head = (n: string) =>
			spawnSync("git", ["-C", join(fixture.root, n), "rev-parse", "HEAD"], {
				encoding: "utf-8",
			}).stdout.trim();
		const before = { alpha: head("alpha"), beta: head("beta") };

		expect(runCli(fixture.workbenchDir, ["workbench", "migrate-layout", "--apply"]).code).toBe(0);

		// Commit siloing again: this moves worktrees, never product code.
		expect(head("alpha")).toBe(before.alpha);
		expect(head("beta")).toBe(before.beta);
	});
});

describe.skipIf(SHOULD_SKIP)("A26 — never-pushed is not the same as in sync", () => {
	it("reports a repo whose branch was never pushed as unpublished", { timeout: 30_000 }, () => {
		// `rev-list <remote>/<branch>..HEAD` ERRORS when there is no
		// remote-tracking ref, and the error path defaults `ahead` to 0 — so the
		// worst case (nothing has ever left this machine) gets the most
		// reassuring message. That inverts the very skew A16 exists to expose.
		fixture = buildTwoRepoWorkbench({ materialize: true });
		const alpha = join(fixture.root, "alpha");
		// A remote is configured, but this branch has never been pushed to it.
		spawnSync("git", ["-C", alpha, "checkout", "-q", "-b", "never-pushed"], { encoding: "utf-8" });
		writeFileSync(join(alpha, "local-only.ts"), "export const x = 1;\n");
		spawnSync("git", ["-C", alpha, "add", "-A"], { encoding: "utf-8" });
		spawnSync(
			"git",
			["-C", alpha, "-c", "user.email=t@t.l", "-c", "user.name=t", "commit", "-q", "-m", "local"],
			{ encoding: "utf-8" },
		);

		const { stdout } = runCli(fixture.workbenchDir, ["workbench", "status"]);
		const alphaLine = stdout.split("\n").find((l) => l.includes("alpha")) ?? "";

		expect(alphaLine).not.toMatch(/in sync/i);
		expect(alphaLine).toMatch(/never been pushed|no upstream|not published/i);
	});
});

describe.skipIf(SHOULD_SKIP)("A28 — a move never targets its own source", () => {
	it("refuses to move a worktree into itself", { timeout: 60_000 }, () => {
		// `dest = <owner>-worktrees` and only repoDir is excluded from the loose
		// set, so a worktree already NAMED `alpha-worktrees` gets a destination
		// inside itself.
		fixture = buildTwoRepoWorkbench({ materialize: true });
		const wb = fixture.workbenchDir;
		expect(runCli(wb, ["worktree", "create", "alpha", "alpha-worktrees"]).code).toBe(0);
		expect(runCli(wb, ["worktree", "create", "alpha", "ordinary"]).code).toBe(0);

		// The DRY RUN is where this must surface. git does refuse the move, so
		// nothing ends up nested — but planning an impossible move and then
		// failing on `fatal: ... Invalid argument` mid-apply tells the reader
		// nothing. The original hypothesis (silent self-nesting) was wrong; this
		// is the real residue.
		const plan = runCli(wb, ["workbench", "migrate-layout"]);
		expect(plan.stdout).not.toContain("alpha-worktrees/alpha-worktrees");
		expect(plan.stdout).toMatch(/cannot move|inside itself|skipped/i);

		const applied = runCli(wb, ["workbench", "migrate-layout", "--apply"]);
		// Apply must not die on the move it cannot make, and the reader running
		// `--apply` must see the same skip the dry run showed them — otherwise
		// the one place the skip matters is the one place it is invisible.
		expect(applied.code, applied.stderr).toBe(0);
		expect(applied.stdout).toMatch(/cannot move|inside itself|skipped/i);
		// Never nested inside itself, and the one that CAN move still does.
		expect(existsSync(join(wb, "alpha-worktrees", "alpha-worktrees"))).toBe(false);
		expect(existsSync(join(wb, "alpha-worktrees", "ordinary"))).toBe(true);
	});
});

describe.skipIf(SHOULD_SKIP)("A29 — status resolves by declared path", () => {
	it("finds a repo at its declared path, not at its name", { timeout: 30_000 }, () => {
		// Every other consumer uses repoDir(); status alone used repo.name, so a
		// repo with a declared `path` reported "not materialized" while
		// `worktree list` found it fine. Phase 8's own rule, missed in one place.
		fixture = buildTwoRepoWorkbench({ materialize: true });
		const wb = fixture.workbenchDir;
		renameSync(join(fixture.root, "alpha"), join(fixture.root, "alpha-elsewhere"));
		renameSync(join(wb, "alpha"), join(wb, "alpha-elsewhere"));
		declare(wb, { alpha: { path: "alpha-elsewhere" } });

		const { stdout } = runCli(wb, ["workbench", "status"]);
		const alphaLine = stdout.split("\n").find((l) => l.includes("alpha")) ?? "";

		expect(alphaLine).not.toMatch(/not materialized/i);
	});
});

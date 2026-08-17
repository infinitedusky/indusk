import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A13 / A14 — a workbench that wraps more than one repo.
 *
 * Both rows are authored against `worktree.repos[]`, which nothing reads
 * today: the singular `worktree.wrapped_repo` is the only shape the CLI
 * knows. That makes these honestly red — `worktree list` refuses the fixture
 * outright ("this project is not a workbench") because the field it looks for
 * is absent, and `worktree create` has no repo argument to give.
 *
 * Deliberately driven through the built CLI rather than by importing the
 * command functions. A test that imports its subject cannot go red before the
 * subject exists — module resolution precedes collection — and the point of
 * authoring now is a red that means something.
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

describe.skipIf(SHOULD_SKIP)("A13 — both declared repos present as trunks", () => {
	it("lists every declared repo, each with its own worktrees", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ materialize: true });

		const { code, stdout } = runCli(fixture.workbenchDir, ["worktree", "list"]);

		expect(code).toBe(0);
		for (const name of fixture.repoNames) {
			expect(stdout).toContain(name);
		}
	});

	it("attributes each repo's worktrees to that repo, not to the other", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ materialize: true });

		// A worktree of `alpha` only. `beta` has none — so a reader must be
		// able to tell that apart from "both have one", which is exactly what
		// a single-trunk renderer cannot express.
		const created = runCli(fixture.workbenchDir, ["worktree", "create", "alpha", "alpha-feature"]);
		expect(created.code).toBe(0);

		const { stdout } = runCli(fixture.workbenchDir, ["worktree", "list"]);

		const alphaSection = stdout.slice(stdout.indexOf("alpha"), stdout.indexOf("beta"));
		expect(alphaSection).toContain("alpha-feature");
		expect(stdout.slice(stdout.indexOf("beta"))).not.toContain("alpha-feature");
	});
});

describe.skipIf(SHOULD_SKIP)("A14 — creating a worktree names its repo", () => {
	it("creates the worktree in the repo the developer named", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ materialize: true });

		const { code } = runCli(fixture.workbenchDir, ["worktree", "create", "beta", "beta-feature"]);

		expect(code).toBe(0);
		// The worktree is a checkout of `beta`, so beta's README travels with it
		// and alpha's does not. Asserting on content rather than on the directory
		// existing is what separates "made a worktree" from "made it from the
		// right repo" — the failure this row exists to catch.
		const wt = join(fixture.workbenchDir, "beta-feature");
		expect(existsSync(join(wt, "README.md"))).toBe(true);
		expect(
			spawnSync("git", ["-C", wt, "remote", "get-url", "origin"], { encoding: "utf-8" }).stdout,
		).toContain("beta");
	});

	it("refuses ambiguity by listing the declared repos", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ materialize: true });

		// No repo named, two declared: picking one silently is the failure. The
		// refusal has to name what it could not choose between, or the developer
		// has no way to act on it.
		const { code, stderr } = runCli(fixture.workbenchDir, ["worktree", "create", "some-feature"]);

		expect(code).not.toBe(0);
		for (const name of fixture.repoNames) {
			expect(stderr).toContain(name);
		}
	});

	it("does not require the repo argument when only one is declared", { timeout: 30_000 }, () => {
		// The reduction: a single-repo workbench must keep working untouched,
		// which is the whole backward-compatibility claim. A claim about it is
		// worth nothing; this is the check.
		fixture = buildTwoRepoWorkbench({ materialize: true, omitRemoteFor: "beta" });

		const { code } = runCli(fixture.workbenchDir, ["worktree", "create", "alpha", "solo-feature"]);
		expect(code).toBe(0);
	});
});

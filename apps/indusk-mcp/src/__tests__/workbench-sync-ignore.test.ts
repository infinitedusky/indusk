import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A8 — machine-specific residue never reaches the shared remote.
 *
 * INVERTED-FIXTURE TRAP. Run against a workbench root that is not a git repo,
 * this row passes trivially: nothing can leak into a remote that does not
 * exist. It is only meaningful against `gitInitWorkbench: true`, where the
 * root really is a repo with a real remote and the only thing standing between
 * a trunk symlink and the shared history is an ignore file that does not exist
 * yet. Anyone re-authoring this must keep the git-init, or they will pin the
 * accident instead of the guarantee.
 *
 * The ignore shape has to be a WHITELIST rather than a blacklist, and the
 * unpredicted-worktree case below is why: worktree directories appear at the
 * workbench root with names nobody listed in advance, so a deny-list is always
 * one `worktree create` behind.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

function git(cwd: string, args: string[]): { code: number; stdout: string } {
	const r = spawnSync("git", args, {
		cwd,
		encoding: "utf-8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "test@test.local",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "test@test.local",
		},
	});
	return { code: r.status ?? -1, stdout: r.stdout };
}

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe.skipIf(SHOULD_SKIP)("A8 — residue stays out of the shared remote", () => {
	it("keeps trunk symlinks, worktrees, and env out of the remote", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
		const wb = fixture.workbenchDir;

		// The PRODUCT writes the ignore rules, not the fixture. A fixture-written
		// .gitignore would make this test verify its own setup — the trap A15
		// and A17 both fell into earlier in this plan.
		expect(runCli(wb, ["workbench", "restore"]).code).toBe(0);

		// The four residue classes named in the ADR, all present on disk.
		mkdirSync(join(wb, ".indusk", "extensions", "doppler"), { recursive: true });
		writeFileSync(join(wb, ".indusk", "extensions", "doppler", ".env"), "DOPPLER_TOKEN=secret\n");
		mkdirSync(join(wb, "some-worktree"), { recursive: true });
		writeFileSync(join(wb, "some-worktree", "file.ts"), "export const x = 1;\n");
		writeFileSync(join(wb, ".env.local"), "SECRET=nope\n");

		git(wb, ["add", "-A"]);
		git(wb, ["commit", "-q", "-m", "sync"]);
		git(wb, ["push", "-q", "origin", "main"]);

		const tracked = git(wb, ["ls-tree", "-r", "--name-only", "HEAD"]).stdout;

		expect(tracked).not.toContain("doppler/.env");
		expect(tracked).not.toMatch(/^some-worktree\//m);
		expect(tracked).not.toContain(".env.local");
		// The trunk symlinks are the fixture's declared repo names at the root.
		for (const name of fixture.repoNames) {
			expect(tracked).not.toMatch(new RegExp(`^${name}(/|$)`, "m"));
		}
		// …while the context that is supposed to travel actually does. A test
		// that only asserts absence passes just as well against an ignore file
		// that excludes everything.
		expect(tracked).toContain(".indusk/planning/sample-plan/brief.md");
	});

	it("ignores a worktree directory nobody listed in advance", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
		const wb = fixture.workbenchDir;
		expect(runCli(wb, ["workbench", "restore"]).code).toBe(0);

		// The whole case for a whitelist: this name is invented at runtime, so
		// no deny-list could have contained it.
		const unpredicted = join(wb, "feature-nobody-predicted-2026");
		mkdirSync(unpredicted, { recursive: true });
		writeFileSync(join(unpredicted, "code.ts"), "export const y = 2;\n");

		const status = git(wb, ["status", "--porcelain", "--untracked-files=all"]).stdout;
		expect(status).not.toContain("feature-nobody-predicted-2026");
	});
});

/** Rewrite declared repo entries — the only way layout is expressed. */
function declareLayout(workbenchDir: string, edits: Record<string, { worktrees?: string }>): void {
	const cfgPath = join(workbenchDir, ".indusk", "config.json");
	const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
	for (const repo of cfg.worktree.repos as Array<{ name: string; [k: string]: unknown }>) {
		const edit = edits[repo.name];
		if (edit) Object.assign(repo, edit);
	}
	writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

describe.skipIf(SHOULD_SKIP)("A21 — declared locations make the ignore rule precise", () => {
	it("needs no deny-by-default rule, and appends cleanly to a hand-written file", {
		timeout: 30_000,
	}, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
		const wb = fixture.workbenchDir;
		declareLayout(wb, { alpha: { worktrees: "alpha-wt" }, beta: { worktrees: "beta-wt" } });

		// A hand-written ignore file with its own meaning. Appending to it must
		// not invert that meaning — which is exactly what `/*/` plus an
		// allow-list would do to somebody else's decisions.
		writeFileSync(join(wb, ".gitignore"), "# mine\n*.log\nbuild/\n");

		expect(runCli(wb, ["workbench", "restore"]).code).toBe(0);

		const body = readFileSync(join(wb, ".gitignore"), "utf-8");
		expect(body).toContain("# mine");
		expect(body).toContain("*.log");
		// Precise lines, one per declared location — not a whole-root denial.
		expect(body).toContain("/alpha-wt/");
		expect(body).toContain("/beta-wt/");
		expect(body).not.toMatch(/^\/\*\/?$/m);

		// And it actually works: a worktree in a declared location stays out.
		expect(runCli(wb, ["worktree", "create", "alpha", "feat"]).code).toBe(0);
		git(wb, ["add", "-A"]);
		git(wb, ["commit", "-q", "-m", "work"]);
		expect(git(wb, ["ls-tree", "-r", "--name-only", "HEAD"]).stdout).not.toContain("alpha-wt/");
	});
});

describe.skipIf(SHOULD_SKIP)(
	"A22 — a flat workbench that cannot carry the contract is refused",
	() => {
		it("refuses by name rather than committing worktree contents", { timeout: 30_000 }, () => {
			// The Phase 7 finding, from a real workbench: scaffolding only TOPS UP
			// an existing .gitignore, so one that predates this plan never receives
			// the deny-by-default rule and sync commits worktree contents.
			fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
			const wb = fixture.workbenchDir;
			writeFileSync(join(wb, ".gitignore"), "# pre-existing, no root rule\n.env\n");
			mkdirSync(join(wb, "some-worktree"), { recursive: true });
			writeFileSync(join(wb, "some-worktree", "code.ts"), "export const x = 1;\n");

			const r = runCli(wb, ["workbench", "sync"]);

			expect(r.code).not.toBe(0);
			const out = `${r.stdout}${r.stderr}`;
			// Name what is missing and what it protects — a refusal a reader cannot
			// act on is just a blocked command.
			expect(out).toMatch(/gitignore/i);
			expect(out).toMatch(/\/\*\//);
			// And the worktree did NOT reach the remote.
			expect(git(wb, ["ls-tree", "-r", "--name-only", "HEAD"]).stdout).not.toContain(
				"some-worktree/",
			);
		});

		it("proceeds when the developer explicitly overrides", { timeout: 30_000 }, () => {
			// A refusal with no way past it becomes a reason to stop using the tool.
			fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
			const wb = fixture.workbenchDir;
			writeFileSync(join(wb, ".gitignore"), "# pre-existing, no root rule\n.env\n");

			expect(runCli(wb, ["workbench", "sync", "--no-ignore-check"]).code).toBe(0);
		});
	},
);

describe.skipIf(SHOULD_SKIP)("a freshly created workbench can sync", () => {
	it("tops up an InDusk-managed .gitignore instead of refusing it", { timeout: 30_000 }, () => {
		// Found by running `indusk setup` and then `workbench sync`: init
		// scaffolds a `.gitignore`, so EVERY newly created workbench tripped the
		// Phase 10 refusal and could not sync at all. A guard that blocks the
		// product's own output is a bug, not a guard — and no fixture caught it,
		// because fixtures ship no ignore file.
		//
		// The line is provenance: InDusk wrote the file, so InDusk may extend it.
		// A file a human wrote is still refused.
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
		const wb = fixture.workbenchDir;
		writeFileSync(join(wb, ".gitignore"), "\n# InDusk managed\n.mcp.json\n.indusk/eval/\n");

		const r = runCli(wb, ["workbench", "sync"]);

		expect(r.code, r.stderr).toBe(0);
		const body = readFileSync(join(wb, ".gitignore"), "utf-8");
		expect(body).toContain(".mcp.json"); // their rules survive
		expect(body).toMatch(/^\/\*\/$/m); // ours were added
	});

	it("still refuses a .gitignore InDusk did not write", { timeout: 30_000 }, () => {
		// The paired negative: without it, "top up everything" would pass the
		// test above and look correct.
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
		const wb = fixture.workbenchDir;
		writeFileSync(join(wb, ".gitignore"), "# hand-written by a person\n*.log\n");

		expect(runCli(wb, ["workbench", "sync"]).code).not.toBe(0);
		expect(readFileSync(join(wb, ".gitignore"), "utf-8")).not.toMatch(/^\/\*\/$/m);
	});
});

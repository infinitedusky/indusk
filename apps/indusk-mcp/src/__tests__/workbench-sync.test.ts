import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A3 / A2 / A16 — the sync loop's observable contract.
 *
 * DESIGN NOTE, flagged rather than buried: the ADR settles what sync
 * guarantees (any change commits, nobody types git) but deliberately leaves
 * the trigger open — a watcher, or the existing mutation chokepoints. A test
 * has to name a surface to cross a boundary at all, so these author against
 * `indusk workbench sync` as the explicit sync point and `indusk workbench
 * status` as the reporting surface. If the implementation later makes syncing
 * automatic, the explicit sync point still has to exist for a developer who
 * wants to force one — so naming it here does not foreclose the watcher.
 *
 * Red today on "unknown command": the `workbench` group does not exist.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

function git(cwd: string, args: string[]): string {
	return spawnSync("git", args, {
		cwd,
		encoding: "utf-8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "test",
			GIT_AUTHOR_EMAIL: "test@test.local",
			GIT_COMMITTER_NAME: "test",
			GIT_COMMITTER_EMAIL: "test@test.local",
		},
	}).stdout;
}

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe.skipIf(SHOULD_SKIP)("A3 — every change commits itself", () => {
	it("commits an edit with a timestamp-style message, unprompted", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });
		const wb = fixture.workbenchDir;

		writeFileSync(join(wb, ".indusk", "planning", "sample-plan", "notes.md"), "a thought\n");

		const { code } = runCli(wb, ["workbench", "sync"]);
		expect(code).toBe(0);

		// Nothing left uncommitted — "any change commits" is the contract, and a
		// dirty tree is the thing that blocks the other machine's next pull.
		expect(git(wb, ["status", "--porcelain"]).trim()).toBe("");
		// The message is a sync log entry, not a narrative — it just has to be
		// machine-recognizable and unprompted.
		expect(git(wb, ["log", "-1", "--pretty=%s"])).toMatch(/\d{4}-\d{2}-\d{2}|sync/i);
	});
});

describe.skipIf(SHOULD_SKIP)("A2 — a change reaches the other workbench", () => {
	it("arrives after the second workbench's next sync, with no git typed", {
		timeout: 30_000,
	}, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });
		const machineB = join(fixture.root, "machine-b");
		fixture.cloneWorkbenchTo(machineB);

		writeFileSync(
			join(fixture.workbenchDir, ".indusk", "planning", "sample-plan", "decision.md"),
			"we chose the boring option\n",
		);
		expect(runCli(fixture.workbenchDir, ["workbench", "sync"]).code).toBe(0);

		expect(runCli(machineB, ["workbench", "sync"]).code).toBe(0);

		const arrived = join(machineB, ".indusk", "planning", "sample-plan", "decision.md");
		expect(existsSync(arrived)).toBe(true);
		expect(readFileSync(arrived, "utf-8")).toContain("boring option");
	});
});

describe.skipIf(SHOULD_SKIP)("A16 — the two-clock skew is visible", () => {
	it("distinguishes a phase whose code arrived from one whose has not", { timeout: 30_000 }, () => {
		// Plan documents auto-push in seconds; the code they describe pushes
		// when its author decides. A developer who pulls a phase marked
		// complete must be able to tell that the commits behind it have not
		// reached them — otherwise "done" and "present" silently diverge and
		// the plan is the faster of the two.
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true, materialize: true });
		const wb = fixture.workbenchDir;

		// Local work in the wrapped repo that has NOT been pushed.
		const codeRepo = join(fixture.root, "alpha");
		writeFileSync(join(codeRepo, "unpushed.ts"), "export const x = 1;\n");
		git(codeRepo, ["add", "-A"]);
		git(codeRepo, ["commit", "-q", "-m", "work the other machine cannot see"]);

		const { code, stdout } = runCli(wb, ["workbench", "status"]);

		expect(code).toBe(0);
		// It has to name the repo and say it is ahead of its remote. "Some
		// repos are out of sync" is not something a reader can act on.
		expect(stdout).toContain("alpha");
		expect(stdout).toMatch(/ahead|unpushed|not pushed/i);
		// …and it must not say the same thing about the repo that is clean,
		// or the signal is indistinguishable from noise.
		const betaLine = stdout.split("\n").find((l) => l.includes("beta")) ?? "";
		expect(betaLine).not.toMatch(/ahead|unpushed|not pushed/i);
	});
});

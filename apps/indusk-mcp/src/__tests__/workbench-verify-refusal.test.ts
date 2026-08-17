import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A17 — verification never reports phantom on a diff that could not have
 * contained the code.
 *
 * THE SHARPEST INVERTED-FIXTURE TRAP IN THIS PLAN. Against today's shape this
 * assertion PASSES, and for entirely the wrong reason: `assertGitRepo` refuses
 * to run verify on a workbench root because that root is not a git repo, so no
 * detector ever executes and nothing is ever reported. The guarantee looks
 * intact because the machinery never started.
 *
 * This plan makes the workbench root a git repo. That removes the refusal by
 * accident rather than by decision, and what is left is a repo whose diff
 * STRUCTURALLY cannot contain the code being checked — plan documents live in
 * the workbench repo, code lives across a symlink in the wrapped repo. Phantom
 * detection fires when nothing outside `impl.md` and machine state changed,
 * which in a workbench is always. Every honestly-checked item would be
 * reported phantom, and a detector that cries wolf gets switched off, taking
 * its real catches with it.
 *
 * So the fixture git-inits the root. That is what makes the row red now and
 * meaningful later. Re-author it without the git-init and you pin the
 * accident.
 *
 * Either outcome satisfies the assertion — check the code's repo, or refuse
 * and say which repo could not be identified. What must never happen is a
 * confident phantom finding about work that was really done.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

function git(cwd: string, args: string[]): void {
	spawnSync("git", args, {
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
}

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/**
 * Fail loudly when verify never got as far as a detector.
 *
 * Authoring this row without the guard produced a PASSING test on the first
 * run, for a reason nobody had predicted: verify aborted at "Gate scripts not
 * found" and the assertion — output contains no "phantom" — was trivially
 * satisfied by an error message about something else entirely. A row that
 * cannot distinguish "the detector ran and stayed quiet" from "the detector
 * never started" asserts nothing at all.
 */
function assertVerifyActuallyRan(out: string): void {
	const preconditionFailures = [
		"Gate scripts not found",
		"is not a git repository",
		"no such plan",
		"Cannot find module",
	];
	for (const marker of preconditionFailures) {
		if (out.includes(marker)) {
			throw new Error(
				`verify aborted before running any detector (${marker}). This row asserts what the detectors conclude, so a precondition failure is an inconclusive run, not a pass. Full output:\n${out}`,
			);
		}
	}
}

const PLAN = "sample-plan";

function implDoc(itemChecked: boolean): string {
	const box = itemChecked ? "x" : " ";
	return `---
title: "Sample"
status: in-progress
trajectory: required
gate_policy: auto
---

# Sample

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | the module exports a greeting | Phase 1 | Phase 1 | passing |

## Checklist

### Phase 1: Build the thing

- [${box}] Add the greeting module to the wrapped repo

#### Phase 1 Verification
- [${box}] T1 passes
`;
}

describe.skipIf(SHOULD_SKIP)("A17 — no phantom finding for code in another repo", () => {
	it("does not call honestly-done work phantom when the code lives in the wrapped repo", {
		timeout: 30_000,
	}, () => {
		fixture = buildTwoRepoWorkbench({
			gitInitWorkbench: true,
			materialize: true,
			installGateScripts: true,
		});
		const wb = fixture.workbenchDir;
		const planDir = join(wb, ".indusk", "planning", PLAN);
		mkdirSync(planDir, { recursive: true });

		// Baseline: the plan exists, nothing is checked off yet.
		writeFileSync(join(planDir, "impl.md"), implDoc(false));
		git(wb, ["add", "-A"]);
		git(wb, ["commit", "-q", "-m", "plan baseline"]);

		// Real work, in the repo where code actually lives.
		const codeRepo = join(fixture.root, "alpha");
		writeFileSync(join(codeRepo, "greeting.ts"), "export const greeting = 'hello';\n");
		git(codeRepo, ["add", "-A"]);
		git(codeRepo, ["commit", "-q", "-m", "add greeting module"]);

		// The checkoff, in the repo where plans actually live.
		writeFileSync(join(planDir, "impl.md"), implDoc(true));
		git(wb, ["add", "-A"]);
		git(wb, ["commit", "-q", "-m", "check off phase 1"]);

		const { stdout, stderr } = runCli(wb, ["verify", PLAN, "--phase", "1"]);
		const out = `${stdout}${stderr}`;

		assertVerifyActuallyRan(out);

		// The failure this row exists to prevent: a confident phantom verdict
		// about work that was genuinely done, just not in this repo.
		expect(out.toLowerCase()).not.toContain("phantom");

		// And it must not have reached that conclusion by silently doing
		// nothing either — a refusal is acceptable, silence is not.
		expect(out.trim().length).toBeGreaterThan(0);
	});

	it("names the repo it could not identify when it refuses", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({
			gitInitWorkbench: true,
			materialize: true,
			installGateScripts: true,
			planImpl: implDoc(false),
		});
		const wb = fixture.workbenchDir;
		const planDir = join(wb, ".indusk", "planning", PLAN);
		writeFileSync(join(planDir, "impl.md"), implDoc(true));
		git(wb, ["add", "-A"]);
		git(wb, ["commit", "-q", "-m", "check off with no code anywhere"]);

		const { stdout, stderr } = runCli(wb, ["verify", PLAN, "--phase", "1"]);
		const out = `${stdout}${stderr}`;

		assertVerifyActuallyRan(out);

		// Two declared repos and no way to tell which holds this plan's code.
		// Guessing is the one unacceptable answer; a refusal has to be
		// actionable, which means naming the candidates.
		const refused = /refus|cannot determine|could not determine|ambiguous/i.test(out);
		const checkedTheRightRepo = !/phantom/i.test(out);
		expect(refused || checkedTheRightRepo).toBe(true);
		if (refused) {
			for (const name of fixture.repoNames) {
				expect(out).toContain(name);
			}
		}
	});
});

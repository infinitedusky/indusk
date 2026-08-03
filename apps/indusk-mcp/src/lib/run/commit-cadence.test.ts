import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixtureDir, guineaPigHappyPathSteps, realGateScripts } from "./harness.test-support.js";
import { runLoop } from "./loop.js";

/**
 * A2 + A5 (dawn-hook-parity) — loop-owned per-item commit cadence.
 *
 * A2: a thin-lane run leaves one git commit per completed checklist item,
 * each message naming its item. Red at authoring: the loop never commits.
 *
 * A5: a commit that fails (here: rejected by a pre-commit hook — deterministic
 * regardless of machine git config) is surfaced loudly and adds nothing
 * downstream. Red at authoring: no commit machinery exists, so no failure is
 * ever surfaced.
 */

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
	const { stdout } = await execFileAsync("git", args, { cwd });
	return stdout;
}

async function makeGitFixtureWorktree(prefix: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
	await cp(fixtureDir, root, { recursive: true });
	await git(root, "init");
	await git(root, "config", "user.email", "dawn@test.local");
	await git(root, "config", "user.name", "Dawn Test");
	await git(root, "add", "-A");
	await git(root, "commit", "-m", "fixture baseline");
	return root;
}

describe("A2 — one commit per completed checklist item", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await makeGitFixtureWorktree("dawn-cadence-a2");
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("commits each checkoff with a message naming its item", async () => {
		const impl = await readFile(join(worktree, "impl.md"), "utf8");
		const model = new MockLanguageModelV4({
			doGenerate: guineaPigHappyPathSteps(impl, { itemwiseCheckoffs: true }),
		});

		const result = await runLoop({ worktree, model, gate: { scripts: realGateScripts } });
		expect(result.status).toBe("complete");

		const log = await git(worktree, "log", "--format=%s", "HEAD");
		const commits = log.trim().split("\n").filter(Boolean);
		// Fixture baseline + one commit per checkoff event: 4 impl items + 1
		// verification item, each checked in its own edit step.
		const itemCommits = commits.filter((m) => m !== "fixture baseline");
		expect(itemCommits).toHaveLength(5);

		// Messages name their items — spot-check the distinctive fragments.
		const joined = itemCommits.join("\n");
		expect(joined).toContain("parse");
		expect(joined).toContain("CLI wrapper");
		expect(joined).toMatch(/vitest|green|Verification|T1/i);

		// Every work-product change is committed at run end. The run's own eval
		// bookkeeping (`.indusk/eval/`) is deliberately excluded from staging —
		// it is machine state written after each commit, not plan history — so
		// it is the only thing allowed to remain dirty.
		// `-uall` so untracked files list individually — plain --porcelain
		// collapses them to `?? .indusk/`, which would let unrelated stray
		// files hide behind the eval-state exemption.
		const status = await git(worktree, "status", "--porcelain", "-uall");
		const dirty = status
			.split("\n")
			.filter((l) => l.trim())
			.filter((l) => !l.includes(".indusk/eval/"));
		expect(dirty).toEqual([]);
	}, 30_000);
});

describe("A5 — a failed commit is loud and enqueues nothing", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await makeGitFixtureWorktree("dawn-cadence-a5");
		// Deterministic commit failure: a pre-commit hook that always rejects.
		const hookDir = join(worktree, ".git", "hooks");
		await mkdir(hookDir, { recursive: true });
		const hookPath = join(hookDir, "pre-commit");
		await writeFile(hookPath, "#!/bin/sh\necho 'rejected by test pre-commit hook' >&2\nexit 1\n");
		await chmod(hookPath, 0o755);
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("surfaces the git error, completes the run, and records no commits", async () => {
		const impl = await readFile(join(worktree, "impl.md"), "utf8");
		const model = new MockLanguageModelV4({
			doGenerate: guineaPigHappyPathSteps(impl, { itemwiseCheckoffs: true }),
		});

		const result = await runLoop({ worktree, model, gate: { scripts: realGateScripts } });

		// Commit failure is bookkeeping, not a gate: the run still completes.
		expect(result.status).toBe("complete");
		if (result.status !== "complete") return;

		// The failure is surfaced loudly on the phase report.
		const report = result.phases[0] as { commitFailures?: string[] };
		expect(report.commitFailures ?? []).not.toHaveLength(0);
		expect((report.commitFailures ?? []).join("\n")).toContain("rejected by test pre-commit hook");

		// No commit landed beyond the baseline.
		const log = await git(worktree, "log", "--format=%s", "HEAD");
		const commits = log.trim().split("\n").filter(Boolean);
		expect(commits).toEqual(["fixture baseline"]);

		// Nothing was enqueued for eval — the queue stays absent/empty (A5's
		// no-enqueue half; re-asserted with the queue module in Phase 3).
		const pendingPath = join(worktree, ".indusk", "eval", "pending.jsonl");
		const pending = await readFile(pendingPath, "utf8").catch(() => "");
		expect(pending.trim()).toBe("");
	}, 30_000);
});

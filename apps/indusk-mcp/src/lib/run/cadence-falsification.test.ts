import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	finishStep,
	fixtureDir,
	guineaPigHappyPathSteps,
	phase1ImplItems,
	realGateScripts,
	toolCallStep,
} from "./harness.test-support.js";
import { runLoop } from "./loop.js";

/**
 * A10 + A11 + A13 (dawn-hook-parity Phase 5, falsification) — the commit
 * cadence's history guarantees under conditions Phase 2's tests never hit.
 *
 * A10: a model that checks several items in ONE edit. `newlyCheckedItem`
 * returns only the first, so today the other items' work rides along inside a
 * commit that never names them — A2's claim is false off the itemwise path.
 *
 * A11: a failed commit followed by a successful one. Today the next commit
 * silently absorbs the failed item's work while naming only the later item.
 *
 * The original hypothesis ("unstage and the next commit contains only its own
 * work") was REFUTED while fixing it: `git reset` unstages, but the failed
 * item's change is still in the WORKING TREE — it was never committed, so the
 * next commit necessarily contains it, and un-writing it would destroy real
 * work. The defect is misattribution, not staging, so the assertion below
 * pins the achievable invariant: whatever a commit contains, its message
 * accounts for. (Recorded in the plan's Phase 5 notes.)
 *
 * A13: a commit that lands while the queue append throws. The append shares
 * the git calls' try block, so today the landed commit is reported as a
 * commit FAILURE and its sha is dropped from `commits[]`.
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

describe("A10 — a multi-item checkoff accounts for every item", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await makeGitFixtureWorktree("dawn-falsify-a10");
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("names every item checked in a single edit, not just the first", async () => {
		const impl = await readFile(join(worktree, "impl.md"), "utf8");
		// The batched path: ONE edit checks off all four Phase 1 impl items.
		const model = new MockLanguageModelV4({
			doGenerate: guineaPigHappyPathSteps(impl, { itemwiseCheckoffs: false }),
		});

		const result = await runLoop({ worktree, model, gate: { scripts: realGateScripts } });
		expect(result.status).toBe("complete");

		const items = phase1ImplItems(impl).map((l) => l.replace(/^- \[ \]\s*/, "").trim());
		expect(items.length).toBeGreaterThan(1); // fixture sanity: batching is meaningful

		const log = await git(worktree, "log", "--format=%s%n%b", "HEAD");

		// Every item checked in that edit must be accounted for in the history
		// the run left behind — no item's work silently absorbed and unnamed.
		// Distinctive fragments, one per fixture item.
		for (const fragment of ["parse(", "compare(", "bump(", "CLI wrapper"]) {
			expect(log, `history does not account for the item containing "${fragment}"`).toContain(
				fragment,
			);
		}
	}, 30_000);
});

describe("A11 — a failed commit does not poison the next one", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await makeGitFixtureWorktree("dawn-falsify-a11");
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("names the failed attempt's item in the commit that actually carries it", async () => {
		// A pre-commit hook that rejects exactly ONCE — so a failed commit is
		// followed by a successful one (A5's always-reject hook can never
		// produce this sequence, which is why it missed the bug).
		const hookDir = join(worktree, ".git", "hooks");
		await mkdir(hookDir, { recursive: true });
		const hookPath = join(hookDir, "pre-commit");
		await writeFile(
			hookPath,
			[
				"#!/bin/sh",
				'MARKER="$(git rev-parse --git-dir)/reject-once-fired"',
				'if [ ! -f "$MARKER" ]; then',
				'  touch "$MARKER"',
				"  echo 'rejected once by test hook' >&2",
				"  exit 1",
				"fi",
				"exit 0",
			].join("\n"),
		);
		await chmod(hookPath, 0o755);

		const impl = await readFile(join(worktree, "impl.md"), "utf8");
		const model = new MockLanguageModelV4({
			doGenerate: guineaPigHappyPathSteps(impl, { itemwiseCheckoffs: true }),
		});

		const result = await runLoop({ worktree, model, gate: { scripts: realGateScripts } });
		expect(result.status).toBe("complete");
		if (result.status !== "complete") return;

		// The first commit attempt failed; the ones after it succeeded.
		const report = result.phases[0] as { commitFailures?: string[] };
		expect(report.commitFailures ?? []).not.toHaveLength(0);

		// The first SUCCESSFUL commit carries the rejected attempt's work (it
		// was never committed, and destroying it would be worse) — so its
		// message MUST account for every checkoff it contains. Anything less
		// is history that lies.
		const firstSuccessSha = (await git(worktree, "log", "--format=%H", "HEAD"))
			.trim()
			.split("\n")
			.filter(Boolean)
			.at(-2); // -1 is the fixture baseline
		expect(firstSuccessSha).toBeTruthy();

		const sha = String(firstSuccessSha);
		const implDiff = await git(worktree, "show", "--format=", "-U0", sha);
		const carriedCheckoffs = implDiff
			.split("\n")
			.filter((l) => l.startsWith("+- [x]"))
			.map((l) => l.replace(/^\+- \[x\]\s*/, "").trim());
		expect(carriedCheckoffs.length).toBeGreaterThan(1); // the poisoning condition

		const message = await git(worktree, "show", "--format=%s%n%b", "--no-patch", sha);
		for (const checkoff of carriedCheckoffs) {
			// A distinctive fragment of each carried item must appear.
			const fragment = checkoff.slice(0, 24).replace(/[`*]/g, "");
			expect(
				message.replace(/[`*]/g, ""),
				`commit ${sha.slice(0, 8)} carries an item its message never names: "${fragment}"`,
			).toContain(fragment);
		}
	}, 30_000);
});

describe("A13 — a landed commit whose queue append fails is still reported as landed", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await makeGitFixtureWorktree("dawn-falsify-a13");
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("keeps the sha in commits[] and does not call it a commit failure", async () => {
		// Make the queue append fail: `.indusk/eval` exists as a FILE, so
		// mkdir/appendFile throw. The commits themselves are unaffected.
		await mkdir(join(worktree, ".indusk"), { recursive: true });
		await writeFile(join(worktree, ".indusk", "eval"), "not a directory\n");

		const impl = await readFile(join(worktree, "impl.md"), "utf8");
		const model = new MockLanguageModelV4({
			doGenerate: guineaPigHappyPathSteps(impl, { itemwiseCheckoffs: true }),
		});

		const result = await runLoop({ worktree, model, gate: { scripts: realGateScripts } });
		expect(result.status).toBe("complete");
		if (result.status !== "complete") return;

		const report = result.phases[0] as {
			commits?: Array<{ sha: string }>;
			commitFailures?: string[];
		};

		// The commits genuinely landed — git says so.
		const landed = (await git(worktree, "log", "--format=%H", "HEAD"))
			.trim()
			.split("\n")
			.filter(Boolean);
		expect(landed.length).toBeGreaterThan(1); // baseline + item commits

		// …so the report must say so too: shas retained, no commit failures.
		expect(report.commits ?? [], "landed commits were dropped from the report").not.toHaveLength(0);
		expect(
			report.commitFailures ?? [],
			"a queue-append failure was misreported as a commit failure",
		).toHaveLength(0);
	}, 30_000);
});

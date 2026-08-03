import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixtureDir, guineaPigHappyPathSteps, realGateScripts } from "./harness.test-support.js";
import { runLoop } from "./loop.js";

/**
 * A3 + A4 + A9 (dawn-hook-parity) — the pending-eval queue and its drain.
 *
 * A3: after a run, `.indusk/eval/pending.jsonl` holds exactly one record per
 * commit the run made. Red at authoring: no queue exists.
 *
 * A4: draining produces one evaluation per pending record (stubbed evaluator
 * via INDUSK_EVAL_CMD); a second drain produces nothing new. Red at
 * authoring: the drain mode doesn't exist. The stub claude in PATH keeps the
 * red run from ever spawning a real evaluator session.
 *
 * A9: a run with no usable `claude` CLI completes normally and still fills
 * the queue — the lane itself never needs Claude Code installed. Red at
 * authoring via the queue clause (no queue is written today).
 */

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const evalTriggerScript = resolve(here, "../../../hooks/eval-trigger.js");

async function git(cwd: string, ...args: string[]): Promise<string> {
	const { stdout } = await execFileAsync("git", args, { cwd });
	return stdout;
}

interface QueueWorktree {
	root: string;
	/** A PATH prefix whose `claude` is a poison stub touching this marker. */
	poisonBin: string;
	poisonMarker: string;
}

async function makeQueueWorktree(prefix: string): Promise<QueueWorktree> {
	const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
	await cp(fixtureDir, root, { recursive: true });
	// Anchor InDusk state in-tree so the queue resolves here, not an ancestor.
	await mkdir(join(root, ".indusk", "eval"), { recursive: true });
	await writeFile(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ eval: { enabled: true } }),
	);
	await git(root, "init");
	await git(root, "config", "user.email", "dawn@test.local");
	await git(root, "config", "user.name", "Dawn Test");
	await git(root, "add", "-A");
	await git(root, "commit", "-m", "fixture baseline");

	const poisonBin = await mkdtemp(join(tmpdir(), `${prefix}-bin-`));
	const poisonMarker = join(poisonBin, "claude-was-invoked");
	const stub = join(poisonBin, "claude");
	await writeFile(stub, `#!/bin/sh\ntouch "${poisonMarker}"\nexit 0\n`);
	await chmod(stub, 0o755);

	return { root, poisonBin, poisonMarker };
}

async function runHappyPath(root: string): Promise<void> {
	const impl = await readFile(join(root, "impl.md"), "utf8");
	const model = new MockLanguageModelV4({
		doGenerate: guineaPigHappyPathSteps(impl, { itemwiseCheckoffs: true }),
	});
	const result = await runLoop({ worktree: root, model, gate: { scripts: realGateScripts } });
	expect(result.status).toBe("complete");
}

async function readPending(root: string): Promise<Array<Record<string, unknown>>> {
	const raw = await readFile(join(root, ".indusk", "eval", "pending.jsonl"), "utf8").catch(
		() => "",
	);
	return raw
		.split("\n")
		.filter((l) => l.trim())
		.map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe("A3 — the queue holds one record per commit", () => {
	let tree: QueueWorktree;

	beforeEach(async () => {
		tree = await makeQueueWorktree("dawn-queue-a3");
	});

	afterEach(async () => {
		await rm(tree.root, { recursive: true, force: true });
		await rm(tree.poisonBin, { recursive: true, force: true });
	});

	it("appends {sha, plan, phase, source, timestamp} per commit, matching git log", async () => {
		await runHappyPath(tree.root);

		const shas = (await git(tree.root, "log", "--format=%H", "HEAD"))
			.trim()
			.split("\n")
			.filter(Boolean);
		const itemShas = shas.slice(0, -1); // exclude the fixture baseline

		const pending = await readPending(tree.root);
		// Guard against vacuous truth: the run must actually produce commits
		// (A2's machinery) before "one record per commit" means anything.
		expect(pending.length).toBeGreaterThan(0);
		expect(pending).toHaveLength(itemShas.length);
		expect(pending.map((r) => r.sha).sort()).toEqual([...itemShas].sort());
		for (const record of pending) {
			expect(record.source).toBe("atdawn");
			expect(typeof record.timestamp).toBe("string");
			expect(typeof record.phase).toBe("number");
		}
	});
});

describe("A4 — draining is one evaluation per record, exactly once", () => {
	let tree: QueueWorktree;

	beforeEach(async () => {
		tree = await makeQueueWorktree("dawn-queue-a4");
	});

	afterEach(async () => {
		await rm(tree.root, { recursive: true, force: true });
		await rm(tree.poisonBin, { recursive: true, force: true });
	});

	it("drains every pending record through the evaluator once; re-drain is a no-op", async () => {
		await runHappyPath(tree.root);
		const pendingBefore = await readPending(tree.root);
		expect(pendingBefore.length).toBeGreaterThan(0);

		// Stub evaluator: records each invocation as one line in results.log.
		const stubPath = join(tree.root, "stub-eval.mjs");
		await writeFile(
			stubPath,
			[
				'import { appendFileSync } from "node:fs";',
				"const record = { timestamp: new Date().toISOString(), stub: true, args: process.argv.slice(2) };",
				'appendFileSync(".indusk/eval/results.log", JSON.stringify(record) + "\\n");',
			].join("\n"),
		);

		const env = {
			...process.env,
			PATH: `${tree.poisonBin}:${process.env.PATH}`,
			INDUSK_EVAL_CMD: `${process.execPath} ${stubPath}`,
		};

		const drain = () =>
			execFileAsync(process.execPath, ["--no-warnings", evalTriggerScript, "--drain-pending"], {
				cwd: tree.root,
				env,
			});

		await drain();
		const results1 = await readFile(join(tree.root, ".indusk", "eval", "results.log"), "utf8");
		const lines1 = results1.split("\n").filter((l) => l.trim());
		expect(lines1).toHaveLength(pendingBefore.length);

		// Idempotent: a second drain evaluates nothing new.
		await drain();
		const results2 = await readFile(join(tree.root, ".indusk", "eval", "results.log"), "utf8");
		const lines2 = results2.split("\n").filter((l) => l.trim());
		expect(lines2).toHaveLength(pendingBefore.length);
	});
});

describe("A9 — the lane never needs the claude CLI", () => {
	let tree: QueueWorktree;

	beforeEach(async () => {
		tree = await makeQueueWorktree("dawn-queue-a9");
	});

	afterEach(async () => {
		await rm(tree.root, { recursive: true, force: true });
		await rm(tree.poisonBin, { recursive: true, force: true });
	});

	it("completes a run and fills the queue without ever invoking claude", async () => {
		const originalPath = process.env.PATH;
		process.env.PATH = `${tree.poisonBin}:${originalPath}`;
		try {
			await runHappyPath(tree.root);
		} finally {
			process.env.PATH = originalPath;
		}

		// The queue filled (the lane's rail works)…
		const pending = await readPending(tree.root);
		expect(pending.length).toBeGreaterThan(0);

		// …and nothing in the lane ever exec'd claude.
		const invoked = await readFile(tree.poisonMarker, "utf8").then(
			() => true,
			() => false,
		);
		expect(invoked).toBe(false);
	});
});

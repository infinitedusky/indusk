import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * A12 (dawn-hook-parity Phase 5, falsification) — the queue's durability
 * promise must cover evaluator FAILURE, not just crash-safety.
 *
 * The drain appends to the drained ledger before spawning (deliberate: a
 * crashed drain must never double-evaluate) and resolves on `close`
 * regardless of exit code. So today, a drain on a machine where the
 * evaluator cannot run — no `claude`, a broken runner, a bad
 * `INDUSK_EVAL_CMD` — marks every queued record drained, writes no
 * scorecard, and leaves the queue empty. The backlog is silently destroyed
 * and `check_health` goes quiet: exactly the loss the queue exists to
 * prevent.
 *
 * Red at authoring: after the failing drain, nothing is re-drainable and the
 * drain reports no failures.
 */

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const evalTriggerScript = resolve(here, "../../../hooks/eval-trigger.js");

interface DrainFixture {
	root: string;
	shas: string[];
}

async function makeQueueFixture(prefix: string, count: number): Promise<DrainFixture> {
	const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
	await mkdir(join(root, ".indusk", "eval"), { recursive: true });
	await writeFile(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ eval: { enabled: true } }),
	);
	await execFileAsync("git", ["init"], { cwd: root });
	await execFileAsync("git", ["config", "user.email", "dawn@test.local"], { cwd: root });
	await execFileAsync("git", ["config", "user.name", "Dawn Test"], { cwd: root });
	await writeFile(join(root, "seed.txt"), "seed\n");
	await execFileAsync("git", ["add", "-A"], { cwd: root });
	await execFileAsync("git", ["commit", "-m", "seed"], { cwd: root });
	const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
	const head = stdout.trim();

	const shas: string[] = [];
	const lines: string[] = [];
	for (let i = 0; i < count; i++) {
		// Distinct sha-shaped ids so dedup is exercised per record; the real
		// evaluator would resolve them, but this drain never gets that far.
		const sha = `${head.slice(0, 36)}${String(i).padStart(4, "0")}`;
		shas.push(sha);
		lines.push(
			JSON.stringify({
				sha,
				plan: "fixture-plan",
				phase: 1,
				source: "atdawn",
				timestamp: new Date().toISOString(),
			}),
		);
	}
	await writeFile(join(root, ".indusk", "eval", "pending.jsonl"), `${lines.join("\n")}\n`);
	return { root, shas };
}

async function readJsonl(path: string): Promise<Array<Record<string, unknown>>> {
	const raw = await readFile(path, "utf8").catch(() => "");
	return raw
		.split("\n")
		.filter((l) => l.trim())
		.map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe("A12 — a drain whose evaluator always fails does not eat the queue", () => {
	let fixture: DrainFixture;

	beforeEach(async () => {
		fixture = await makeQueueFixture("dawn-falsify-a12", 3);
	});

	afterEach(async () => {
		await rm(fixture.root, { recursive: true, force: true });
	});

	it("reports the failures and leaves every record re-drainable", async () => {
		// An "evaluator" that always fails — the machine-can't-evaluate case.
		const stubPath = join(fixture.root, "failing-eval.mjs");
		await writeFile(stubPath, 'console.error("evaluator unavailable");\nprocess.exit(1);\n');

		const { stderr } = await execFileAsync(
			process.execPath,
			["--no-warnings", evalTriggerScript, "--drain-pending"],
			{
				cwd: fixture.root,
				env: { ...process.env, INDUSK_EVAL_CMD: `${process.execPath} ${stubPath}` },
			},
		);

		// The drain must SAY the evaluations failed — silence here is the bug.
		expect(stderr, "the drain did not report any failure").toMatch(/fail/i);

		// Nothing was evaluated…
		const results = await readFile(join(fixture.root, ".indusk", "eval", "results.log"), "utf8")
			.catch(() => "")
			.then((raw) => raw.split("\n").filter((l) => l.trim()));
		expect(results).toHaveLength(0);

		// …so nothing may be lost: a second drain must still see all 3 records
		// as work to do. (Today they are all marked drained and vanish.)
		const drained = await readJsonl(
			join(fixture.root, ".indusk", "eval", "pending-drained.jsonl"),
		);
		const drainedShas = new Set(drained.map((r) => r.sha as string));
		const stillPending = fixture.shas.filter((sha) => !drainedShas.has(sha));
		expect(
			stillPending,
			"records whose evaluation failed were marked drained — the backlog was destroyed",
		).toHaveLength(fixture.shas.length);
	}, 30_000);
});

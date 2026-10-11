import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	BAD_MODEL_MESSAGE,
	type OtlpCapture,
	startOtlpCapture,
} from "../../__tests__/helpers/otlp-capture.js";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { evalDir } from "../bookkeeping/roots.js";
import { runEvaluatorSync } from "./evaluator-runner.js";
import { __resetEvalOtelForTests } from "./otel.js";
import { runPersistentEval } from "./persistent-evaluator.js";

/**
 * How the evaluator answers a model that refuses for a limit, replies in
 * prose, or fails for any other reason (evaluator-waits-out-limits).
 *
 * A fake `claude` on PATH plays a script of answers, one per call, and logs
 * every call it receives. The evaluator is driven in-process, once through
 * each runner the commit hook can reach (`runPersistentEval`, which the hook
 * uses, and `runEvaluatorSync`), and the promise mark is read at the wire:
 * the OTLP spans the evaluator exported.
 *
 * promise: a-limited-evaluation-waits
 * promise: a-prose-reply-is-asked-again
 * promise: every-commit-evaluated
 */

const PROMISE = "every-commit-evaluated";

const SCORECARD = JSON.stringify({
	version: 1,
	timestamp: "2026-10-10T00:00:00.000Z",
	mode: "eval",
	changeId: "fixture",
	projectGroup: "fixture",
	questions: [],
	summary: "fixture scorecard",
});

interface Answer {
	code: number;
	stdout: string;
}

const scored = (): Answer => ({
	code: 0,
	stdout: JSON.stringify({ result: SCORECARD, session_id: "sess-1", total_cost_usd: 0, usage: {} }),
});
const prose = (text: string): Answer => ({
	code: 0,
	stdout: JSON.stringify({ result: text, session_id: "sess-1", is_error: false }),
});
const refused = (message: string): Answer => ({
	code: 1,
	stdout: JSON.stringify({
		type: "result",
		is_error: true,
		api_error_status: 429,
		result: message,
		session_id: "sess-1",
	}),
});

const RATE_LIMITING = "API Error: Server is temporarily limiting requests (not your usage limit)";
const WEEKLY_LIMIT = "You've hit your weekly limit · resets Oct 13";

let f: Fixture;
let capture: OtlpCapture;
let fakeDir: string;
const saved: Record<string, string | undefined> = {};
const ENV = [
	"PATH",
	"INDUSK_EVAL_OTEL",
	"OTEL_EXPORTER_OTLP_ENDPOINT",
	"INDUSK_EVAL_RATE_LIMIT_DELAY_MS",
];

beforeEach(async () => {
	for (const k of ENV) saved[k] = process.env[k];
	f = makeFixture();
	fakeDir = join(f.home, "bin");
	mkdirSync(fakeDir, { recursive: true });
	capture = await startOtlpCapture();
	process.env.INDUSK_EVAL_OTEL = "1";
	process.env.OTEL_EXPORTER_OTLP_ENDPOINT = capture.endpoint;
	process.env.INDUSK_EVAL_RATE_LIMIT_DELAY_MS = "1";
	__resetEvalOtelForTests();
});

afterEach(async () => {
	for (const k of ENV) {
		if (saved[k] === undefined) delete process.env[k];
		else process.env[k] = saved[k];
	}
	await capture.close();
	f.cleanup();
});

/** Put a `claude` on PATH that answers `answers[n]` to call n (the last one repeats). */
function fakeClaude(answers: Answer[]): { calls: () => { args: string[]; prompt: string }[] } {
	const callsLog = join(f.home, "calls.jsonl");
	const script = join(fakeDir, "claude");
	writeFileSync(
		script,
		`#!${process.execPath}
const fs = require("node:fs");
const answers = ${JSON.stringify(answers)};
const log = ${JSON.stringify(callsLog)};
const done = fs.existsSync(log) ? fs.readFileSync(log, "utf-8").split("\\n").filter(Boolean).length : 0;
const prompt = fs.readFileSync(0, "utf-8");
fs.appendFileSync(log, JSON.stringify({ args: process.argv.slice(2), prompt }) + "\\n");
const a = answers[Math.min(done, answers.length - 1)];
process.stdout.write(a.stdout);
process.exit(a.code);
`,
	);
	chmodSync(script, 0o755);
	process.env.PATH = `${fakeDir}:${saved.PATH}`;
	return {
		calls: () =>
			existsSync(callsLog)
				? readFileSync(callsLog, "utf-8")
						.split("\n")
						.filter(Boolean)
						.map((l) => JSON.parse(l))
				: [],
	};
}

const RUNNERS = [
	["runPersistentEval", runPersistentEval],
	["runEvaluatorSync", runEvaluatorSync],
] as const;

async function evaluate(run: (typeof RUNNERS)[number][1]) {
	const outcome = (await run({
		projectRoot: f.main,
		gitRoot: f.main,
		changeId: "abc1234",
		transcriptPath: join(f.home, "transcript.jsonl"),
		mode: "eval",
	})) as unknown as Record<string, unknown>;
	// The batch processor flushed at shutdown; give the capture a beat to read it.
	await capture.waitForSpans(1, 15_000);
	await new Promise((r) => setTimeout(r, 300));
	const marks = capture.spans().filter((s) => s.attributes["indusk.promise"] === PROMISE);
	const violations = capture
		.spans()
		.filter((s) => s.attributes["indusk.promise.outcome"] === "violated");
	return { outcome, marks, violations };
}

function resultsLog(): Record<string, unknown>[] {
	const path = join(evalDir(f.main), "results.log");
	if (!existsSync(path)) return [];
	return readFileSync(path, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l));
}

function queue(file: string): Record<string, unknown>[] {
	const path = join(evalDir(f.main), file);
	if (!existsSync(path)) return [];
	return readFileSync(path, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l));
}

describe.each(RUNNERS)("%s", (_name, run) => {
	describe.each([
		["rate limiting", RATE_LIMITING],
		["a weekly limit", WEEKLY_LIMIT],
	])("A1 — a model that answers 429 for %s", (_kind, message) => {
		it("marks no violation and leaves the commit waiting, logged as waiting rather than as an error", async () => {
			fakeClaude([refused(message)]);
			const { outcome, violations } = await evaluate(run);

			expect(outcome.waiting, "the outcome says the commit is waiting").toBe(true);
			expect(outcome.error).toBeUndefined();
			expect(violations, "no span marks a violation").toHaveLength(0);

			const last = resultsLog().at(-1);
			expect(last).toMatchObject({ changeId: "abc1234", waiting: true });
			expect(last?.error).toBeUndefined();

			const waiting = queue("pending.jsonl").filter((r) => r.sha === "abc1234");
			expect(waiting, "the commit is in the queue the hook drains").toHaveLength(1);
			expect(waiting[0]).toMatchObject({ waiting: true });
			expect(
				queue("pending-drained.jsonl").some((r) => r.sha === "abc1234"),
				"a waiting commit is not drained",
			).toBe(false);
		});
	});

	describe("A3 — a first answer of prose, then a scorecard", () => {
		it("ends with that scorecard, no violation, after asking again for the scorecard alone", async () => {
			const claude = fakeClaude([prose("Noted — the session is ready."), scored()]);
			const { outcome, marks } = await evaluate(run);

			expect(outcome.error).toBeUndefined();
			expect(outcome.summary).toBe("fixture scorecard");
			const calls = claude.calls();
			expect(calls, "asked exactly twice").toHaveLength(2);
			expect(calls[1].args, "the second ask is in the same session").toContain("--resume");
			expect(calls[1].args).toContain("sess-1");
			expect(calls[1].prompt).toMatch(/scorecard JSON only/i);
			expect(marks).toHaveLength(1);
			expect(marks[0].attributes["indusk.promise.outcome"]).toBe("upheld");
		});
	});

	describe("A4 — two answers with no scorecard", () => {
		it("fails the run, violating the promise with the second answer as the reason", async () => {
			const claude = fakeClaude([
				prose("Noted — the first answer."),
				prose("Still no scorecard, the second answer."),
			]);
			const { outcome, marks } = await evaluate(run);

			expect(claude.calls(), "asked once more, not a third time").toHaveLength(2);
			expect(outcome.error).toBe(true);
			expect(String(outcome.message)).toContain("Still no scorecard, the second answer.");
			expect(marks).toHaveLength(1);
			expect(marks[0].attributes["indusk.promise.outcome"]).toBe("violated");
			const event = marks[0].events.find((e) => e.name === "indusk.promise.violated");
			expect(String(event?.attributes["indusk.promise.symptom"])).toContain(
				"Still no scorecard, the second answer.",
			);
		});
	});

	describe("A5 — any other failure still violates the promise, with its reason", () => {
		it("a model that does not exist", async () => {
			fakeClaude([{ code: 1, stdout: BAD_MODEL_MESSAGE }]);
			const { outcome, marks } = await evaluate(run);

			expect(outcome.error).toBe(true);
			expect(outcome.waiting).toBeUndefined();
			expect(marks).toHaveLength(1);
			expect(marks[0].attributes["indusk.promise.outcome"]).toBe("violated");
			const event = marks[0].events.find((e) => e.name === "indusk.promise.violated");
			expect(String(event?.attributes["indusk.promise.symptom"])).toContain(
				BAD_MODEL_MESSAGE.slice(0, 40),
			);
			expect(queue("pending.jsonl")).toHaveLength(0);
		});

		it("a CLI that is not installed", async () => {
			process.env.PATH = join(f.home, "no-claude-here");
			const { outcome, marks } = await evaluate(run);

			expect(outcome.error).toBe(true);
			expect(outcome.waiting).toBeUndefined();
			expect(marks).toHaveLength(1);
			expect(marks[0].attributes["indusk.promise.outcome"]).toBe("violated");
			const event = marks[0].events.find((e) => e.name === "indusk.promise.violated");
			expect(String(event?.attributes["indusk.promise.symptom"])).toContain(
				"claude could not be started",
			);
			expect(queue("pending.jsonl")).toHaveLength(0);
		});
	});
});

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../lib/bookkeeping/fixture.test-support.js";
import { evalDir } from "../lib/bookkeeping/roots.js";

/**
 * A2 (evaluator-waits-out-limits) — a commit's trigger first evaluates every
 * waiting commit. One that now scores leaves the queue, one refused again
 * stays, and none is evaluated twice.
 *
 * The hook is run the way Claude Code runs it: a `git commit` event on stdin.
 * `INDUSK_EVAL_CMD` stands in for the evaluator of each waiting commit
 * (it receives `<sha> <source> [repo]`); exit 0 is "it was evaluated", exit 1
 * is "the model refused it again". A poison `claude` on PATH keeps the new
 * commit's own detached evaluation from reaching a real model.
 *
 * promise: a-limited-evaluation-waits
 */

const HOOK = resolve(__dirname, "../../hooks/eval-trigger.js");

let f: Fixture;
let stub: string;
let calls: string;

const waiting = (sha: string) => ({
	sha,
	source: "commit",
	waiting: true,
	timestamp: "2026-10-10T00:00:00.000Z",
	repo: undefined,
});

function readJsonl(path: string): Record<string, unknown>[] {
	if (!existsSync(path)) return [];
	return readFileSync(path, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l));
}

beforeEach(() => {
	f = makeFixture();
	mkdirSync(join(f.main, ".indusk"), { recursive: true });
	writeFileSync(
		join(f.main, ".indusk", "config.json"),
		JSON.stringify({ eval: { enabled: true } }),
	);

	const bin = join(f.home, "bin");
	mkdirSync(bin, { recursive: true });
	const poison = join(bin, "claude");
	writeFileSync(poison, "#!/bin/sh\ncat > /dev/null\nexit 0\n");
	chmodSync(poison, 0o755);

	calls = join(f.home, "stub-calls.jsonl");
	stub = join(bin, "eval-stub");
	writeFileSync(
		stub,
		`#!${process.execPath}
const fs = require("node:fs");
const [sha, source] = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ sha, source }) + "\\n");
process.exit(sha === "refused1" ? 1 : 0);
`,
	);
	chmodSync(stub, 0o755);

	const dir = evalDir(f.main);
	mkdirSync(dir, { recursive: true });
	const queued = [
		waiting("scores1"),
		waiting("refused1"),
		// The thin lane's record: not waiting, drained at rail-check, not by a commit.
		{ sha: "thin1", source: "atdawn", timestamp: "2026-10-10T00:00:00.000Z" },
	];
	writeFileSync(join(dir, "pending.jsonl"), `${queued.map((r) => JSON.stringify(r)).join("\n")}\n`);
});

afterEach(() => {
	f.cleanup();
});

function commitEvent(): void {
	const result = spawnSync("node", [HOOK], {
		cwd: f.main,
		input: JSON.stringify({
			tool_input: { command: 'git commit -m "x"' },
			tool_response: { exit_code: 0 },
			cwd: f.main,
		}),
		env: {
			...process.env,
			PATH: `${join(f.home, "bin")}:${process.env.PATH}`,
			INDUSK_EVAL_CMD: stub,
			INDUSK_SKIP_UPDATE_CHECK: "1",
		},
		encoding: "utf-8",
	});
	if (result.status !== 0) throw new Error(`hook exited ${result.status}: ${result.stderr}`);
}

const stubbed = () => readJsonl(calls).map((c) => c.sha);

describe("A2 — a commit's trigger retries the waiting commits first", () => {
	it("a waiting commit that scores leaves the queue, one refused again stays, none runs twice", () => {
		commitEvent();

		expect(stubbed(), "every waiting commit was tried, the thin lane's was not").toEqual([
			"scores1",
			"refused1",
		]);
		const drained = readJsonl(join(evalDir(f.main), "pending-drained.jsonl")).map((r) => r.sha);
		expect(drained, "the scored one is done; the refused one is not").toEqual(["scores1"]);

		// Both retries come before the new commit's own evaluation is spawned.
		const syslog = readFileSync(join(evalDir(f.main), "system.log"), "utf-8");
		const retried = syslog.indexOf("waiting");
		const spawned = syslog.indexOf("evaluator spawned");
		expect(retried, "system.log says waiting commits were retried").toBeGreaterThan(-1);
		expect(spawned, "system.log says the new commit's evaluator spawned").toBeGreaterThan(-1);
		expect(retried).toBeLessThan(spawned);

		// The next commit: the refused one is tried again, the scored one is not.
		commitEvent();
		expect(stubbed()).toEqual(["scores1", "refused1", "refused1"]);
	});
});

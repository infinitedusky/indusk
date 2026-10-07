import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { runPersistentEval } from "./persistent-evaluator.js";

/**
 * bookkeeping-lives-where-it-is-read A17 — found by falsification.
 *
 * The evaluator resumes one Claude Code session from commit to commit. Since
 * this plan its session file is in the project's home, shared by every
 * checkout, but Claude Code finds a session by the directory it was made in:
 * a resume from another checkout fails, and the evaluator then clears the
 * session and starts a full fresh run. Alternating commits between the main
 * checkout and a plan worktree would pay that every time.
 *
 * A fake `claude` on PATH stands in for the CLI with that one rule: a session
 * resumes only from the directory that made it.
 */

let f: Fixture;
let bin: string;
let log: string;
const previousPath = process.env.PATH;

beforeEach(() => {
	f = makeFixture();
	bin = join(f.home, "bin");
	log = join(f.home, "claude-calls.jsonl");
	const sessions = join(f.home, "claude-sessions");
	mkdirSync(bin, { recursive: true });
	mkdirSync(sessions, { recursive: true });
	const scorecard = JSON.stringify({
		version: 1,
		timestamp: "2026-10-08T00:00:00.000Z",
		mode: "eval",
		changeId: "fixture",
		projectGroup: "fixture",
		questions: [],
		summary: "fixture scorecard",
	});
	writeFileSync(
		join(bin, "claude"),
		`#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const sessions = ${JSON.stringify(sessions)};
const at = args.indexOf("--resume");
const cwd = fs.realpathSync(process.cwd());
let id;
if (at >= 0) {
  id = args[at + 1];
  const file = path.join(sessions, id);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf-8") !== cwd) {
    fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ cwd, resume: id, ok: false }) + "\\n");
    process.stdout.write("No conversation found with session ID: " + id);
    process.exit(1);
  }
} else {
  id = "s-" + (fs.readdirSync(sessions).length + 1);
  fs.writeFileSync(path.join(sessions, id), cwd);
}
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ cwd, resume: at >= 0 ? id : null, ok: true, session: id }) + "\\n");
process.stdout.write(JSON.stringify({ result: ${JSON.stringify(scorecard)}, session_id: id, total_cost_usd: 0, usage: {}, duration_ms: 1 }));
`,
	);
	chmodSync(join(bin, "claude"), 0o755);
	process.env.PATH = `${bin}:${previousPath}`;
});

afterEach(() => {
	process.env.PATH = previousPath;
	f.cleanup();
});

const calls = () =>
	readFileSync(log, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map(
			(l) => JSON.parse(l) as { cwd: string; resume: string | null; ok: boolean; session?: string },
		);

const evaluate = (checkout: string) =>
	runPersistentEval({
		projectRoot: checkout,
		gitRoot: checkout,
		changeId: "HEAD",
		transcriptPath: join(f.home, "transcript.jsonl"),
		mode: "eval",
	});

describe("A17 — each checkout keeps its own evaluator session", () => {
	it("a worktree commit's evaluation neither discards the main checkout's session nor resumes one made elsewhere", async () => {
		await evaluate(f.main);
		await evaluate(f.worktree);
		await evaluate(f.main);
		const made = calls();
		expect(
			made.filter((c) => !c.ok),
			"a resume was tried from a checkout that did not make it",
		).toEqual([]);
		const first = made[0]?.session;
		expect(made.at(-1)).toMatchObject({ cwd: f.main, resume: first, ok: true });
	});
});

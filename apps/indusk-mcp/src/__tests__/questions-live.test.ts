// promise: decisions-wait-in-one-place
// promise: a-build-runs-to-review-unasked
// clause: a-decision-is-a-question/never-decided-silently
// clause: the-cost-sets-the-wait/holds-by-default
// clause: the-cost-sets-the-wait/a-hold-frees-the-slot
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../lib/bookkeeping/fixture.test-support.js";
import { runStepSession } from "../lib/build/build-session.js";
import { planWaiting } from "../lib/plans/waiting.js";
import { answerQuestionRecord } from "../lib/questions/answer.js";
import { readQuestions } from "../lib/questions/history.js";
import { SessionManager } from "../lib/session/manager.js";

/**
 * decisions-as-questions T20 (system tier): real sessions, the real manager and the real
 * stream protocol, with a scripted child standing in for the model: it reads the first
 * message, asks one cheap question through `ask_decision`, and ends when the reply
 * allows it. With nothing set the run does not continue, frees its place, and the next
 * session starts from the answer; with `cheap` set to `immediate` the same run goes on at
 * once. A run against the developer's own `claude` is the release's e2e, not this file.
 */
const SCRIPT = `#!/usr/bin/env node
const fs = require("node:fs");
const dir = process.env.FAKE_DIR;
const out = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
let asked = false;
let buf = "";
process.stdin.on("data", (d) => {
  buf += d;
  for (let i = buf.indexOf("\\n"); i >= 0; i = buf.indexOf("\\n")) {
    const line = JSON.parse(buf.slice(0, i));
    buf = buf.slice(i + 1);
    if (line.type === "user") {
      fs.appendFileSync(dir + "/prompts.txt", line.message.content + "\\n---\\n");
      if (!asked && !line.message.content.includes("answered")) {
        asked = true;
        out({ type: "control_request", request_id: "r1", request: { subtype: "can_use_tool", tool_name: "mcp__indusk__ask_decision", input: { question: "Which store?", options: [{ label: "sqlite" }, { label: "files" }], recommended: "sqlite", reason: "simplest", cost: "cheap" } } });
      } else {
        out({ type: "result", subtype: "success", is_error: false, result: "done", session_id: "s" });
        process.exit(0);
      }
    } else if (line.type === "control_response") {
      const r = line.response.response;
      fs.appendFileSync(dir + "/replies.txt", JSON.stringify(r) + "\\n");
      if (r.behavior === "allow") {
        out({ type: "result", subtype: "success", is_error: false, result: "done", session_id: "s" });
        process.exit(0);
      }
    } else if (line.type === "control_request") {
      process.exit(0);
    }
  }
});
setTimeout(() => process.exit(0), 20000);
`;

let f: Fixture;
let dir: string;
beforeEach(() => {
	f = makeFixture();
	dir = mkdtempSync(join(tmpdir(), "questions-live-"));
	writeFileSync(join(dir, "claude"), SCRIPT);
	chmodSync(join(dir, "claude"), 0o755);
	process.env.FAKE_DIR = dir;
});
afterEach(() => {
	f.cleanup();
	rmSync(dir, { recursive: true, force: true });
	delete process.env.FAKE_DIR;
});

const run = (manager: SessionManager) =>
	runStepSession("work", {
		manager,
		worktree: f.worktree,
		project: "proj",
		plan: "seat-holds",
		claudeBin: join(dir, "claude"),
	});
const read = (name: string): string => {
	try {
		return readFileSync(join(dir, name), "utf-8");
	} catch {
		return "";
	}
};

describe("T20 — a run that asks a cheap question", () => {
	it("with nothing set it does not continue, frees its place, and the next session starts from the answer", async () => {
		const manager = new SessionManager({ recordPath: join(dir, "sessions.json"), max: 1 });
		const out = await run(manager);
		expect(out).toEqual({ error: null, waiting: "q-1" });
		expect(manager.running()).toEqual([]);
		expect(manager.capRefusal()).toBeUndefined();
		const [q] = readQuestions(f.main, "seat-holds");
		expect(q).toMatchObject({ state: "waiting", dueAt: null });
		const needs = planWaiting({
			sessions: [],
			plans: [{ name: "seat-holds", documents: {}, workflow: null } as never],
			questions: readQuestions(f.main, "seat-holds"),
		});
		expect(needs[0]).toMatchObject({ plan: "seat-holds", on: "question", questionId: "q-1" });
		expect(read("replies.txt")).toMatch(/"behavior":"deny"/);

		answerQuestionRecord(f.main, "seat-holds", "q-1", "files, we already run one");
		const second = await run(manager);
		expect(second).toEqual({ error: null });
		expect(read("prompts.txt")).toContain("files, we already run one");
	}, 30_000);

	it("with cheap set to immediate the same run goes on at once with its recommendation", async () => {
		writeFileSync(
			join(f.home, "config.json"),
			JSON.stringify({ sessions: { question_wait: { cheap: "immediate" } } }),
		);
		const manager = new SessionManager({ recordPath: join(dir, "sessions.json"), max: 1 });
		expect(await run(manager)).toEqual({ error: null });
		expect(read("replies.txt")).toMatch(/"behavior":"allow"/);
		expect(read("replies.txt")).toContain("sqlite");
		expect(readQuestions(f.main, "seat-holds")[0]).toMatchObject({
			state: "went-ahead",
			done: "sqlite",
		});
	}, 30_000);
});

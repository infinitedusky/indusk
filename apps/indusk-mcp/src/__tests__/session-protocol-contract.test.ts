import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Session, type StartedEvent, startSession } from "../lib/session/start.js";

/**
 * promise: a-plan-can-start-from-the-admin — admin-plan-authoring A5, a contract; publish-hygiene A1.
 * lesson: the-admin-drives-claude-over-an-undocumented-flag-and-a-contract-test-watches-it
 *
 * The admin drives the developer's own `claude` over `--permission-prompt-tool
 * stdio`, which `claude --help` does not list. Nothing we own can say whether
 * Claude Code still speaks it, so this asks the real CLI, in a scratch folder:
 * a question answered, a write allowed, an interrupt honoured. System tier —
 * it starts real sessions on the developer's login, at landing and on
 * release, never in a phase.
 */

const HAS_CLAUDE = spawnSync("claude", ["--version"], { encoding: "utf-8" }).status === 0;
const MODEL = "sonnet";
const TIMEOUT = 180_000;

const dirs: string[] = [];
const sessions: Session[] = [];
afterEach(async () => {
	await Promise.all(sessions.splice(0).map((s) => s.stop(2000)));
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function scratch(): string {
	const dir = realpathSync(mkdtempSync(join(tmpdir(), "session-contract-")));
	dirs.push(dir);
	return dir;
}

/** Start a session and collect its events; `react` answers what it asks. */
function run(prompt: string, react: (ev: StartedEvent, s: Session) => void) {
	const events: StartedEvent[] = [];
	const cwd = scratch();
	const holder: { s?: Session } = {};
	const session = startSession({
		cwd,
		kind: "planning",
		prompt,
		model: MODEL,
		onEvent: (ev) => {
			events.push(ev);
			if (holder.s) react(ev, holder.s);
			if (ev.type === "result") holder.s?.stop(2000);
		},
	});
	holder.s = session;
	sessions.push(session);
	return { cwd, events, session };
}

describe.skipIf(!HAS_CLAUDE)("A5 — Claude Code still speaks the three exchanges", () => {
	it(
		"a question arrives with its options, and the answer reaches the session",
		async () => {
			const { cwd, events, session } = run(
				"Use the AskUserQuestion tool to ask me one question: which colour I prefer, with the options red and blue. Then write my answer, and nothing else, to colour.txt.",
				(ev, s) => {
					if (ev.type === "question") {
						s.answer(ev, Object.fromEntries(ev.questions.map((q) => [q.question, "blue"])));
					}
					if (ev.type === "permission") s.decide(ev, { allow: true });
				},
			);
			await session.done;
			const question = events.find((e) => e.type === "question");
			expect(question, JSON.stringify(events.slice(-3))).toBeDefined();
			expect(existsSync(join(cwd, "colour.txt"))).toBe(true);
			expect(readFileSync(join(cwd, "colour.txt"), "utf-8").trim().toLowerCase()).toBe("blue");
		},
		TIMEOUT,
	);

	// publish-hygiene A1: whether the write is asked about is Claude Code's;
	// whether the model tries it is the model's. Started from a plain terminal
	// it sometimes answered "DENIED" without calling a tool (2 of 9 runs), so
	// the prompt names the tool and offers no way out, a run that tried
	// nothing is started once more, and that failure says what it is.
	it(
		"a write is asked about in a planning session, and a denial is heard",
		async () => {
			const attempt = async () => {
				const started = run(
					"Call the Write tool now to create hello.txt in the current directory containing the single word hi. Call it before you write anything else.",
					(ev, s) => {
						if (ev.type === "permission")
							s.decide(ev, { allow: false, message: "not in this test" });
					},
				);
				await started.session.done;
				return started;
			};
			const triedWrite = (events: StartedEvent[]) =>
				events.some((e) => e.type === "tool" && e.name === "Write");
			let { cwd, events } = await attempt();
			if (!triedWrite(events)) ({ cwd, events } = await attempt());
			expect(
				triedWrite(events),
				`the model never attempted the write, twice: ${JSON.stringify(events.slice(-2))}`,
			).toBe(true);
			expect(events.some((e) => e.type === "permission" && e.tool === "Write")).toBe(true);
			expect(existsSync(join(cwd, "hello.txt"))).toBe(false);
		},
		TIMEOUT,
	);

	it(
		"an interrupt ends the session, which exits",
		async () => {
			const { events, session } = run(
				"Count slowly from 1 to 400, one number per line, writing each line with a separate Bash echo command. Do not batch them.",
				(ev, s) => {
					if (ev.type === "permission") s.decide(ev, { allow: true });
					if (ev.type === "tool") void s.stop(10_000);
				},
			);
			const code = await session.done;
			expect(events.some((e) => e.type === "tool")).toBe(true);
			expect(code === null || typeof code === "number").toBe(true);
			expect(events.filter((e) => e.type === "tool").length).toBeLessThan(20);
		},
		TIMEOUT,
	);
});

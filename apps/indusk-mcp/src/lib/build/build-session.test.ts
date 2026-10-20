// clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check
// clause: an-accepted-brief-is-planned-unasked/decides-and-records
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { readHistoryLines } from "../plans/history.js";
import { readQuestions, recordQuestion } from "../questions/history.js";
import { SessionManager } from "../session/manager.js";
import type { Session, SessionOptions, StartedEvent } from "../session/start.js";
import { runStepSession, stepEnv, stepPrompt } from "./build-session.js";

/**
 * promise: a-build-runs-to-review-unasked — admin-plan-authoring A30, the build session's half.
 * promise: nothing-ships-until-accepted — admin-plan-authoring A35, the marking half.
 * promise: a-skip-reason-is-one-sentence — skip-reason-why A16, the shortening session's prompt.
 * promise: a-build-runs-to-review-unasked — workbench-plan-authoring A13, a workbench build's two roots.
 * promise: a-prompt-shows-only-when-a-person-must-choose — decided-prompts-stay-closed A1, A2, the package half.
 * promise: a-decided-request-stays-decided — decided-prompts-stay-closed A7, the package half.
 *
 * One step of a build is one session that nobody answers: it runs under
 * `INDUSK_GATE_POLICY=auto`, its writes outside the worktree are refused, its
 * plain questions are refused naming `ask_decision`, and a rate-limited step is
 * tried again. Sessions here are scripted fakes; A24 runs the real `claude`.
 */

const WORKTREE = "/w/proj-worktrees/seats";
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A manager whose sessions play `script` (events emitted after start) and remember what they were sent. */
function scriptedManager(scripts: StartedEvent[][]) {
	const dir = mkdtempSync(join(tmpdir(), "build-session-"));
	dirs.push(dir);
	const started: SessionOptions[] = [];
	const replies: Array<{ requestId: string; body: unknown }> = [];
	const manager = new SessionManager({
		recordPath: join(dir, "r.json"),
		start: (opts): Session => {
			started.push(opts);
			const script = scripts[started.length - 1] ?? [];
			let finish: (c: number | null) => void = () => {};
			const done = new Promise<number | null>((r) => {
				finish = r;
			});
			setTimeout(() => {
				for (const ev of script) opts.onEvent(ev);
				opts.onEvent({ type: "exit", code: 0, stderr: "" });
				finish(0);
			}, 0);
			return {
				pid: 100 + started.length,
				kind: opts.kind,
				cwd: opts.cwd,
				say: () => {},
				answer: (ev, answers) => replies.push({ requestId: ev.requestId, body: answers }),
				decide: (ev, d) => replies.push({ requestId: ev.requestId, body: d }),
				stop: async () => finish(0),
				done,
			};
		},
	});
	return { manager, started, replies };
}

const ok: StartedEvent = {
	type: "result",
	ok: true,
	subtype: "success",
	text: "done",
	sessionId: "s",
};
const limited: StartedEvent = {
	type: "result",
	ok: false,
	subtype: "success",
	text: "API Error: Server is temporarily limiting requests · Rate limited",
	sessionId: "s",
	apiErrorStatus: 429,
};
const opts = (manager: SessionManager, sleeps: number[] = []) => ({
	manager,
	worktree: WORKTREE,
	project: "proj",
	plan: "seats",
	sleep: async (ms: number) => {
		sleeps.push(ms);
	},
});

describe("A30 — a build step is a session nobody answers", () => {
	it("runs as a build session in the worktree, under the build's gate policy", async () => {
		const m = scriptedManager([[ok]]);
		expect(await runStepSession("work", opts(m.manager))).toEqual({ error: null });
		expect(m.started[0]).toMatchObject({
			kind: "build",
			cwd: WORKTREE,
			env: { INDUSK_GATE_POLICY: "auto" },
		});
		expect(m.started[0].prompt.startsWith("/work seats")).toBe(true);
	});

	it("a write outside the worktree is refused; one inside is allowed; a plain question is refused, naming ask_decision", async () => {
		const m = scriptedManager([
			[
				{
					type: "permission",
					requestId: "in",
					tool: "Write",
					input: { file_path: `${WORKTREE}/src/a.ts` },
				},
				{
					type: "permission",
					requestId: "out",
					tool: "Write",
					input: { file_path: "/w/proj/src/a.ts" },
				},
				{ type: "question", requestId: "q", questions: [], input: {} },
				ok,
			],
		]);
		await runStepSession("work", opts(m.manager));
		const by = Object.fromEntries(m.replies.map((r) => [r.requestId, r.body]));
		expect(by.in).toEqual({ allow: true });
		expect(by.out).toMatchObject({ allow: false, message: expect.stringContaining(WORKTREE) });
		expect(by.q).toMatchObject({ allow: false, message: expect.stringMatching(/ask_decision/) });
	});

	it("a rate-limited step is tried again after the evaluator's waits, then succeeds", async () => {
		const sleeps: number[] = [];
		const m = scriptedManager([[limited], [limited], [ok]]);
		expect(await runStepSession("work", opts(m.manager, sleeps))).toEqual({ error: null });
		expect(m.started).toHaveLength(3);
		expect(sleeps).toEqual([15_000, 45_000]);
	});

	it("any other failure is the step's error, not tried again", async () => {
		const m = scriptedManager([[{ ...ok, ok: false, subtype: "error_max_turns", text: "" }]]);
		expect(await runStepSession("cleanup", opts(m.manager))).toEqual({ error: "error_max_turns:" });
		expect(m.started).toHaveLength(1);
	});

	it("the retrospective is asked to land the plan with the command that refuses an unaccepted one", () => {
		expect(stepPrompt("retrospective", "seats")).toContain("indusk plans land seats");
	});
});

describe("A35 — a build step's session is marked; the release's is not", () => {
	it("work, falsify and cleanup run marked as build steps, under the auto gate policy", () => {
		for (const step of ["work", "falsify", "cleanup"] as const) {
			expect(stepEnv(step)).toEqual({ INDUSK_GATE_POLICY: "auto", INDUSK_BUILD_STEP: step });
		}
	});

	it("the retrospective, which lands the accepted plan, is not marked", () => {
		expect(stepEnv("retrospective")).toEqual({ INDUSK_GATE_POLICY: "auto" });
	});
});

describe("A13 — a workbench build writes in its code worktree and at the root, and nowhere else", () => {
	const ROOT = "/w/workbench";
	const CODE = "/w/workbench/seats";

	it("starts at the root with the code worktree added; writes in either are allowed, others refused", async () => {
		const m = scriptedManager([
			[
				{
					type: "permission",
					requestId: "code",
					tool: "Write",
					input: { file_path: `${CODE}/src/a.ts` },
				},
				{
					type: "permission",
					requestId: "plan",
					tool: "Edit",
					input: { file_path: `${ROOT}/.indusk/planning/seats/impl.md` },
				},
				{
					type: "permission",
					requestId: "out",
					tool: "Write",
					input: { file_path: "/w/elsewhere/a.ts" },
				},
				ok,
			],
		]);
		await runStepSession("work", { ...opts(m.manager), worktree: ROOT, addDirs: [CODE] });
		expect(m.started[0]).toMatchObject({ cwd: ROOT, addDirs: [CODE] });
		const by = Object.fromEntries(m.replies.map((r) => [r.requestId, r.body]));
		expect(by.code).toEqual({ allow: true });
		expect(by.plan).toEqual({ allow: true });
		expect(by.out).toMatchObject({ allow: false });
	});
});

describe("decided-prompts-stay-closed A1, A2, A7 — every request a build decides is recorded as decided, by rule", () => {
	it("an inside write is followed by an allowed decision, an outside write by a denial with the reason, a question by its decline", async () => {
		const m = scriptedManager([
			[
				{
					type: "permission",
					requestId: "in",
					tool: "Write",
					input: { file_path: `${WORKTREE}/src/a.ts` },
				},
				{
					type: "permission",
					requestId: "out",
					tool: "Write",
					input: { file_path: "/w/proj/src/a.ts" },
				},
				{ type: "question", requestId: "q", questions: [], input: {} },
				ok,
			],
		]);
		const heard: Array<Record<string, unknown>> = [];
		await runStepSession("work", {
			...opts(m.manager),
			onEvent: (ev) => heard.push(ev as unknown as Record<string, unknown>),
		});
		// The event's type is read as a string so this file loads before the type exists.
		const decided = Object.fromEntries(
			heard.filter((e) => e.type === "decided").map((e) => [e.requestId, e]),
		);
		expect(decided.in).toMatchObject({ allow: true, by: "rule" });
		expect(decided.out).toMatchObject({
			allow: false,
			by: "rule",
			message: expect.stringContaining(WORKTREE),
		});
		expect(decided.q).toMatchObject({
			allow: false,
			by: "rule",
			message: expect.stringMatching(/ask_decision/),
		});
	});
});

describe("A16 — the shortening session is told which reason to rewrite", () => {
	const detail = { ritual: "audit", length: 300, sentences: 1 } as const;

	it("names the field, the limit, one sentence, and to change nothing else", () => {
		// biome-ignore lint/suspicious/noExplicitAny: the step is added with its implementation
		const prompt = (stepPrompt as any)("shorten-reason", "seats", detail) as string;
		expect(prompt).toContain("audit_reason");
		expect(prompt).toContain("120");
		expect(prompt).toContain("one sentence");
		expect(prompt).toMatch(/change nothing else/);
		expect(prompt).toContain("300");
		expect(prompt).toContain("INDUSK_GATE_POLICY=auto");
	});
});

/**
 * promise: an-accepted-brief-is-planned-unasked — a-brief-is-planned-unasked A5.
 *
 * Each planning step is one unattended session told to write one document of
 * the plan, from its brief and research, to the planner skill's rules.
 */
describe("A5 — a planning step writes only its document, unattended", () => {
	const DOCUMENT = {
		"plan-test-plan": "test-plan.md",
		"plan-adr": "adr.md",
		"plan-impl": "impl.md",
	} as const;
	const steps = Object.keys(DOCUMENT) as Array<keyof typeof DOCUMENT>;

	it.each(steps)(
		"%s names its document, its inputs, the planner and the unattended policy",
		(step) => {
			const prompt = stepPrompt(step, "seats");
			expect(prompt).toContain(`.indusk/planning/seats/${DOCUMENT[step]}`);
			expect(prompt).toContain("brief.md");
			expect(prompt).toContain("research.md");
			expect(prompt).toContain("planner skill");
			expect(prompt).toContain("INDUSK_GATE_POLICY=auto");
			expect(prompt).toContain("blocker:");
			expect(prompt).toMatch(/only/i);
		},
	);

	it.each(steps)("%s never approves, builds or writes another document", (step) => {
		const prompt = stepPrompt(step, "seats");
		expect(prompt).toContain("indusk plans approve");
		expect(prompt).toMatch(/never approve/i);
		for (const other of Object.values(DOCUMENT).filter((d) => d !== DOCUMENT[step])) {
			expect(prompt).not.toContain(`.indusk/planning/seats/${other}`);
		}
	});

	it("the impl prompt asks for real gate items and a draft status", () => {
		const prompt = stepPrompt("plan-impl", "seats");
		expect(prompt).toContain("status: draft");
		expect(prompt).toMatch(/real items/i);
	});

	it("a planning step's session is marked with its step name", () => {
		expect(stepEnv("plan-adr")).toMatchObject({
			INDUSK_GATE_POLICY: "auto",
			INDUSK_BUILD_STEP: "plan-adr",
		});
	});
});

/**
 * a-brief-is-planned-unasked T17 (A17): the planner skill's steps stop on an
 * ADR left proposed; a planning step must not, and must change no document but its own.
 */
describe("A17 — an earlier document's draft or proposed status is no reason to stop", () => {
	it("A17 tells a planning step an earlier document left draft or proposed is not a reason to stop", () => {
		for (const step of ["plan-adr", "plan-impl"] as const) {
			const prompt = stepPrompt(step, "seats");
			expect(prompt).toMatch(/proposed/);
			expect(prompt).toMatch(/draft/);
			expect(prompt).toMatch(/not a reason to stop/i);
		}
	});

	it("A17 tells a planning step it changes no other document's status", () => {
		const prompt = stepPrompt("plan-impl", "seats");
		expect(prompt).toMatch(/other document'?s? status|status of any other document/i);
	});
});

/**
 * decisions-as-questions, Build Phase 2: an unattended session asks a choice through
 * `ask_decision`. The question is recorded in the plan's history; what the session
 * hears back depends on its cost's setting (hold by default).
 *
 * clause: a-decision-is-a-question/asked-with-a-recommendation
 * clause: the-cost-sets-the-wait/holds-by-default
 * clause: the-cost-sets-the-wait/the-setting-decides
 * clause: the-cost-sets-the-wait/a-hold-frees-the-slot
 * promise: a-build-runs-to-review-unasked
 */
describe("ask_decision — a build asks a choice and it becomes a question", () => {
	let f: Fixture;
	beforeEach(() => {
		f = makeFixture();
	});
	afterEach(() => f.cleanup());

	const decision = (over: Record<string, unknown> = {}): StartedEvent => ({
		type: "question",
		requestId: "d",
		questions: [],
		decision: true,
		input: {
			question: "Which store?",
			options: [{ label: "sqlite" }, { label: "files" }],
			recommended: "sqlite",
			reason: "simplest",
			cost: "cheap",
			...over,
		},
	});
	const run = (m: ReturnType<typeof scriptedManager>) =>
		runStepSession("work", { ...opts(m.manager), worktree: f.worktree });

	it("with nothing set the question holds: the session is refused, stopped, and the run waits", async () => {
		const m = scriptedManager([[decision(), ok]]);
		const out = await run(m);
		expect(out).toEqual({ error: null, waiting: "q-1" });
		const reply = m.replies.find((r) => r.requestId === "d")?.body;
		expect(reply).toMatchObject({ allow: false, message: expect.stringContaining("q-1") });
		const [q] = readQuestions(f.worktree, "seats");
		expect(q).toMatchObject({ id: "q-1", state: "waiting", dueAt: null, text: "Which store?" });
	});

	it("a malformed question is returned to the session, saying what is missing, and recorded nowhere", async () => {
		const m = scriptedManager([[decision({ reason: "" }), ok]]);
		expect(await run(m)).toEqual({ error: null });
		expect(m.replies.find((r) => r.requestId === "d")?.body).toMatchObject({
			allow: false,
			message: expect.stringMatching(/reason/),
		});
		expect(readQuestions(f.worktree, "seats")).toEqual([]);
	});

	it("`immediate` answers the session with its recommendation at once and does not stop it", async () => {
		writeFileSync(
			join(f.home, "config.json"),
			JSON.stringify({ sessions: { question_wait: { cheap: "immediate" } } }),
		);
		const m = scriptedManager([[decision(), ok]]);
		expect(await run(m)).toEqual({ error: null });
		expect(m.replies.find((r) => r.requestId === "d")?.body).toEqual({ "Which store?": "sqlite" });
		expect(readQuestions(f.worktree, "seats")[0]).toMatchObject({
			state: "went-ahead",
			done: "sqlite",
		});
	});

	it("a set time leaves the request open, tied to its session while it lives, and untied when it ends (T31)", async () => {
		writeFileSync(
			join(f.home, "config.json"),
			JSON.stringify({ sessions: { question_wait: { cheap: 5 } } }),
		);
		const m = scriptedManager([[decision(), ok]]);
		expect(await run(m)).toEqual({ error: null });
		expect(m.replies.find((r) => r.requestId === "d")).toBeUndefined();
		const [q] = readQuestions(f.worktree, "seats");
		expect(q).toMatchObject({ state: "waiting" });
		expect(q?.dueAt).toBeGreaterThan(q?.askedAt ?? 0);
		// Tied to its session while the session lived: the line written when it was asked says so.
		const lines = readHistoryLines(f.worktree, "seats").filter((l) => l.includes("question q-1"));
		expect(lines.some((l) => l.includes('"requestId":"d"'))).toBe(true);
		// The session ended, so the record no longer names it and the plan waits under Needs you.
		expect(q?.session).toBeUndefined();
	});

	it("the answers given while it was stopped are told to the next session, once", async () => {
		recordQuestion(f.worktree, {
			id: "q-1",
			plan: "seats",
			text: "Which store?",
			options: [
				{ label: "sqlite", changes: [] },
				{ label: "files", changes: [] },
			],
			recommended: "sqlite",
			reason: "r",
			statedCost: "cheap",
			cost: "cheap",
			askedAt: 1,
			dueAt: null,
			state: "answered",
			answer: "files, we already run one",
		});
		const first = scriptedManager([[ok]]);
		await run(first);
		expect(first.started[0].prompt).toContain("files, we already run one");
		const second = scriptedManager([[ok]]);
		await run(second);
		expect(second.started[0].prompt).not.toContain("files, we already run one");
	});
});

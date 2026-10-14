import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionBusy, SessionManager } from "./manager.js";
import type { Session, SessionOptions } from "./start.js";

/**
 * promise: a-session-can-be-stopped — admin-plan-authoring A21, the manager's half.
 *
 * The admin daemon owns its sessions (ADR D2): one at a time, each written to
 * a record so a daemon that stops, or starts again after a crash, can end
 * what it started. Stopping a session ends it and writes nothing else — what
 * the session already wrote stays. The session is a fake here; A22 runs real
 * processes.
 */

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fakeStarter() {
	const started: Array<{ opts: SessionOptions; stopped: boolean }> = [];
	let pid = 40_000;
	const start = (opts: SessionOptions): Session => {
		const entry = { opts, stopped: false };
		started.push(entry);
		let finish: (code: number | null) => void = () => {};
		const done = new Promise<number | null>((r) => {
			finish = r;
		});
		return {
			pid: ++pid,
			kind: opts.kind,
			cwd: opts.cwd,
			say: () => {},
			answer: () => {},
			decide: () => {},
			async stop() {
				entry.stopped = true;
				finish(0);
			},
			done,
		};
	};
	return { started, start };
}

function manager() {
	const dir = mkdtempSync(join(tmpdir(), "session-manager-"));
	dirs.push(dir);
	const record = join(dir, "admin-sessions.json");
	const fake = fakeStarter();
	return { record, fake, m: new SessionManager({ recordPath: record, start: fake.start }) };
}

/** The error `fn` throws, or undefined when it does not throw. */
function attempt(fn: () => unknown): Error | undefined {
	try {
		fn();
		return undefined;
	} catch (err) {
		return err as Error;
	}
}

const planning = {
	cwd: "/p/proj-worktrees/seats",
	kind: "planning" as const,
	prompt: "/planner feature seats",
	onEvent: () => {},
};
const meta = { project: "proj", plan: "seats" };

describe("A21 — a session can be stopped, and is recorded", () => {
	it("a started session is recorded with its pid, project, plan and kind", () => {
		const { m, record } = manager();
		const { id, session } = m.start({ ...planning, ...meta });
		const saved = JSON.parse(readFileSync(record, "utf-8"));
		expect(saved.sessions).toEqual([
			expect.objectContaining({
				id,
				pid: session.pid,
				project: "proj",
				plan: "seats",
				kind: "planning",
			}),
		]);
	});

	it("a second planning session on the same plan is refused, naming the first (sessions-per-plan A2)", () => {
		const { m } = manager();
		const { id } = m.start({ ...planning, ...meta });
		const refusal = attempt(() => m.start({ ...planning, ...meta }));
		expect(refusal).toBeInstanceOf(SessionBusy);
		// Sandy, 2026-10-14: the refusal says plainly that this plan has one, and offers to continue it.
		expect(refusal?.message).toContain("A planning session is already running on this plan");
		expect(refusal?.message).toContain("Do you want to continue that session here?");
		expect((refusal as SessionBusy).running?.id).toBe(id);
	});

	it("stopping it ends the session and clears the record; another may start", async () => {
		const { m, record, fake } = manager();
		const { id } = m.start({ ...planning, ...meta });
		await m.stop(id);
		expect(fake.started[0].stopped).toBe(true);
		expect(JSON.parse(readFileSync(record, "utf-8")).sessions).toEqual([]);
		expect(() => m.start({ ...planning, ...meta })).not.toThrow();
	});

	it("a session that ends on its own leaves the record", async () => {
		const { m, record } = manager();
		const { session } = m.start({ ...planning, ...meta });
		await session.stop();
		await new Promise((r) => setImmediate(r));
		expect(JSON.parse(readFileSync(record, "utf-8")).sessions).toEqual([]);
	});

	it("stopAll ends every session it holds", async () => {
		const { m, fake } = manager();
		m.start({ ...planning, ...meta });
		await m.stopAll();
		expect(fake.started.every((s) => s.stopped)).toBe(true);
	});

	it("stopping an id it does not hold is refused, naming the id", async () => {
		const { m } = manager();
		await expect(m.stop("nope")).rejects.toThrow(/nope/);
	});
});

describe("A21 — the panel's answers reach the session by the request's id", () => {
	it("an answer to a request the session never made is refused, naming it", () => {
		const { m } = manager();
		const { id } = m.start({ ...planning, ...meta });
		expect(() => m.reply(id, { requestId: "r-none", allow: true })).toThrow(/r-none/);
	});
});

describe("A21 — an answer is delivered once, to the request it answers", () => {
	it("a question answered through the manager reaches the session; a second answer is refused", () => {
		const dir = mkdtempSync(join(tmpdir(), "session-manager-"));
		dirs.push(dir);
		const answered: Array<Record<string, string>> = [];
		let emit: SessionOptions["onEvent"] = () => {};
		const m = new SessionManager({
			recordPath: join(dir, "r.json"),
			start: (opts) => {
				emit = opts.onEvent;
				return {
					pid: 1,
					kind: opts.kind,
					cwd: opts.cwd,
					say: () => {},
					answer: (_ev, answers) => answered.push(answers),
					decide: () => {},
					stop: async () => {},
					done: new Promise(() => {}),
				};
			},
		});
		const { id } = m.start({ ...planning, ...meta });
		emit({ type: "question", requestId: "q1", questions: [], input: {} });
		m.reply(id, { requestId: "q1", answers: { "Which workflow?": "feature" } });
		expect(answered).toEqual([{ "Which workflow?": "feature" }]);
		expect(() => m.reply(id, { requestId: "q1", answers: {} })).toThrow(/already answered/);
	});
});

describe("A21 — a question can be declined, as a build declines every one", () => {
	it("declining sends a refusal with its message; allowing a question without answers is refused", () => {
		const dir = mkdtempSync(join(tmpdir(), "session-manager-"));
		dirs.push(dir);
		const decided: unknown[] = [];
		let emit: SessionOptions["onEvent"] = () => {};
		const m = new SessionManager({
			recordPath: join(dir, "r.json"),
			start: (opts) => {
				emit = opts.onEvent;
				return {
					pid: 1,
					kind: opts.kind,
					cwd: opts.cwd,
					say: () => {},
					answer: () => {},
					decide: (ev, d) => decided.push({ requestId: ev.requestId, ...d }),
					stop: async () => {},
					done: new Promise(() => {}),
				};
			},
		});
		const { id } = m.start({ ...planning, ...meta });
		emit({ type: "question", requestId: "q1", questions: [], input: {} });
		emit({ type: "question", requestId: "q2", questions: [], input: {} });
		m.reply(id, { requestId: "q1", allow: false, message: "decide yourself" });
		expect(decided).toEqual([{ requestId: "q1", allow: false, message: "decide yourself" }]);
		expect(() => m.reply(id, { requestId: "q2", allow: true })).toThrow(/answer it or decline it/);
	});
});

describe("A1 — the person replies in their own words, and the panel shows it", () => {
	it("say sends the text to the session and records it as the person's event", () => {
		const dir = mkdtempSync(join(tmpdir(), "session-manager-"));
		dirs.push(dir);
		const said: string[] = [];
		const m = new SessionManager({
			recordPath: join(dir, "r.json"),
			start: (opts) => ({
				pid: 1,
				kind: opts.kind,
				cwd: opts.cwd,
				say: (text) => said.push(text),
				answer: () => {},
				decide: () => {},
				stop: async () => {},
				done: new Promise(() => {}),
			}),
		});
		const { id } = m.start({ ...planning, ...meta });
		const seen: unknown[] = [];
		m.subscribe(id, (ev) => seen.push(ev));
		m.say(id, "Looks good — accept the brief.");
		expect(said).toEqual(["Looks good — accept the brief."]);
		expect(seen).toContainEqual({ type: "you", text: "Looks good — accept the brief." });
		expect(() => m.say(id, "   ")).toThrow(/empty/);
	});
});

describe("plan-cockpit — the question a session waits on", () => {
	it("pendingQuestion is the latest question not yet answered, and none once it is answered", () => {
		const { m, fake } = manager();
		const { id } = m.start({ ...planning, ...meta });
		expect(m.pendingQuestion(id)).toBeUndefined();
		const ev = {
			type: "question" as const,
			requestId: "req-1",
			questions: [{ question: "Which map?", options: [{ label: "A" }, { label: "B" }] }],
			input: {},
		};
		fake.started[0]?.opts.onEvent(ev);
		expect(m.pendingQuestion(id)).toEqual(ev);
		m.reply(id, { requestId: "req-1", answers: { "Which map?": "A" } });
		expect(m.pendingQuestion(id)).toBeUndefined();
		expect(m.pendingQuestion("no-such-session")).toBeUndefined();
	});
});

/**
 * promise: a-session-belongs-to-its-plan — a session is owned by its project,
 * plan and kind; only a second of the same owner is refused.
 */
describe("sessions-per-plan — a session belongs to its plan", () => {
	it("A1 — a planning session for another plan starts while one runs", () => {
		const { m } = manager();
		m.start({ ...planning, ...meta });
		expect(attempt(() => m.start({ ...planning, ...meta, plan: "other" }))).toBeUndefined();
		expect(m.running()).toHaveLength(2);
	});

	it("A3 — a plan can have a planning session and a build at the same time", () => {
		const { m } = manager();
		m.start({ ...planning, ...meta });
		const refusal = attempt(() => m.start({ ...planning, ...meta, kind: "build" }));
		expect(refusal).toBeUndefined();
		expect(m.forPlan("proj", "seats", "build")?.kind).toBe("build");
		expect(m.forPlan("proj", "seats", "planning")?.kind).toBe("planning");
	});
});

/**
 * promise: sessions-are-capped — the machine runs at most sessions.max
 * (the InDusk home's config.json, 4 by default).
 */
describe("sessions-per-plan — the machine's cap", () => {
	const savedHome = process.env.INDUSK_HOME;
	afterEach(() => {
		if (savedHome === undefined) {
			delete process.env.INDUSK_HOME;
		} else {
			process.env.INDUSK_HOME = savedHome;
		}
	});

	function homeWith(config?: unknown): string {
		const home = mkdtempSync(join(tmpdir(), "indusk-home-"));
		dirs.push(home);
		if (config !== undefined) writeFileSync(join(home, "config.json"), JSON.stringify(config));
		process.env.INDUSK_HOME = home;
		return home;
	}

	/** Start sessions on plans p1..pN, returning each start's refusal (or undefined). */
	function startMany(m: SessionManager, count: number): Array<Error | undefined> {
		return Array.from({ length: count }, (_, i) =>
			attempt(() => m.start({ ...planning, ...meta, plan: `p${i + 1}` })),
		);
	}

	it("A8 — at the cap another start is refused, naming each running session and how to stop one", () => {
		const dir = mkdtempSync(join(tmpdir(), "session-manager-"));
		dirs.push(dir);
		const fake = fakeStarter();
		const opts = { recordPath: join(dir, "r.json"), start: fake.start, max: 2 };
		const m = new SessionManager(opts as ConstructorParameters<typeof SessionManager>[0]);
		const [first, second] = startMany(m, 2);
		expect(first).toBeUndefined();
		expect(second).toBeUndefined();
		const refusal = attempt(() => m.start({ ...planning, ...meta, plan: "p3" }));
		expect(refusal).toBeInstanceOf(SessionBusy);
		expect(refusal?.message).toMatch(/p1/);
		expect(refusal?.message).toMatch(/p2/);
		expect(refusal?.message).toMatch(/stop/i);
	});

	it("A9 — with no sessions.max a fourth session starts and a fifth is refused", () => {
		homeWith();
		const { m } = manager();
		const results = startMany(m, 5);
		expect(results.slice(0, 4)).toEqual([undefined, undefined, undefined, undefined]);
		expect(results[4]).toBeInstanceOf(SessionBusy);
	});

	it("A9 — with sessions.max 2 in the InDusk home's config a third is refused", () => {
		homeWith({ sessions: { max: 2 } });
		const { m } = manager();
		const results = startMany(m, 3);
		expect(results.slice(0, 2)).toEqual([undefined, undefined]);
		expect(results[2]).toBeInstanceOf(SessionBusy);
	});
});

describe("A14 — a build's own next step is not refused by the cap", () => {
	function capped() {
		const dir = mkdtempSync(join(tmpdir(), "session-manager-"));
		dirs.push(dir);
		const fake = fakeStarter();
		const m = new SessionManager({ recordPath: join(dir, "r.json"), start: fake.start, max: 2 });
		return m;
	}
	const build = { ...planning, ...meta, kind: "build" as const, plan: "p3" };

	it("A14 — an admitted build's step starts though other plans filled the cap since", () => {
		const m = capped();
		m.admitBuild("proj", "p3");
		m.start({ ...planning, ...meta, plan: "p1" });
		expect(attempt(() => m.start(build))).toBeUndefined();
	});

	it("A14 — a build at the cap is refused before it starts", () => {
		const m = capped();
		for (const plan of ["p1", "p2"]) m.start({ ...planning, ...meta, plan });
		expect(attempt(() => m.admitBuild("proj", "p3"))).toBeInstanceOf(SessionBusy);
	});

	it("A14 — an admitted build never gets past the same-plan rule", () => {
		const m = capped();
		m.admitBuild("proj", "p3");
		m.start(build);
		const refusal = attempt(() => m.start(build));
		expect(refusal).toBeInstanceOf(SessionBusy);
		expect(refusal?.message).toMatch(/already running on this plan/);
	});
});

describe("A15 — an admitted build holds its place between its steps", () => {
	it("A15 — with one build admitted and no step running, the cap of 2 admits one more session, not two", () => {
		const dir = mkdtempSync(join(tmpdir(), "session-manager-"));
		dirs.push(dir);
		const m = new SessionManager({
			recordPath: join(dir, "r.json"),
			start: fakeStarter().start,
			max: 2,
		});
		m.admitBuild("proj", "built");
		expect(attempt(() => m.start({ ...planning, ...meta, plan: "p1" }))).toBeUndefined();
		expect(attempt(() => m.start({ ...planning, ...meta, plan: "p2" }))).toBeInstanceOf(
			SessionBusy,
		);
		expect(attempt(() => m.admitBuild("proj", "another"))).toBeInstanceOf(SessionBusy);
	});

	it("A15 — once the build ends its place is free again", () => {
		const dir = mkdtempSync(join(tmpdir(), "session-manager-"));
		dirs.push(dir);
		const m = new SessionManager({
			recordPath: join(dir, "r.json"),
			start: fakeStarter().start,
			max: 2,
		});
		const done = m.admitBuild("proj", "built");
		m.start({ ...planning, ...meta, plan: "p1" });
		done();
		expect(attempt(() => m.start({ ...planning, ...meta, plan: "p2" }))).toBeUndefined();
	});
});

describe("sessions-per-plan — what two running sessions must not break", () => {
	it("A10 — stopping one leaves the other running and recorded", async () => {
		const { m, record, fake } = manager();
		expect(attempt(() => m.start({ ...planning, ...meta }))).toBeUndefined();
		expect(attempt(() => m.start({ ...planning, ...meta, plan: "other" }))).toBeUndefined();
		const [first, other] = m.running();
		await m.stop(first?.id ?? "none");
		expect(fake.started[0]?.stopped).toBe(true);
		expect(fake.started[1]?.stopped).toBe(false);
		expect(m.running().map((r) => r.id)).toEqual([other?.id]);
		const saved = JSON.parse(readFileSync(record, "utf-8")).sessions;
		expect(saved.map((r: { plan: string }) => r.plan)).toEqual(["other"]);
	});

	it("A11 — a session that ends on its own is dropped from the record for its own plan; the others' records stay", async () => {
		const { m, record } = manager();
		const first = attempt(() => m.start({ ...planning, ...meta }));
		const second = attempt(() => m.start({ ...planning, ...meta, plan: "other" }));
		expect(first).toBeUndefined();
		expect(second).toBeUndefined();
		const ending = m.forPlan("proj", "seats");
		expect(ending).toBeDefined();
		await m.get(ending?.id ?? "none")?.stop();
		await new Promise((r) => setImmediate(r));
		const saved = JSON.parse(readFileSync(record, "utf-8")).sessions;
		expect(saved.map((r: { plan: string }) => r.plan)).toEqual(["other"]);
	});
});

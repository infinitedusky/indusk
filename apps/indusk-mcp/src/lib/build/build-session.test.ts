import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionManager } from "../session/manager.js";
import type { Session, SessionOptions, StartedEvent } from "../session/start.js";
import { runStepSession, stepEnv, stepPrompt } from "./build-session.js";

/**
 * promise: a-build-runs-to-review-unasked — admin-plan-authoring A30, the build session's half.
 * promise: nothing-ships-until-accepted — admin-plan-authoring A35, the marking half.
 * promise: a-build-runs-to-review-unasked — workbench-plan-authoring A13, a workbench build's two roots.
 *
 * One step of a build is one session that nobody answers: it runs under
 * `INDUSK_GATE_POLICY=auto`, its writes outside the worktree are refused, its
 * questions are answered "decide and record why", and a rate-limited step is
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

	it("a write outside the worktree is refused; one inside is allowed; a question is told to decide", async () => {
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
		expect(by.q).toMatchObject({ allow: false, message: expect.stringMatching(/own judgement/) });
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

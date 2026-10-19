// clause: a-run-is-read-from-its-record/says-what-is-true
// clause: a-run-is-read-from-its-record/never-in-progress-when-idle
import { describe, expect, it } from "vitest";
import { PROCESS_GONE, type RunStatus } from "./liveness.js";
import { nextStepFor } from "./next-step.js";
import {
	type Confirmation,
	confirmationsOf,
	liveCheckRecorded,
	openConfirmations,
	type SituationInput,
	situation,
} from "./situation.js";

/**
 * A65–A69 and A82 (a-run-can-be-trusted, Build Phase 2): a plan's situation said in
 * words from the record and the plan's files, and never in progress without a process.
 */

const running: RunStatus = { state: "running" };
const gone: RunStatus = { state: "stopped", reason: PROCESS_GONE };

const input = (over: Partial<SituationInput> = {}): SituationInput => ({
	stepName: "Build",
	archived: false,
	landedOnMain: false,
	waitingOn: null,
	run: null,
	...over,
});

describe("A65 — a planning plan reads planning with its step", () => {
	it("A65 each planning step is named in words", () => {
		const words: Record<string, RegExp> = {
			"plan-test-plan": /test plan/,
			"plan-adr": /decision/,
			"plan-impl": /impl/,
			"plan-review": /cold/,
		};
		for (const [step, re] of Object.entries(words)) {
			const s = situation(input({ run: { kind: "planning", status: running, step } }));
			expect(s.kind).toBe("planning");
			expect(s.text).toMatch(/^Planning — /);
			expect(s.text).toMatch(re);
			expect(s.running).toBe(true);
		}
	});
});

describe("A66 — a building plan reads building with its phase, a waiting one what it waits on", () => {
	it("A66 building names the phase the plan is on", () => {
		const s = situation(
			input({ run: { kind: "build", status: running, phase: "Build Phase 4: the rule" } }),
		);
		expect(s).toMatchObject({ kind: "building", text: "Building — Build Phase 4: the rule" });
	});

	it("A66 waiting names what the person decides", () => {
		for (const [on, re] of [
			["review", /review/],
			["approval", /approve/],
			["amendment", /re-approve/],
			["plan-review", /plan review/],
		] as const) {
			const s = situation(input({ waitingOn: on }));
			expect(s).toMatchObject({ kind: "waiting", waitingOn: on, running: false });
			expect(s.text).toMatch(re);
		}
	});
});

describe("A67 — a plan merged to main reads complete with a confirmation list", () => {
	const list: Confirmation[] = [
		{ name: "p/a", kind: "clause signal", confirmed: true },
		{ name: "p/b", kind: "clause signal", confirmed: false },
		{ name: "L1", kind: "live check", confirmed: false },
	];

	it("A67 complete, not running, listing each clause signal and live check by name", () => {
		const s = situation(
			input({
				landedOnMain: true,
				run: { kind: "release", status: gone },
				confirmations: list,
			}),
		);
		expect(s).toMatchObject({ kind: "complete", running: false });
		expect(s.confirmations?.map((c) => c.name)).toEqual(["p/a", "p/b", "L1"]);
		expect(openConfirmations(s.confirmations).map((c) => c.name)).toEqual(["p/b", "L1"]);
		expect(s.text).toMatch(/2 still to confirm/);
	});

	it("A67 it never reads landed or releasing", () => {
		for (const run of [
			null,
			{ kind: "release" as const, status: running },
			{ kind: "release" as const, status: gone },
		]) {
			const s = situation(input({ landedOnMain: true, run, confirmations: list }));
			expect(s.kind).toBe("complete");
			expect(s.text).not.toMatch(/landed|releasing/i);
		}
	});

	it("A67 each confirmation ticks when its signal holds or its live check is recorded", () => {
		const made = confirmationsOf({
			promises: [
				{
					name: "p",
					clauses: [
						{ clause: "a", kind: "split", standing: "holding" },
						{ clause: "b", kind: "limit", standing: "no-signal" },
						{ clause: "c", kind: "split", standing: "broken" },
						{ clause: "r", kind: "rests-on", standing: "holding" },
					],
				},
			],
			liveChecks: [
				{ id: "L1", recorded: true },
				{ id: "L2", recorded: false },
			],
		});
		expect(made).toEqual([
			{ name: "p/a", kind: "clause signal", confirmed: true },
			{ name: "p/b", kind: "clause signal", confirmed: false },
			{ name: "p/c", kind: "clause signal", confirmed: false },
			{ name: "L1", kind: "live check", confirmed: true },
			{ name: "L2", kind: "live check", confirmed: false },
		]);
	});

	it("A67 a live check is recorded by its id beside a date in the impl's Notes", () => {
		const body =
			"## Notes\n\n- L1 — 2026-10-20 — killed the session, read the stop sentence\n- L2 pending\n\n## After\n";
		expect(liveCheckRecorded(body, "L1")).toBe(true);
		expect(liveCheckRecorded(body, "L2")).toBe(false);
		expect(liveCheckRecorded("no notes at all", "L1")).toBe(false);
		// a mention of the id above Notes does not count
		expect(liveCheckRecorded("L1 2026-10-20\n## Notes\nnothing\n", "L1")).toBe(false);
	});

	it("A67 a plan with everything confirmed reads complete with nothing to confirm", () => {
		const s = situation(
			input({
				landedOnMain: true,
				confirmations: list.map((c) => ({ ...c, confirmed: true })),
			}),
		);
		expect(s.text).toBe("Complete — merged to main");
	});
});

describe("A68 — a plan whose run stopped reads stopped with the reason and what starts it", () => {
	it("A68 stopped, with the reason, and Build starts it again", () => {
		const s = situation(
			input({
				run: {
					kind: "build",
					status: { state: "stopped", reason: "two steps in a row made no progress" },
					phase: "Build Phase 2: x",
				},
			}),
		);
		expect(s).toMatchObject({ kind: "stopped", running: false });
		expect(s.text).toContain("two steps in a row made no progress");
		expect(s.text).toMatch(/Build starts it again at Build Phase 2: x/);
	});
});

describe("A69 and A82 — nothing reads in progress without a process", () => {
	it("A69 an accepted plan with no release process, after a restart, reads stopped, never releasing", () => {
		const s = situation(input({ stepName: "Release", run: { kind: "release", status: gone } }));
		expect(s.kind).toBe("stopped");
		expect(s.text).not.toMatch(/releasing|in progress/i);
		expect(s.running).toBe(false);
	});

	it("A82 a building plan whose process is gone never reads building and does not run", () => {
		const s = situation(input({ run: { kind: "build", status: gone, phase: "Build Phase 2: x" } }));
		expect(s.kind).toBe("stopped");
		expect(s.text).not.toMatch(/^Building|Releasing/);
		expect(s.running).toBe(false);
	});

	it("A82 with no record at all, a plan at the Build step reads idle, nothing running", () => {
		const s = situation(input({ stepName: "Build", run: null }));
		expect(s).toMatchObject({ kind: "idle", running: false });
		expect(s.text).toMatch(/nothing is running/);
	});

	it("A82 a run whose record cannot be read reads as no run, not as running", () => {
		const s = situation(input({ run: { kind: "build", status: { state: "unknown" } } }));
		expect(s.running).toBe(false);
		expect(s.kind).toBe("idle");
	});

	it("A82 only a live process runs: every kind reads running only on a running status", () => {
		for (const kind of ["planning", "build", "release"] as const) {
			expect(situation(input({ run: { kind, status: running } })).running).toBe(true);
			expect(situation(input({ run: { kind, status: gone } })).running).toBe(false);
		}
	});
});

/**
 * A91 and A93 (a-run-can-be-trusted, Build Phase 7, falsification): what the page says is
 * true against the inputs that made it say it wrongly.
 */
describe("A91 — a run that ended at a wait the person has since answered reads the step the plan is at", () => {
	it("A91 a planning run stopped at ready-for-approval, then approved from the command line, never reads stopped", () => {
		// As `runOfPlan` hands it: the record's clean stop, worded by its step (no stopReason).
		const s = situation(
			input({
				stepName: "Build",
				waitingOn: null,
				run: {
					kind: "planning",
					status: { state: "stopped", reason: "ready-for-approval" },
					stopStep: "ready-for-approval",
				} as SituationInput["run"],
			}),
		);
		expect(s.text).not.toBe("Stopped — ready-for-approval. Build starts the planning again.");
		expect(s.kind).not.toBe("stopped");
		expect(s.text).toMatch(/At Build/);
		const next = nextStepFor(s);
		expect(next?.text).not.toMatch(/press Build/);
		expect(next?.text).toMatch(/Build/);
	});

	it("A91 each clean end of a runner reads the step the plan is at once nothing waits on the person", () => {
		for (const [kind, step] of [
			["planning", "ready-for-approval"],
			["planning", "wait-for-looks"],
			["build", "review"],
		] as const) {
			const s = situation(
				input({
					stepName: "Review",
					run: {
						kind,
						status: { state: "stopped", reason: step },
						stopStep: step,
					} as SituationInput["run"],
				}),
			);
			expect(s.kind, `${kind} ${step}`).toBe("idle");
		}
	});

	it("A91 a death, a refusal, an amendment and a failed release still read stopped", () => {
		for (const [kind, step, reason] of [
			["build", null, PROCESS_GONE],
			["build", "cannot-continue", "two steps in a row made no progress"],
			["build", "amendment", "the brief changed"],
			["build", "judgement", "a person must look"],
			["release", "release-failed", "the plan is not on main"],
		] as const) {
			const s = situation(
				input({
					run: {
						kind,
						status: { state: "stopped", reason },
						stopStep: step,
					} as SituationInput["run"],
				}),
			);
			expect(s.kind, `${kind} ${step}`).toBe("stopped");
		}
	});
});

describe("A93 — a failed live check and an unconfirmed plain promise are never ticked", () => {
	it("A93 a Notes line holding a date beside a failed result does not record the live check", () => {
		for (const word of ["failed", "fail", "red", "broken", "refused", "FAILED"]) {
			const body = `## Notes\n\n- L1 — 2026-10-20 — ${word}: the stop sentence never appeared\n`;
			expect(liveCheckRecorded(body, "L1"), word).toBe(false);
		}
		expect(
			liveCheckRecorded("## Notes\n\n- L1 — 2026-10-20 — read the stop sentence\n", "L1"),
		).toBe(true);
	});

	it("A93 a promise the plan makes with no clauses is listed, and ticked only once it is in force", () => {
		const made = confirmationsOf({
			promises: [
				{ name: "plain", clauses: [], inForce: false },
				{ name: "kept", clauses: [], inForce: true },
				{
					name: "rests",
					clauses: [{ clause: "r", kind: "rests-on", standing: "holding" }],
					inForce: false,
				},
			],
			liveChecks: [],
		} as Parameters<typeof confirmationsOf>[0]);
		expect(made).toEqual([
			{ name: "plain", kind: "clause signal", confirmed: false },
			{ name: "kept", kind: "clause signal", confirmed: true },
			{ name: "rests", kind: "clause signal", confirmed: false },
		]);
	});
});

describe("A65 — a closed plan", () => {
	it("an archived plan with nothing to confirm reads closed", () => {
		expect(situation(input({ archived: true })).kind).toBe("closed");
	});
});

// promise: a-run-is-read-from-its-record

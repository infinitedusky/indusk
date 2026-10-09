import { describe, expect, it } from "vitest";
import type { RetrospectiveReadiness } from "../cleanup/gate.js";
import type { ImplPhase, ParsedImpl } from "../impl-parser-core.js";
import type { Trajectory } from "../trajectory/parser.js";
import type { BuildPlan } from "./next-step.js";
import { type BuildStepName, runBuild, runRelease } from "./runner.js";

/**
 * promise: a-build-runs-to-review-unasked — admin-plan-authoring A11 at the runner, A30's runner half.
 * promise: nothing-ships-until-accepted — admin-plan-authoring A19, A20.
 * promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes — plan-review-subagent A4.
 *
 * The runner asks `nextBuildStep` after every step and runs a fresh session
 * for each: it stops at review, a declared judgement, or when it cannot
 * continue, and never starts the retrospective on its own. Acceptance — by
 * the person, or by a workflow set to accept automatically — starts the
 * release, whose first step is the retrospective. The plan and the sessions
 * are fakes here: a scripted plan that moves as each step "runs".
 */

const ready = (missing: string[] = []): RetrospectiveReadiness => ({
	falsificationOk: !missing.includes("falsification"),
	cleanupOk: !missing.includes("cleanup"),
	auditOk: !missing.includes("audit"),
	rowsOk: true,
	nonTerminalRows: [],
	promisesOk: true,
	unprovenPromises: [],
	passes: missing.length === 0,
	missing,
});

const phase = (name: string, done: boolean, items = ["build it"]): ImplPhase => ({
	number: 1,
	kind: "build",
	ordinal: 1,
	name,
	gates: [{ type: "implementation", items: items.map((text) => ({ checked: done, text })) }],
	blocker: null,
	forwardIntelligence: null,
});

const noRows: Trajectory = { rows: [], deferred: [] } as unknown as Trajectory;
const planOf = (phases: ImplPhase[], missing: string[]): BuildPlan => ({
	impl: { title: "seats", status: "in-progress", phases } as ParsedImpl,
	trajectory: noRows,
	readiness: ready(missing),
});

/** A plan that advances one state each time a step runs; `stuck` keeps it where it is. */
function scripted(states: BuildPlan[], opts: { stuck?: boolean; failAt?: number } = {}) {
	let at = 0;
	const ran: BuildStepName[] = [];
	const accepted: string[] = [];
	return {
		ran,
		accepted,
		deps: {
			read: async () => states[Math.min(at, states.length - 1)],
			run: async (step: BuildStepName) => {
				ran.push(step);
				if (opts.failAt === ran.length) return { error: "claude exited 1" };
				if (!opts.stuck) at += 1;
				return { error: null };
			},
			accept: async (by: "person" | "auto") => {
				accepted.push(by);
			},
		},
	};
}

const BUILT = planOf([phase("Seats", true)], []);

describe("A11 — the runner works through phases, falsification and cleanup without asking, and stops at review", () => {
	it("runs work, falsify, work, cleanup, work, then stops at review — never the retrospective", async () => {
		const s = scripted([
			planOf([phase("Seats", false)], ["falsification", "cleanup"]),
			planOf([phase("Seats", true)], ["falsification", "cleanup"]),
			planOf(
				[phase("Seats", true), phase("Falsification — x", false)],
				["falsification", "cleanup"],
			),
			planOf([phase("Seats", true), phase("Falsification — x", true)], ["cleanup"]),
			planOf(
				[phase("Seats", true), phase("Falsification — x", true), phase("Cleanup — y", false)],
				["cleanup"],
			),
			BUILT,
		]);
		const stop = await runBuild({ ...s.deps, autoAccept: false });
		expect(s.ran).toEqual(["work", "falsify", "work", "cleanup", "work"]);
		expect(stop).toEqual({ step: "review" });
		expect(s.accepted).toEqual([]);
	});

	it("stops at a declared judgement without running a session for it", async () => {
		const judged = planOf([phase("Seats", false, ["manual smoke: open the page and look"])], []);
		const s = scripted([judged]);
		const stop = await runBuild({ ...s.deps, autoAccept: false });
		expect(stop.step).toBe("judgement");
		expect(s.ran).toEqual([]);
	});

	it("stops when two steps in a row change nothing, rather than trying forever", async () => {
		const s = scripted([planOf([phase("Seats", false)], [])], { stuck: true });
		const stop = await runBuild({ ...s.deps, autoAccept: false });
		expect(stop).toEqual({ step: "cannot-continue", why: "two steps in a row made no progress" });
		expect(s.ran).toEqual(["work", "work"]);
	});

	it("stops when a step's session fails, naming the error", async () => {
		const s = scripted([planOf([phase("Seats", false)], [])], { failAt: 1 });
		const stop = await runBuild({ ...s.deps, autoAccept: false });
		expect(stop).toEqual({
			step: "cannot-continue",
			why: "the last step's session failed: claude exited 1",
		});
	});
});

describe("plan-review-subagent A4 — after cleanup the build runs the audit, then stops at review unasked", () => {
	it("runs work, falsify, cleanup, audit, then stops at review — accept never called", async () => {
		const s = scripted([
			planOf([phase("Seats", false)], ["falsification", "cleanup", "audit"]),
			planOf([phase("Seats", true)], ["falsification", "cleanup", "audit"]),
			planOf([phase("Seats", true)], ["cleanup", "audit"]),
			planOf([phase("Seats", true)], ["audit"]),
			BUILT,
		]);
		const stop = await runBuild({ ...s.deps, autoAccept: false });
		expect(s.ran).toEqual(["work", "falsify", "cleanup", "audit"]);
		expect(stop).toEqual({ step: "review" });
		expect(s.accepted).toEqual([]);
	});
});

describe("A19 — accepting runs the release workflow", () => {
	it("acceptance is recorded, then the retrospective runs; nothing else", async () => {
		const s = scripted([BUILT]);
		const result = await runRelease({ ...s.deps }, "person");
		expect(s.accepted).toEqual(["person"]);
		expect(s.ran).toEqual(["retrospective"]);
		expect(result).toEqual({ released: true, error: null });
	});

	it("a retrospective whose session fails says so; the plan stays accepted and unlanded", async () => {
		const s = scripted([BUILT], { failAt: 1 });
		const result = await runRelease({ ...s.deps }, "person");
		expect(result).toEqual({ released: false, error: "claude exited 1" });
	});
});

describe("A20 — with auto-accept, a built plan goes on to release without the person", () => {
	it("review is reached, accepted by its workflow, and the retrospective runs", async () => {
		const s = scripted([planOf([phase("Seats", false)], []), BUILT]);
		const stop = await runBuild({ ...s.deps, autoAccept: true });
		expect(s.accepted).toEqual(["auto"]);
		expect(s.ran).toEqual(["work", "retrospective"]);
		expect(stop).toEqual({ step: "released" });
	});

	it("without it, the same build stops at review and waits", async () => {
		const s = scripted([planOf([phase("Seats", false)], []), BUILT]);
		const stop = await runBuild({ ...s.deps, autoAccept: false });
		expect(stop).toEqual({ step: "review" });
		expect(s.accepted).toEqual([]);
	});
});

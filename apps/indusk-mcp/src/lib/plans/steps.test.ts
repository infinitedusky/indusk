// promise: a-run-is-read-from-its-record
import { describe, expect, it } from "vitest";
import { derivePlanPosition, type PlanPositionState } from "../lifecycle.js";
import type { PlanSummary } from "../plan-parser.js";
import { type PlanSnapshot, planSteps, stepCount } from "./steps.js";

// promise: a-plan-shows-two-workflows
// promise: a-finished-ritual-stays-done

/**
 * plan-cockpit A10 and A11, the package's halves: the steps follow the plan's
 * type, a ritual skipped with a reason reads as skipped, and where the plan
 * stands says which step is current. Positions come from the real
 * `derivePlanPosition`, so the steps and the plan bar cannot disagree.
 */

const ALL = ["research", "brief", "test-plan", "adr", "impl"].map((d) => `${d}.md`);

function positionOf(
	stage: PlanSummary["stage"],
	stageStatus: string,
	over: { documents?: string[]; workflow?: PlanSummary["workflow"]; missing?: string[] } = {},
): PlanPositionState {
	return derivePlanPosition({
		summary: {
			name: "p",
			stage,
			stageStatus,
			nextStep: "",
			dependencies: [],
			documents: over.documents ?? ALL,
			...(over.workflow ? { workflow: over.workflow } : {}),
		},
		impl: null,
		readiness: {
			missing: over.missing ?? [],
			nonTerminalRows: [],
			unprovenPromises: [],
			longSkipReasons: [],
		} as never,
		archived: false,
	});
}

const feature = (position: PlanPositionState, over: Partial<PlanSnapshot> = {}): PlanSnapshot => ({
	workflow: "feature",
	position,
	documents: {
		research: { status: "accepted" },
		brief: { status: "accepted" },
		"test-plan": { status: "accepted" },
		adr: { status: "accepted" },
		impl: { status: "approved" },
	},
	...over,
});

const states = (steps: { name: string; state: string }[]) =>
	Object.fromEntries(steps.map((s) => [s.name, s.state]));

describe("A10 — steps follow the type", () => {
	it("A10 a bugfix lists Brief, Test plan, Impl and the Planning audit only", () => {
		const bugfix = planSteps({
			workflow: "bugfix",
			position: positionOf("impl", "in-progress", {
				workflow: "bugfix",
				documents: ["brief.md", "test-plan.md", "impl.md"],
			}),
			documents: {
				brief: { status: "accepted" },
				"test-plan": { status: "accepted" },
				impl: { status: "in-progress" },
			},
		});
		expect(bugfix.planning.map((s) => s.name)).toEqual([
			"Brief",
			"Test plan",
			"Impl",
			"Planning audit",
		]);
	});

	it("A10 a ritual skipped with a reason is skipped, carries the reason and is not owed", () => {
		const { release } = planSteps(
			feature(positionOf("impl", "completed", { missing: ["cleanup"] }), {
				skippedRituals: [{ ritual: "falsification", reason: "a docs-only plan" }],
			}),
		);
		expect(release.find((s) => s.name === "Falsify")).toEqual({
			name: "Falsify",
			state: "skipped",
			reason: "a docs-only plan",
		});
		expect(stepCount(release)).toEqual({ done: 1, total: 5 });
	});

	it("A10 a spike has research only, and no release step is owed", () => {
		const spike = planSteps({
			workflow: "spike",
			position: positionOf("research", "complete", {
				workflow: "spike",
				documents: ["research.md"],
			}),
			documents: { research: { status: "complete" } },
		});
		expect(spike.planning).toEqual([{ name: "Research", state: "done" }]);
		expect(spike.release.every((s) => s.state === "skipped")).toBe(true);
		expect(stepCount(spike.release)).toEqual({ done: 0, total: 0 });
	});

	it("A10 an absent document the plan has moved past is missing, not skipped", () => {
		const { planning } = planSteps({
			workflow: "feature",
			position: positionOf("impl", "approved", {
				documents: ["research.md", "brief.md", "adr.md", "impl.md"],
			}),
			documents: {
				research: { status: "accepted" },
				brief: { status: "accepted" },
				adr: { status: "accepted" },
				impl: { status: "approved" },
			},
		});
		expect(states(planning)["Test plan"]).toBe("missing");
	});
});

describe("A11 — the steps say where the plan is", () => {
	it("A11 mid-build: Planning done, Build current, the rest not yet", () => {
		const { planning, release } = planSteps(feature(positionOf("impl", "in-progress")));
		expect(planning.every((s) => s.state === "done")).toBe(true);
		expect(states(release)).toEqual({
			Build: "current",
			Falsify: "not-yet",
			Cleanup: "not-yet",
			Audit: "not-yet",
			Review: "not-yet",
			Release: "not-yet",
		});
		expect(stepCount(planning)).toEqual({ done: 6, total: 6 });
		expect(stepCount(release)).toEqual({ done: 0, total: 6 });
	});

	it("A11 at review: Build to Audit done, Review current", () => {
		const { release } = planSteps(feature(positionOf("impl", "completed")));
		expect(states(release)).toMatchObject({
			Build: "done",
			Falsify: "done",
			Cleanup: "done",
			Audit: "done",
			Review: "current",
			Release: "not-yet",
		});
	});

	it("A11 an ADR proposed waits for a person; accepted it is done", () => {
		const proposed = planSteps(
			feature(positionOf("adr", "proposed", { documents: ALL.slice(0, 4) }), {
				documents: {
					research: { status: "accepted" },
					brief: { status: "accepted" },
					"test-plan": { status: "accepted" },
					adr: { status: "proposed" },
				},
			}),
		);
		expect(states(proposed.planning)).toMatchObject({ Decision: "needs-you", Impl: "not-yet" });
		const accepted = planSteps(
			feature(positionOf("impl", "draft"), {
				documents: {
					research: { status: "accepted" },
					brief: { status: "accepted" },
					"test-plan": { status: "accepted" },
					adr: { status: "accepted" },
					impl: { status: "draft" },
				},
			}),
		);
		expect(states(accepted.planning)).toMatchObject({ Decision: "done", Impl: "needs-you" });
	});

	it("A11 a plan that could not be read has every step not yet", () => {
		const { planning, release } = planSteps({ workflow: "feature", documents: {} });
		expect([...planning, ...release].every((s) => s.state === "not-yet")).toBe(true);
	});
});

describe("a-finished-ritual-stays-done — a finished ritual reads done whatever the plan is doing now", () => {
	// `finishedRituals` rides in as a spread, so these rows compile before the
	// snapshot has the field and fail on a step's state, not on a type.
	const finished = (...rituals: string[]) => ({ finishedRituals: rituals });
	const reopened = (...rituals: string[]) =>
		planSteps({
			...feature(positionOf("impl", "in-progress")),
			...finished(...rituals),
		}).release;

	it("A1 falsification, cleanup and audit finished, a later build phase open: all three done, Build current", () => {
		expect(states(reopened("falsification", "cleanup", "audit"))).toMatchObject({
			Build: "current",
			Falsify: "done",
			Cleanup: "done",
			Audit: "done",
		});
	});

	it("A3 only falsification finished, a build phase open: Falsify done, Cleanup and Audit not yet", () => {
		expect(states(reopened("falsification"))).toMatchObject({
			Build: "current",
			Falsify: "done",
			Cleanup: "not-yet",
			Audit: "not-yet",
		});
	});

	it("A4 a regression guard: a ritual being worked reads current, the others not yet", () => {
		const { release } = planSteps(
			feature(positionOf("impl", "completed", { missing: ["falsification"] })),
		);
		expect(states(release)).toMatchObject({
			Falsify: "current",
			Cleanup: "not-yet",
			Audit: "not-yet",
		});
	});

	it("A5 a regression guard: a ritual skipped with a reason reads skipped with it, not done", () => {
		const { release } = planSteps({
			...feature(positionOf("impl", "in-progress")),
			skippedRituals: [{ ritual: "cleanup", reason: "nothing to extract" }],
		});
		expect(release.find((s) => s.name === "Cleanup")).toEqual({
			name: "Cleanup",
			state: "skipped",
			reason: "nothing to extract",
		});
	});
});

describe("A104 — a running build reads as the Build step in progress", () => {
	// clause: a-run-is-read-from-its-record/says-what-is-true
	const approved = () => positionOf("impl", "approved");
	it("shows Build current while a build runs, even before a phase has started", () => {
		const steps = planSteps(feature(approved(), { live: { build: true } })).release;
		expect(states(steps).Build).toBe("current");
	});
	it("shows Build not yet when nothing runs", () => {
		const steps = planSteps(feature(approved(), { live: { build: false } })).release;
		expect(states(steps).Build).toBe("not-yet");
	});
});

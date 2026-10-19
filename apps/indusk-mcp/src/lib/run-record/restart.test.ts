// clause: a-run-is-read-from-its-record/dead-reads-stopped
// promise: nothing-ships-until-accepted
import { describe, expect, it } from "vitest";
import type { PlanningDecision } from "../build/next-planning-step.js";
import type { BuildStep } from "../build/next-step.js";
import { type RestartReads, restartStep } from "./restart.js";

const reads = (over: Partial<RestartReads> = {}): RestartReads => ({
	implStatus: "in-progress",
	accepted: false,
	build: () => ({ step: "work", phase: "Build Phase 2: second" }) as BuildStep,
	planning: () => ({ step: "plan-adr" }) as PlanningDecision,
	...over,
});

describe("A11 — Build on a dead run starts the step the documents say is next", () => {
	it("A11 a build that died in the second phase restarts there", () => {
		expect(restartStep("build", reads())).toEqual({
			run: "build",
			step: { step: "work", phase: "Build Phase 2: second" },
		});
	});

	it("A11 asks the documents each time, never remembering the step it died on", () => {
		let phase = "Build Phase 2: second";
		const r = reads({ build: () => ({ step: "work", phase }) as BuildStep });
		restartStep("build", r);
		phase = "Build Phase 3: third";
		expect(restartStep("build", r)).toMatchObject({ step: { phase: "Build Phase 3: third" } });
	});
});

describe("A13 — a dead planning run restarts at the planning step the documents say is next", () => {
	it("A13 never at the release and never at a build step before approval", () => {
		for (const dead of ["planning", "build", "release"] as const) {
			const restart = restartStep(dead, reads({ implStatus: "draft", accepted: true }));
			expect(restart).toEqual({ run: "planning", decision: { step: "plan-adr" } });
		}
	});

	it("A13 a plan with no impl yet is a planning run's to restart too", () => {
		expect(restartStep("build", reads({ implStatus: null })).run).toBe("planning");
	});
});

describe("A57 — a plan not yet accepted never restarts into the release", () => {
	it("A57 a dead release of a plan not accepted starts the step the plan is at", () => {
		expect(restartStep("release", reads({ accepted: false })).run).toBe("build");
	});

	it("A57 a dead build never answers the release, accepted or not", () => {
		expect(restartStep("build", reads({ accepted: true })).run).toBe("build");
		expect(restartStep("build", reads({ accepted: false })).run).toBe("build");
	});

	it("A57 a dead release of an accepted plan restarts the release", () => {
		expect(restartStep("release", reads({ accepted: true }))).toEqual({ run: "release" });
	});
});

// promise: a-run-is-read-from-its-record

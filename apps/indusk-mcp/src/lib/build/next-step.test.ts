import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import type { RetrospectiveReadiness } from "../cleanup/gate.js";
import { parseImplString } from "../impl-parser-core.js";
import { parseTrajectory } from "../trajectory/parser.js";
import { type BuildPlan, nextBuildStep, type StepOutcome } from "./next-step.js";

/**
 * promise: a-build-runs-to-review-unasked — admin-plan-authoring A13.
 *
 * A build that cannot continue stops and says why, instead of trying again
 * without end. Three causes, from ADR D4: the step's session ended in an
 * error after its retries; two steps in a row made no progress; the open
 * phase carries a `blocker:` line. The outcome of the step just run is an
 * input the CLI cannot be handed, so this row reaches the function itself.
 */

const ready: RetrospectiveReadiness = {
	falsificationOk: true,
	cleanupOk: true,
	rowsOk: true,
	nonTerminalRows: [],
	promisesOk: true,
	unprovenPromises: [],
	passes: true,
	missing: [],
};

function fixturePlan(opts: { open?: boolean; blocker?: string } = {}): BuildPlan {
	const box = opts.open === false ? "[x]" : "[ ]";
	const text = [
		"---",
		"title: seat-holds",
		"status: in-progress",
		"---",
		"",
		"## Checklist",
		"",
		"### Build Phase 1: Seats",
		"",
		`- ${box} build seats`,
		...(opts.blocker ? ["", `blocker: ${opts.blocker}`] : []),
		"",
		"#### Build Phase 1 Verification",
		"",
		`- ${box} the tests pass`,
		"",
	].join("\n");
	return {
		impl: parseImplString(text),
		trajectory: parseTrajectory(matter(text).content),
		readiness: ready,
	};
}

const moved: StepOutcome = { progressed: true, error: null };
const stuck: StepOutcome = { progressed: false, error: null };

describe("A13 — a build that cannot continue stops and says why", () => {
	it("stops when two steps in a row change nothing", () => {
		expect(nextBuildStep(fixturePlan(), { last: stuck, previous: stuck })).toEqual({
			step: "cannot-continue",
			why: "two steps in a row made no progress",
		});
	});

	it("one step with no progress is given another try", () => {
		expect(nextBuildStep(fixturePlan(), { last: stuck, previous: moved }).step).toBe("work");
	});

	it("stops when the step's session failed after its retries, naming the error", () => {
		const step = nextBuildStep(fixturePlan(), {
			last: { progressed: false, error: "claude exited 1: rate limited" },
		});
		expect(step).toEqual({
			step: "cannot-continue",
			why: "the last step's session failed: claude exited 1: rate limited",
		});
	});

	it("stops at a blocker on the open phase, quoting it", () => {
		const step = nextBuildStep(fixturePlan({ blocker: "the seat API has no hold endpoint" }));
		expect(step.step).toBe("cannot-continue");
		expect(step).toMatchObject({
			why: expect.stringContaining("the seat API has no hold endpoint"),
		});
	});

	it("a phase that is closed is not stopped by the blocker it once had", () => {
		const step = nextBuildStep(fixturePlan({ open: false, blocker: "resolved since" }));
		expect(step.step).toBe("review");
	});
});

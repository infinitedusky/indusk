import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import type { RetrospectiveReadiness } from "../cleanup/gate.js";
import { parseImplString } from "../impl-parser-core.js";
import { parseTrajectory } from "../trajectory/parser.js";
import { type BuildPlan, nextBuildStep, type StepOutcome } from "./next-step.js";

/**
 * promise: a-build-runs-to-review-unasked — admin-plan-authoring A13.
 * promise: a-skip-reason-is-one-sentence — skip-reason-why A15, below.
 * promise: an-audit-concern-gets-a-solution — A12.
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
	longSkipReasons: [],
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
		amendments: [],
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

// promise: a-skip-reason-is-one-sentence
describe("A15 — an over-long skip reason is shortened, not re-run", () => {
	const closed = (
		missing: string[],
		longSkipReasons: RetrospectiveReadiness["longSkipReasons"],
	) => {
		const plan = fixturePlan({ open: false });
		return { ...plan, readiness: { ...ready, passes: false, missing, longSkipReasons } };
	};

	it.each(["falsification", "cleanup", "audit"] as const)(
		"%s skipped with a 300-character reason asks for the reason to be shortened",
		(ritual) => {
			const step = nextBuildStep(closed([ritual], [{ ritual, length: 300, sentences: 1 }]));
			expect(step).toEqual({ step: "shorten-reason", ritual, length: 300, sentences: 1 });
		},
	);

	it("a missing audit with no long reason still runs the audit", () => {
		expect(nextBuildStep(closed(["audit"], []))).toEqual({ step: "audit" });
	});

	it("a long reason for a ritual that is not missing is not acted on", () => {
		const step = nextBuildStep(
			closed(["audit"], [{ ritual: "cleanup", length: 300, sentences: 1 }]),
		);
		expect(step).toEqual({ step: "audit" });
	});

	it("shortens in falsification, cleanup, audit order", () => {
		const step = nextBuildStep(
			closed(
				["cleanup", "audit"],
				[
					{ ritual: "audit", length: 400, sentences: 2 },
					{ ritual: "cleanup", length: 300, sentences: 1 },
				],
			),
		);
		expect(step).toMatchObject({ step: "shorten-reason", ritual: "cleanup" });
	});
});

// clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person
describe("A12 — a waiting amendment stops the build for re-approval", () => {
	it("stops by name, instead of running a step", () => {
		const plan = { ...fixturePlan(), amendments: ["promise a-x"] };
		expect(nextBuildStep(plan)).toEqual({ step: "amendment", amendments: ["promise a-x"] });
	});
	it("stops by name when every phase is closed too", () => {
		const plan = { ...fixturePlan({ open: false }), amendments: ["promise a-x"] };
		expect(nextBuildStep(plan).step).toBe("amendment");
	});
});

// promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes
describe("A14 — the audit runs when the build phases close, before falsification", () => {
	const closed = (missing: string[]) => {
		const plan = fixturePlan({ open: false });
		return { ...plan, readiness: { ...ready, passes: false, missing } };
	};
	it("is the audit while the audit, falsification and cleanup are to do", () => {
		expect(nextBuildStep(closed(["falsification", "cleanup", "audit"]))).toEqual({ step: "audit" });
	});
	it("is falsification once the audit file exists", () => {
		expect(nextBuildStep(closed(["falsification", "cleanup"]))).toEqual({ step: "falsify" });
	});
});

// promise: an-audit-concern-gets-a-solution
// clause: an-audit-concern-gets-a-solution/the-plan-answers — A33
// promise: a-build-runs-to-review-unasked — A38
describe("Build Phase 8 — the build waits for a complete audit and an approval it can read", () => {
	it("A33 — an audit file that reads incomplete sends the build back to the audit step", () => {
		const plan = { ...fixturePlan({ open: false }), auditOpen: true };
		expect(nextBuildStep(plan)).toEqual({ step: "audit" });
		expect(nextBuildStep({ ...plan, auditOpen: false }).step).toBe("review");
	});

	it("A38 — an approval record that cannot be read stops the build saying so and what to do", () => {
		const plan = {
			...fixturePlan({ open: false }),
			approvalUnreadable: "no commit is its approval",
		};
		const step = nextBuildStep(plan);
		expect(step.step).toBe("cannot-continue");
		expect(step).toMatchObject({
			why: expect.stringContaining("the approval record cannot be read: no commit is its approval"),
		});
		expect(step).toMatchObject({ why: expect.stringContaining("re-approve the plan") });
	});
});

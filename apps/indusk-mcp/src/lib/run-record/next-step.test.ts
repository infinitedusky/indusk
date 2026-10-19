// clause: a-run-is-read-from-its-record/always-a-next-step
// clause: a-run-is-read-from-its-record/says-what-is-true
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { derivePlanPosition } from "../lifecycle.js";
import { parseAllPlans } from "../plan-parser.js";
import { type PlanSnapshot, stepAt } from "../plans/steps.js";
import { WAITING_KINDS } from "../plans/waiting.js";
import { PROCESS_GONE } from "./liveness.js";
import { nextStepFor } from "./next-step.js";
import { type SituationInput, situation } from "./situation.js";

/**
 * A70 and A71 (a-run-can-be-trusted, Build Phase 2): every plan that is not closed
 * shows a next step and who takes it.
 */

const REPO = resolve(__dirname, "../../../../..");

const base: SituationInput = {
	stepName: "Build",
	archived: false,
	landedOnMain: false,
	waitingOn: null,
	run: null,
};
const running = { state: "running" } as const;
const gone = { state: "stopped", reason: PROCESS_GONE } as const;

describe("A70 — every situation short of closed has a next step and who takes it", () => {
	const cases: Array<[string, SituationInput]> = [
		["planning", { ...base, run: { kind: "planning", status: running, step: "plan-impl" } }],
		["building", { ...base, run: { kind: "build", status: running, phase: "Build Phase 1: x" } }],
		["releasing", { ...base, run: { kind: "release", status: running } }],
		...WAITING_KINDS.map((on): [string, SituationInput] => [
			`waiting on ${on}`,
			{ ...base, waitingOn: on },
		]),
		["stopped build", { ...base, run: { kind: "build", status: gone } }],
		["stopped release", { ...base, run: { kind: "release", status: gone } }],
		["stopped planning", { ...base, run: { kind: "planning", status: gone } }],
		[
			"complete with confirmations open",
			{
				...base,
				landedOnMain: true,
				confirmations: [{ name: "p/a", kind: "clause signal", confirmed: false }],
			},
		],
		["complete, all confirmed", { ...base, landedOnMain: true, confirmations: [] }],
		["idle at a step", base],
		["idle with no step", { ...base, stepName: null }],
	];

	for (const [name, one] of cases) {
		it(`A70 ${name}`, () => {
			const next = nextStepFor(situation(one));
			expect(next).not.toBeNull();
			expect(next?.text.length).toBeGreaterThan(10);
			expect(["system", "person", "event"]).toContain(next?.by);
		});
	}

	it("A70 who takes it: the system while it runs, the person at a decision or a restart, an event while confirmations are open", () => {
		const by = (one: SituationInput) => nextStepFor(situation(one))?.by;
		expect(by({ ...base, run: { kind: "build", status: running } })).toBe("system");
		expect(by({ ...base, waitingOn: "approval" })).toBe("person");
		expect(by({ ...base, run: { kind: "build", status: gone } })).toBe("person");
		expect(
			by({
				...base,
				landedOnMain: true,
				confirmations: [{ name: "p/a", kind: "clause signal", confirmed: false }],
			}),
		).toBe("event");
	});

	it("A70 a closed plan is the only one with none", () => {
		expect(nextStepFor(situation({ ...base, archived: true }))).toBeNull();
	});
});

/**
 * A92 (a-run-can-be-trusted, Build Phase 7, falsification): a plan on main whose
 * confirmation list was not read, or could not be read, never claims everything is confirmed.
 */
describe("A92 — an unread or unreadable confirmation list never reads as everything confirmed", () => {
	it("A92 the nav row, which reads no list, says the list is on the plan's page", () => {
		const s = situation({ ...base, landedOnMain: true });
		const next = nextStepFor(s);
		expect(next?.text).not.toMatch(/everything is confirmed/i);
		expect(next?.text).toMatch(/plan's page/);
		expect(s.confirmationNote ?? "").not.toMatch(/everything it promised is confirmed/i);
	});

	it("A92 a registry that could not be read says so, naming why", () => {
		const s = situation({
			...base,
			landedOnMain: true,
			confirmations: { unreadable: "promises/a.md: no state" },
		} as unknown as SituationInput);
		const next = nextStepFor(s);
		expect(next?.text).not.toMatch(/everything is confirmed/i);
		expect(next?.text).toMatch(/could not be read: promises\/a\.md: no state/);
		expect(s.confirmationNote).toMatch(/could not be read: promises\/a\.md: no state/);
	});

	it("A92 a list that was read and is empty still says everything is confirmed", () => {
		const s = situation({ ...base, landedOnMain: true, confirmations: [] });
		expect(nextStepFor(s)?.text).toMatch(/everything is confirmed/);
		expect(s.confirmationNote).toBeUndefined();
	});
});

describe("A71 — no open plan in this repo's planning folder reads without a next step", () => {
	it("A71 every plan the project lists has a situation and a next step", () => {
		const plans = parseAllPlans(REPO);
		expect(plans.length).toBeGreaterThan(0);
		for (const summary of plans) {
			const position = derivePlanPosition({
				summary,
				impl: null,
				readiness: null,
				archived: false,
			});
			const snapshot: PlanSnapshot = {
				workflow: summary.workflow ?? null,
				position,
				documents: {},
			};
			const s = situation({ ...base, stepName: stepAt(snapshot)?.name ?? null });
			const next = nextStepFor(s);
			expect(next, `${summary.name} reads without a next step`).not.toBeNull();
		}
	});
});

// promise: a-run-is-read-from-its-record

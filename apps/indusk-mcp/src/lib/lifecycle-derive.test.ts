import { describe, expect, it } from "vitest";
import type { RetrospectiveReadiness } from "./cleanup/gate.js";
import type { ImplPhase, ParsedImpl } from "./impl-parser-core.js";
import { derivePhaseActivity, derivePlanPosition } from "./lifecycle.js";
import type { PlanSummary } from "./plan-parser.js";

/**
 * admin-ui-phase-progress — A29, A32, A33 (falsification).
 *
 * Three ways the plan bar and the phase bar can be confidently wrong:
 *
 * - A29: `resolvePosition` reads `readiness.missing` for the two rituals and
 *   nothing else, so a completed impl whose only problem is a non-terminal
 *   row reads "cleaned, awaiting /retrospective" — the gate would refuse and
 *   the bar says come ahead. A `null` readiness (unreadable impl) reads the
 *   same.
 * - A32: the parser always emits an implementation gate; a phase with no
 *   implementation items had `total === 0`, which is not "all checked", so it
 *   read "implementing 0 of 0" forever while `deriveActivePhase` said nothing
 *   was open. The falsify ritual produces exactly that phase whenever every
 *   hypothesis holds.
 * - A33: `executing` carried no message of its own; an in-progress impl with
 *   every item checked has no active phase, so the active segment was blank.
 *   D5 says the active segment always carries the message.
 */

function summary(over: Partial<PlanSummary>): PlanSummary {
	return {
		name: "demo",
		stage: "impl",
		stageStatus: "completed",
		nextStep: "",
		dependencies: [],
		documents: ["brief.md", "test-plan.md", "adr.md", "impl.md"],
		...over,
	};
}

function readiness(missing: string[]): RetrospectiveReadiness {
	return {
		falsificationOk: !missing.includes("falsification"),
		cleanupOk: !missing.includes("cleanup"),
		rowsOk: !missing.includes("rows"),
		nonTerminalRows: missing.includes("rows") ? ["A7"] : [],
		passes: missing.length === 0,
		missing,
	};
}

function phase(over: Partial<ImplPhase>): ImplPhase {
	return {
		number: 1,
		kind: "build",
		ordinal: 1,
		name: "Demo",
		gates: [],
		blocker: null,
		forwardIntelligence: null,
		...over,
	};
}

const item = (checked: boolean, text = "an item") => ({ checked, text });

describe("A29 — the plan bar names the block, never 'cleaned' over it", () => {
	it("rituals terminal but a row non-terminal: the message names the rows", () => {
		const state = derivePlanPosition({
			summary: summary({}),
			impl: null,
			readiness: readiness(["rows"]),
			archived: false,
		});
		expect(state.position).toBe("retrospective");
		expect(state.awaiting).toMatch(/rows/);
		expect(state.awaiting).not.toMatch(/cleaned/);
	});

	it("readiness could not be computed: the message says unknown, never cleaned", () => {
		const state = derivePlanPosition({
			summary: summary({}),
			impl: null,
			readiness: null,
			archived: false,
		});
		expect(state.awaiting).toMatch(/unknown/);
		expect(state.awaiting).not.toMatch(/cleaned/);
	});

	it("everything satisfied still reads cleaned, awaiting /retrospective", () => {
		const state = derivePlanPosition({
			summary: summary({}),
			impl: null,
			readiness: readiness([]),
			archived: false,
		});
		expect(state.awaiting).toMatch(/cleaned/);
	});
});

describe("A32 — an empty implementation stage is not an active stage", () => {
	it("no implementation items, every gate checked ⇒ closed, and no implementation stage", () => {
		const p = phase({
			gates: [
				{ type: "implementation", items: [] },
				{ type: "verification", items: [item(true)] },
				{ type: "context", items: [item(true)] },
				{ type: "document", items: [item(true)] },
			],
		});
		const state = derivePhaseActivity(p, null);
		expect(state.activity).toBe("closed");
		expect(state.stages.map((s) => s.kind)).not.toContain("implementation");
	});

	it("no implementation items, one unchecked Verification item ⇒ verifying", () => {
		const p = phase({
			gates: [
				{ type: "implementation", items: [] },
				{ type: "verification", items: [item(false)] },
			],
		});
		expect(derivePhaseActivity(p, null).activity).toBe("verifying");
	});

	it("implementation items present and unchecked still read implementing", () => {
		const p = phase({
			gates: [
				{ type: "implementation", items: [item(false)] },
				{ type: "verification", items: [item(false)] },
			],
		});
		expect(derivePhaseActivity(p, null).activity).toBe("implementing");
	});
});

describe("A33 — an executing plan with nothing open still carries a message", () => {
	const allChecked: ParsedImpl = {
		title: "demo",
		status: "in-progress",
		phases: [
			phase({
				gates: [
					{ type: "implementation", items: [item(true)] },
					{ type: "verification", items: [item(true)] },
				],
			}),
		],
	};

	it("in-progress, every item checked ⇒ awaiting says so", () => {
		const state = derivePlanPosition({
			summary: summary({ stageStatus: "in-progress" }),
			impl: allChecked,
			readiness: readiness(["falsification", "cleanup"]),
			archived: false,
		});
		expect(state.position).toBe("executing");
		expect(state.awaiting).toMatch(/every item checked/);
	});

	it("in-progress with an open item ⇒ no plan-level message (the active phase speaks)", () => {
		const open: ParsedImpl = {
			...allChecked,
			phases: [phase({ gates: [{ type: "implementation", items: [item(false)] }] })],
		};
		const state = derivePlanPosition({
			summary: summary({ stageStatus: "in-progress" }),
			impl: open,
			readiness: readiness(["falsification", "cleanup"]),
			archived: false,
		});
		expect(state.awaiting).toBeNull();
	});
});

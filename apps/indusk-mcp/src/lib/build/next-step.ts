import type { RetrospectiveReadiness } from "../cleanup/gate.js";
import type { ImplPhase, ParsedImpl } from "../impl-parser-core.js";
import type { Trajectory } from "../trajectory/parser.js";
import { detectHumanGate } from "./judgement.js";

/**
 * What an unattended build does next (admin-plan-authoring, ADR D4).
 *
 * A pure decision over the plan as it stands and the outcome of the steps
 * just run. The runner asks it after every step; `indusk plans next` prints
 * it. It never answers the retrospective: a build stops at review, and the
 * release begins only once the plan is accepted.
 *
 * promise: a-build-runs-to-review-unasked
 */

export interface BuildPlan {
	impl: ParsedImpl;
	trajectory: Trajectory;
	/** The retrospective's readiness: which rituals are satisfied, which rows are open. */
	readiness: RetrospectiveReadiness;
}

/** What one step's session did. */
export interface StepOutcome {
	/** An item was checked or a row's state changed. */
	progressed: boolean;
	/** The session ended in an error after its retries; null when it ended normally. */
	error: string | null;
}

export type BuildStep =
	| { step: "work"; phase: string }
	| { step: "falsify" }
	| { step: "cleanup" }
	| { step: "judgement"; phase: string; item: string; items: string[] }
	| { step: "review" }
	| { step: "cannot-continue"; why: string };

export function nextBuildStep(
	plan: BuildPlan,
	outcomes: { last?: StepOutcome; previous?: StepOutcome } = {},
): BuildStep {
	const { last, previous } = outcomes;
	if (last?.error)
		return { step: "cannot-continue", why: `the last step's session failed: ${last.error}` };
	if (last && previous && !last.progressed && !previous.progressed) {
		return { step: "cannot-continue", why: "two steps in a row made no progress" };
	}

	const open = plan.impl.phases.find(isOpen);
	if (open) {
		const phase = `${open.kind === "test" ? "Test" : "Build"} Phase ${open.number}: ${open.name}`;
		if (open.blocker)
			return { step: "cannot-continue", why: `${phase} has a blocker: ${open.blocker}` };
		const items = detectHumanGate(open, plan.trajectory);
		if (items.length > 0) return { step: "judgement", phase, item: items[0], items };
		return { step: "work", phase };
	}

	const { missing, nonTerminalRows } = plan.readiness;
	if (missing.includes("falsification")) return { step: "falsify" };
	if (missing.includes("cleanup")) return { step: "cleanup" };
	if (missing.includes("rows")) {
		return {
			step: "cannot-continue",
			why: `every phase is closed but rows are not terminal: ${nonTerminalRows.join(", ")}`,
		};
	}
	// A promise no passing row names is shown at review as unproven; the
	// person decides, and the retrospective will refuse to close until it is.
	return { step: "review" };
}

function isOpen(phase: ImplPhase): boolean {
	return phase.gates.some((g) => g.items.some((i) => !i.checked));
}

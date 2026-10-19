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
	/** What the brief says now that the person did not approve, one `<part> <name>` each; empty when nothing waits. */
	amendments: string[];
	/** `audit.md` exists and its answers do not read complete: the audit step is not done. */
	auditOpen?: boolean;
	/** Why the approval record cannot be read, when it cannot; the build cannot tell what changed. */
	approvalUnreadable?: string;
}

/** What one step's session did. */
export interface StepOutcome {
	/** An item was checked or a row's state changed. */
	progressed: boolean;
	/** The session ended in an error after its retries; null when it ended normally. */
	error: string | null;
}

/**
 * A ritual skipped with a reason longer than one sentence of at most 120 characters.
 *
 * promise: a-skip-reason-is-one-sentence
 */
export type ShortenReason = RetrospectiveReadiness["longSkipReasons"][number];

export type BuildStep =
	| { step: "work"; phase: string }
	| { step: "falsify" }
	| { step: "cleanup" }
	| { step: "audit" }
	| ({ step: "shorten-reason" } & ShortenReason)
	| { step: "judgement"; phase: string; item: string; items: string[] }
	| { step: "review" }
	| { step: "amendment"; amendments: string[] }
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

	if (plan.approvalUnreadable) {
		return {
			step: "cannot-continue",
			why: `the approval record cannot be read: ${plan.approvalUnreadable} — re-approve the plan`,
		};
	}

	// A waiting amendment is the person's to re-approve; no step runs past it.
	if (plan.amendments.length > 0) return { step: "amendment", amendments: plan.amendments };

	const open = plan.impl.phases.find(isOpen);
	if (open) {
		const phase = phaseLabel(open);
		if (open.blocker)
			return { step: "cannot-continue", why: `${phase} has a blocker: ${open.blocker}` };
		const items = detectHumanGate(open, plan.trajectory);
		if (items.length > 0) return { step: "judgement", phase, item: items[0], items };
		return { step: "work", phase };
	}

	const { missing, nonTerminalRows, longSkipReasons } = plan.readiness;
	// An over-long skip reason leaves its ritual in `missing`; running the ritual would turn
	// a skip into a full run (an audit, quietly). Rewrite the one line instead.
	for (const ritual of ["falsification", "cleanup", "audit"] as const) {
		const long = (longSkipReasons ?? []).find((r) => r.ritual === ritual);
		if (long && missing.includes(ritual)) {
			return { step: "shorten-reason", ritual, length: long.length, sentences: long.sentences };
		}
	}
	// promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes — read once, when the build phases close, before falsification
	// An `audit.md` that exists but is not answered is not a finished audit: the step runs again.
	if (missing.includes("audit") || plan.auditOpen) return { step: "audit" };
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

/** A phase as the runner and the page word it: `Build Phase 2: <name>`. */
export function phaseLabel(phase: ImplPhase): string {
	return `${phase.kind === "test" ? "Test" : "Build"} Phase ${phase.number}: ${phase.name}`;
}

/** The phase still has an unchecked item. */
export function isOpen(phase: ImplPhase): boolean {
	return phase.gates.some((g) => g.items.some((i) => !i.checked));
}

import type { ImplPhase } from "../impl-parser-core.js";
import { isOpen, phaseLabel } from "../build/next-step.js";

/**
 * The phase the build controls name (a-run-can-be-trusted, Decision 5): read from
 * the plan's own impl every time it is asked, never from the run's record, whose
 * phase is the one the run started at and is history. A run that started at Test
 * Phase 1 and has since closed three phases shows the fourth.
 *
 * clause: a-run-is-read-from-its-record/shows-where-it-is
 */

/** What `shownPhase` needs of a plan: its impl's phases, as `readBuildPlan` parsed them. */
export interface ShownPhasePlan {
	impl: { phases: readonly ImplPhase[] };
}

/**
 * The first phase with work left, worded as the runner words it; `null` when the plan
 * cannot be read or has no phase left to name, so the page names none rather than a
 * wrong one. `startedAtPhase` is accepted so callers pass the record's phase, and it
 * is deliberately never used.
 */
export function shownPhase(
	plan: ShownPhasePlan | null | undefined,
	_run: { startedAtPhase?: string | null } = {},
): string | null {
	const phases = plan?.impl?.phases;
	if (!phases) return null;
	const open = phases.find(isOpen);
	return open ? phaseLabel(open) : null;
}

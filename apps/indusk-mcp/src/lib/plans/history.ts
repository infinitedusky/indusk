import type { NoteCommit } from "../bookkeeping/notes.js";

/**
 * A plan's decisions, recorded on `main` (plan-cockpit, ADR decision 4). Stub —
 * Build Phase 6 implements it.
 *
 * promise: decisions-wait-in-one-place
 */

export interface DecisionEntry {
	decision: string;
	answer: string;
	by: string;
	at: string;
}

export function historyPath(_anyCheckout: string, _plan: string): string {
	return "";
}

export function appendDecision(
	_anyCheckout: string,
	_plan: string,
	entry: DecisionEntry,
): { entry: DecisionEntry; commit: NoteCommit } {
	return { entry, commit: { committed: false, reason: "not written yet" } };
}

export function readHistory(_anyCheckout: string, _plan: string): DecisionEntry[] {
	return [];
}

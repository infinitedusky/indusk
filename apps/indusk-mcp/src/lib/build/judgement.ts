import type { ImplPhase } from "../impl-parser-core.js";
import type { Trajectory } from "../trajectory/parser.js";

/**
 * Which open items a person must judge (admin-plan-authoring, ADR D4) — one
 * rule, read by Dawn's loop (`indusk run`) and by an unattended build's next
 * step. It moved here from `run/loop.ts`, where it was autopilot's step 1, so
 * the two would not each keep a copy.
 */

/**
 * Derive whether a phase is a human gate — no new marker required. Returns
 * the matching item texts (empty = machine-verifiable phase).
 */
export function detectHumanGate(phase: ImplPhase, trajectory: Trajectory): string[] {
	// Ids named in the Deferred Verification block — an item referencing one
	// is deferred human judgment even without matching a text pattern.
	const deferredIds = new Set(
		trajectory.deferred.flatMap((row) => row.name.match(/\b[TAU]\d+\b/g) ?? []),
	);

	const matches: string[] = [];
	for (const gate of phase.gates) {
		for (const item of gate.items) {
			if (item.checked) continue; // already handled by a human
			const referencesDeferredRow = (item.text.match(/\b[TAU]\d+\b/g) ?? []).some((id) =>
				deferredIds.has(id),
			);
			if (referencesDeferredRow || HUMAN_GATE_PATTERNS.some((p) => p.test(item.text))) {
				matches.push(item.text);
			}
		}
	}
	return matches;
}

/**
 * The plan's already-declared "a human must look" phrasings (autopilot step 1)
 * — a Deferred Verification reference, a `U`-prefixed deferred row, or a
 * manual/visual-judgment item.
 */
const HUMAN_GATE_PATTERNS: readonly RegExp[] = [
	/deferred verification/i,
	/\bU\d+\b/,
	/\bmanual smoke\b/i,
	/\bbrowser smoke\b/i,
	/\bmanual(?:ly)?\s+(?:check|verify|verification|test|review)\b/i,
	/does it look right/i,
];

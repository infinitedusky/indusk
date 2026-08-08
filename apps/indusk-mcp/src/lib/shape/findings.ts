/**
 * Turning a Shape finding into work.
 *
 * `appendFindingToPhase` returns the edited body and never writes. The caller
 * owns the write so the edit flows through the PreToolUse gate chain like any
 * other impl edit — a library that wrote impl.md directly would be a hole in
 * the gate by construction, which is precisely what `atdawn run`'s falsification
 * found when `bash` was rewriting checkboxes the `edit` gate would have refused.
 *
 * Phase 2 fills this in.
 */

export interface ShapeFinding {
	file: string;
	/** The concrete change to make. */
	change: string;
	/** The rule it came from — a finding without its basis is unreviewable. */
	rule: string;
}

export function appendFindingToPhase(
	_implBody: string,
	_phase: number,
	_finding: ShapeFinding,
): string {
	throw new Error("appendFindingToPhase is implemented in Phase 2");
}

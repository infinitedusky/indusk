/**
 * The one definition of "this name is safe to join into a path".
 *
 * Lived inside `plan-parser.ts` while plan declarations were the only
 * caller. Workbench repo names are the second caller, and the standing rule
 * here is that a primitive kept in a domain folder gets COPIED by the next
 * domain rather than imported — which is how `git()` and the phase-block scan
 * each ended up with two definitions. Moving it out on the second caller
 * rather than the third is the cheap moment.
 *
 * Both callers read a name out of a file a human edits and then join it into
 * a filesystem path. Same question, same answer — unlike `isMachineState` vs
 * `isNotCode`, which look alike and are deliberately not shared because their
 * answers genuinely differ.
 */

/**
 * A name must be a single clean path segment to be joined into a path or
 * rendered verbatim. Anything else is dropped at the boundary: degrade to
 * structure-loss, never a path traversal or a raw render.
 */
export function isCleanSegment(name: string): boolean {
	return (
		name.trim() !== "" &&
		name !== "." &&
		name !== ".." &&
		!name.includes("/") &&
		!name.includes("\\")
	);
}

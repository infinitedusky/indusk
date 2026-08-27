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

/**
 * Directories a declared path must never resolve onto.
 *
 * `isCleanSegment` answers "could this traverse?" — it cannot answer "does
 * this collide?". `.git`, `.indusk` and `.claude` are all single clean
 * segments, so a config declaring `worktrees: ".git"` would place worktrees
 * inside the workbench's own git directory. Collision is a different question
 * from traversal and needs its own answer.
 */
const RESERVED_SEGMENTS = new Set([".git", ".indusk", ".claude"]);

/** A clean segment that does not collide with machine-owned state. */
export function isUsableSegment(name: string): boolean {
	return isCleanSegment(name) && !RESERVED_SEGMENTS.has(name);
}

/**
 * A layout value: a relative path inside the workbench, of any depth.
 *
 * `isUsableSegment` answers the same question for a NAME, where one segment is
 * the whole point. A location is different — `worktrees/alpha` and `repos` are
 * both legitimate places to put things, and forcing them into one segment made
 * the only expressible nesting a per-repo directory at the root.
 *
 * What must still hold is that the value cannot leave the workbench. That is
 * three separate checks, and `..` is the one worth stating: it is refused in
 * ANY position, not just the front, because `a/../../b` escapes just as surely
 * as `../b` does. `.` alone is allowed and means the workbench root itself.
 */
export function isUsableRelPath(p: string): boolean {
	if (p.trim() === "" || p === "..") return false;
	if (p.startsWith("/") || p.startsWith("~") || p.includes("\\")) return false;
	if (p === ".") return true;
	const parts = p.split("/");
	if (parts.some((seg) => seg === "" || seg === "..")) return false;
	// The first segment lands at the workbench root, where machine-owned
	// directories live. `.git/x` is a perfectly clean relative path.
	return !RESERVED_SEGMENTS.has(parts[0]);
}

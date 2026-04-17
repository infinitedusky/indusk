import type { Trajectory, TrajectoryRow, TrajectoryState } from "./parser.js";
import { parseTrajectory } from "./parser.js";

/**
 * Rows whose `Writable at` equals the given phase and whose state is not
 * yet `written` or beyond. These are tests the author should commit as
 * failing at phase start (before implementation work).
 */
export function getRowsWritableAt(trajectory: Trajectory, phase: number): TrajectoryRow[] {
	return trajectory.rows.filter(
		(row) =>
			row.writableAt === phase &&
			(row.state === "planned" || row.state === "writable" || row.state === "unknown"),
	);
}

/**
 * Rows whose `Passes at` equals the given phase, regardless of current state.
 * These are the tests that must be in `passing` (or `skipped` with reason)
 * before the phase can close.
 */
export function getRowsPassingAt(trajectory: Trajectory, phase: number): TrajectoryRow[] {
	return trajectory.rows.filter((row) => row.passesAt === phase);
}

/**
 * Rows that block phase-close for the given phase. A row blocks if its
 * `Passes at` equals the phase AND its state is not one of the terminal
 * states (`passing`, `skipped`, `blocked` — blocked implies a tracked
 * investigation, not a silent fail).
 */
export function getRowsBlockingPhaseClose(trajectory: Trajectory, phase: number): TrajectoryRow[] {
	return trajectory.rows.filter(
		(row) =>
			row.passesAt === phase &&
			row.state !== "passing" &&
			row.state !== "skipped" &&
			row.state !== "blocked",
	);
}

/**
 * Update the `State` column for a specific row ID in an impl.md body.
 * Returns the new body. The input must be the full impl body (after
 * frontmatter); the output is body markdown with exactly one cell changed.
 *
 * If the row ID is not found, returns the body unchanged.
 */
export function updateRowState(body: string, id: string, newState: TrajectoryState): string {
	const lines = body.split("\n");
	let inTrajectoryTable = false;
	let headerCells: string[] | null = null;
	let stateIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (/^##\s+Test Trajectory\b/.test(line)) {
			inTrajectoryTable = true;
			headerCells = null;
			stateIndex = -1;
			continue;
		}

		if (!inTrajectoryTable) continue;

		// A new heading ends the trajectory block
		if (/^#{1,3}\s+/.test(line) && !/^##\s+Test Trajectory\b/.test(line)) {
			inTrajectoryTable = false;
			continue;
		}

		const trimmed = line.trim();
		if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;

		const cells = trimmed
			.slice(1, -1)
			.split("|")
			.map((c) => c.trim());

		// Header row: find the State column index
		if (!headerCells) {
			headerCells = cells;
			stateIndex = cells.findIndex((c) => c.toLowerCase() === "state");
			continue;
		}

		// Separator row: skip
		if (cells.every((c) => /^:?-+:?$/.test(c))) continue;

		// Data row: check ID and update State
		if (cells[0] !== id || stateIndex === -1) continue;
		if (cells[stateIndex] === newState) return body;

		const newCells = [...cells];
		newCells[stateIndex] = newState;
		// Preserve the leading/trailing pipe and surrounding whitespace
		const leadingWs = line.match(/^\s*/)?.[0] ?? "";
		lines[i] = `${leadingWs}| ${newCells.join(" | ")} |`;
		return lines.join("\n");
	}

	return body;
}

/**
 * Convenience: parse the body, compute blocking rows, and return error
 * messages suitable for a hook's stderr. Returns empty array if phase can
 * close cleanly.
 */
export function computePhaseCloseBlockers(
	body: string,
	phase: number,
): { row: TrajectoryRow; message: string }[] {
	const trajectory = parseTrajectory(body);
	if (!trajectory.present) return [];
	const blocking = getRowsBlockingPhaseClose(trajectory, phase);
	return blocking.map((row) => ({
		row,
		message: `  [${row.id}] ${row.asserts} — state: ${row.state} (must be 'passing' or 'skipped' to close Phase ${phase})`,
	}));
}

/**
 * Convenience: nudge text for phase start. Returns a string listing rows
 * whose `Writable at` equals the phase and are not yet written, or null
 * if nothing needs authoring.
 */
export function getPhaseStartNudge(body: string, phase: number): string | null {
	const trajectory = parseTrajectory(body);
	if (!trajectory.present) return null;
	const rows = getRowsWritableAt(trajectory, phase);
	if (rows.length === 0) return null;
	const lines = rows.map((r) => `  [${r.id}] ${r.asserts}`);
	return `Phase ${phase} opens with these tests to author (commit as failing before implementation work):\n${lines.join("\n")}`;
}

/**
 * Convenience: nudge text for near-phase-close. Returns a string listing
 * rows whose `Passes at` equals the phase but state is not yet `passing`
 * or `skipped`, or null if the trajectory for this phase is green.
 */
export function getPhaseCloseNudge(body: string, phase: number): string | null {
	const trajectory = parseTrajectory(body);
	if (!trajectory.present) return null;
	const blocking = getRowsBlockingPhaseClose(trajectory, phase);
	if (blocking.length === 0) return null;
	const lines = blocking.map((r) => `  [${r.id}] ${r.asserts} — state: ${r.state}`);
	return `Phase ${phase} cannot close until these trajectory rows are 'passing' or 'skipped':\n${lines.join("\n")}`;
}

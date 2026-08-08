import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * The phase-boundary record — where a phase began.
 *
 * **Deliberately generic, not Shape-specific.** Shape is its first consumer,
 * but `verify` (when it wires into this lane) and `Challenge` (when it lands)
 * ask the same question: what happened between the start of this phase and now?
 * A second near-identical single-consumer ledger would be the beginning of a
 * family of them, so the artifact is designed for the boundary rather than for
 * whoever needed it first.
 *
 * Created on demand — an absent file means no phase has been opened, not that
 * anything is broken.
 */

export interface PhaseBoundaryRecord {
	plan: string;
	phase: number;
	/** The commit the phase opened at. */
	sha: string;
	timestamp: string;
}

export const BOUNDARY_REL_PATH = join(".indusk", "phase-boundary.jsonl");

export function boundaryPath(root: string): string {
	return join(root, BOUNDARY_REL_PATH);
}

/**
 * Read every boundary record. A malformed line THROWS rather than being skipped.
 *
 * Skipping would silently lose a phase's start, and a missing start widens the
 * review scope to include earlier phases' code — which looks exactly like Shape
 * working, while actually re-flagging work someone already reviewed. Same rule
 * the verify ledger follows for the same reason.
 */
export async function readBoundaries(root: string): Promise<PhaseBoundaryRecord[]> {
	let raw: string;
	try {
		raw = await readFile(boundaryPath(root), "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw new Error(
			`Could not read the phase-boundary record at ${BOUNDARY_REL_PATH}: ${(err as Error).message}`,
		);
	}

	const records: PhaseBoundaryRecord[] = [];
	const lines = raw.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.length === 0) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			throw new Error(
				`Corrupt phase-boundary record: ${BOUNDARY_REL_PATH} line ${i + 1} is not valid JSON. Refusing to guess where a phase began — repair or remove the file.`,
			);
		}
		if (!isBoundaryRecord(parsed)) {
			throw new Error(
				`Corrupt phase-boundary record: ${BOUNDARY_REL_PATH} line ${i + 1} is missing required fields (plan, phase, sha).`,
			);
		}
		records.push(parsed);
	}
	return records;
}

function isBoundaryRecord(value: unknown): value is PhaseBoundaryRecord {
	if (typeof value !== "object" || value === null) return false;
	const r = value as Record<string, unknown>;
	return (
		typeof r.plan === "string" &&
		typeof r.phase === "number" &&
		Number.isFinite(r.phase) &&
		typeof r.sha === "string" &&
		r.sha.length > 0
	);
}

export async function recordPhaseStart(
	root: string,
	record: { plan: string; phase: number; sha: string; at: string },
): Promise<void> {
	const path = boundaryPath(root);
	await mkdir(dirname(path), { recursive: true });
	const line: PhaseBoundaryRecord = {
		plan: record.plan,
		phase: record.phase,
		sha: record.sha,
		timestamp: record.at,
	};
	await appendFile(path, `${JSON.stringify(line)}\n`, "utf8");
}

/**
 * Where phase N of this plan began. Null when the phase was never opened —
 * callers must treat that as "cannot scope the review", never as "review
 * everything".
 */
export function findPhaseStart(
	records: PhaseBoundaryRecord[],
	plan: string,
	phase: number,
): PhaseBoundaryRecord | null {
	let best: PhaseBoundaryRecord | null = null;
	for (const record of records) {
		if (record.plan !== plan || record.phase !== phase) continue;
		// A later record for the same phase supersedes an earlier one — a phase
		// re-opened after a stop starts from where it actually resumed.
		best = record;
	}
	return best;
}

import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Trajectory } from "../trajectory/parser.js";

/**
 * The chained verify ledger — where the "before" comes from when Dawn didn't
 * run the work.
 *
 * Each clean verification records the boundary it judged; the next phase's
 * verification uses that record as its baseline. The chain is a byproduct of
 * verifying, not a ceremony someone has to remember before dispatching work —
 * which matters because a forgotten pre-dispatch snapshot would mean no
 * verification, silently, in exactly the case this exists for.
 *
 * Failure-safety here is the deliberate INVERSE of the pending-eval ledger.
 * That one writes its done-marker BEFORE the risky operation, so a crash leaves
 * a gap rather than a double-eval. This one writes only AFTER a clean verdict,
 * because the danger is not duplication — it is a bad phase silently becoming
 * the yardstick the next phase is measured against.
 */

export interface VerifyRecord {
	plan: string;
	phase: number;
	/** The commit this verification judged as the phase boundary. */
	sha: string;
	/** Hash of the trajectory table at that boundary — the goalpost fingerprint. */
	trajectory: string;
	timestamp: string;
}

export const LEDGER_REL_PATH = join(".indusk", "verify", "ledger.jsonl");

export function ledgerPath(root: string): string {
	return join(root, LEDGER_REL_PATH);
}

/**
 * Read every record. A malformed line THROWS rather than being skipped.
 *
 * Skipping a bad line would silently shorten the chain, and a shortened chain
 * degrades into bootstrap mode — which produces a confident report against the
 * wrong baseline. That failure is indistinguishable from success from the
 * outside, so it has to be loud.
 */
export async function readLedger(root: string): Promise<VerifyRecord[]> {
	let raw: string;
	try {
		raw = await readFile(ledgerPath(root), "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw new Error(
			`Could not read the verify ledger at ${LEDGER_REL_PATH}: ${(err as Error).message}`,
		);
	}

	const records: VerifyRecord[] = [];
	const lines = raw.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.length === 0) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			throw new Error(
				`Corrupt verify ledger: ${LEDGER_REL_PATH} line ${i + 1} is not valid JSON. Refusing to verify against an unknown baseline — repair or remove the ledger.`,
			);
		}
		if (!isVerifyRecord(parsed)) {
			throw new Error(
				`Corrupt verify ledger: ${LEDGER_REL_PATH} line ${i + 1} is missing required fields (plan, phase, sha). Refusing to verify against an unknown baseline.`,
			);
		}
		records.push(parsed);
	}
	return records;
}

function isVerifyRecord(value: unknown): value is VerifyRecord {
	if (typeof value !== "object" || value === null) return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.plan === "string" &&
		typeof record.phase === "number" &&
		Number.isFinite(record.phase) &&
		typeof record.sha === "string" &&
		record.sha.length > 0
	);
}

export async function appendVerifyRecord(root: string, record: VerifyRecord): Promise<void> {
	const path = ledgerPath(root);
	await mkdir(dirname(path), { recursive: true });
	await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
}

/**
 * The chain's lookup rule: the baseline for phase N is this plan's record for
 * the highest phase strictly below N. Null means "never verified" — bootstrap.
 */
export function findBaselineRecord(
	records: VerifyRecord[],
	plan: string,
	phase: number,
): VerifyRecord | null {
	let best: VerifyRecord | null = null;
	for (const record of records) {
		if (record.plan !== plan) continue;
		if (record.phase >= phase) continue;
		// `>=` so a later record for the same phase supersedes an earlier one.
		if (best === null || record.phase >= best.phase) best = record;
	}
	return best;
}

/** Fingerprint the goalposts so drift is detectable even without the old file. */
export function hashTrajectory(trajectory: Trajectory): string {
	const canonical = trajectory.rows.map((row) => ({
		id: row.id,
		asserts: row.asserts,
		writableAt: row.writableAt,
		passesAt: row.passesAt,
	}));
	return `sha256:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

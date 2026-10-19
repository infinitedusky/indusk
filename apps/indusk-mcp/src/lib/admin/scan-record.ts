import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeFileDurably } from "../always-on/durable-write.js";
import { induskHome } from "../telemetry/status.js";

/**
 * The recorder loop's scan record: for each project, the last pass's start, end and
 * outcome, in machine state (`<INDUSK_HOME>/recorder-scan.json`). A pass that threw is
 * recorded `ok: false` with its message — a scan that did not finish. The patient recorder
 * test reads it to know whether the admin has scanned since a break was loaded.
 *
 * promise: a-production-break-is-recorded-unasked
 * clause: landing-tests-hold-under-load/recorder-waits-for-its-break
 */

export interface ScanRecord {
	startedAt: number;
	endedAt: number;
	ok: boolean;
	error?: string;
}

export function scanRecordPath(home: string = induskHome()): string {
	return join(home, "recorder-scan.json");
}

/** Every project's last scan; empty when none was written or the file cannot be read. */
export function readScanRecords(home: string = induskHome()): Record<string, ScanRecord> {
	const path = scanRecordPath(home);
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as Record<string, ScanRecord>;
	} catch {
		return {};
	}
}

/** Replace the project's last scan, the whole file written to a temp file and renamed. */
export function writeScanRecord(
	root: string,
	record: ScanRecord,
	home: string = induskHome(),
): void {
	const all = readScanRecords(home);
	all[root] = record;
	writeFileDurably(scanRecordPath(home), `${JSON.stringify(all, null, 2)}\n`);
}

/** True only for a pass that started after `since` and ended ok. */
export function scanFinishedAfter(record: ScanRecord | undefined, since: number): boolean {
	return record?.ok === true && record.startedAt > since;
}

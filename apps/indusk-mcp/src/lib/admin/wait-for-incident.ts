/**
 * The patient wait of the recorder landing test: wait for the incident the
 * admin was expected to commit, or for the admin to finish a scan after the
 * break was loaded and find none — never for a fixed minute, which a busy
 * machine outlasts. The clock and the reads are inputs, so the rule is decided
 * from values (`lesson: code-that-decides-takes-its-clock-and-its-reads`).
 *
 * The upper bound ends only a hung admin; it is not the rule.
 *
 * promise: a-production-break-is-recorded-unasked
 * clause: landing-tests-hold-under-load/recorder-waits-for-its-break
 */

/** Generous: only stops an admin that never scans again. Four minutes. */
export const INCIDENT_WAIT_UPPER_BOUND_MS = 4 * 60_000;

export interface WaitForIncidentInput {
	now: () => number;
	sleep: (ms: number) => Promise<void>;
	/** The recorded incident, or null while there is none. */
	incident: () => string | null;
	/** True only for a pass that started after the break was loaded and ended ok. */
	scanFinishedAfterBreak: () => boolean;
	upperBoundMs?: number;
	pollMs?: number;
	/** Names the break in the failure. */
	breakName?: string;
	/** The last pass's error, named when the wait ends without a finished scan. */
	lastScanError?: () => string | undefined;
}

export async function waitForIncident(input: WaitForIncidentInput): Promise<{ found: string }> {
	const upper = input.upperBoundMs ?? INCIDENT_WAIT_UPPER_BOUND_MS;
	const poll = input.pollMs ?? 1_000;
	const name = input.breakName ?? "the break";
	const started = input.now();
	for (;;) {
		// Read the scan first: an incident is written before its pass ends, so a
		// scan seen finished here means the incident, if any, is already visible.
		const finished = input.scanFinishedAfterBreak();
		const found = input.incident();
		if (found !== null) return { found };
		if (finished) {
			throw new Error(
				`${name} was not recorded: the admin finished a scan after it was loaded and found no incident`,
			);
		}
		if (input.now() - started >= upper) {
			const error = input.lastScanError?.();
			throw new Error(
				`${name} was not recorded within ${upper} ms and the admin finished no scan after it was loaded${error ? ` (last pass failed: ${error})` : ""}`,
			);
		}
		await input.sleep(poll);
	}
}

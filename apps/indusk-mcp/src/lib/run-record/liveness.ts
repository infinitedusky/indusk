import type { ProcessDeps } from "../process-identity.js";
import type { RunRecord } from "./record.js";

export interface RunStatus {
	state: "running" | "stopped" | "unknown";
	reason?: string;
}

/** Not yet the rule: reads every record as unknown. */
export function runStatus(
	_record: RunRecord | "unknown" | null,
	_deps: ProcessDeps,
	_heldHere: boolean,
): RunStatus {
	return { state: "unknown" };
}

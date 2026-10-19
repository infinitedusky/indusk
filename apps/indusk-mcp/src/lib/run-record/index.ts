/**
 * A run's record on disk and the rules read from it (a-run-can-be-trusted).
 * Its own export, not the `build` one: the admin's tests stand the `build`
 * export in for the runner, and the record must stay real beside them.
 */

export { type PsRow, psAll, realProcessReads } from "../process-identity.js";
export { type RunStatus, runStatus } from "./liveness.js";
export {
	type RunKind,
	type RunProcess,
	type RunRecord,
	readRunRecord,
	runRecordPath,
	startRunRecord,
	writeRunRecord,
} from "./record.js";
export { type Restart, type RestartReads, restartStep } from "./restart.js";

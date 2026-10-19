/**
 * A run's record on disk and the rules read from it (a-run-can-be-trusted).
 * Its own export, not the `build` one: the admin's tests stand the `build`
 * export in for the runner, and the record must stay real beside them.
 */

export { type PsRow, psAll, realProcessReads } from "../process-identity.js";
export {
	type GitReads,
	landedOnMain,
	landingSubject,
	NOT_ON_MAIN,
	planLandedOnMain,
	type ReleaseOutcome,
	realGitReads,
	releaseOutcome,
} from "./landed.js";
export { type RunStatus, runStatus } from "./liveness.js";
export { type NextStep, nextStepFor } from "./next-step.js";
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
export { type ShownPhasePlan, shownPhase } from "./shown-phase.js";
export {
	type DeadReadsInput,
	type IdleInput,
	reportDeadReadsStopped,
	reportKeptOnDisk,
	reportNotInProgressWhenIdle,
} from "./signals.js";
export {
	type Confirmation,
	type ConfirmationSources,
	confirmationsOf,
	liveCheckRecorded,
	openConfirmations,
	planningWords,
	type Situation,
	type SituationInput,
	type SituationKind,
	situation,
	waitingWords,
} from "./situation.js";
export {
	expectedAudit,
	judgeNextStep,
	judgePlanningAudit,
	judgeReleased,
	judgeSaysWhatIsTrue,
	judgeShowsWhereItIs,
	readReviewText,
	reportNextStep,
	reportPlanningAudit,
	reportReleased,
	reportSaysWhatIsTrue,
	reportShowsWhereItIs,
	type TrueInput,
	trunkMergeSubjects,
} from "./situation-signals.js";
export { stopSentence } from "./stop-sentence.js";

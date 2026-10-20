import type { WaitingOn } from "../plans/waiting.js";
import type { RunStatus } from "./liveness.js";
import type { RunKind } from "./record.js";

/**
 * A plan's situation, said in words from one place (a-run-can-be-trusted,
 * Build Phase 2): planning (and its step), building (and its phase), waiting on the
 * person (and for what), complete (merged to main) with what is still to be
 * confirmed, or stopped (and why, and what starts it again). The plan page and the
 * nav row both ask this; neither composes its own sentence.
 *
 * What it will not do is read in progress without a process: planning, building and
 * releasing need the run's live status to say running, and a run whose process is gone
 * reads stopped (`never-in-progress-when-idle`). Landing is read from the trunk by the
 * caller (`landedOnMain`), never from branch containment.
 *
 * clause: a-run-is-read-from-its-record/says-what-is-true
 * clause: a-run-is-read-from-its-record/never-in-progress-when-idle
 */

export type SituationKind =
	| "planning"
	| "building"
	| "releasing"
	| "waiting"
	| "stopped"
	| "complete"
	| "closed"
	| "idle";

/** One thing still to be confirmed (or already confirmed) after a plan is on main. */
export interface Confirmation {
	/** `<promise>/<clause>` for a clause signal, the row's id for a live check. */
	name: string;
	kind: "clause signal" | "live check";
	confirmed: boolean;
}

export interface SituationInput {
	/** The plan's current step as `stepAt` names it, when it has one. */
	stepName: string | null;
	/** The plan is in the archive. */
	archived: boolean;
	/** The plan is on the trunk: its landing merge or archive folder is there. */
	landedOnMain: boolean;
	/** What the plan waits on the person for, from `planWaiting`; null when nothing. */
	waitingOn: WaitingOn | null;
	/** The newest run of the plan, with what the run reader says of it. */
	run: {
		kind: RunKind;
		status: RunStatus;
		/** The planning step running, as the planning runner names it. */
		step?: string | null;
		/** The phase the plan is on (`shownPhase`), never the run's start. */
		phase?: string | null;
		/** The step the record's stop names (`ready-for-approval`, `review`, …), when it stopped on its own. */
		stopStep?: string | null;
	} | null;
	/**
	 * The confirmation list of a plan on main: the list when it was read, `{ unreadable }` when
	 * the promise registry could not be read, absent when it was not read (the nav row reads
	 * none). Only a list that was read and holds nothing open says everything is confirmed.
	 */
	confirmations?: readonly Confirmation[] | { unreadable: string };
}

export interface Situation {
	kind: SituationKind;
	/** The sentence, as the page and the nav row show it. */
	text: string;
	/** A process runs for the plan right now: the only case anything pulses or reads in progress. */
	running: boolean;
	/** What the plan waits on, when `kind` is `waiting`. */
	waitingOn?: WaitingOn;
	/** Why a stopped run stopped. */
	reason?: string;
	/** The run that stopped, when `kind` is `stopped`. */
	stoppedKind?: RunKind;
	/** The step the plan is at, kept for the next step's words. */
	stepName?: string | null;
	/** A plan on main: each clause signal and live check, ticked as confirmed. */
	confirmations?: readonly Confirmation[];
	/**
	 * A plan on main whose list was not read or could not be read: what to say in its place,
	 * never that everything is confirmed (A92).
	 */
	confirmationNote?: string;
}

/** What each planning step is doing, in words. */
const PLANNING_WORDS: Record<string, string> = {
	"plan-test-plan": "writing the test plan",
	"plan-adr": "writing the decision",
	"plan-impl": "writing the impl",
	"plan-review": "reading the plan cold (the planning audit)",
};

export const planningWords = (step: string | null | undefined): string =>
	(step ? PLANNING_WORDS[step] : undefined) ?? "writing the plan";

/** What a plan waits on, in words that tell the person what to do. */
const WAITING_WORDS: Record<WaitingOn, string> = {
	question: "an agent is waiting for your answer",
	approval: "the plan is written; approve it",
	review: "the build is done; review it",
	amendment: "the brief changed after you approved it; re-approve it",
	"plan-review": "its plan review is still to be written",
};

export const waitingWords = (on: WaitingOn): string => WAITING_WORDS[on];

/**
 * The stops a runner makes when it has done its part and handed the plan to the person
 * (planning: ready for approval, waiting for looks; build: at review; release: released).
 * Once nothing waits on the person, the person has answered, so such a run is not a stopped
 * one: the plan reads the step it is at (A91). A death, a refusal, an amendment, a judgement,
 * a rate limit and a failed release are not among them.
 */
const CLEAN_ENDS: ReadonlySet<string> = new Set([
	"ready-for-approval",
	"wait-for-looks",
	"review",
	"released",
]);

const endedCleanly = (run: SituationInput["run"]): boolean =>
	run?.status.state === "stopped" &&
	typeof run.stopStep === "string" &&
	CLEAN_ENDS.has(run.stopStep);

/** The confirmations still open. */
export const openConfirmations = (c: readonly Confirmation[] | undefined): Confirmation[] =>
	(c ?? []).filter((x) => !x.confirmed);

/** What a plan on main says in place of a list nobody read. */
export const CONFIRMATIONS_NOT_READ = "see the plan's page for what is left to confirm";

/** What a plan on main says when its promise registry could not be read. */
export const confirmationsUnreadable = (reason: string): string =>
	`the promise registry could not be read: ${reason}; what is left to confirm is not known`;

function confirmationsRead(c: SituationInput["confirmations"]): {
	list: readonly Confirmation[] | undefined;
	note: string | undefined;
} {
	if (c === undefined) return { list: undefined, note: CONFIRMATIONS_NOT_READ };
	if ("unreadable" in c) return { list: undefined, note: confirmationsUnreadable(c.unreadable) };
	return { list: c, note: undefined };
}

export function situation(input: SituationInput): Situation {
	const { run } = input;
	const base = { stepName: input.stepName };
	const { list: confirmations, note } = confirmationsRead(input.confirmations);
	const open = openConfirmations(confirmations);

	// On the trunk: complete, whatever a release record says about how it ended.
	if (input.landedOnMain || (input.archived && open.length > 0)) {
		const text =
			open.length > 0
				? `Complete — merged to main; ${open.length} still to confirm`
				: "Complete — merged to main";
		return {
			...base,
			kind: "complete",
			text,
			running: false,
			confirmations: confirmations ?? [],
			...(note === undefined ? {} : { confirmationNote: note }),
		};
	}
	if (input.archived) return { ...base, kind: "closed", text: "Closed", running: false };

	// Only a live process reads as in progress.
	if (run?.status.state === "running") {
		if (run.kind === "planning") {
			return {
				...base,
				kind: "planning",
				text: `Planning — ${planningWords(run.step)}`,
				running: true,
			};
		}
		if (run.kind === "release") {
			return {
				...base,
				kind: "releasing",
				text: "Releasing — the retrospective is landing it",
				running: true,
			};
		}
		return {
			...base,
			kind: "building",
			text: run.phase ? `Building — ${run.phase}` : "Building",
			running: true,
		};
	}

	if (input.waitingOn) {
		return {
			...base,
			kind: "waiting",
			text: `Waiting on you — ${waitingWords(input.waitingOn)}`,
			running: false,
			waitingOn: input.waitingOn,
		};
	}

	if (run?.status.state === "stopped" && !endedCleanly(run)) {
		const reason = run.status.reason ?? "it ended";
		const again =
			run.kind === "planning" ? "Build starts the planning again" : "Build starts it again";
		return {
			...base,
			kind: "stopped",
			text: `Stopped — ${reason}. ${again}${run.phase ? ` at ${run.phase}` : ""}.`,
			running: false,
			reason,
			stoppedKind: run.kind,
		};
	}

	const at = input.stepName ? `At ${input.stepName}` : "Nothing left to do before it closes";
	return { ...base, kind: "idle", text: `${at}; nothing is running`, running: false };
}

/** A result that says the check did not pass: such a line records nothing (A93). */
const FAILED_RESULT = /\b(?:fail|failed|red|broken|refused)\b/i;

/**
 * Each live-check row's id, recorded once a line of the impl's Notes holds its id beside a date
 * and a result that is not a failure (`fail`, `failed`, `red`, `broken`, `refused`).
 */
export function liveCheckRecorded(implBody: string, id: string): boolean {
	const notes = implBody.split(/^## Notes\s*$/m)[1];
	if (notes === undefined) return false;
	const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const names = new RegExp(`\\b${escaped}\\b.*\\d{4}-\\d{2}-\\d{2}`);
	return notes.split("\n").some((line) => names.test(line) && !FAILED_RESULT.test(line));
}

export interface ConfirmationSources {
	/** The promises the plan makes, each with its clauses and where each stands. */
	promises: ReadonlyArray<{
		name: string;
		/** The registry has the promise in force (`enforced`). */
		inForce?: boolean;
		clauses: ReadonlyArray<{
			clause: string;
			kind: "split" | "limit" | "rests-on";
			standing: "broken" | "no-signal" | "holding";
		}>;
	}>;
	/** The impl's rows of level `live check`, with whether the Notes hold a result for each. */
	liveChecks: ReadonlyArray<{ id: string; recorded: boolean }>;
}

/**
 * What a plan on main still has to confirm: each split and limit clause, confirmed once its
 * signal reports it holding in a real run, and each live check, confirmed once its result is
 * written in Notes. A resting clause counts through the promise it rests on. A promise with no
 * split or limit clause is one confirmation by its own name, confirmed only once the registry
 * has it in force (A93).
 */
export function confirmationsOf(src: ConfirmationSources): Confirmation[] {
	return [
		...src.promises.flatMap((p) => {
			const own = p.clauses.filter((c) => c.kind !== "rests-on");
			if (own.length === 0)
				return [{ name: p.name, kind: "clause signal" as const, confirmed: p.inForce === true }];
			return own.map((c) => ({
				name: `${p.name}/${c.clause}`,
				kind: "clause signal" as const,
				confirmed: c.standing === "holding",
			}));
		}),
		...src.liveChecks.map((l) => ({
			name: l.id,
			kind: "live check" as const,
			confirmed: l.recorded,
		})),
	];
}

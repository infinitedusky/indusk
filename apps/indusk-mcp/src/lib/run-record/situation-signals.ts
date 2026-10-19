import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Tracer } from "@opentelemetry/api";
import { isAnswered } from "../audit/answers.js";
import { planReviewAnswers } from "../plans/plan-review.js";
import type { PsRow } from "../process-identity.js";
import { type ClauseVerdict, writeClauseSignals } from "../promises/clause-signal.js";
import type { SessionRecord } from "../session/manager.js";
import type { SituationKind } from "./situation.js";

/**
 * The signals for five more clauses of `a-run-is-read-from-its-record`
 * (a-run-can-be-trusted, Build Phase 2; Decision 17). Each judges from a source the
 * code it checks does not use: the process table and the session manager's own sessions,
 * a plain `git log` of the trunk, the phase the live step session was started for, and
 * `plan-review.md` read straight from disk. None calls `situation()`, `shownPhase`,
 * `releaseOutcome` or the run record. Each is best-effort: a signal never fails the page.
 *
 * clause: a-run-is-read-from-its-record/shows-where-it-is
 * clause: a-run-is-read-from-its-record/released-only-when-landed
 * clause: a-run-is-read-from-its-record/says-what-is-true
 * clause: a-run-is-read-from-its-record/always-a-next-step
 * clause: a-run-is-read-from-its-record/the-planning-audit-is-a-step
 */

const PROMISE = "a-run-is-read-from-its-record";
const SIGNAL = { plan: "a-run-can-be-trusted", phase: "Build Phase 2" };
const START_TOLERANCE_MS = 5000;

const verdict = (clause: string, broken: string | null): ClauseVerdict => ({
	promise: PROMISE,
	clause,
	...(broken === null ? {} : { broken }),
});

async function report(
	root: string,
	span: string,
	plan: string,
	v: ClauseVerdict | null,
	tracer?: Tracer,
): Promise<void> {
	try {
		if (v) await writeClauseSignals(root, span, plan, SIGNAL, [v], tracer);
	} catch {
		// best-effort
	}
}

/** `ps` shows the process `pid` started at `startedAt`, read from the whole table. */
function livesIn(table: readonly PsRow[], pid: number, startedAt: string): boolean {
	const at = Date.parse(startedAt);
	return table.some(
		(r) =>
			r.pid === pid &&
			r.startedAt !== null &&
			Math.abs(Date.parse(r.startedAt) - at) <= START_TOLERANCE_MS,
	);
}

/** shows-where-it-is: while a build runs, the phase shown equals the phase the live session works. */
export function judgeShowsWhereItIs(input: {
	plan: string;
	shown: string | null;
	/** The phase the live step session was started for, from the runner's own report. */
	sessionPhase: string | null;
}): ClauseVerdict | null {
	if (input.sessionPhase === null) return null;
	return verdict(
		"shows-where-it-is",
		input.shown === input.sessionPhase
			? null
			: `${input.plan} shows ${input.shown ?? "no phase"} but its live session works ${input.sessionPhase}`,
	);
}

export const reportShowsWhereItIs = (
	root: string,
	input: Parameters<typeof judgeShowsWhereItIs>[0],
	tracer?: Tracer,
) => report(root, "run.shown-phase", input.plan, judgeShowsWhereItIs(input), tracer);

/** The merge commits' subjects on the checked-out trunk, by a plain `git log` and nothing of the package's. */
export function trunkMergeSubjects(root: string): string[] {
	try {
		return execFileSync("git", ["log", "HEAD", "--merges", "--format=%s"], {
			cwd: root,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		})
			.split("\n")
			.filter(Boolean);
	} catch {
		return [];
	}
}

const landedIn = (subjects: readonly string[], plan: string): boolean =>
	subjects.some((s) => s.startsWith("Merge ") && s.endsWith(`: ${plan} landed`));

/** released-only-when-landed: a release marked released has its landing merge in the trunk's own log. */
export function judgeReleased(plan: string, subjects: readonly string[]): ClauseVerdict {
	return verdict(
		"released-only-when-landed",
		landedIn(subjects, plan)
			? null
			: `${plan} was marked released but its landing is not in the trunk's log`,
	);
}

export const reportReleased = (root: string, plan: string, tracer?: Tracer) =>
	report(root, "run.released", plan, judgeReleased(plan, trunkMergeSubjects(root)), tracer);

export interface TrueInput {
	plan: string;
	kind: SituationKind;
	/** The words the page or nav row showed. */
	text: string;
	/** This daemon holds a run of the plan in memory as running. */
	heldHere: boolean;
	/** The sessions the manager holds for the plan, with their kinds (its own sessions file). */
	sessions: ReadonlyArray<Pick<SessionRecord, "pid" | "startedAt" | "kind">>;
	table: readonly PsRow[];
	/** The trunk's merge subjects, read plain. */
	subjects: readonly string[];
}

/**
 * says-what-is-true: planning, building and releasing need a live process that equals a held
 * session of that kind (or this daemon's own running entry); complete needs the landing in the
 * trunk's log; stopped needs neither a live process nor a landing.
 */
export function judgeSaysWhatIsTrue(input: TrueInput): ClauseVerdict | null {
	const { kind, plan, text } = input;
	const wanted = kind === "planning" ? "planning" : "build";
	const live =
		input.heldHere ||
		input.sessions.some((s) => s.kind === wanted && livesIn(input.table, s.pid, s.startedAt));
	const landed = landedIn(input.subjects, plan);
	const said = (why: string) => verdict("says-what-is-true", `${plan} read "${text}" but ${why}`);
	switch (kind) {
		case "planning":
		case "building":
		case "releasing":
			return live ? verdict("says-what-is-true", null) : said("no process runs for it");
		case "complete":
			return landed
				? verdict("says-what-is-true", null)
				: said("its landing is not in the trunk's log");
		case "stopped":
			if (live) return said("a process runs for it");
			if (landed) return said("its landing is in the trunk's log");
			return verdict("says-what-is-true", null);
		default:
			return null;
	}
}

export const reportSaysWhatIsTrue = (root: string, input: TrueInput, tracer?: Tracer) =>
	report(root, "run.says", input.plan, judgeSaysWhatIsTrue(input), tracer);

/** always-a-next-step: an open plan shown has a next step that names who takes it. */
export function judgeNextStep(input: {
	plan: string;
	kind: SituationKind;
	next: { text: string; by: string } | null;
}): ClauseVerdict | null {
	if (input.kind === "closed") return null;
	const has = input.next !== null && input.next.text.trim() !== "" && input.next.by !== "";
	return verdict("always-a-next-step", has ? null : `${input.plan} is open and shows no next step`);
}

export const reportNextStep = (
	root: string,
	input: Parameters<typeof judgeNextStep>[0],
	tracer?: Tracer,
) => report(root, "run.next", input.plan, judgeNextStep(input), tracer);

/**
 * the-planning-audit-is-a-step: the step's state matches `plan-review.md` read from disk now:
 * done when the impl is approved or the review is written with every finding answered, else
 * not done (nothing about the hash yet: Build Phase 5 teaches the step to read a stale review).
 */
export function expectedAudit(input: {
	implStatus: string | null;
	reviewText: string | null;
}): "done" | "open" {
	if (input.implStatus !== null && input.implStatus !== "draft") return "done";
	return input.reviewText !== null && isAnswered(planReviewAnswers(input.reviewText))
		? "done"
		: "open";
}

export function judgePlanningAudit(input: {
	plan: string;
	/** The Planning audit step's state as shown; null when the plan shows no such step. */
	shown: string | null;
	implStatus: string | null;
	reviewText: string | null;
}): ClauseVerdict | null {
	if (input.implStatus === null) return null;
	if (input.shown === null)
		return verdict(
			"the-planning-audit-is-a-step",
			`${input.plan} has an impl and shows no Planning audit step`,
		);
	const expected = expectedAudit(input);
	const shownDone = input.shown === "done";
	return verdict(
		"the-planning-audit-is-a-step",
		shownDone === (expected === "done")
			? null
			: `${input.plan} shows the Planning audit ${input.shown} but plan-review.md on disk says ${expected}`,
	);
}

/** The plan-review.md text of a plan folder, straight from disk; null when absent. */
export function readReviewText(planDir: string): string | null {
	const path = join(planDir, "plan-review.md");
	try {
		return existsSync(path) ? readFileSync(path, "utf-8") : null;
	} catch {
		return null;
	}
}

export const reportPlanningAudit = (
	root: string,
	input: Parameters<typeof judgePlanningAudit>[0],
	tracer?: Tracer,
) => report(root, "run.audit", input.plan, judgePlanningAudit(input), tracer);

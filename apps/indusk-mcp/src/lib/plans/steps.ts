import type {
	DocumentPosition,
	PlanPosition,
	PlanPositionState,
	RitualWord,
	SegmentState,
} from "../lifecycle.js";
import { DOCUMENT_LABELS, requiredDocuments, type WorkflowType } from "../workflow-types.js";
import type { PlanReviewState } from "./plan-review.js";

/**
 * A plan's two workflows as lists of steps (plan-cockpit, ADR decision 3):
 * Planning, the documents its type requires, and Release, what carries a built
 * plan to a release. Every state is read from where the plan stands and what
 * its documents say; nothing here sets one and no control on the page can.
 *
 * Nothing new is derived. The plan's position and its segments come from
 * `derivePlanPosition` (`lifecycle`), the type's documents from
 * `workflow-types`, and a skipped ritual from the skip readers — this module
 * only names the steps a person reads and picks the word for each.
 *
 * promise: a-plan-shows-two-workflows
 * promise: display-names-are-defined-once
 */

/**
 * `done`, `current` (being written, built or looked at), `needs-you` (a
 * document waits for a person to accept it), `not-yet`, `skipped` (the type
 * has no such step, or the ritual was skipped with a reason) and `missing`
 * (the type requires it and the plan has moved past it — the plan bar's own
 * reading, kept apart from `skipped` on purpose).
 */
export type StepState = "done" | "current" | "needs-you" | "not-yet" | "skipped" | "missing";

/**
 * A Planning step's name: a document's label in sentence case (`DOCUMENT_LABELS`,
 * the one place a document is named), except the ADR, which a person knows as
 * the Decision.
 */
export type PlanningStepName = string;
export type ReleaseStepName = "Build" | "Falsify" | "Cleanup" | "Audit" | "Review" | "Release";

export interface PlanStep<Name extends string> {
	name: Name;
	state: StepState;
	/** Why a step is `skipped`, when a person wrote one down. */
	reason?: string;
}

/**
 * The rituals a plan can skip with a reason: the two that have phases
 * (`RitualWord`, `RITUAL_ORDER` stays those two) and the audit, which has none.
 */
export type SkippedRitual = RitualWord | "audit";

/** What `planSteps` needs of a plan — the facts, not the page's own `Plan`. */
export interface PlanSnapshot {
	/** The declared type; null when none is declared or the word is not a type. */
	workflow: WorkflowType | null;
	/** Documents the plan's project turned off; they are not part of its planning. */
	documentsOff?: readonly string[];
	/** Where the plan stands; absent when it could not be read (a malformed plan). */
	position?: PlanPositionState;
	/** Each document the plan has, with its status. */
	documents: Partial<Record<DocumentPosition, { status?: string }>>;
	/** Falsification, cleanup or audit skipped with a reason. */
	skippedRituals?: ReadonlyArray<{ ritual: SkippedRitual; reason?: string }>;
	/** Falsification, cleanup or audit finished: its phase closed or its report written. */
	finishedRituals?: ReadonlyArray<SkippedRitual>;
	/** Its plan-review.md as `plans/plan-review` read it. Absent: not read, steps keep their document reading. */
	planReview?: PlanReviewState;
	/**
	 * The processes running for the plan now (a-run-can-be-trusted, Decision 15).
	 * Given, a step reads in progress only while one runs for it, else to do; absent
	 * means the caller did not look, and a step reads as its documents say.
	 */
	live?: LivePlan;
}

/** What runs for a plan: a process writing it, a build, a release. */
export interface LivePlan {
	/** A planning run or an interactive session is writing the plan's documents. */
	writing?: boolean;
	/** The planning run's current step (`plan-impl`, `plan-review`, ...), when one runs. */
	planningStep?: string | null;
	/** A build run (phases, falsify, cleanup, audit) is going. */
	build?: boolean;
	/** The release's retrospective is running. */
	release?: boolean;
}

export interface PlanWorkflows {
	planning: PlanStep<PlanningStepName>[];
	release: PlanStep<ReleaseStepName>[];
}

const sentenceCase = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The Planning steps in order, each with the document it is and the position that stands for it. */
const PLANNING: ReadonlyArray<{
	name: PlanningStepName;
	document: DocumentPosition;
	at: PlanPosition;
	/** The Planning audit: kept wherever the impl is, never as a document of its own. */
	audit?: true;
}> = [
	{ name: "Research", document: "research", at: "research" },
	{ name: "Brief", document: "brief", at: "brief" },
	{ name: sentenceCase(DOCUMENT_LABELS["test-plan"]), document: "test-plan", at: "test-plan" },
	{ name: "Decision", document: "adr", at: "adr" },
	{ name: "Impl", document: "impl", at: "impl-approved" },
	{ name: "Planning audit", document: "impl", at: "impl-approved", audit: true },
];

/** An impl past its approval has done its Planning work; a draft is waiting to be approved. */
const IMPL_PLANNED = new Set(["approved", "in-progress", "completed"]);
const FINISHED = new Set(["accepted", "complete", "completed"]);

/** Whether a document's status says its Planning work is done (an impl: approved or later). */
export function documentFinished(document: DocumentPosition, status: string | undefined): boolean {
	if (status === undefined) return false;
	return document === "impl" ? IMPL_PLANNED.has(status) : FINISHED.has(status);
}

function planningStep(
	step: (typeof PLANNING)[number],
	plan: PlanSnapshot,
): PlanStep<PlanningStepName> {
	const status = plan.documents[step.document]?.status;
	const segment: SegmentState = plan.position?.segments[step.at] ?? "pending";
	const named = (state: StepState): PlanStep<PlanningStepName> => ({ name: step.name, state });
	// A step the documents call in progress is that only while a process runs for it.
	const inProgress = (running: boolean): StepState =>
		plan.live === undefined || running ? "current" : "not-yet";
	if (step.audit) return named(planningAudit(plan, status, segment, inProgress));
	switch (segment) {
		case "done":
			return named("done");
		case "skipped":
			return named("skipped");
		case "missing":
		case "unknown":
			return named("missing");
		case "active": {
			if (documentFinished(step.document, status)) return named("done");
			if (step.document === "impl" && status === "draft" && plan.planReview !== undefined) {
				// Decision 16: a written impl asks for approval only once its plan review is
				// answered; until then the Planning audit is the step the plan is at.
				if (plan.planReview === "answered") return named("needs-you");
				if (plan.live?.planningStep === "plan-impl") return named("current");
				return named("done");
			}
			// An impl waits to be approved; any other document waits to be accepted
			// once it has been proposed. A draft is still being written.
			const waiting = step.document === "impl" ? status === "draft" : status === "proposed";
			return named(waiting ? "needs-you" : inProgress(plan.live?.writing === true));
		}
		default:
			return named("not-yet");
	}
}

/**
 * The Planning audit reads the plan review for the documents as they stand: done
 * once it is answered (or the impl is approved past it), in progress only while the
 * planning run is on its plan-review step, otherwise to do.
 */
function planningAudit(
	plan: PlanSnapshot,
	implStatus: string | undefined,
	implSegment: SegmentState,
	inProgress: (running: boolean) => StepState,
): StepState {
	if (implSegment === "skipped") return "skipped";
	if (documentFinished("impl", implStatus) || implSegment === "done") return "done";
	if (implStatus !== "draft") return "not-yet";
	if (plan.planReview === "answered") return "done";
	if (plan.planReview === undefined) return "not-yet";
	return plan.live?.planningStep === "plan-review" ? inProgress(true) : "not-yet";
}

function releaseStep(name: ReleaseStepName, plan: PlanSnapshot): PlanStep<ReleaseStepName> {
	const segments = plan.position?.segments;
	const at = (position: PlanPosition): SegmentState => segments?.[position] ?? "pending";
	const named = (state: StepState, reason?: string): PlanStep<ReleaseStepName> => ({
		name,
		state,
		...(reason ? { reason } : {}),
	});
	const ritual: SkippedRitual | null =
		name === "Falsify"
			? "falsification"
			: name === "Cleanup"
				? "cleanup"
				: name === "Audit"
					? "audit"
					: null;
	if (ritual) {
		const skipped = plan.skippedRituals?.find((r) => r.ritual === ritual);
		if (skipped) return named("skipped", skipped.reason);
		if (plan.finishedRituals?.includes(ritual)) return named("done");
	}
	// An active step is in progress only while a process runs for it (Decision 15).
	const running = (on: boolean | undefined): boolean => plan.live === undefined || on === true;
	const segment = (state: SegmentState, on: boolean | undefined = plan.live?.build): StepState =>
		state === "done"
			? "done"
			: state === "active"
				? running(on)
					? "current"
					: "not-yet"
				: state === "skipped"
					? "skipped"
					: "not-yet";
	switch (name) {
		case "Build":
			return named(segment(at("executing")));
		case "Falsify":
			return named(segment(at("falsify")));
		case "Cleanup":
			return named(segment(at("cleanup")));
		case "Audit":
			return named(segment(at("audit")));
		case "Review":
			// Review waits on the person, not on a process.
			return named(segment(at("review"), true));
		case "Release": {
			// Accepted waits for the release to run; the retrospective is that run.
			if (at("executing") === "skipped") return named("skipped");
			if (at("accepted") === "active" || at("retrospective") === "active") {
				return named(running(plan.live?.release) ? "current" : "not-yet");
			}
			return named(at("archived") === "pending" ? "not-yet" : "done");
		}
	}
}

const RELEASE_STEPS: readonly ReleaseStepName[] = [
	"Build",
	"Falsify",
	"Cleanup",
	"Audit",
	"Review",
	"Release",
];

/**
 * Planning is the documents the plan's type requires, in lifecycle order — a
 * bugfix shows no Research or Decision. Release is the six steps every plan
 * with an impl goes through; for a type with none they all read `skipped`.
 */
export function planSteps(plan: PlanSnapshot): PlanWorkflows {
	const required =
		plan.workflow === null ? null : requiredDocuments(plan.workflow, plan.documentsOff);
	return {
		planning: PLANNING.filter((s) => required === null || required.includes(s.document)).map((s) =>
			planningStep(s, plan),
		),
		release: RELEASE_STEPS.map((name) => releaseStep(name, plan)),
	};
}

/**
 * The step a plan is at: the first step, Planning then Release, that is current
 * or needs the person; else the first not yet begun (an approved impl not yet
 * built is at Build); null when none is left.
 */
export function stepAt(
	plan: PlanSnapshot,
): (PlanStep<string> & { workflow: "planning" | "release" }) | null {
	const { planning, release } = planSteps(plan);
	const steps = [
		...planning.map((s) => ({ ...s, workflow: "planning" as const })),
		...release.map((s) => ({ ...s, workflow: "release" as const })),
	];
	return (
		steps.find((s) => s.state === "current" || s.state === "needs-you") ??
		steps.find((s) => s.state === "not-yet") ??
		null
	);
}

/**
 * "n of m" for one list. A skipped step is neither done nor owed, so it is in
 * neither number: a plan whose falsification was skipped with a reason is
 * complete at five of five.
 */
export function stepCount(steps: ReadonlyArray<{ state: StepState }>): {
	done: number;
	total: number;
} {
	const owed = steps.filter((s) => s.state !== "skipped");
	return { done: owed.filter((s) => s.state === "done").length, total: owed.length };
}

import type {
	DocumentPosition,
	PlanPosition,
	PlanPositionState,
	RitualWord,
	SegmentState,
} from "../lifecycle.js";
import { DOCUMENT_LABELS, requiredDocuments, type WorkflowType } from "../workflow-types.js";

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
	/** Falsification or cleanup skipped with a reason. */
	skippedRituals?: ReadonlyArray<{ ritual: RitualWord; reason?: string }>;
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
}> = [
	{ name: "Research", document: "research", at: "research" },
	{ name: "Brief", document: "brief", at: "brief" },
	{ name: sentenceCase(DOCUMENT_LABELS["test-plan"]), document: "test-plan", at: "test-plan" },
	{ name: "Decision", document: "adr", at: "adr" },
	{ name: "Impl", document: "impl", at: "impl-approved" },
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
			// An impl waits to be approved; any other document waits to be accepted
			// once it has been proposed. A draft is still being written.
			const waiting = step.document === "impl" ? status === "draft" : status === "proposed";
			return named(waiting ? "needs-you" : "current");
		}
		default:
			return named("not-yet");
	}
}

function releaseStep(name: ReleaseStepName, plan: PlanSnapshot): PlanStep<ReleaseStepName> {
	const segments = plan.position?.segments;
	const at = (position: PlanPosition): SegmentState => segments?.[position] ?? "pending";
	const named = (state: StepState, reason?: string): PlanStep<ReleaseStepName> => ({
		name,
		state,
		...(reason ? { reason } : {}),
	});
	const ritual = name === "Falsify" ? "falsification" : name === "Cleanup" ? "cleanup" : null;
	if (ritual) {
		const skipped = plan.skippedRituals?.find((r) => r.ritual === ritual);
		if (skipped) return named("skipped", skipped.reason);
	}
	const segment = (state: SegmentState): StepState =>
		state === "done"
			? "done"
			: state === "active"
				? "current"
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
			return named(segment(at("review")));
		case "Release": {
			// Accepted waits for the release to run; the retrospective is that run.
			if (at("executing") === "skipped") return named("skipped");
			if (at("accepted") === "active" || at("retrospective") === "active") {
				return named("current");
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

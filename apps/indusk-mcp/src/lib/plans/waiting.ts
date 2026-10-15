import type { DocumentPosition } from "../lifecycle.js";
import type { Question } from "../session/protocol.js";
import { WORKFLOW_DEFINITIONS } from "../workflow-types.js";
import { documentFinished, type PlanSnapshot, planSteps } from "./steps.js";

/**
 * What a plan waits on a person for (plan-cockpit, ADR decision 4), at most
 * one thing per plan, read from what the admin can see:
 *
 *   - **question** — a running admin session for the plan has asked
 *     (`AskUserQuestion`) and nobody has answered; it waits at the plan's
 *     current step. A blocked agent outranks the rest.
 *   - **review** — its build stopped at review, or the plan stands at review
 *     (the build's stop is held in memory; the position is on disk, so it
 *     survives a restart of the admin).
 *   - **approval** — its impl is a draft, every other document its type
 *     requires is accepted, and no session's turn is still open on it (an idle
 *     session waiting for the person is not writing): approving a
 *     plan its author has not finished would approve half of it.
 *
 * Each names the decision in words, what accepting it is called and the
 * alternative. For a question they are the question and its first two options,
 * so the question's own text is the key its answer is given under; an ask of
 * several questions carries each (`questions`), `decision` naming the first.
 * Pure: the
 * admin passes the sessions, plans and builds it holds.
 *
 * promise: decisions-wait-in-one-place
 * promise: display-names-are-defined-once
 */

export type WaitingOn = "question" | "approval" | "review";

export interface WaitingSession {
	plan: string;
	kind: "planning" | "build";
	/** The question the session asked and nobody has answered yet, if any. */
	question: { requestId: string; questions: Question[] } | null;
	/**
	 * The session's turn is open — it is working, not idle waiting for the
	 * person. Absent means writing: approval is withheld rather than offered early.
	 */
	writing?: boolean;
}

export interface WaitingBuild {
	plan: string;
	/** Where the admin's build of the plan stopped (the runner's stop step), or null. */
	stoppedAt: string | null;
}

export interface WaitingInput {
	sessions: ReadonlyArray<WaitingSession>;
	plans: ReadonlyArray<PlanSnapshot & { name: string }>;
	builds?: ReadonlyArray<WaitingBuild>;
}

/** One question of an ask: its words and the two answers the card offers. */
export interface WaitingQuestion {
	question: string;
	accept: string;
	alternative: string;
}

export interface Waiting {
	plan: string;
	on: WaitingOn;
	/** The step of the plan's workflows it waits at, as `plans/steps` names it. */
	step: string;
	/** The decision, in words; for a question, the question itself. */
	decision: string;
	/** What accepting is called on the card. */
	accept: string;
	/** The other answer offered beside accepting. */
	alternative: string;
	/** The session's request a question's answer goes to. */
	requestId?: string;
	/** Every question the agent asked, in its order; present for a question. */
	questions?: WaitingQuestion[];
}

export const APPROVAL_DECISION =
	"The plan is written. Approve it, so its documents and promises reach main and its build can start?";
export const REVIEW_DECISION =
	"The build is done and waits for your review. Accept it, so the release runs?";

export function planWaiting({ sessions, plans, builds = [] }: WaitingInput): Waiting[] {
	const waiting: Waiting[] = [];
	for (const plan of plans) {
		const one =
			askedOf(plan, sessions) ??
			(atReview(plan, builds) ? review(plan.name) : null) ??
			(awaitingApproval(plan) && !beingWritten(plan, sessions) ? approval(plan.name) : null);
		if (one) waiting.push(one);
	}
	return waiting;
}

function askedOf(
	plan: PlanSnapshot & { name: string },
	sessions: ReadonlyArray<WaitingSession>,
): Waiting | null {
	const asked = sessions.find((s) => s.plan === plan.name && s.question)?.question;
	const first = asked?.questions[0];
	if (!asked || !first) return null;
	return {
		plan: plan.name,
		on: "question",
		step: currentStep(plan),
		decision: first.question,
		accept: first.options[0]?.label ?? "Yes",
		alternative: first.options[1]?.label ?? "No",
		requestId: asked.requestId,
		questions: asked.questions.map((q) => ({
			question: q.question,
			accept: q.options[0]?.label ?? "Yes",
			alternative: q.options[1]?.label ?? "No",
		})),
	};
}

/** A session for the plan is mid-turn and has asked nothing: it is still writing. */
function beingWritten(
	plan: PlanSnapshot & { name: string },
	sessions: ReadonlyArray<WaitingSession>,
): boolean {
	return sessions.some((s) => s.plan === plan.name && !s.question && s.writing !== false);
}

/** The first step in either list that is being worked or waits on the person. */
function currentStep(plan: PlanSnapshot): string {
	const { planning, release } = planSteps(plan);
	const step = [...planning, ...release].find(
		(s) => s.state === "current" || s.state === "needs-you",
	);
	return step?.name ?? "Planning";
}

function atReview(plan: PlanSnapshot & { name: string }, builds: ReadonlyArray<WaitingBuild>) {
	return (
		plan.position?.position === "review" ||
		builds.some((b) => b.plan === plan.name && b.stoppedAt === "review")
	);
}

function awaitingApproval(plan: PlanSnapshot): boolean {
	if (plan.documents.impl?.status !== "draft") return false;
	const required: readonly DocumentPosition[] =
		plan.workflow === null ? ["brief", "test-plan"] : WORKFLOW_DEFINITIONS[plan.workflow].requires;
	return required
		.filter((d) => BEFORE_IMPL.includes(d))
		.every((d) => documentFinished(d, plan.documents[d]?.status));
}

/** The documents a plan writes before its impl; the retrospective comes after. */
const BEFORE_IMPL: readonly DocumentPosition[] = ["research", "brief", "test-plan", "adr"];

function review(plan: string): Waiting {
	return {
		plan,
		on: "review",
		step: "Review",
		decision: REVIEW_DECISION,
		accept: "Accept",
		alternative: "Not yet — send it back",
	};
}

function approval(plan: string): Waiting {
	return {
		plan,
		on: "approval",
		step: "Impl",
		decision: APPROVAL_DECISION,
		accept: "Approve",
		alternative: "Not yet — keep planning",
	};
}

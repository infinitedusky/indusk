import type { PlanningStop } from "../build/planning-runner.js";
import type { DocumentPosition } from "../lifecycle.js";
import type { Question as QuestionRecord } from "../questions/record.js";
import type { Question as AskedQuestion } from "../session/protocol.js";
import { requiredDocuments } from "../workflow-types.js";
import { documentFinished, type PlanSnapshot, stepAt } from "./steps.js";

/**
 * What a plan waits on a person for (plan-cockpit, ADR decision 4), at most
 * one thing per plan, read from what the admin can see:
 *
 *   - **question** — a running admin session for the plan has asked
 *     (`AskUserQuestion`) and nobody has answered; it waits at the plan's
 *     current step. A blocked agent outranks the rest.
 *   - **question** (held) — an unattended run asked a decision through
 *     `ask_decision` and its question holds (no stored deadline): the run ended
 *     and freed its place, and the plan waits with no timer until the person
 *     answers; the answer resumes the run.
 *   - **review** — its build stopped at review, or the plan stands at review
 *     (the build's stop is held in memory; the position is on disk, so it
 *     survives a restart of the admin).
 *   - **approval** — its impl is a draft, every other document its type
 *     requires is accepted, no session's turn is still open on it (an idle
 *     session waiting for the person is not writing), no planning run for it
 *     is going, and its plan review is written for the documents as they stand
 *     with every finding answered (`readPlanReview`, the one reader `plans
 *     approve` asks too): approving a plan its author has not finished would
 *     approve half of it.
 *   - **plan-review** — the same plan, but `plan-review.md` is missing, was
 *     written for other documents than stand now (stale), or leaves a finding
 *     unanswered. It waits at Impl; its words are to the
 *     plan's agent, never an approval. While the admin's planning run for the
 *     plan is going nothing is listed; when that run stopped short of
 *     approval, the decision says why. After an admin restart the run is
 *     unknown and the file alone decides.
 *   - **amendment** — its brief changed after the person approved it
 *     (plan-stories, ADR decision 5). It waits at the Brief step, after a
 *     question and before review and approval, and is answered on the plan's
 *     amendment card, never as a decision.
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

export const WAITING_KINDS = [
	"question",
	"approval",
	"review",
	"amendment",
	"plan-review",
] as const;

export type WaitingOn = (typeof WAITING_KINDS)[number];

export interface WaitingSession {
	plan: string;
	kind: "planning" | "build";
	/** The question the session asked and nobody has answered yet, if any. */
	question: { requestId: string; questions: AskedQuestion[] } | null;
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

/** The admin's planning run for a plan, as the admin holds it. */
export interface WaitingPlanning {
	plan: string;
	/** The run has not ended (between its steps counts as going). */
	running: boolean;
	/** Where the run stopped, as the admin holds it; null while it runs. */
	stop?: PlanningStop | null;
}

export interface WaitingInput {
	sessions: ReadonlyArray<WaitingSession>;
	plans: ReadonlyArray<PlanSnapshot & { name: string }>;
	builds?: ReadonlyArray<WaitingBuild>;
	/** The amendments waiting per plan; a plan with a count above 0 waits on them. */
	amendments?: ReadonlyArray<{ plan: string; count: number }>;
	/** The admin's planning runs; absent (an admin restart) reads as no run. */
	plannings?: ReadonlyArray<WaitingPlanning>;
	/** The plans' question records; one still waiting with no stored deadline holds its plan. */
	questions?: ReadonlyArray<QuestionRecord>;
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
	/** The held question a plan waits on (no session asked it any more): answered by recording, then the run resumes. */
	questionId?: string;
	/** The question's stored time (ms) when it waits on a set time with no session left to send it ahead. */
	dueAt?: number;
	/** The question is answered and its run did not restart: accepting starts the run again, answering nothing. */
	restart?: boolean;
	/** The pending request is a recorded question: the plan page draws its question row, not a second card. */
	recordedQuestion?: string;
	/** Every question the agent asked, in its order; present for a question. */
	questions?: WaitingQuestion[];
}

export const APPROVAL_DECISION =
	"The plan is written. Approve it, so its documents and promises reach main and its build can start?";
export const PLAN_REVIEW_DECISION =
	"The plan needs its plan review: plan-review.md, written for the documents as they stand with every finding answered, before it can be approved.";
export const REVIEW_DECISION =
	"The build is done and waits for your review. Accept it, so the release runs?";

export const AMENDMENT_DECISION =
	"The brief changed after it was approved. Review the change on the plan's page.";

export function planWaiting({
	sessions,
	plans,
	builds = [],
	amendments = [],
	plannings = [],
	questions = [],
}: WaitingInput): Waiting[] {
	const waiting: Waiting[] = [];
	for (const plan of plans) {
		const one =
			askedOf(plan, sessions, questions) ??
			heldQuestion(plan, questions) ??
			unrestarted(plan, questions, sessions, plannings) ??
			(amended(plan.name, amendments) ? amendment(plan.name) : null) ??
			(atReview(plan, builds) ? review(plan.name) : null) ??
			(awaitingApproval(plan) &&
			!beingWritten(plan, sessions) &&
			!planningGoing(plan.name, plannings)
				? plan.planReview === "answered"
					? approval(plan.name)
					: planReview(plan.name, plannings)
				: null);
		if (one) waiting.push(one);
	}
	return waiting;
}

/** The recommended option first, then the first other one: what a card offers as accept and alternative. */
function offered(q: QuestionRecord): { accept: string; alternative: string } {
	const labels = q.options.map((o) => o.label);
	const accept = labels.includes(q.recommended) ? q.recommended : (labels[0] ?? "Yes");
	return { accept, alternative: labels.find((l) => l !== accept) ?? "No" };
}

function askedOf(
	plan: PlanSnapshot & { name: string },
	sessions: ReadonlyArray<WaitingSession>,
	questions: ReadonlyArray<QuestionRecord>,
): Waiting | null {
	const asked = sessions.find((s) => s.plan === plan.name && s.question)?.question;
	const first = asked?.questions[0];
	if (!asked || !first) return null;
	const recorded = questions.find(
		(q) =>
			q.plan === plan.name && q.state === "waiting" && q.session?.requestId === asked.requestId,
	);
	if (recorded) {
		const { accept, alternative } = offered(recorded);
		return {
			plan: plan.name,
			on: "question",
			step: stepAt(plan)?.name ?? "Planning",
			decision: first.question,
			accept,
			alternative,
			requestId: asked.requestId,
			recordedQuestion: recorded.id,
			...(typeof recorded.dueAt === "number" ? { dueAt: recorded.dueAt } : {}),
			questions: [{ question: first.question, accept, alternative }],
		};
	}
	return {
		plan: plan.name,
		on: "question",
		step: stepAt(plan)?.name ?? "Planning",
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

/**
 * The plan's oldest question that waits with no session to send it on: one that holds
 * (no stored deadline), or one on a set time whose session has ended, which shows its time left.
 */
function heldQuestion(
	plan: PlanSnapshot & { name: string },
	questions: ReadonlyArray<QuestionRecord>,
): Waiting | null {
	const q = questions.find((x) => x.plan === plan.name && x.state === "waiting" && !x.session);
	if (!q) return null;
	const { accept, alternative } = offered(q);
	return {
		plan: plan.name,
		on: "question",
		step: stepAt(plan)?.name ?? "Build",
		decision: q.text,
		accept,
		alternative,
		questionId: q.id,
		...(typeof q.dueAt === "number" ? { dueAt: q.dueAt } : {}),
		questions: [{ question: q.text, accept, alternative }],
	};
}

/**
 * A question was answered while its run was stopped and the run did not start again (a
 * restart refused at `sessions.max`, an admin that went down): the plan waits for the run
 * to restart, and Build starts it.
 */
function unrestarted(
	plan: PlanSnapshot & { name: string },
	questions: ReadonlyArray<QuestionRecord>,
	sessions: ReadonlyArray<WaitingSession>,
	plannings: ReadonlyArray<WaitingPlanning>,
): Waiting | null {
	const q = questions.find(
		(x) => x.plan === plan.name && x.state === "answered" && x.answer !== undefined && !x.told,
	);
	if (!q || sessions.some((s) => s.plan === plan.name) || planningGoing(plan.name, plannings))
		return null;
	return {
		plan: plan.name,
		on: "question",
		step: stepAt(plan)?.name ?? "Build",
		decision: `${q.text} — answered, its run did not restart. Start it again so it hears: ${q.answer}`,
		accept: "Start the run again",
		alternative: "Not yet",
		questionId: q.id,
		restart: true,
		questions: [{ question: q.text, accept: "Start the run again", alternative: "Not yet" }],
	};
}

/**
 * A session for the plan is mid-turn and has asked nothing: it is still writing.
 * promise: approval-waits-for-a-finished-plan
 */
function beingWritten(
	plan: PlanSnapshot & { name: string },
	sessions: ReadonlyArray<WaitingSession>,
): boolean {
	return sessions.some((s) => s.plan === plan.name && !s.question && s.writing !== false);
}

/**
 * The admin's planning run for the plan has not ended: the plan is still being written.
 * promise: approval-waits-for-a-finished-plan
 */
function planningGoing(plan: string, plannings: ReadonlyArray<WaitingPlanning>): boolean {
	return plannings.some((p) => p.plan === plan && p.running);
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
		plan.workflow === null
			? ["brief", "test-plan"]
			: requiredDocuments(plan.workflow, plan.documentsOff);
	return required
		.filter((d) => BEFORE_IMPL.includes(d))
		.every((d) => documentFinished(d, plan.documents[d]?.status));
}

/** The documents a plan writes before its impl; the retrospective comes after. */
const BEFORE_IMPL: readonly DocumentPosition[] = ["research", "brief", "test-plan", "adr"];

function amended(plan: string, amendments: NonNullable<WaitingInput["amendments"]>): boolean {
	return amendments.some((a) => a.plan === plan && a.count > 0);
}

function amendment(plan: string): Waiting {
	return {
		plan,
		on: "amendment",
		step: "Brief",
		decision: AMENDMENT_DECISION,
		accept: "Approve",
		alternative: "Not yet",
	};
}

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

/**
 * The plan needs its plan review; when its planning run stopped short of approval, the
 * decision says why.
 * promise: approval-waits-for-a-finished-plan
 */
function planReview(plan: string, plannings: ReadonlyArray<WaitingPlanning>): Waiting {
	const stop = plannings.find((p) => p.plan === plan)?.stop;
	const why =
		stop?.step === "cannot-continue"
			? stop.why.replace(/\.$/, "")
			: stop?.step === "wait-for-looks"
				? `it waits for its looks: ${stop.looks.join("; ")}`
				: null;
	return {
		plan,
		on: "plan-review",
		step: "Impl",
		decision: why
			? `${PLAN_REVIEW_DECISION} Its planning run stopped: ${why}.`
			: PLAN_REVIEW_DECISION,
		accept: "Ask the agent to write it",
		alternative: "Not yet",
	};
}

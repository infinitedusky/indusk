import { join } from "node:path";
import { answersNote, untold } from "../questions/answer.js";
import { changesAgreed } from "../questions/cost.js";
import { readQuestionWait } from "../questions/deadline.js";
import { nextQuestionId, readQuestions, recordQuestion } from "../questions/history.js";
import type { Question } from "../questions/record.js";
import { reportClause } from "../questions/signals.js";
import { silentDecisions } from "../questions/silent.js";
import { readQuestionWaitSetting } from "../session/limits.js";
import type { SessionManager, SessionRecord } from "../session/manager.js";
import { decideBuildPermission, refuseBuildQuestion } from "../session/permissions.js";
import {
	isRateLimitedResult,
	RATE_LIMIT_RETRIES,
	rateLimitDelayMs,
} from "../session/rate-limit.js";
import type { StartedEvent } from "../session/start.js";
import { type DecisionStore, receiveDecision } from "./decision-request.js";
import type { ShortenReason } from "./next-step.js";
import type { BuildStepName } from "./runner.js";
import { BUILD_STEP_ENV, type PlanningStep } from "./step-env.js";

/**
 * One step of a build as a session of the developer's own `claude`
 * (admin-plan-authoring, ADR D4, D5): a fresh `build` session in the plan's
 * worktree, under `INDUSK_GATE_POLICY=auto`, its requests decided in code
 * (`permissions.ts`); a choice it asks through `ask_decision` becomes a question record
 * (`decision-request.ts`), and a plain `AskUserQuestion` is refused naming `ask_decision`.
 * A step that ends in a rate limit is tried again, as the evaluator's runs
 * are; any other failure is the step's error.
 */

/** Every step a session can run: a build's, or a planning run's. */
export type SessionStepName = BuildStepName | PlanningStep;

export const GATE_POLICY_FOR_BUILDS = { INDUSK_GATE_POLICY: "auto" } as const;

/** A step's environment: unattended, and marked as a build step unless it is the release (A35). */
export function stepEnv(step: SessionStepName): Record<string, string> {
	return {
		...GATE_POLICY_FOR_BUILDS,
		...(step === "retrospective" ? {} : { [BUILD_STEP_ENV]: step }),
	};
}

const UNATTENDED =
	"This build runs unattended (INDUSK_GATE_POLICY=auto): nobody is watching. When you meet a choice the plan does not settle, ask it with the `ask_decision` tool (at least two options, the one you recommend and why, a cost, and what each option changes of the brief, a promise, a look or a gate); the answer comes back, or this session ends and a new one starts with it. Never record a choice as decided unattended. Skip a gate item only as `(none needed — <why>)`; the person reviewing the build reads every skip.";

/** What each step asks for. The runner decides which step; this only words it. */
export function stepPrompt(
	step: SessionStepName,
	plan: string,
	reason?: ShortenReason,
	answered = "",
): string {
	return `${stepText(step, plan, reason)}${answered}`;
}

function stepText(step: SessionStepName, plan: string, reason?: ShortenReason): string {
	switch (step) {
		case "work":
			return `/work ${plan}\n\n${UNATTENDED} Work the plan's open phases in order until every one is closed, then stop. Do not run /falsify, /cleanup, /audit or /retrospective.`;
		case "falsify":
			return `/falsify ${plan}\n\n${UNATTENDED} End the hunt yourself when you can form no further specific hypothesis; do not wait for confirmation.`;
		case "cleanup":
			return `/cleanup ${plan}\n\n${UNATTENDED} End the review yourself when nothing more is warranted; do not wait for confirmation.`;
		case "audit":
			return `/audit ${plan}\n\n${UNATTENDED} Write audit.md and end; its findings block nothing, so do not act on them.`;
		case "shorten-reason": {
			// promise: a-skip-reason-is-one-sentence
			const field = `${reason?.ritual ?? "the skipped ritual"}_reason`;
			const was = reason
				? `${reason.length} characters in ${reason.sentences} sentence(s)`
				: "too long";
			return `The ritual skip in plan \`${plan}\` has a reason that is too long: \`${field}\` in the frontmatter of .indusk/planning/${plan}/impl.md is ${was}. A skip reason is one sentence of at most 120 characters (rituals/reason.ts); the detail belongs in the impl body or the retrospective.\n\nRewrite that one line as one sentence of at most 120 characters that keeps the reason; change nothing else in the plan, commit with a message naming \`${field}\`, and end. ${UNATTENDED} Do not run /falsify, /cleanup or /audit.`;
		}
		case "plan-test-plan":
		case "plan-adr":
		case "plan-impl":
			return planningPrompt(step, plan);
		case "plan-review":
			return planReviewPrompt(plan);
		case "retrospective":
			return `/retrospective ${plan}\n\nThe plan has been accepted. Run the retrospective to the end; it lands the plan with \`indusk plans land ${plan}\`. ${UNATTENDED}`;
	}
}

/** The document each planning step writes, and what its prompt adds to the shared rules. */
const PLANNING_DOCUMENTS: Record<
	Exclude<PlanningStep, "plan-review">,
	{ file: string; extra: string }
> = {
	"plan-test-plan": {
		file: "test-plan.md",
		extra: "Write one clause plan per promise clause, with a measure for each.",
	},
	"plan-adr": {
		file: "adr.md",
		extra:
			"Write the decisions the brief and the test plan need, each with the alternatives rejected.",
	},
	"plan-impl": {
		file: "impl.md",
		extra:
			"Write the gates with real items (the impl's `gate_policy` may be `ask`: a gate with no items would stop the build for a person), and set `status: draft` in its frontmatter.",
	},
};

/**
 * A planning step (a-brief-is-planned-unasked, ADR decision 3): one unattended
 * session that writes one document of the plan. The planner skill is installed
 * in the session, so the prompt names it rather than repeating it.
 *
 * promise: an-accepted-brief-is-planned-unasked
 */
function planningPrompt(step: Exclude<PlanningStep, "plan-review">, plan: string): string {
	const { file, extra } = PLANNING_DOCUMENTS[step];
	const dir = `.indusk/planning/${plan}`;
	return `Write the \`${file}\` of plan \`${plan}\` and nothing else.

Read ${dir}/brief.md and ${dir}/research.md, and follow the planner skill's section for ${file}. Write only ${dir}/${file}: no other document, and no code. ${extra}

${UNATTENDED} Record each open decision, with its reason, in the document. When you cannot decide, write a \`blocker: <what you could not decide>\` line in the document and end.

The earlier documents stay exactly as the earlier steps left them: an ADR or test plan still \`proposed\` or \`draft\` is not a reason to stop (the person approves them all once, after the impl), and you change no other document's status, only the status your own document needs.

Never approve anything: do not run \`indusk plans approve\`, approve a look, or build. Commit ${file} on the plan's branch and end.`;
}

/**
 * The planning run's last step (audit-concerns-are-answered, ADR D9): the plan is read
 * cold by a fresh reader and every finding answered before the person is asked to approve.
 *
 * promise: a-plan-is-read-cold-before-approval
 */
function planReviewPrompt(plan: string): string {
	const dir = `.indusk/planning/${plan}`;
	return `/audit ${plan} --before-approval

Write only ${dir}/plan-review.md and the plan documents its answers change: no code, and never the research. ${UNATTENDED} Answer each finding yourself, with fix, amendment or nothing and its reason; write a \`blocker: <what you could not decide>\` line in plan-review.md and end when you cannot.

Never approve anything: do not run \`indusk plans approve\`, approve a look, or build. Commit what you wrote on the plan's branch and end.`;
}

export interface BuildSessionOptions {
	manager: SessionManager;
	worktree: string;
	/** A workbench plan's code worktree: the session may write there too (`--add-dir`). */
	addDirs?: string[];
	project: string;
	plan: string;
	claudeBin?: string;
	model?: string;
	/** Waits between rate-limited tries; the shared schedule (`session/rate-limit.ts`) by default. */
	retryDelaysMs?: number[];
	sleep?: (ms: number) => Promise<void>;
	onEvent?: (ev: StartedEvent) => void;
	/**
	 * Told, right after the step's `claude` child is spawned, of the manager's own record for it
	 * (`pid`, `bin`, `startedAt`): what a run's record on disk keeps to tell a live run from a dead one
	 * (a-run-can-be-trusted, Decision 4). Told again for each rate-limit retry's new session.
	 */
	onSession?: (record: SessionRecord) => void;
	/** For a `shorten-reason` step: the reason to rewrite. */
	reason?: ShortenReason;
	/** The clock a question's asked time and deadline are read from; the real one by default. */
	now?: () => number;
}

/** What a question's arrival decided, reported to the clauses it bears on (signals.ts). */
function reportAsked(worktree: string, reply: ReturnType<typeof receiveDecision>): void {
	// A question sent back before the person saw it kept the clause: nothing malformed is shown.
	void reportClause(worktree, "asked-with-a-recommendation", { outcome: "upheld" });
	if (reply.to !== "hold") return;
	const q = reply.question;
	if (changesAgreed(q)) void reportClause(worktree, "never-timed-out", { outcome: "upheld" });
	else void reportClause(worktree, "holds-by-default", { outcome: "upheld" });
}

/** After a step: no document it saved records a choice as decided unattended without a question (clause never-decided-silently). */
function reportSilent(worktree: string, plan: string, step: SessionStepName): void {
	if (step === "retrospective") return;
	try {
		const recorded = new Set(readQuestions(worktree, plan).map((q) => q.id));
		const found = silentDecisions(join(worktree, ".indusk", "planning", plan), recorded);
		const first = found[0];
		void reportClause(
			worktree,
			"never-decided-silently",
			first
				? { outcome: "broken", symptom: `${plan}/${first.file}:${first.line} ${first.why}` }
				: { outcome: "upheld" },
		);
	} catch {
		// A read that fails reports nothing.
	}
}

/** Run `read`; its failure is the fallback, never the step's: the history is an aid to the run. */
function attempt<T>(read: () => T, fallback: T): T {
	try {
		return read();
	} catch {
		return fallback;
	}
}

/** Keep a question in the plan's history, tied to the session that asked it while that session lives. */
function keep(worktree: string, q: Question, sessionId: string, requestId: string): boolean {
	try {
		recordQuestion(
			worktree,
			q.state === "waiting" && q.dueAt !== null
				? { ...q, session: { id: sessionId, requestId } }
				: q,
		);
		return true;
	} catch {
		return false;
	}
}

/** Run one step to its end. `error` is null when the session finished its work. */
export async function runStepSession(
	step: SessionStepName,
	opts: BuildSessionOptions,
): Promise<{ error: string | null; waiting?: string }> {
	const delays =
		opts.retryDelaysMs ??
		Array.from({ length: RATE_LIMIT_RETRIES }, (_, i) => rateLimitDelayMs(i + 1));
	const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
	for (let attempt = 0; ; attempt++) {
		const { error, rateLimited, waiting } = await oneSession(step, opts);
		if (waiting) return { error: null, waiting };
		if (error === null) return { error: null };
		if (!rateLimited || attempt >= delays.length) return { error };
		await sleep(delays[attempt]);
	}
}

async function oneSession(
	step: SessionStepName,
	opts: BuildSessionOptions,
): Promise<{ error: string | null; rateLimited: boolean; waiting?: string }> {
	let result: Extract<StartedEvent, { type: "result" }> | undefined;
	let waiting: string | undefined;
	const told = attempt(() => untold(readQuestions(opts.worktree, opts.plan)), []);
	for (const q of told)
		attempt(() => recordQuestion(opts.worktree, { ...q, told: true }), undefined);
	const store: DecisionStore = {
		nextId: () => attempt(() => nextQuestionId(opts.worktree, opts.plan), `q-${Date.now()}`),
		wait: () => {
			try {
				return readQuestionWaitSetting();
			} catch {
				// A setting that cannot be read holds every question: a typo never sends one ahead.
				return readQuestionWait({});
			}
		},
		now: () => (opts.now ?? Date.now)(),
	};
	let stderr = "";
	const holder: { id?: string } = {};
	const { id, session } = opts.manager.start({
		cwd: opts.worktree,
		...(opts.addDirs?.length ? { addDirs: opts.addDirs } : {}),
		kind: "build",
		prompt: stepPrompt(step, opts.plan, opts.reason, answersNote(told)),
		project: opts.project,
		plan: opts.plan,
		env: stepEnv(step),
		...(opts.claudeBin ? { claudeBin: opts.claudeBin } : {}),
		...(opts.model ? { model: opts.model } : {}),
		onEvent: (ev) => {
			opts.onEvent?.(ev);
			if (!holder.id) return;
			if (ev.type === "permission") {
				opts.manager.reply(
					holder.id,
					{
						requestId: ev.requestId,
						...decideBuildPermission(ev, [opts.worktree, ...(opts.addDirs ?? [])]),
					},
					"rule",
				);
			} else if (ev.type === "question" && ev.decision) {
				let reply = receiveDecision(ev, opts.plan, store);
				// A question that cannot be kept is not asked: the session hears why and decides as it must.
				if (
					reply.to !== "refuse" &&
					!keep(opts.worktree, reply.question, holder.id, ev.requestId)
				) {
					reply = {
						to: "refuse",
						message:
							"This question could not be recorded in the plan's history, so it was not asked. Record the choice and its reason in the plan and say plainly that it could not be asked.",
					};
				}
				reportAsked(opts.worktree, reply);
				if (reply.to === "refuse") {
					opts.manager.reply(
						holder.id,
						{ requestId: ev.requestId, allow: false, message: reply.message },
						"rule",
					);
				} else if (reply.to === "answer") {
					opts.manager.reply(
						holder.id,
						{ requestId: ev.requestId, answers: reply.answers },
						"rule",
					);
				} else if (reply.to === "hold") {
					waiting = reply.question.id;
					opts.manager.reply(
						holder.id,
						{ requestId: ev.requestId, allow: false, message: reply.message },
						"rule",
					);
					void opts.manager.stop(holder.id).catch(() => {});
				}
				// `wait`: the question was kept with its session; the request stays open.
			} else if (ev.type === "question") {
				const refusal = refuseBuildQuestion(ev);
				opts.manager.reply(
					holder.id,
					{
						requestId: ev.requestId,
						allow: false,
						message: refusal.allow ? "" : refusal.message,
					},
					"rule",
				);
			} else if (ev.type === "result") {
				result = ev;
				void opts.manager.stop(holder.id).catch(() => {});
			} else if (ev.type === "exit") {
				stderr = ev.stderr;
			}
		},
	});
	holder.id = id;
	if (opts.onSession) {
		const record = opts.manager.running().find((r) => r.id === id);
		if (record) opts.onSession(record);
	}
	const code = await session.done;
	reportSilent(opts.worktree, opts.plan, step);
	if (waiting) {
		// The session ended with the question: its place under the cap is free (clause a-hold-frees-the-slot).
		const freed = opts.manager.forPlan(opts.project, opts.plan, "build") === undefined;
		void reportClause(
			opts.worktree,
			"a-hold-frees-the-slot",
			freed
				? { outcome: "upheld" }
				: {
						outcome: "broken",
						symptom: `${opts.plan} still holds a session after asking ${waiting}`,
					},
		);
		return { error: null, rateLimited: false, waiting };
	}
	if (result?.ok) return { error: null, rateLimited: false };
	if (result) {
		return {
			error: `${result.subtype}: ${result.text}`.trim(),
			rateLimited: isRateLimitedResult(result),
		};
	}
	return {
		error: `claude exited ${code ?? "on a signal"}${stderr ? `: ${stderr.slice(-500)}` : ""}`,
		rateLimited: false,
	};
}

import type { SessionManager } from "../session/manager.js";
import { decideBuildPermission, refuseBuildQuestion } from "../session/permissions.js";
import {
	isRateLimitedResult,
	RATE_LIMIT_RETRIES,
	rateLimitDelayMs,
} from "../session/rate-limit.js";
import type { StartedEvent } from "../session/start.js";
import type { ShortenReason } from "./next-step.js";
import type { BuildStepName } from "./runner.js";
import { BUILD_STEP_ENV, type PlanningStep } from "./step-env.js";

/**
 * One step of a build as a session of the developer's own `claude`
 * (admin-plan-authoring, ADR D4, D5): a fresh `build` session in the plan's
 * worktree, under `INDUSK_GATE_POLICY=auto`, its requests decided in code
 * (`permissions.ts`) and its questions refused with "decide and record why".
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
	"This build runs unattended (INDUSK_GATE_POLICY=auto): nobody will answer a question. Decide on your own judgement and record each decision and its reason in the plan. Skip a gate item only as `(none needed — <why>)`; the person reviewing the build reads every skip.";

/** What each step asks for. The runner decides which step; this only words it. */
export function stepPrompt(step: SessionStepName, plan: string, reason?: ShortenReason): string {
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
		case "retrospective":
			return `/retrospective ${plan}\n\nThe plan has been accepted. Run the retrospective to the end; it lands the plan with \`indusk plans land ${plan}\`. ${UNATTENDED}`;
	}
}

/** The document each planning step writes, and what its prompt adds to the shared rules. */
const PLANNING_DOCUMENTS: Record<PlanningStep, { file: string; extra: string }> = {
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
function planningPrompt(step: PlanningStep, plan: string): string {
	const { file, extra } = PLANNING_DOCUMENTS[step];
	const dir = `.indusk/planning/${plan}`;
	return `Write the \`${file}\` of plan \`${plan}\` and nothing else.

Read ${dir}/brief.md and ${dir}/research.md, and follow the planner skill's section for ${file}. Write only ${dir}/${file}: no other document, and no code. ${extra}

${UNATTENDED} Record each open decision, with its reason, in the document. When you cannot decide, write a \`blocker: <what you could not decide>\` line in the document and end.

Never approve anything: do not run \`indusk plans approve\`, approve a look, or build. Commit ${file} on the plan's branch and end.`;
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
	/** For a `shorten-reason` step: the reason to rewrite. */
	reason?: ShortenReason;
}

/** Run one step to its end. `error` is null when the session finished its work. */
export async function runStepSession(
	step: SessionStepName,
	opts: BuildSessionOptions,
): Promise<{ error: string | null }> {
	const delays =
		opts.retryDelaysMs ??
		Array.from({ length: RATE_LIMIT_RETRIES }, (_, i) => rateLimitDelayMs(i + 1));
	const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
	for (let attempt = 0; ; attempt++) {
		const { error, rateLimited } = await oneSession(step, opts);
		if (error === null) return { error: null };
		if (!rateLimited || attempt >= delays.length) return { error };
		await sleep(delays[attempt]);
	}
}

async function oneSession(
	step: SessionStepName,
	opts: BuildSessionOptions,
): Promise<{ error: string | null; rateLimited: boolean }> {
	let result: Extract<StartedEvent, { type: "result" }> | undefined;
	let stderr = "";
	const holder: { id?: string } = {};
	const { id, session } = opts.manager.start({
		cwd: opts.worktree,
		...(opts.addDirs?.length ? { addDirs: opts.addDirs } : {}),
		kind: "build",
		prompt: stepPrompt(step, opts.plan, opts.reason),
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
	const code = await session.done;
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

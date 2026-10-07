import type { SessionManager } from "../session/manager.js";
import { decideBuildPermission, refuseBuildQuestion } from "../session/permissions.js";
import {
	isRateLimitedResult,
	RATE_LIMIT_RETRIES,
	rateLimitDelayMs,
} from "../session/rate-limit.js";
import type { StartedEvent } from "../session/start.js";
import type { BuildStepName } from "./runner.js";
import { BUILD_STEP_ENV } from "./step-env.js";

/**
 * One step of a build as a session of the developer's own `claude`
 * (admin-plan-authoring, ADR D4, D5): a fresh `build` session in the plan's
 * worktree, under `INDUSK_GATE_POLICY=auto`, its requests decided in code
 * (`permissions.ts`) and its questions refused with "decide and record why".
 * A step that ends in a rate limit is tried again, as the evaluator's runs
 * are; any other failure is the step's error.
 */

export const GATE_POLICY_FOR_BUILDS = { INDUSK_GATE_POLICY: "auto" } as const;

/** A step's environment: unattended, and marked as a build step unless it is the release (A35). */
export function stepEnv(step: BuildStepName): Record<string, string> {
	return {
		...GATE_POLICY_FOR_BUILDS,
		...(step === "retrospective" ? {} : { [BUILD_STEP_ENV]: step }),
	};
}

const UNATTENDED =
	"This build runs unattended (INDUSK_GATE_POLICY=auto): nobody will answer a question. Decide on your own judgement and record each decision and its reason in the plan. Skip a gate item only as `(none needed — <why>)`; the person reviewing the build reads every skip.";

/** What each step asks for. The runner decides which step; this only words it. */
export function stepPrompt(step: BuildStepName, plan: string): string {
	switch (step) {
		case "work":
			return `/work ${plan}\n\n${UNATTENDED} Work the plan's open phases in order until every one is closed, then stop. Do not run /falsify, /cleanup or /retrospective.`;
		case "falsify":
			return `/falsify ${plan}\n\n${UNATTENDED} End the hunt yourself when you can form no further specific hypothesis; do not wait for confirmation.`;
		case "cleanup":
			return `/cleanup ${plan}\n\n${UNATTENDED} End the review yourself when nothing more is warranted; do not wait for confirmation.`;
		case "retrospective":
			return `/retrospective ${plan}\n\nThe plan has been accepted. Run the retrospective to the end; it lands the plan with \`indusk plans land ${plan}\`. ${UNATTENDED}`;
	}
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
}

/** Run one step to its end. `error` is null when the session finished its work. */
export async function runStepSession(
	step: BuildStepName,
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
	step: BuildStepName,
	opts: BuildSessionOptions,
): Promise<{ error: string | null; rateLimited: boolean }> {
	let result: Extract<StartedEvent, { type: "result" }> | undefined;
	let stderr = "";
	const holder: { id?: string } = {};
	const { id, session } = opts.manager.start({
		cwd: opts.worktree,
		...(opts.addDirs?.length ? { addDirs: opts.addDirs } : {}),
		kind: "build",
		prompt: stepPrompt(step, opts.plan),
		project: opts.project,
		plan: opts.plan,
		env: stepEnv(step),
		...(opts.claudeBin ? { claudeBin: opts.claudeBin } : {}),
		...(opts.model ? { model: opts.model } : {}),
		onEvent: (ev) => {
			opts.onEvent?.(ev);
			if (!holder.id) return;
			if (ev.type === "permission") {
				opts.manager.reply(holder.id, {
					requestId: ev.requestId,
					...decideBuildPermission(ev, [opts.worktree, ...(opts.addDirs ?? [])]),
				});
			} else if (ev.type === "question") {
				const refusal = refuseBuildQuestion(ev);
				opts.manager.reply(holder.id, {
					requestId: ev.requestId,
					allow: false,
					message: refusal.allow ? "" : refusal.message,
				});
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

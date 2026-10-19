import { appendTiming, type StepOutcome, timingLogPath } from "./log.js";
import { recordSafely } from "./safe.js";

export interface TimedStepDeps {
	root: string;
	plan: string;
	now?: () => number;
	newId: () => string;
	/** The project's machine-state home; the real one when absent. */
	home?: string;
	warn?: (message: string) => void;
	/**
	 * Refine how a step that did not fail ended: `blocked` when the plan now
	 * carries a blocker, `stopped` when a person or a timeout ended the session.
	 * Returning nothing keeps the default; a throw is treated as nothing.
	 */
	classify?: (
		result: { error: string | null } | undefined,
		step: string,
		phase: string | undefined,
	) => Promise<StepOutcome | undefined> | StepOutcome | undefined;
}

/**
 * Time an unattended step by wrapping the function that runs it, not by editing
 * the runners that call it. A start is written before the step runs and an end,
 * with how it ended, after it returns or throws; both survive the step's own
 * session record. The step's result or throw passes through unchanged, and an
 * unwritable record only warns (plan-timing ADR, steps-are-timed).
 *
 * promise: a-plan-says-how-long-it-took
 */
export function timedStep<
	Step extends string,
	Rest extends unknown[],
	R extends { error: string | null },
>(
	run: (step: Step, ...rest: Rest) => Promise<R>,
	deps: TimedStepDeps,
): (step: Step, ...rest: Rest) => Promise<R> {
	const now = deps.now ?? Date.now;
	const warn = deps.warn ?? ((m: string) => console.warn(m));
	const path = timingLogPath(deps.root, deps.plan, deps.home);
	return async (step, ...rest) => {
		const id = deps.newId();
		const phase = typeof rest[0] === "string" ? rest[0] : undefined;
		const base = { plan: deps.plan, id, step, ...(phase ? { phase } : {}) };
		await recordSafely(() => appendTiming(path, { kind: "step-start", ...base }, now), warn);
		let result: R | undefined;
		let thrown = false;
		try {
			result = await run(step, ...rest);
			return result;
		} catch (err) {
			thrown = true;
			throw err;
		} finally {
			await recordSafely(async () => {
				let outcome: StepOutcome = thrown || result?.error ? "failed" : "finished";
				if (deps.classify) {
					try {
						outcome = (await deps.classify(result, step, phase)) ?? outcome;
					} catch {
						// a classifier that cannot tell leaves the default
					}
				}
				await appendTiming(path, { kind: "step-end", ...base, outcome }, now);
			}, warn);
		}
	};
}

/**
 * Which build step a session is (admin-plan-authoring A35). A build step's
 * session may run any shell command — its writes are bounded, its commands
 * are not — so `indusk plans accept` and `plans land` read this and refuse
 * inside a step. The release session, the retrospective that acceptance
 * starts, is not marked: it is the one that lands. A boundary against a
 * confused session, not a sandbox: a session that unsets it is not stopped.
 *
 * promise: nothing-ships-until-accepted
 */

export const BUILD_STEP_ENV = "INDUSK_BUILD_STEP";

/** The build step this process runs inside, if any. */
export function currentBuildStep(env: NodeJS.ProcessEnv = process.env): string | null {
	const step = env[BUILD_STEP_ENV];
	return step ? step : null;
}

/**
 * The planning steps (a-brief-is-planned-unasked): the unattended sessions that
 * write a plan's test plan, ADR and impl from its accepted brief. Defined once,
 * here, for the loop that names them and the refusals that read them. Each is
 * a build step, so everything a build step is refused is refused them too; they
 * are named apart because approving is refused them as well.
 */
export const PLANNING_STEPS = ["plan-test-plan", "plan-adr", "plan-impl", "plan-review"] as const;

export type PlanningStep = (typeof PLANNING_STEPS)[number];

/** The planning step this process runs inside, if any. */
export function currentPlanningStep(env: NodeJS.ProcessEnv = process.env): PlanningStep | null {
	const step = currentBuildStep(env);
	return PLANNING_STEPS.find((s) => s === step) ?? null;
}

/** Why `what` is refused inside a planning step, or null outside one. */
export function planningStepRefusal(
	what: string,
	env: NodeJS.ProcessEnv = process.env,
): string | null {
	const step = currentPlanningStep(env);
	return step
		? `${what} is not done from inside a planning step (${step}): approving is the person's`
		: null;
}

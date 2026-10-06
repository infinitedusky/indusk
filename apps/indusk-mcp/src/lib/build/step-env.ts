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

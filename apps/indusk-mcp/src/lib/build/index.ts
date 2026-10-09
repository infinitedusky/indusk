/**
 * An unattended build's decisions and wiring (admin-plan-authoring, ADR D4–D7),
 * one definition behind `indusk plans next | review` and the admin.
 */
export {
	type BuildSessionOptions,
	GATE_POLICY_FOR_BUILDS,
	runStepSession,
	stepPrompt,
} from "./build-session.js";
export { detectHumanGate } from "./judgement.js";
export { type BuildPlan, type BuildStep, nextBuildStep, type StepOutcome } from "./next-step.js";
export { BuildPlanUnreadable, readBuildPlan } from "./read-plan.js";
/** Whether the project accepts a built plan on its own (`release.auto_accept` in `.indusk/config.json`). */
export { autoAccepts } from "./release-config.js";
export { buildReview, type Review } from "./review.js";
export {
	type BuildStepName,
	type RunnerDeps,
	type RunnerStop,
	type RunnerUpdate,
	runBuild,
	runRelease,
} from "./runner.js";
export { buildStepModel } from "./step-model.js";

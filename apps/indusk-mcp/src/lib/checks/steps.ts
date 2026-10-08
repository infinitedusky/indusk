import { type EnsureResult, ensureConfigBlock, readConfig, type WorkflowSteps } from "../config.js";

/**
 * A project's declared step tooling, `workflow.steps` (release-checks-run-once
 * D4). Facts, never logic (D5): a command or a path is a string, `covers` a
 * list of strings; anything else is refused naming the key, so a value nobody
 * can read is never quietly treated as "not declared".
 *
 * promise: landing-and-release-name-the-projects-commands
 */
export function readWorkflowSteps(checkout: string): WorkflowSteps {
	const steps = (readConfig(checkout) as { workflow?: { steps?: unknown } } | null)?.workflow
		?.steps;
	if (steps === undefined) return {};
	if (!isObject(steps)) throw new Error("workflow.steps must be an object of steps");
	const out: WorkflowSteps = {};
	if (steps.land !== undefined) {
		const land = section(steps.land, "land");
		out.land = { slow_tests: text(land.slow_tests, "land.slow_tests") };
	}
	if (steps.release !== undefined) {
		const release = section(steps.release, "release");
		out.release = {
			command: text(release.command, "release.command"),
			version_file: text(release.version_file, "release.version_file"),
			changelog: text(release.changelog, "release.changelog"),
			covers: paths(release.covers, "release.covers"),
		};
	}
	return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function section(v: unknown, key: string): Record<string, unknown> {
	if (!isObject(v)) throw new Error(`workflow.steps.${key} must be an object`);
	return v;
}

function text(v: unknown, key: string): string | undefined {
	if (v === undefined) return undefined;
	if (typeof v !== "string" || v.trim() === "") {
		throw new Error(
			`workflow.steps.${key} must be a command, a path or a name (a non-empty string); a step that needs logic names a script that holds it`,
		);
	}
	return v;
}

function paths(v: unknown, key: string): string[] | undefined {
	if (v === undefined) return undefined;
	if (!Array.isArray(v) || !v.every((p) => typeof p === "string" && p.trim() !== "")) {
		throw new Error(`workflow.steps.${key} must be a list of paths`);
	}
	return v;
}

/**
 * Ensure the `workflow` block exists, empty: keyed on presence, so a project
 * that declares its steps is never touched, and one that declares none still
 * sees where they would go. Called by `indusk update`.
 */
export function ensureWorkflowConfig(projectRoot: string): EnsureResult {
	return ensureConfigBlock(projectRoot, "workflow", { steps: {} });
}

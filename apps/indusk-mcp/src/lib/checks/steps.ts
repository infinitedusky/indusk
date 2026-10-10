import {
	type EnsureResult,
	ensureConfigBlock,
	readConfig,
	type ReleaseSlowTests,
	type WorkflowSteps,
} from "../config.js";
import { isTier, TIER_STEPS, TIERS, TierConfigError } from "../models/tier-names.js";

/**
 * A project's declared step tooling, `workflow.steps` (release-checks-run-once
 * D4). Facts, never logic (D5): a command or a path is a string, `covers` a
 * list of strings; anything else is refused naming the key, so a value nobody
 * can read is never quietly treated as "not declared".
 *
 * promise: landing-and-release-name-the-projects-commands
 * promise: dusk-installs-its-own-build — `land.install`, the command landing
 * runs so this machine's `indusk` is the landed build (small-fixes).
 */
export function readWorkflowSteps(checkout: string): WorkflowSteps {
	const steps = (readConfig(checkout) as { workflow?: { steps?: unknown } } | null)?.workflow
		?.steps;
	if (steps === undefined) return {};
	if (!isObject(steps)) throw new Error("workflow.steps must be an object of steps");
	const out: WorkflowSteps = {};
	const known = new Set<string>(["land", "release", ...TIER_STEPS]);
	for (const key of Object.keys(steps)) {
		if (!known.has(key)) {
			throw new TierConfigError(`workflow.steps.${key} is not a step InDusk reads`);
		}
	}
	for (const step of TIER_STEPS) {
		if (steps[step] === undefined) continue;
		const tier = section(steps[step], step).tier;
		if (tier === undefined) continue;
		if (!isTier(tier)) {
			throw new TierConfigError(
				`workflow.steps.${step}.tier must be one of ${TIERS.join(", ")}; got ${JSON.stringify(tier)}`,
			);
		}
		out[step] = { tier };
	}
	if (steps.land !== undefined) {
		const land = section(steps.land, "land");
		out.land = {
			slow_tests: text(land.slow_tests, "land.slow_tests"),
			install: text(land.install, "land.install"),
		};
	}
	if (steps.release !== undefined) {
		const release = section(steps.release, "release");
		out.release = {
			command: text(release.command, "release.command"),
			version_file: text(release.version_file, "release.version_file"),
			changelog: text(release.changelog, "release.changelog"),
			covers: paths(release.covers, "release.covers"),
			slow_tests: slowTests(release.slow_tests),
			done_when: oneOf(release.done_when, "release.done_when", ["published", "green"]),
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

function oneOf<T extends string>(v: unknown, key: string, words: readonly T[]): T | undefined {
	if (v === undefined) return undefined;
	if (typeof v !== "string" || !(words as readonly string[]).includes(v)) {
		throw new Error(`workflow.steps.${key} must be one of ${words.join(", ")}`);
	}
	return v as T;
}

/** `release.slow_tests`: a command, the report it writes, when it runs, and an optional rerun template. */
function slowTests(v: unknown): ReleaseSlowTests | undefined {
	if (v === undefined) return undefined;
	const slow = section(v, "release.slow_tests");
	const command = text(slow.command, "release.slow_tests.command");
	const report = text(slow.report, "release.slow_tests.report");
	const when = oneOf(slow.when, "release.slow_tests.when", ["before", "after"] as const);
	if (command === undefined) throw new Error("workflow.steps.release.slow_tests.command is required");
	if (report === undefined) {
		throw new Error(
			"workflow.steps.release.slow_tests.report is required: a path or glob to the JUnit XML the command writes",
		);
	}
	if (when === undefined) {
		throw new Error("workflow.steps.release.slow_tests.when is required: before or after");
	}
	const rerun = text(slow.rerun, "release.slow_tests.rerun");
	if (rerun !== undefined && !rerun.includes("{files}")) {
		throw new Error(
			"workflow.steps.release.slow_tests.rerun must contain {files}, where the failing files go",
		);
	}
	return { command, report, when, ...(rerun === undefined ? {} : { rerun }) };
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

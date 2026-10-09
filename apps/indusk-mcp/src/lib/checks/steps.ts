import { type EnsureResult, ensureConfigBlock, readConfig, type WorkflowSteps } from "../config.js";
import { isTier, TIER_STEPS, TIERS, type Tier, TierConfigError } from "../models/tier-names.js";

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
 * `workflow.tiers`, each tier's model alias (model-per-phase). A tier left out
 * has no model; a key that is not a tier, or a model that is not a non-empty
 * string, is refused naming it — a mistyped tier would otherwise build every
 * phase on the session's own model without a word.
 */
export function readTiers(checkout: string): Partial<Record<Tier, string>> {
	const tiers = (readConfig(checkout) as { workflow?: { tiers?: unknown } } | null)?.workflow
		?.tiers;
	if (tiers === undefined) return {};
	if (!isObject(tiers)) throw new TierConfigError("workflow.tiers must be an object of tiers");
	const out: Partial<Record<Tier, string>> = {};
	for (const [key, model] of Object.entries(tiers)) {
		if (!isTier(key)) {
			throw new TierConfigError(
				`workflow.tiers.${key} is not a tier; the tiers are ${TIERS.join(", ")}`,
			);
		}
		if (typeof model !== "string" || model.trim() === "") {
			throw new TierConfigError(`workflow.tiers.${key} must be a model alias (a non-empty string)`);
		}
		out[key] = model;
	}
	return out;
}

/**
 * Ensure the `workflow` block exists, empty: keyed on presence, so a project
 * that declares its steps is never touched, and one that declares none still
 * sees where they would go. Called by `indusk update`.
 */
export function ensureWorkflowConfig(projectRoot: string): EnsureResult {
	return ensureConfigBlock(projectRoot, "workflow", { steps: {} });
}

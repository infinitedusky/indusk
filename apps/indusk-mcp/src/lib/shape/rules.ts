import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnabledExtensions } from "../extension-loader.js";

/**
 * Craft rules for a Shape review — sourced from the project's enabled domain
 * extensions, never hardcoded here.
 *
 * A project sets its own standard by choosing extensions, exactly as `/cleanup`
 * already delegates "what counts as a cohesive unit". Encoding rules in core
 * would take that choice away and duplicate knowledge the extensions own — the
 * maxim-7 argument that kept runner-specific output parsing out of
 * `atdawn verify`.
 */

export interface CraftRuleSource {
	extension: string;
	/** The extension's own prose. The reviewing agent reads it directly. */
	rules: string;
}

export interface CraftRuleSet {
	scope: { inScope: string[]; outOfScope: string[] };
	sources: CraftRuleSource[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = join(__dirname, "../../..");

/**
 * What Shape asks of every unit, whatever the project's stack.
 *
 * This is the fallback standard a library or CLI with no domain extension
 * enabled still gets — the general move, "extract a function or module". It is
 * deliberately about *shape*, not about any framework: the framework-specific
 * rules arrive as extension prose in `sources` and can be turned off by turning
 * the extension off.
 */
const IN_SCOPE = [
	"Does this unit have one reason to change? A block doing two jobs wants to be two named things.",
	"Should this inline block have been a named function or module? The general move is to extract it.",
	"Does the name say what the code is for, rather than how it works?",
	"Is there a seam here a test could reach, or does testing it require running everything around it?",
];

/**
 * Where Shape stops and `/cleanup` starts.
 *
 * The line is operational rather than a matter of taste: Shape can only see the
 * files this phase changed, so cross-file questions are ones it is not equipped
 * to answer. Cleanup at close sees the finished whole and answers them there —
 * and A9 pins the other half, that cleanup's scan still returns these files, so
 * "Shape reviewed it" never quietly means nobody looks again.
 */
const OUT_OF_SCOPE = [
	"Cross-file duplication and the rule of three — `/cleanup` owns these at plan close, when the third occurrence exists to be counted.",
	"Module boundaries and package structure — the same: they cannot be judged until the modules are finished.",
	"Anything requiring files this phase did not change.",
];

/** Where an extension's craft prose lives, package copy first. */
function readExtensionProse(root: string, packageRoot: string, name: string): string | null {
	const candidates = [
		join(packageRoot, "extensions", name, "skill.md"),
		join(root, ".claude", "skills", name, "SKILL.md"),
	];
	for (const path of candidates) {
		if (existsSync(path)) return readFileSync(path, "utf-8");
	}
	return null;
}

/**
 * The rule set for a Shape review of this project, right now.
 *
 * Enabled extensions contribute their prose; disabled ones contribute nothing,
 * which is the whole point (A11) — if turning an extension off did not change
 * what Shape flags, the rule would really be hardcoded somewhere and the project
 * could not set its own standard.
 *
 * No filtering by "is this a *domain* extension": there is no such taxonomy in
 * the manifest, and inventing one here would be exactly the hardcoded judgment
 * A11 exists to prevent. The reviewing agent reads prose and can tell which of
 * it bears on craft.
 */
export async function collectCraftRules(
	root: string,
	packageRoot: string = defaultPackageRoot,
): Promise<CraftRuleSet> {
	const sources: CraftRuleSource[] = [];

	for (const extension of getEnabledExtensions(root)) {
		if (!extension.manifest.provides.skill) continue;
		const rules = readExtensionProse(root, packageRoot, extension.manifest.name);
		if (rules === null) continue;
		sources.push({ extension: extension.manifest.name, rules });
	}

	return {
		scope: { inScope: [...IN_SCOPE], outOfScope: [...OUT_OF_SCOPE] },
		sources,
	};
}

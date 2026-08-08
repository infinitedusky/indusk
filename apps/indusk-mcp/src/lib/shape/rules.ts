/**
 * Craft rules for a Shape review — sourced from the project's enabled domain
 * extensions, never hardcoded here.
 *
 * A project sets its own standard by choosing extensions, exactly as `/cleanup`
 * already delegates "what counts as a cohesive unit". Encoding rules in core
 * would take that choice away and duplicate knowledge the extensions own — the
 * maxim-7 argument that kept runner-specific output parsing out of
 * `atdawn verify`.
 *
 * Phase 2 fills this in.
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

export async function collectCraftRules(
	_root: string,
	_packageRoot?: string,
): Promise<CraftRuleSet> {
	throw new Error("collectCraftRules is implemented in Phase 2");
}

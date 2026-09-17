import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ParsedImpl, parseImplString } from "./impl-parser-core.js";

/**
 * The impl parser plus its two filesystem entry points. The parser itself —
 * `parseImplString`, the phase types, `getPhaseCompletion`, `findPhase` — lives
 * in `impl-parser-core.ts` (no `node:fs`, so the admin's browser components can
 * import it) and is re-exported here so every existing import keeps working.
 */
export * from "./impl-parser-core.js";

/**
 * Resolve a `<plan>` argument to its impl.md: an explicit impl.md path, a
 * directory containing one, or a plan name under `.indusk/planning/`.
 *
 * **One definition on purpose.** `atdawn run` and `atdawn verify` both take a
 * plan argument, and if they resolved it differently, verify would judge a file
 * run never executed. That is not a duplicated-lines problem — it is a silent
 * divergence between two enforcement lanes, so the rule lives here and both
 * callers import it.
 */
export function resolveImplPath(projectRoot: string, plan: string): string | null {
	const candidates = plan.endsWith("impl.md")
		? [resolve(projectRoot, plan)]
		: [
				resolve(projectRoot, plan, "impl.md"),
				resolve(projectRoot, ".indusk", "planning", plan, "impl.md"),
			];
	return candidates.find((p) => existsSync(p)) ?? null;
}

export function parseImpl(filePath: string): ParsedImpl {
	if (!existsSync(filePath)) {
		return { title: "", status: "", phases: [] };
	}
	return parseImplString(readFileSync(filePath, "utf-8"));
}

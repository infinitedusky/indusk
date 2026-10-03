import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The planning context file (context-tiers, ADR D4).
 *
 * `.indusk/planning/CLAUDE.md` carries the rules of plan documents — the
 * trajectory, the gates, the test-phase structure — and Claude Code loads it
 * whenever a file under `.indusk/planning/` is read, so every consumer gets
 * those rules at the moment a plan is written and carries none of them in its
 * root file. It is package-owned, like a skill: the source is
 * `templates/planning/CLAUDE.md`, `init` writes it and `update` overwrites it,
 * and `skill-sync-parity` pins this repository's copy byte-equal.
 */

export const PLANNING_CONTEXT_REL = ".indusk/planning/CLAUDE.md";
export const PLANNING_CONTEXT_TEMPLATE_REL = "templates/planning/CLAUDE.md";

export type PlanningContextSync = "created" | "updated" | "current" | "skipped";

/**
 * Write the package's planning context file into the project. `overwrite`
 * false (init without `--force`) keeps an existing file and says `skipped`,
 * the way skills are kept; true (update, or init `--force`) replaces it when
 * the bytes differ.
 */
export function syncPlanningContext(
	packageRoot: string,
	projectRoot: string,
	opts: { overwrite: boolean },
): PlanningContextSync {
	const source = join(packageRoot, PLANNING_CONTEXT_TEMPLATE_REL);
	const target = join(projectRoot, PLANNING_CONTEXT_REL);
	if (!existsSync(target)) {
		mkdirSync(dirname(target), { recursive: true });
		cpSync(source, target);
		return "created";
	}
	if (!opts.overwrite) return "skipped";
	if (readFileSync(source, "utf-8") === readFileSync(target, "utf-8")) return "current";
	cpSync(source, target);
	return "updated";
}

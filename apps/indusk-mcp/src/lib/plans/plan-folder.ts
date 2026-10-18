import { existsSync } from "node:fs";
import { join } from "node:path";
import { getPlanningDir } from "../config.js";

/**
 * Where a plan's folder is: `.indusk/planning/<plan>`, else
 * `.indusk/planning/archive/<plan>` (the retrospective archives a plan before
 * it lands, and every command that acts on a plan must still find it), else
 * null. The planning folder wins when a plan is in both.
 *
 * promise: a-plan-is-found-in-the-archive
 */
export function planFolder(projectRoot: string, plan: string): string | null {
	const planning = getPlanningDir(projectRoot);
	const active = join(planning, plan);
	if (existsSync(active)) return active;
	const archived = join(planning, "archive", plan);
	return existsSync(archived) ? archived : null;
}

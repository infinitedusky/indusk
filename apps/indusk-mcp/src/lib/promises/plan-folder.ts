import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isUsableSegment } from "../path-segment.js";

/**
 * What a plan's name resolves to on disk. A plan is a DIRECTORY under
 * `.indusk/planning/` or its `archive/`, and `archive` itself is not one
 * (day-promises A28: a file such as `master.md` and the archive folder both
 * satisfied a bare `existsSync`). The registry check, the registry's writer
 * and the plan contract all ask through here.
 */
export type PlanFolderStatus =
	| "active"
	| "archived"
	| "missing"
	| "not-a-folder"
	| "archive-folder";

const planningDir = (planRoot: string) => join(planRoot, ".indusk", "planning");

/** Where `plan`'s folder would be: active, or archived. */
export function planFolderPath(planRoot: string, plan: string, archived = false): string {
	return archived
		? join(planningDir(planRoot), "archive", plan)
		: join(planningDir(planRoot), plan);
}

export function planFolderStatus(planRoot: string, plan: string): PlanFolderStatus {
	if (!isUsableSegment(plan)) return "missing";
	if (plan === "archive") return "archive-folder";
	for (const [dir, status] of [
		[planFolderPath(planRoot, plan), "active"],
		[planFolderPath(planRoot, plan, true), "archived"],
	] as const) {
		if (!existsSync(dir)) continue;
		return statSync(dir).isDirectory() ? status : "not-a-folder";
	}
	return "missing";
}

export interface PlanFolder {
	plan: string;
	archived: boolean;
	dir: string;
}

function folders(dir: string, archived: boolean): PlanFolder[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && !(e.name === "archive" && !archived))
		.map((e) => ({ plan: e.name, archived, dir: join(dir, e.name) }))
		.sort((a, b) => a.plan.localeCompare(b.plan));
}

/** Every plan folder, active first. */
export function planFolders(planRoot: string): PlanFolder[] {
	const planning = planningDir(planRoot);
	return [...folders(planning, false), ...folders(join(planning, "archive"), true)];
}

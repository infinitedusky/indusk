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

/**
 * Where `plan`'s folder is: the planning folder, else the archive (the
 * retrospective archives a plan before it lands, and every command that acts
 * on a plan must still find it), else null — also null for a name that is not
 * a plan's folder (the archive folder, a file, an unusable segment). The
 * planning folder wins when a plan is in both.
 *
 * promise: a-plan-is-found-in-the-archive
 */
export function findPlanFolder(planRoot: string, plan: string): string | null {
	const status = planFolderStatus(planRoot, plan);
	if (status === "active") return planFolderPath(planRoot, plan);
	return status === "archived" ? planFolderPath(planRoot, plan, true) : null;
}

export interface PlanFolder {
	plan: string;
	archived: boolean;
	dir: string;
}

/** A file in a plan's folder, as a refusal names it: relative to the plan root. */
export function planFileRel(folder: Pick<PlanFolder, "plan" | "archived">, file: string): string {
	return `.indusk/planning/${folder.archived ? "archive/" : ""}${folder.plan}/${file}`;
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

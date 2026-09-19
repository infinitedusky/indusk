import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlanningDir } from "../config.js";
import { type PlanSummary, parsePlan } from "../plan-parser.js";
import { openMaintenancePhases } from "./reopen.js";

/**
 * What a closed plan is doing after it closed (day-monitor, ADR D7, D8).
 *
 * An archived plan normally reads `archived`. It is back in motion when an
 * incident appended a Maintenance phase to its impl and that phase has an
 * unchecked item — **reopened**: the plan tools list it active and it reads
 * executing that phase. Derived from files only; nothing here opens a socket.
 */

export const ARCHIVE_DIR = "archive";

export interface AfterClose {
	archived: true;
	/** The open Maintenance phases' names, e.g. `Maintenance — i-2026-09-19-…`. */
	reopened: string[];
}

export type ArchivedPlanSummary = PlanSummary & AfterClose;

function archiveDir(projectRoot: string): string {
	return join(getPlanningDir(projectRoot), ARCHIVE_DIR);
}

/** The archived plan's folder, or null when there is none by that name. */
export function archivedPlanDir(projectRoot: string, name: string): string | null {
	const dir = join(archiveDir(projectRoot), name);
	return existsSync(join(dir)) && name !== "" && !name.includes("/") ? dir : null;
}

/** One archived plan as the plan tools report it. */
export function archivedPlan(projectRoot: string, name: string): ArchivedPlanSummary | null {
	const dir = archivedPlanDir(projectRoot, name);
	if (!dir) return null;
	const summary = parsePlan(dir);
	const implPath = join(dir, "impl.md");
	const reopened = existsSync(implPath)
		? openMaintenancePhases(readFileSync(implPath, "utf-8"))
		: [];
	if (reopened.length > 0) {
		return {
			...summary,
			stage: "impl",
			stageStatus: "in-progress",
			nextStep: `Work ${reopened[0]}, then check its phase off`,
			archived: true,
			reopened,
		};
	}
	return { ...summary, stage: "archived", stageStatus: "archived", archived: true, reopened };
}

/** Archived plans that are back in motion — the ones the active list must show. */
export function archivedInMotion(projectRoot: string): ArchivedPlanSummary[] {
	const dir = archiveDir(projectRoot);
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => archivedPlan(projectRoot, d.name))
		.filter((p): p is ArchivedPlanSummary => p !== null && p.reopened.length > 0);
}

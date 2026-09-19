import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { getPlanningDir } from "../config.js";
import type { MonitorWindow } from "../lifecycle.js";
import { type PlanSummary, parsePlan } from "../plan-parser.js";
import { getQuietWindowDays } from "./config.js";
import { recorded } from "./incidents.js";
import { type Registry, readPromises } from "./registry.js";
import { openMaintenancePhases } from "./reopen.js";

/**
 * What a closed plan is doing after it closed (day-monitor, ADR D7, D8).
 *
 * An archived plan normally reads `archived`. It is back in motion when an
 * incident appended a Maintenance phase to its impl and that phase has an
 * unchecked item — **reopened**: the plan tools list it active and it reads
 * executing that phase. Otherwise, a plan holding a behaviour promise is in
 * **monitor** while `now − max(closed, lastViolation) < window`: `closed` is
 * the date on its retrospective's "Landed on main at …" line (else the
 * retrospective's `date`), `lastViolation` the latest `last_seen` among its
 * promises' incidents, and `window` the quiet window. Derived from files
 * only; nothing here opens a socket.
 */

export const ARCHIVE_DIR = "archive";

export interface AfterClose {
	archived: true;
	/** The open Maintenance phases' names, e.g. `Maintenance — i-2026-09-19-…`. */
	reopened: string[];
	/** Set while the plan is inside its quiet window. */
	monitor: MonitorWindow | null;
}

const DAY_MS = 86_400_000;

/** When the plan closed: its retrospective's landing date, else its `date`. Null without a retrospective. */
export function closedAt(planDir: string): Date | null {
	const path = join(planDir, "retrospective.md");
	if (!existsSync(path)) return null;
	const text = readFileSync(path, "utf-8");
	const landed = /Landed on main at[^\n]*?(\d{4}-\d{2}-\d{2})/.exec(text)?.[1];
	if (landed) return new Date(`${landed}T00:00:00Z`);
	const date = (matter(text).data as { date?: unknown }).date;
	const d = date instanceof Date ? date : typeof date === "string" ? new Date(date) : null;
	return d && !Number.isNaN(d.getTime()) ? d : null;
}

function registryOf(projectRoot: string): Registry | null {
	const read = readPromises(projectRoot);
	if (read.ok) return read.registry;
	return "partial" in read ? read.partial : null;
}

/** The plan's quiet window, when it is inside one. */
export function monitorWindow(
	projectRoot: string,
	name: string,
	planDir: string,
	registry: Registry | null,
	now: Date = new Date(),
): MonitorWindow | null {
	if (!registry) return null;
	const held = registry.promises.filter(
		(p) => p.owner === name && p.kind === "behaviour" && p.state !== "retired",
	);
	if (held.length === 0) return null;
	const closed = closedAt(planDir);
	if (!closed) return null;
	const names = new Set(held.map((p) => p.name));
	let lastViolation: Date | null = null;
	for (const i of registry.incidents) {
		if (!names.has(i.promise)) continue;
		const seen = recorded(join(registry.dir, i.file)).lastSeen ?? i.date;
		const d = new Date(seen);
		if (!Number.isNaN(d.getTime()) && (!lastViolation || d > lastViolation)) lastViolation = d;
	}
	const restarted = lastViolation !== null && lastViolation > closed;
	const anchor = restarted && lastViolation ? lastViolation : closed;
	const windowDays = getQuietWindowDays(projectRoot);
	const elapsedDays = Math.max(0, (now.getTime() - anchor.getTime()) / DAY_MS);
	if (elapsedDays >= windowDays) return null;
	return {
		windowDays,
		elapsedDays: Math.round(elapsedDays * 10) / 10,
		restartedAt: restarted && lastViolation ? lastViolation.toISOString() : null,
	};
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
export function archivedPlan(
	projectRoot: string,
	name: string,
	registry: Registry | null = registryOf(projectRoot),
	now: Date = new Date(),
): ArchivedPlanSummary | null {
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
			monitor: null,
		};
	}
	const monitor = monitorWindow(projectRoot, name, dir, registry, now);
	if (monitor) {
		return {
			...summary,
			stage: "monitor",
			stageStatus: "monitor",
			nextStep: `Quiet window: ${Math.floor(monitor.elapsedDays)} of ${monitor.windowDays} days${monitor.restartedAt ? `, restarted ${monitor.restartedAt.slice(0, 10)}` : ""}`,
			archived: true,
			reopened,
			monitor,
		};
	}
	return {
		...summary,
		stage: "archived",
		stageStatus: "archived",
		archived: true,
		reopened,
		monitor: null,
	};
}

/** Archived plans that are back in motion — reopened or in monitor — the ones the active list must show. */
export function archivedInMotion(projectRoot: string): ArchivedPlanSummary[] {
	const dir = archiveDir(projectRoot);
	if (!existsSync(dir)) return [];
	const registry = registryOf(projectRoot);
	const now = new Date();
	return readdirSync(dir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => archivedPlan(projectRoot, d.name, registry, now))
		.filter(
			(p): p is ArchivedPlanSummary => p !== null && (p.reopened.length > 0 || p.monitor !== null),
		);
}

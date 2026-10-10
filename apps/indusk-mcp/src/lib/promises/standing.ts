import type { HealthDeps, HealthRow, PromiseHealth, SourceHealthRead } from "./health.js";
import type { PromiseEntry } from "./registry.js";
import type { PlanRow } from "./rows.js";
import type { SourceName } from "./sources.js";

// promise: every-promise-is-listed

export type Standing = "broken" | "being-proven" | "declared" | "enforced" | "retired";

/** One source's health row for a promise, named by the source that read it. */
export interface SourcedHealth extends HealthRow {
	source: SourceName;
}

export interface StandingResult {
	standing: Standing;
	health: Partial<Record<SourceName, PromiseHealth>>;
	tests: { passing: number; total: number };
	lastActivity: string | null;
}

export interface StandingRow extends StandingResult {
	entry: PromiseEntry;
	rows: PlanRow[];
}

export interface StandingDeps extends HealthDeps {
	health?: SourceHealthRead[];
}

export function standingOf(
	_entry: PromiseEntry,
	_health: SourcedHealth[],
	_rows: PlanRow[],
): StandingResult {
	return {
		standing: "declared",
		health: {},
		tests: { passing: 0, total: 0 },
		lastActivity: null,
	};
}

export async function readStanding(
	_projectRoot: string,
	_deps: StandingDeps = {},
): Promise<StandingRow[]> {
	return [];
}

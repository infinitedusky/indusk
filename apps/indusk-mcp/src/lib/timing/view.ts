import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mainCheckoutOf } from "../bookkeeping/roots.js";
import { git } from "../git.js";
import { phaseLabel } from "../impl-headings.js";
import { PlanCommandRefusal } from "../plans/plan-branch.js";
import { findPlanFolder } from "../promises/plan-folder.js";
import { readBoundaries } from "../shape/boundary.js";
import type { PhaseBoundaryRecord } from "../shape/boundary-record.js";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import { isRootsRefusal, resolveExecutionRoots } from "../worktree/roots.js";
import { readTimings, type StepOutcome, type TimingRecord, timingLogPath } from "./log.js";

/**
 * What `indusk plans time` shows: a plan's phases, unattended steps and test
 * runs with their durations, and a total from the brief's acceptance to the
 * plan's landing (plan-timing ADR). Every read is tolerant: a plan recorded
 * before any of this existed prints what it has and names what it lacks.
 *
 * Durations are `Date.parse(end) - Date.parse(start)` in epoch milliseconds,
 * never stored and never read in a zone; the one stored duration is a test
 * run's, measured on a monotonic clock.
 *
 * promise: a-plan-says-how-long-it-took
 */

/** The four reads behind the view; each is the caller's seam. */
export interface PlanTimeReads {
	boundaries: () => Promise<PhaseBoundaryRecord[]>;
	timings: () => Promise<TimingRecord[]>;
	/** When the brief was accepted, ISO; null when it carries none. */
	acceptedAt: () => Promise<string | null>;
	/** When the plan landed, ISO; null while it has not. */
	landedAt: () => Promise<string | null>;
}

export interface PhaseTime {
	label: string;
	opened: string;
	/** Null while the phase is open. */
	closed: string | null;
	/** True when the end is the next phase's opening, not a recorded close. */
	derived: boolean;
	open: boolean;
	/** For an open phase, the time since it opened. */
	durationMs: number;
}

export interface StepTime {
	id: string;
	step: string;
	phase?: string;
	started: string;
	ended: boolean;
	outcome: StepOutcome | null;
	/** Null when the step never wrote its end. */
	durationMs: number | null;
	/** For a step that never ended, the time since it started. */
	sinceStartMs: number | null;
}

export interface TestRunTime {
	scope: string;
	startedAt: string;
	durationMs: number;
	passed: boolean;
	files: { own: number; reached: number; mustNotBreak: number };
}

export interface PlanTime {
	plan: string;
	phases: PhaseTime[];
	steps: StepTime[];
	testRuns: TestRunTime[];
	/** Acceptance to landing, or to now while the plan has not landed; null with no acceptance time. */
	total: { from: string; to: string; ms: number; landed: boolean } | null;
	/** The total less the phases' durations: the time no phase accounts for. Null without both. */
	between: number | null;
	/** Each kind of record the plan has none of, by name. */
	missing: string[];
}

const at = (iso: string) => Date.parse(iso);

function phasesOf(
	boundaries: PhaseBoundaryRecord[],
	timings: TimingRecord[],
	plan: string,
	now: number,
	landedAt: string | null,
): PhaseTime[] {
	// The earliest opening of each phase wins, as `findPhaseStart` reads it.
	const opened = new Map<string, { label: string; opened: string }>();
	for (const b of boundaries) {
		if (b.plan !== plan) continue;
		const label = phaseLabel({ kind: b.kind ?? "build", number: b.phase });
		const have = opened.get(label);
		if (!have || at(b.timestamp) < at(have.opened))
			opened.set(label, { label, opened: b.timestamp });
	}
	const closes = new Map<string, string>();
	for (const r of timings) {
		if (r.kind !== "phase-close" || r.plan !== plan) continue;
		const label = phaseLabel({ kind: r.phaseKind ?? "build", number: r.phase });
		const have = closes.get(label);
		if (!have || at(r.at) < at(have)) closes.set(label, r.at);
	}
	const ordered = [...opened.values()].sort((a, b) => at(a.opened) - at(b.opened));
	return ordered.map((phase, i) => {
		const recorded = closes.get(phase.label) ?? null;
		// A plan that has landed has no open phase: its last one ends at the landing.
		const next = ordered[i + 1]?.opened ?? landedAt;
		const closed = recorded ?? next;
		return {
			label: phase.label,
			opened: phase.opened,
			closed,
			derived: recorded === null && next !== null,
			open: closed === null,
			durationMs: (closed === null ? now : at(closed)) - at(phase.opened),
		};
	});
}

function stepsOf(timings: TimingRecord[], plan: string, now: number): StepTime[] {
	const ends = new Map<string, Extract<TimingRecord, { kind: "step-end" }>>();
	for (const r of timings) if (r.kind === "step-end" && r.plan === plan) ends.set(r.id, r);
	const steps: StepTime[] = [];
	for (const r of timings) {
		if (r.kind !== "step-start" || r.plan !== plan) continue;
		const end = ends.get(r.id);
		steps.push({
			id: r.id,
			step: r.step,
			...(r.phase ? { phase: r.phase } : {}),
			started: r.at,
			ended: end !== undefined,
			outcome: end?.outcome ?? null,
			durationMs: end ? at(end.at) - at(r.at) : null,
			sinceStartMs: end ? null : now - at(r.at),
		});
	}
	return steps.sort((a, b) => at(a.started) - at(b.started));
}

function testRunsOf(timings: TimingRecord[], plan: string): TestRunTime[] {
	const runs: TestRunTime[] = [];
	for (const r of timings) {
		if (r.kind !== "test-run" || r.plan !== plan) continue;
		runs.push({
			scope: r.scope === "landing" ? "landing" : r.scope.phase,
			startedAt: r.startedAt,
			durationMs: r.durationMs,
			passed: r.passed,
			files: r.files,
		});
	}
	return runs.sort((a, b) => at(a.startedAt) - at(b.startedAt));
}

export async function planTime(
	root: string,
	plan: string,
	options: {
		now?: () => number;
		reads?: PlanTimeReads;
		home?: string;
		/** The checkout holding the plan's live copy (its worktree while built there); default `root`. */
		liveRoot?: string;
	} = {},
): Promise<PlanTime> {
	const now = (options.now ?? Date.now)();
	const reads = options.reads ?? defaultReads(root, plan, options.home, options.liveRoot ?? root);
	const missing: string[] = [];

	let boundaries: PhaseBoundaryRecord[] = [];
	try {
		boundaries = (await reads.boundaries()).filter((b) => b.plan === plan);
		if (boundaries.length === 0) missing.push("phase openings");
	} catch (err) {
		missing.push(
			`phase openings (unreadable: ${err instanceof Error ? err.message : String(err)})`,
		);
	}
	const timings = await reads.timings();

	const landed = await reads.landedAt();
	const phases = phasesOf(boundaries, timings, plan, now, landed);
	const steps = stepsOf(timings, plan, now);
	const testRuns = testRunsOf(timings, plan);
	if (steps.length === 0) missing.push("steps");
	if (testRuns.length === 0) missing.push("test runs");

	const from = await reads.acceptedAt();
	let total: PlanTime["total"] = null;
	if (from === null) missing.push("acceptance time");
	else {
		const to = landed ?? new Date(now).toISOString();
		total = { from, to, ms: at(to) - at(from), landed: landed !== null };
	}
	const between =
		total && phases.length > 0 ? total.ms - phases.reduce((sum, p) => sum + p.durationMs, 0) : null;
	return { plan, phases, steps, testRuns, total, between, missing };
}

/** Durations print like `1h 04m`, `4m 12s`, `9s`; a negative one keeps its sign. */
export function formatDuration(ms: number): string {
	if (ms < 0) return `-${formatDuration(-ms)}`;
	const seconds = Math.round(ms / 1000);
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
	if (m > 0) return `${m}m ${String(seconds % 60).padStart(2, "0")}s`;
	return `${seconds}s`;
}

const col = (text: string, width: number) => text.padEnd(width);

function table(title: string, rows: string[][]): string[] {
	if (rows.length === 0) return [];
	const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
	return [
		title,
		...rows.map(
			(r) =>
				`  ${r
					.map((c, i) => col(c, widths[i]))
					.join("  ")
					.trimEnd()}`,
		),
		"",
	];
}

/** The result as three tables and a total; pure. */
export function formatPlanTime(result: PlanTime): string {
	const lines: string[] = [];
	lines.push(
		...table(
			"Phases",
			result.phases.map((p) => [
				p.label,
				formatDuration(p.durationMs),
				p.open ? "open" : p.derived ? "ended when the next opened" : "closed",
			]),
		),
	);
	lines.push(
		...table(
			"Steps",
			result.steps.map((s) => [
				s.step,
				s.phase ?? "",
				s.ended
					? formatDuration(s.durationMs ?? 0)
					: `started, never ended (${formatDuration(s.sinceStartMs ?? 0)} ago)`,
				s.outcome ?? "",
			]),
		),
	);
	lines.push(
		...table(
			"Test runs",
			result.testRuns.map((t) => [
				t.scope,
				formatDuration(t.durationMs),
				t.passed ? "passed" : "failed",
				`${t.files.own} own, ${t.files.reached} reached, ${t.files.mustNotBreak} must-not-break`,
			]),
		),
	);
	if (result.total) {
		lines.push(
			`total    ${formatDuration(result.total.ms)}${result.total.landed ? "" : " (so far, not yet landed)"}`,
		);
	}
	if (result.between !== null) lines.push(`between  ${formatDuration(result.between)}`);
	if (result.missing.length > 0) lines.push(`no record of: ${result.missing.join(", ")}`);
	return lines.join("\n").trimEnd();
}

function defaultReads(
	root: string,
	plan: string,
	home: string | undefined,
	liveRoot: string,
): PlanTimeReads {
	return {
		boundaries: () => readBoundaries(liveRoot),
		timings: () => readTimings(timingLogPath(root, plan, home)),
		acceptedAt: async () => {
			const folder = findPlanFolder(liveRoot, plan) ?? findPlanFolder(root, plan);
			if (folder === null) return null;
			try {
				const text = readFileSync(join(folder, "brief.md"), "utf-8");
				const match = text.match(/^accepted_at:\s*"?([^"\n]+?)"?\s*$/m);
				return match && Number.isFinite(Date.parse(match[1])) ? match[1] : null;
			} catch {
				return null;
			}
		},
		landedAt: () => landingTime(root, plan),
	};
}

/** The seams of the landing search: where the code lives, its trunk, and git. */
export interface LandingDeps {
	/** The checkout the plan's code lands into; null when it cannot be resolved. */
	codeRootOf: (root: string, plan: string) => string | null;
	trunkOf: (checkout: string) => string;
	runGit: (cwd: string, ...args: string[]) => Promise<string>;
}

const landingDeps: LandingDeps = {
	codeRootOf: (root, plan) => {
		const roots = resolveExecutionRoots(root, plan);
		return isRootsRefusal(roots) ? null : roots.codeRoot;
	},
	trunkOf: mainCheckoutOf,
	runGit: git,
};

/**
 * When the plan landed: the author time of the trunk's merge commit whose
 * subject `plans land` writes (`Merge <branch>: <plan> landed`); null while no
 * such commit exists. The archive records no landing time of its own. The merge
 * is written in the repository the plan's code lands into, which for a
 * workbench plan is a code repo, not the workbench root.
 */
export async function landingTime(
	root: string,
	plan: string,
	deps: LandingDeps = landingDeps,
): Promise<string | null> {
	try {
		const escaped = plan.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const searchRoot = deps.codeRootOf(root, plan) ?? root;
		const out = await deps.runGit(
			deps.trunkOf(searchRoot),
			"log",
			"--first-parent",
			"-E",
			`--grep=^Merge .*: ${escaped} landed$`,
			"--format=%aI",
			"-1",
		);
		return out === "" ? null : out;
	} catch {
		return null;
	}
}

/**
 * The command's answer: refuses a name that is no plan, reads the phase
 * openings from the plan's worktree while it is built there.
 */
export async function planTimeText(
	root: string,
	plan: string,
	options: {
		now?: () => number;
		home?: string;
		/** The checkout holding the plan's live copy; null when the plan has none. */
		liveRoot?: (root: string, plan: string) => Promise<string | null>;
	} = {},
): Promise<string> {
	const resolve = options.liveRoot ?? liveRootOf;
	const live = await resolve(root, plan);
	if (live === null && findPlanFolder(root, plan) === null) {
		throw new PlanCommandRefusal(`no plan named ${plan}, on the trunk or in a worktree`);
	}
	const result = await planTime(root, plan, {
		...(options.now ? { now: options.now } : {}),
		...(options.home ? { home: options.home } : {}),
		liveRoot: live ?? root,
	});
	return formatPlanTime(result);
}

/** The checkout where the plan's documents are written: its worktree, else the trunk; null when neither holds it. */
async function liveRootOf(root: string, plan: string): Promise<string | null> {
	const found = await livePlanCopy(root, plan);
	if (!found.ok) return null;
	const { copy } = found;
	if (copy.source === "worktree") return copy.root;
	return existsSync(copy.dir) ? copy.root : null;
}

import type { LanguageModel } from "ai";
import type { ImplPhase } from "../impl-parser.js";
import type { Trajectory } from "../trajectory/parser.js";
import type { RunGateOptions } from "./driver.js";
import type { GateResult } from "./gate.js";
import type { DriverConfig } from "./registry.js";

/**
 * Loop control for the external orchestrator — the `/work --autopilot`
 * contract ported out of Claude Code (ADR Decision 4):
 *
 *   - scoped per phase: one driver run per phase, a tight phase-only contract;
 *   - advance-on-green: a phase closes only when `check-gates` — invoked
 *     DELIBERATELY with a would-be next-phase checkoff probe — exits 0;
 *   - goalpost guard: the Test Trajectory table is snapshotted pre-phase and
 *     any Asserts change / Passes-at-moved-later STOPS the loop LOUD;
 *   - pause-at-human-gate: deferred/manual verification rows pause the loop
 *     instead of self-approving;
 *   - hard stop at impl-complete: the loop never runs the close-out rituals.
 *
 * Red never auto-retries: one honest driver attempt per phase; a phase that
 * cannot reach green is a human decision, not a machine loop.
 */

export interface RunLoopOptions {
	/** Absolute path to the worktree the run is bound to. */
	worktree: string;
	/** Absolute path to the plan's impl.md. Default: `{worktree}/impl.md`. */
	implPath?: string;
	/** Injectable model client — tests pass a mock; production omits it. */
	model?: LanguageModel;
	/** Resolved provider config (registry). Defaults to the Claude driver. */
	driver?: DriverConfig;
	/** Gate wiring — scripts injectable for tests. Never omitted internally. */
	gate?: RunGateOptions;
	/** Max model steps per phase. Default 24. */
	maxStepsPerPhase?: number;
	/** Progress callback fired before each phase's driver run. */
	onPhaseStart?: (phase: number, name: string) => void;
}

export interface PhaseReport {
	phase: number;
	name: string;
	steps: number;
	toolCalls: number;
	usage?: { inputTokens?: number; outputTokens?: number };
}

export type RunLoopResult =
	| { status: "complete"; phases: PhaseReport[] }
	| { status: "stopped-goalpost"; phase: number; violations: string[]; phases: PhaseReport[] }
	| { status: "stopped-red"; phase: number; reason: string; phases: PhaseReport[] }
	| {
			status: "paused-human-gate";
			phase: number;
			reason: string;
			items: string[];
			phases: PhaseReport[];
	  };

/** Parse the Test Trajectory table out of full impl.md content (frontmatter included). */
export function snapshotTrajectory(_implContent: string): Trajectory {
	throw new Error("not implemented");
}

/**
 * Goalpost guard: compare a pre-phase trajectory snapshot against the
 * post-phase table. Returns violations (empty = clean). Asserts-text changes,
 * Passes-at-moved-later, and row removal are violations; State-cell
 * transitions and added rows are allowed.
 */
export function checkGoalposts(_before: Trajectory, _after: Trajectory): string[] {
	throw new Error("not implemented");
}

/**
 * Derive whether a phase is a human gate — no new marker required. Returns
 * the matching item texts (empty = machine-verifiable phase).
 */
export function detectHumanGate(_phase: ImplPhase, _trajectory: Trajectory): string[] {
	throw new Error("not implemented");
}

/**
 * Deliberate phase-close probe: feed `check-gates` a would-be next-phase
 * checkoff envelope against a temp copy of the impl and require exit 0.
 */
export async function probePhaseClose(_options: {
	implPath: string;
	worktree: string;
	phase: number;
	scripts: string[];
}): Promise<GateResult> {
	throw new Error("not implemented");
}

/** Run the plan's remaining phases through the gated driver, advancing only on green. */
export async function runLoop(_options: RunLoopOptions): Promise<RunLoopResult> {
	throw new Error("not implemented");
}

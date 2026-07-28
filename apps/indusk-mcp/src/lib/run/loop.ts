import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import type { LanguageModel } from "ai";
import matter from "gray-matter";
import { type ImplPhase, parseImplString } from "../impl-parser.js";
import type { Trajectory } from "../trajectory/parser.js";
import { type RunDriverOptions, type RunGateOptions, runDriver } from "./driver.js";
import { resolveGateScripts } from "./gate.js";
import { checkGoalposts, snapshotTrajectory } from "./goalposts.js";
import { probePhaseClose } from "./probe.js";
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
	/** Max model steps per phase. Default 48. */
	maxStepsPerPhase?: number;
	/** Progress callback fired before each phase's driver run. */
	onPhaseStart?: (phase: number, name: string) => void;
	/** Live per-step progress from the driver (tool calls as they land). */
	onStep?: RunDriverOptions["onStep"];
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
	| {
			status: "stopped-red";
			phase: number;
			reason: string;
			phases: PhaseReport[];
			/** Cost of the failed attempt (F4: red stops must report too). */
			attempt?: PhaseReport;
	  }
	| {
			status: "paused-human-gate";
			phase: number;
			reason: string;
			items: string[];
			phases: PhaseReport[];
	  };

// One honest attempt still needs room for a thinking model's read-first style:
// gemini-3.6-flash burned 24 steps mid-ritual (tests already green, checkoffs
// pending) where 2.5-flash finished in 18. 48 bounds the attempt without
// starving cautious models; tune per-run via --max-steps.
const DEFAULT_PHASE_STEPS = 48;

/**
 * Derive whether a phase is a human gate — no new marker required. Returns
 * the matching item texts (empty = machine-verifiable phase).
 */
export function detectHumanGate(phase: ImplPhase, trajectory: Trajectory): string[] {
	// Ids named in the Deferred Verification block — an item referencing one
	// is deferred human judgment even without matching a text pattern.
	const deferredIds = new Set(
		trajectory.deferred.flatMap((row) => row.name.match(/\b[TAU]\d+\b/g) ?? []),
	);

	const matches: string[] = [];
	for (const gate of phase.gates) {
		for (const item of gate.items) {
			if (item.checked) continue; // already handled by a human
			const referencesDeferredRow = (item.text.match(/\b[TAU]\d+\b/g) ?? []).some((id) =>
				deferredIds.has(id),
			);
			if (referencesDeferredRow || HUMAN_GATE_PATTERNS.some((p) => p.test(item.text))) {
				matches.push(item.text);
			}
		}
	}
	return matches;
}

/**
 * The plan's already-declared "a human must look" phrasings (autopilot step 1)
 * — a Deferred Verification reference, a `U`-prefixed deferred row, or a
 * manual/visual-judgment item.
 */
const HUMAN_GATE_PATTERNS: readonly RegExp[] = [
	/deferred verification/i,
	/\bU\d+\b/,
	/\bmanual smoke\b/i,
	/\bbrowser smoke\b/i,
	/\bmanual(?:ly)?\s+(?:check|verify|verification|test|review)\b/i,
	/does it look right/i,
];

/**
 * A phase needs no run when every item is checked or carries a bare opt-out —
 * headless runs are `gate_policy: auto` by contract (there is no user to give
 * conversation-proof skips to), so the auto-policy override markers apply.
 */
function isPhaseDone(phase: ImplPhase): boolean {
	return phase.gates.every((gate) =>
		gate.items.every(
			(item) =>
				item.checked ||
				item.text.includes("(none needed)") ||
				item.text.includes("(not applicable)") ||
				item.text.includes("skip-reason:"),
		),
	);
}

/** The tight per-phase contract handed to the driver — ported from autopilot. */
function phasePrompt(phase: ImplPhase, implFile: string): string {
	return [
		`Execute ONLY Phase ${phase.number} ("${phase.name}") of the implementation plan in \`${implFile}\`.`,
		`1. Read \`${implFile}\` first to see the phase's checklist and the Test Trajectory table.`,
		`2. Work test-first: author the tests for trajectory rows writable at Phase ${phase.number} RED, set their State cells to "written", then implement until green and set them to "passing".`,
		`3. Complete every Phase ${phase.number} checklist item, checking each off in \`${implFile}\` as you finish it. Items marked "(none needed)" may stay unchecked.`,
		`4. You MUST NOT change the Test Trajectory table's Asserts, Writable at, or Passes at columns, any test's assertion text, or any other phase. State cells and Phase ${phase.number} checkoffs are the only plan edits allowed.`,
		`When every Phase ${phase.number} item is done, reply with a short summary instead of calling a tool.`,
	].join("\n");
}

/** Run the plan's remaining phases through the gated driver, advancing only on green. */
export async function runLoop(options: RunLoopOptions): Promise<RunLoopResult> {
	const root = resolve(options.worktree);
	const implPath = options.implPath ? resolve(options.implPath) : join(root, "impl.md");
	const implFile = relative(root, implPath) || "impl.md";
	const scripts = options.gate?.scripts ?? resolveGateScripts(root);
	const gate: RunGateOptions = { ...options.gate, scripts };
	const phases: PhaseReport[] = [];

	const initial = parseImplString(await readFile(implPath, "utf8"));
	if (initial.phases.length === 0) {
		throw new Error(`No phases found in ${implPath} — nothing to run.`);
	}

	for (const planned of initial.phases) {
		// Re-read on every iteration — earlier phases edited the plan.
		const content = await readFile(implPath, "utf8");
		const current = parseImplString(content);
		const phase = current.phases.find((p) => p.number === planned.number) ?? planned;
		if (isPhaseDone(phase)) continue;

		// Goalpost baseline: snapshot the trajectory before the phase runs.
		const trajectoryBefore = snapshotTrajectory(content);

		// Human gate? Pause BEFORE spending a model step — deferred/manual
		// verification is the plan saying "a machine cannot approve this."
		const humanItems = detectHumanGate(phase, trajectoryBefore);
		if (humanItems.length > 0) {
			return {
				status: "paused-human-gate",
				phase: phase.number,
				reason: `Phase ${phase.number} ("${phase.name}") declares verification a machine must not self-approve — a human must check: ${humanItems.join(" · ")}`,
				items: humanItems,
				phases,
			};
		}

		options.onPhaseStart?.(phase.number, phase.name);

		// One honest attempt — both gate layers live on every edit tool call.
		const result = await runDriver({
			worktree: root,
			prompt: phasePrompt(phase, implFile),
			model: options.model,
			driver: options.driver,
			maxSteps: options.maxStepsPerPhase ?? DEFAULT_PHASE_STEPS,
			gate,
			onStep: options.onStep,
		});

		// Goalpost guard: STOP LOUD if the trajectory drifted — a gamed gate,
		// not a passed one. Detection, not reversion: the drift stays visible.
		const trajectoryAfter = snapshotTrajectory(await readFile(implPath, "utf8"));
		const violations = checkGoalposts(trajectoryBefore, trajectoryAfter);
		if (violations.length > 0) {
			return { status: "stopped-goalpost", phase: phase.number, violations, phases };
		}

		// Advance only on green: the deliberate check-gates probe, not the
		// model's self-report, decides whether the phase closed.
		const probe = await probePhaseClose({ implPath, worktree: root, phase: phase.number, scripts });
		if (!probe.allowed) {
			return {
				status: "stopped-red",
				phase: phase.number,
				reason: probe.blockMessage ?? `check-gates refused the Phase ${phase.number} close probe.`,
				phases,
				attempt: {
					phase: phase.number,
					name: phase.name,
					steps: result.steps,
					toolCalls: result.toolCalls.length,
					usage: result.usage,
				},
			};
		}

		phases.push({
			phase: phase.number,
			name: phase.name,
			steps: result.steps,
			toolCalls: result.toolCalls.length,
			usage: result.usage,
		});
	}

	return { status: "complete", phases };
}

import { resolveGateScripts } from "../run/gate.js";
import { checkGoalposts, snapshotTrajectory } from "../run/goalposts.js";
import { probePhaseClose } from "../run/probe.js";
import type { Trajectory } from "../trajectory/parser.js";
import { showFileAt } from "./git.js";
import type { VerifyFinding } from "./verify.js";

/**
 * The three detections that already had machinery.
 *
 * Two of them are pure reuse: `probePhaseClose` answers "may the next phase
 * advance?" against committed state, and `checkGoalposts` compares two parsed
 * trajectories. The third is NOT free, and finding that out is what writing the
 * test taught — see `detectTestFirstDuty` below.
 */

/** States that end a row's authoring obligation — mirrors check-gates Gate A. */
const TERMINAL_STATES: ReadonlySet<string> = new Set(["written", "passing", "skipped", "blocked"]);

/**
 * Premature checkoff — run the REAL `check-gates` against the committed impl.
 *
 * The probe synthesizes a would-be next-phase checkoff and asks the hook
 * whether it would allow it. Exit 2 means some phase at or below N is not
 * actually closable: an unchecked gate item, or a trajectory row that should
 * have been terminal. That is the same question a phase transition asks in the
 * controlled lanes — asked here after the fact instead of before the edit.
 */
export async function detectPrematureCheckoff(options: {
	root: string;
	implPath: string;
	phase: number;
	scripts?: string[];
}): Promise<VerifyFinding[]> {
	const scripts = options.scripts ?? resolveGateScripts(options.root);
	const probe = await probePhaseClose({
		implPath: options.implPath,
		worktree: options.root,
		phase: options.phase,
		scripts,
	});
	if (probe.allowed) return [];

	const message = (probe.blockMessage ?? "").trim();
	if (message.length === 0) {
		return [
			{
				kind: "premature-checkoff",
				message: `check-gates refused the Phase ${options.phase} close probe without explanation — treating silence as a refusal.`,
			},
		];
	}
	return [{ kind: "premature-checkoff", message }];
}

/**
 * Test-first duty — Gate A's rule, applied to the phase being verified.
 *
 * This does NOT come free from the probe, which is the non-obvious part. The
 * probe asks about phase N+1, and it deliberately neutralizes rows writable at
 * N+1 so Gate A cannot misfire on the next phase's obligation. The consequence
 * is that the VERIFIED phase's own test-first duty is invisible to it. Verify
 * therefore applies the rule directly: a row writable at phase N must have been
 * authored (at minimum RED) by the time phase N closes.
 */
export function detectTestFirstDuty(trajectory: Trajectory, phase: number): VerifyFinding[] {
	return trajectory.rows
		.filter((row) => row.writableAt === phase && !TERMINAL_STATES.has(row.state))
		.map((row) => ({
			kind: "test-first" as const,
			row: row.id,
			message: `Row ${row.id} is writable at Phase ${phase} but is still "${row.state}" — the test was never authored. Test-first means it exists as RED before the phase closes.`,
		}));
}

/**
 * Rows whose phase references do not parse.
 *
 * `Phase one` becomes NaN, and every filter in this command is `=== phase` or
 * `<= phase` — neither of which NaN ever satisfies. So the row silently drops
 * out of red-test checking, out of the test-first duty, and out of the probe's
 * Gate B, while still reading as a perfectly ordinary row to a human. Corrupt
 * one cell and the row stops being checked at all, with no signal anywhere.
 *
 * A row the command cannot interpret is unverifiable, and unverifiable is
 * reported — never treated as satisfied.
 */
export function detectMalformedRows(trajectory: Trajectory): VerifyFinding[] {
	const findings: VerifyFinding[] = [];
	for (const row of trajectory.rows) {
		const bad: string[] = [];
		if (!Number.isFinite(row.writableAt)) bad.push("Writable at");
		if (!Number.isFinite(row.passesAt)) bad.push("Passes at");
		if (row.state === "unknown") bad.push("State");
		if (bad.length === 0) continue;
		findings.push({
			kind: "test-first",
			row: row.id,
			message: `Row ${row.id} has an unparseable ${bad.join(" and ")} cell, so it is invisible to every phase-scoped check (red tests, test-first duty, and phase close). An uninterpretable row is unverified, not satisfied — fix the cell.`,
		});
	}
	return findings;
}

/**
 * Goalpost drift — compare the trajectory at the baseline against the current
 * one.
 *
 * `checkGoalposts` already encodes the policy (assertion text changed, `Passes
 * at` deferred, `Writable at` deferred, row deleted, terminality self-assigned)
 * and deliberately permits honest forward progress on the State column. The
 * only new part is where "before" comes from: `git show <baseline>:<path>`
 * instead of an in-process snapshot.
 */
export async function detectGoalpostDrift(options: {
	root: string;
	baselineSha: string;
	implRepoRelPath: string;
	currentContent: string;
	/** Where the baseline came from — changes what an unreachable impl means. */
	baselineSource: "ledger" | "merge-base";
}): Promise<VerifyFinding[]> {
	const baselineContent = await showFileAt(
		options.root,
		options.baselineSha,
		options.implRepoRelPath,
	);
	if (baselineContent === null) {
		// Bootstrap: the plan simply did not exist yet, every row is new, and
		// nothing can have moved. Silence is correct.
		if (options.baselineSource === "merge-base") return [];
		// Ledger: a previous verification DEMONSTRABLY read this plan at this
		// commit. Unreachable now means renamed, moved, or a missing blob — and
		// returning "no drift" would erase the goalposts silently, which is the
		// one thing this command exists not to do.
		return [
			{
				kind: "goalpost",
				message: `Baseline ${options.baselineSha.slice(0, 7)} was recorded by a previous verification, but ${options.implRepoRelPath} cannot be read at that commit — the plan was moved, renamed, or its history is unavailable. Goalpost drift cannot be checked, so it is reported rather than assumed clean.`,
			},
		];
	}

	const before = snapshotTrajectory(baselineContent);
	const after = snapshotTrajectory(options.currentContent);
	if (!before.present || !after.present) return [];

	return checkGoalposts(before, after).map((violation) => ({
		kind: "goalpost" as const,
		row: violation.match(/\brow\s+([TAU]\d+)\b/i)?.[1],
		message: violation,
	}));
}

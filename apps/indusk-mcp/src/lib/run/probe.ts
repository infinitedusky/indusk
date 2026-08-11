import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fencedLineMask, parsePhaseHeading } from "../impl-headings.js";
import { TERMINAL_STATES } from "../trajectory/parser.js";
import { type GateEnvelope, type GateResult, runGateScripts } from "./gate.js";
import { snapshotTrajectory } from "./goalposts.js";

/**
 * The deliberate phase-close probe — how the loop decides a phase may end.
 *
 * Extracted from `loop.ts` (Phase 7). This is the subtlest invariant in the
 * plan: rather than trusting the model's self-report, the loop asks
 * `check-gates` a question it cannot answer wrongly — "would you allow the
 * NEXT phase to be checked off?" — against a synthetic temp copy. It earns its
 * own file and its own tests.
 */

// Terminal trajectory states come from the trajectory module — one definition,
// so this probe and `atdawn verify` cannot disagree about whether a row's
// obligation is discharged.

/** The probe checklist item injected into the temp copy — unique by construction. */
export const PROBE_ITEM = "__indusk-run phase-close probe__";

/**
 * Everything up to and including phase `n`, with every later phase dropped.
 *
 * The probe's contract is "every phase up to N is closed". It used to get that
 * by appending a synthetic `Phase N+1` and relying on `check-gates` stopping at
 * the first phase whose *number* was not smaller — which silently depended on
 * the real Phase N+1 sharing a number with the synthetic one. That coincidence
 * disappeared the moment phases could be ordered by document position instead
 * of by number, and its absence turned every unfinished next phase into a false
 * "premature checkoff".
 *
 * Truncating states the contract directly: if the later phases are not in the
 * document, no ordering rule can include them. Falls back to the full content
 * when phase `n` cannot be located, which preserves the previous behaviour
 * rather than silently probing an empty document.
 */
export function truncateAfterPhase(content: string, n: number): string {
	const lines = content.split("\n");
	const fenced = fencedLineMask(lines);
	let seenTarget = false;
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const heading = parsePhaseHeading(lines[i]);
		if (!heading) continue;
		if (seenTarget) return lines.slice(0, i).join("\n");
		if (heading.kind === "build" && heading.number === n) seenTarget = true;
	}
	return content;
}

/**
 * Deliberate phase-close probe: feed `check-gates` a would-be next-phase
 * checkoff envelope and require exit 0 — never trust the model's self-report.
 *
 * Mechanics: a temp copy of the impl gets a synthetic `Phase N+1` appended
 * with one unchecked implementation item; the probe envelope checks that item
 * off. check-gates then enforces, against the REAL current content: every
 * Phase ≤ N gate item checked (or policy-overridden) and every trajectory row
 * with `Passes at ≤ N` terminal. Rows *writable* at N+1 are the next phase's
 * test-first duty, not part of Phase N's greenness — the probe copy marks the
 * non-terminal ones `skipped` so Gate A cannot misfire on them (their
 * `Passes at` is ≥ N+1, so this cannot mask a Phase ≤ N obligation).
 */
export async function probePhaseClose(options: {
	implPath: string;
	worktree: string;
	phase: number;
	scripts: string[];
}): Promise<GateResult> {
	const content = await readFile(options.implPath, "utf8");
	const probePhase = options.phase + 1;
	const probeContent = [
		// Drop everything after phase N so "the phases before the probe" is
		// exactly "phases up to N" under any ordering rule — see
		// `truncateAfterPhase`.
		truncateAfterPhase(neutralizeRowsWritableAt(content, probePhase), options.phase),
		"",
		`### Phase ${probePhase}: __orchestrator phase-close probe__`,
		"",
		`- [ ] ${PROBE_ITEM}`,
		"",
	].join("\n");

	const dir = await mkdtemp(join(tmpdir(), "indusk-run-probe-"));
	try {
		const probePath = join(dir, "impl.md");
		await writeFile(probePath, probeContent, "utf8");
		const envelope: GateEnvelope = {
			tool_name: "Edit",
			tool_input: {
				file_path: probePath,
				old_string: `- [ ] ${PROBE_ITEM}`,
				new_string: `- [x] ${PROBE_ITEM}`,
			},
			cwd: resolve(options.worktree),
		};
		// The probe is check-gates' question ("may the next phase advance?") —
		// the validator gates write shapes, not phase transitions.
		const checkGates = options.scripts.filter((s) => basename(s) === "check-gates.js");
		return await runGateScripts(envelope, checkGates.length > 0 ? checkGates : options.scripts);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/**
 * In the probe copy only: set non-terminal trajectory rows writable at the
 * probe phase to `skipped` so Gate A (test-first for the NEXT phase) cannot
 * fail a probe that is only asking about THIS phase's closure.
 */
function neutralizeRowsWritableAt(content: string, phase: number): string {
	const trajectory = snapshotTrajectory(content);
	const targets = new Set(
		trajectory.rows
			.filter((row) => row.writableAt === phase && !TERMINAL_STATES.has(row.state))
			.map((row) => row.id),
	);
	if (targets.size === 0) return content;

	const lines = content.split("\n");
	let idColumn = -1;
	let stateColumn = -1;

	return lines
		.map((line) => {
			const trimmed = line.trim();
			if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return line;
			const cells = trimmed.slice(1, -1).split("|");
			const normalized = cells.map((c) => c.trim().toLowerCase());
			if (idColumn === -1 || stateColumn === -1) {
				const id = normalized.indexOf("id");
				const state = normalized.indexOf("state");
				if (id !== -1 && state !== -1) {
					idColumn = id;
					stateColumn = state;
				}
				return line;
			}
			const id = cells[idColumn]?.trim();
			if (id === undefined || !targets.has(id)) return line;
			cells[stateColumn] = " skipped ";
			return `|${cells.join("|")}|`;
		})
		.join("\n");
}

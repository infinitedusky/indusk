import type { PhaseKind } from "../impl-headings.js";
import { findPhaseStart, readBoundaries } from "../shape/boundary.js";
import { appendTiming, readTimings, timingLogPath } from "./log.js";
import { recordSafely } from "./safe.js";

export interface PhaseCloseInput {
	plan: string;
	phase: number;
	kind?: PhaseKind;
	sha: string;
	now?: () => number;
	/** The project's machine-state home; the real one when absent. */
	home?: string;
	warn?: (message: string) => void;
}

/**
 * Record that a phase closed, next to the record of when it opened. Writes
 * nothing for a phase never opened, already closed, or whose close would fall
 * before its opening — each warns, because inventing a time would make the data
 * the later per-phase test decision rests on wrong. Never rejects.
 *
 * promise: a-plan-says-how-long-it-took
 */
export function recordPhaseClose(root: string, input: PhaseCloseInput): Promise<void> {
	const now = input.now ?? Date.now;
	const warn = input.warn ?? ((m: string) => console.warn(m));
	return recordSafely(async () => {
		const ref = { kind: input.kind ?? "build", number: input.phase };
		const opening = findPhaseStart(await readBoundaries(root), input.plan, ref);
		if (opening === null) {
			warn(
				`timing: phase ${input.phase} of ${input.plan} was never opened, so its close is not recorded`,
			);
			return;
		}
		const path = timingLogPath(root, input.plan, input.home);
		const closed = (await readTimings(path)).some(
			(r) =>
				r.kind === "phase-close" &&
				r.plan === input.plan &&
				r.phase === input.phase &&
				(r.phaseKind ?? "build") === ref.kind,
		);
		if (closed) return;
		if (now() < Date.parse(opening.timestamp)) {
			warn(
				`timing: phase ${input.phase} of ${input.plan} would close earlier than it opened, so its close is not recorded`,
			);
			return;
		}
		await appendTiming(
			path,
			{
				kind: "phase-close",
				plan: input.plan,
				phase: input.phase,
				...(input.kind ? { phaseKind: input.kind } : {}),
				sha: input.sha,
			},
			now,
		);
	}, warn);
}

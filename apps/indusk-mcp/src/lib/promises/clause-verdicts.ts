/** Stub: Build Phase 3 writes this (a-run-can-be-trusted A78, A79). */
import type { Tracer } from "@opentelemetry/api";
import type { ClauseVerdict } from "./clause-signal.js";

export const DECISIONS_FILE = "plan-write-decisions.jsonl";

export type Snapshot = Record<string, [number, number]>;

export type PlanWriteLine =
	| {
			kind: "decision";
			toolUseId: string;
			at: string;
			command: string;
			cwd: string;
			decision: "refused" | "allowed";
			files: string[];
			before: Snapshot;
	  }
	| { kind: "after"; toolUseId: string; after: Snapshot };

export function appendDecision(_home: string, _line: PlanWriteLine): void {}

export function judgeDecision(
	_decision: Extract<PlanWriteLine, { kind: "decision" }>,
	_after?: Snapshot,
): ClauseVerdict | null {
	return null;
}

export async function drainPlanWriteDecisions(
	_root: string,
	_opts: { home?: string; tracer?: Tracer; now?: Date; live?: () => boolean } = {},
): Promise<{ sent: number; kept: number }> {
	return { sent: 0, kept: 0 };
}

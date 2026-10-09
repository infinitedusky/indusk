import type { HealthLine, View } from "./view.js";

export interface Break {
	promise: string;
	source: string;
	traceId: string;
	symptom?: string;
}

export interface Problem {
	promise: string;
	source: string;
	message: string;
}

export interface Session {
	cadenceMs: number;
	view: View | null;
	lastLineAt: number | null;
	told: Set<string>;
}

/** The editor's read session over `promises health --json` lines. Built in Build Phase 2. */
export function startSession(cadenceMs = 5_000): Session {
	return { cadenceMs, view: null, lastLineAt: null, told: new Set() };
}

export function onLine(
	_s: Session,
	_line: HealthLine,
	_now: number,
): { session: Session; notify: Break[] } {
	throw new Error("onLine: not built yet");
}

export function onTick(_s: Session, _now: number): Session {
	throw new Error("onTick: not built yet");
}

export function problems(_s: Session): Problem[] {
	throw new Error("problems: not built yet");
}

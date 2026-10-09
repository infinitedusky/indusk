export interface BrokenPromise {
	promise: string;
	source: string;
	sourceLabel: string;
	statement: string;
	symptom?: string;
	traceId?: string;
	tests: string[];
}

export type FixAction =
	| { terminal: { cwd: string; name: string; command: string } }
	| { message: string };

/** The "Fix with Claude" action. Built in Build Phase 2. */
export function fixAction(
	_b: BrokenPromise,
	_ctx: { projectRoot: string; claudeOnPath: boolean },
): FixAction {
	throw new Error("fixAction: not built yet");
}

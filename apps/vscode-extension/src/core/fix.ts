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

/**
 * "Fix with Claude" (vscode-extension A12, A13): the developer's own `claude`
 * in the project, its first message carrying the break's facts. The editor
 * records nothing; Claude records the break through InDusk and fixes it.
 */
export function fixAction(
	b: BrokenPromise,
	ctx: { projectRoot: string; claudeOnPath: boolean },
): FixAction {
	if (!ctx.claudeOnPath) {
		return {
			message:
				"Claude Code is not installed, so there is nothing to start the fix with. Install it with `npm install -g @anthropic-ai/claude-code`, then try again.",
		};
	}
	const trace = b.traceId ? `${b.sourceLabel.replace(/\/+$/, "")}/trace/${b.traceId}` : null;
	const prompt = [
		`The promise \`${b.promise}\` is broken in ${b.source}: "${b.statement}"`,
		b.symptom ? `Symptom: ${b.symptom}` : null,
		trace ? `Trace: ${trace}` : null,
		b.tests.length > 0 ? `Tests that prove it: ${b.tests.join(", ")}` : null,
		"",
		"Record the break first (the `record_breaks` tool, or `indusk promises watch`), then find the cause and fix it under the plan that owns the promise.",
	]
		.filter((l): l is string => l !== null)
		.join("\n");
	return {
		terminal: {
			cwd: ctx.projectRoot,
			name: `Claude — ${b.promise}`,
			command: `claude ${shellQuote(prompt)}`,
		},
	};
}

/** One shell word, whatever it holds: single quotes, each embedded one closed and escaped. */
function shellQuote(text: string): string {
	return `'${text.replace(/'/g, `'\\''`)}'`;
}

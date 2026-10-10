import { type BrokenPromise, cleanFacts, fixPrompt } from "@infinitedusky/indusk-mcp/promises/fix";
import { promiseOf, type View, whereBroken } from "./view.js";

export type { BrokenPromise };

// promise: a-break-opens-a-fix-in-one-click

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
	const f = cleanFacts(b);
	const prompt = fixPrompt(b);
	return {
		terminal: {
			cwd: ctx.projectRoot,
			name: `Claude — ${f.promise}`,
			command: `claude ${shellQuote(prompt)}`,
		},
	};
}

/**
 * The fix for `promise` as the editor last read it: the first source, production
 * leading, where it is broken, with that source's facts. Null when it is broken
 * nowhere, so the action has nothing to start.
 */
export function fixFor(
	view: View | null,
	promise: string,
	ctx: { projectRoot: string; claudeOnPath: boolean },
): FixAction | null {
	const p = promiseOf(view, promise);
	const broke = whereBroken(view, promise);
	if (!p || !broke) return null;
	const { source, row } = broke;
	return fixAction(
		{
			promise,
			source: source.name,
			sourceLabel: source.label,
			statement: p.statement,
			...(row.symptom ? { symptom: row.symptom } : {}),
			...(row.traceId ? { traceId: row.traceId } : {}),
			tests: p.tests,
		},
		ctx,
	);
}

/** One shell word, whatever it holds: single quotes, each embedded one closed and escaped. */
function shellQuote(text: string): string {
	return `'${text.replace(/'/g, `'\\''`)}'`;
}

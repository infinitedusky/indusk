import { type BrokenPromise, cleanFacts, fixPrompt } from "@infinitedusky/indusk-mcp/promises/fix";
import { promiseOf, type View, whereBroken } from "./view.js";

export type { BrokenPromise };

// promise: a-break-opens-a-fix-in-one-click
// promise: a-fix-opens-in-the-claude-code-tab

export type FixAction =
	| { claudeTab: { uri: string } }
	| { terminal: { cwd: string; name: string; command: string } }
	| { message: string };

/** What the editor knows about where the fix can open. */
export interface FixContext {
	projectRoot: string;
	claudeOnPath: boolean;
	/** VS Code itself, as opposed to a fork such as Cursor. */
	host?: "vscode" | "other";
	/** The Claude Code extension is installed in this editor. */
	claudeCodeExtension?: boolean;
}

/** Claude Code's documented link: a new tab with the prompt filled in, not sent. */
const CLAUDE_TAB = "vscode://anthropic.claude-code/open?prompt=";

/**
 * "Fix with Claude" (vscode-extension A12, A13): a new Claude Code tab in VS
 * Code when the extension is installed, otherwise the developer's own `claude`
 * in a terminal in the project, its first message carrying the break's facts
 * (the package's `fixPrompt`, the one wording). The editor records nothing;
 * Claude records the break through InDusk and fixes it.
 */
export function fixAction(b: BrokenPromise, ctx: FixContext): FixAction {
	const tab = ctx.host === "vscode" && ctx.claudeCodeExtension;
	if (!tab && !ctx.claudeOnPath) {
		return {
			message:
				"Claude Code is not installed, so there is nothing to start the fix with. Install it with `npm install -g @anthropic-ai/claude-code`, then try again.",
		};
	}
	const prompt = fixPrompt(b);
	if (tab) return { claudeTab: { uri: `${CLAUDE_TAB}${encodeURIComponent(prompt)}` } };
	const f = cleanFacts(b);
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
export function fixFor(view: View | null, promise: string, ctx: FixContext): FixAction | null {
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

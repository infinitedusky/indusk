import { promiseOf, sourcesInOrder, stateIn, type View } from "./view.js";

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
	const f = cleanFacts(b);
	const trace = f.traceId ? `${f.sourceLabel.replace(/\/+$/, "")}/trace/${f.traceId}` : null;
	const prompt = [
		`The promise \`${f.promise}\` is broken in ${f.source}: "${f.statement}"`,
		f.symptom ? `Symptom: ${f.symptom}` : null,
		trace ? `Trace: ${trace}` : null,
		f.tests.length > 0 ? `Tests that prove it: ${f.tests.join(", ")}` : null,
		"",
		"Record the break first (the `record_breaks` tool, or `indusk promises watch`), then find the cause and fix it under the plan that owns the promise.",
	]
		.filter((l): l is string => l !== null)
		.join("\n");
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
	if (!view || !p) return null;
	for (const source of sourcesInOrder(view)) {
		const { shown, row } = stateIn(source, promise);
		if (shown !== "broken" || !row) continue;
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
	return null;
}

/**
 * The facts as the terminal may receive them. Every one comes from a span or
 * the registry and is typed into a terminal, where a control character is a
 * keystroke (Ctrl-C ends the quoted line and runs what follows): one line
 * each, control characters gone.
 */
function cleanFacts(b: BrokenPromise): BrokenPromise {
	return {
		...b,
		promise: oneLine(b.promise),
		source: oneLine(b.source),
		sourceLabel: oneLine(b.sourceLabel),
		statement: oneLine(b.statement),
		tests: b.tests.map(oneLine),
		...(b.symptom !== undefined ? { symptom: oneLine(b.symptom) } : {}),
		...(b.traceId !== undefined ? { traceId: oneLine(b.traceId) } : {}),
	};
}

/** The text with line breaks and tabs as spaces and every other control character removed. */
function oneLine(text: string): string {
	return (
		text
			.replace(/[\r\n\t]+/g, " ")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point
			.replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
			.trim()
	);
}

/** One shell word, whatever it holds: single quotes, each embedded one closed and escaped. */
function shellQuote(text: string): string {
	return `'${text.replace(/'/g, `'\\''`)}'`;
}

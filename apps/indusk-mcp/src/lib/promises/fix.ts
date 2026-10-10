/**
 * The fix prompt (plan-cockpit, ADR decision 4): the first message the
 * developer's own `claude` starts with when a broken promise is fixed from the
 * admin's promise page or from the editor — the promise, where it is broken,
 * its symptom, a link to the trace and the tests that prove it, then what to
 * do. Built once here, so the two surfaces cannot word it two ways. Moved from
 * the editor's `core/fix.ts`, which now imports it.
 *
 * promise: a-break-opens-a-fix-in-one-click
 */

export interface BrokenPromise {
	promise: string;
	source: string;
	sourceLabel: string;
	statement: string;
	symptom?: string;
	traceId?: string;
	tests: string[];
}

/**
 * The prompt for a break, one fact per line. Every fact comes from a span or
 * the registry and is typed into a terminal, where a control character is a
 * keystroke (Ctrl-C ends the quoted line and runs what follows), so each is
 * cleaned first.
 */
export function fixPrompt(broken: BrokenPromise): string {
	const f = cleanFacts(broken);
	const trace = f.traceId ? `${f.sourceLabel.replace(/\/+$/, "")}/trace/${f.traceId}` : null;
	return [
		`The promise \`${f.promise}\` is broken in ${f.source}: "${f.statement}"`,
		f.symptom ? `Symptom: ${f.symptom}` : null,
		trace ? `Trace: ${trace}` : null,
		f.tests.length > 0 ? `Tests that prove it: ${f.tests.join(", ")}` : null,
		"",
		"Record the break first (the `record_breaks` tool, or `indusk promises watch`), then find the cause and fix it under the plan that owns the promise.",
	]
		.filter((l): l is string => l !== null)
		.join("\n");
}

/** The facts as a terminal may receive them: one line each, control characters gone. */
export function cleanFacts(b: BrokenPromise): BrokenPromise {
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

/**
 * Reading `indusk promises status` output in tests.
 *
 * The output contract (day-monitor): one block per promise, opening on a line
 * that starts with the promise's name, blocks separated by a blank line. Three
 * test files carried this same reader byte for byte; one home now.
 */

/** The block for `name`: from the line that starts with it to the next blank line, or "". */
export function block(out: string, name: string): string {
	const lines = out.split("\n");
	const start = lines.findIndex((l) => l.trimStart().startsWith(name));
	if (start === -1) return "";
	const end = lines.findIndex((l, i) => i > start && l.trim() === "");
	return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

import { promiseOf, sourcesInOrder, stamp, stateIn, type View } from "./view.js";

/**
 * The hover on a marked line: the promise's sentence, its state for each
 * source, and when it last broke or was last seen (vscode-extension A4).
 */
export function hover(promise: string, view: View | null): string {
	const p = promiseOf(view, promise);
	if (!view || !p) return `**${promise}** — not in this project.`;
	const lines = [`**${promise}** — ${p.statement}`, ""];
	if (p.kind !== "behaviour") {
		lines.push(`Watched by the tests: ${p.tests.join(", ") || "none named"}.`);
		return lines.join("\n");
	}
	for (const source of sourcesInOrder(view)) {
		const { shown, row } = stateIn(source, promise);
		const when = row?.lastSeen
			? shown === "broken"
				? `, last broke ${stamp(row.lastSeen)}`
				: `, last seen ${stamp(row.lastSeen)}`
			: "";
		const why = !source.ok
			? ` — ${source.reason}`
			: row?.symptom && shown === "broken"
				? ` — ${row.symptom}`
				: "";
		lines.push(`- ${source.name}: ${shown}${when}${why}`);
	}
	if (view.notReading) lines.push("", "_Not reading: no health line for two reads._");
	return lines.join("\n");
}

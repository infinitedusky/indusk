import { promiseOf, sourcesInOrder, stamp, stateIn, type View } from "./view.js";

/**
 * The hover on a marked line: the promise's sentence, its state for each
 * source, and when it last broke or was last seen (vscode-extension A4).
 */
export function hover(promise: string, view: View | null): string {
	if (!view) return `**${promise}** — not reading: no promise health has arrived yet.`;
	const p = promiseOf(view, promise);
	if (!p) return `**${promise}** — not in this project.`;
	const lines = [`**${promise}** — ${asText(p.statement)}`, ""];
	if (p.kind !== "behaviour") {
		lines.push(`Watched by the tests: ${asText(p.tests.join(", ")) || "none named"}.`);
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
			? ` — ${asText(source.reason)}`
			: row?.symptom && shown === "broken"
				? ` — ${asText(row.symptom)}`
				: "";
		lines.push(`- ${source.name}: ${shown}${when}${why}`);
	}
	if (view.notReading) lines.push("", "_Not reading: no health line for two reads._");
	return lines.join("\n");
}

/**
 * Text from a span, a source or the registry, shown as its characters: the
 * signs that make a link, emphasis, code or HTML are escaped, so a symptom
 * written as a link is not one. Signs that only act at a line's start (`#`,
 * `-`, `1.`) are left: these texts never start a line.
 */
function asText(text: string): string {
	return text.replace(/[\\`*_[\]()!<>|~]/g, "\\$&");
}

import { anyTokenPattern } from "@infinitedusky/indusk-mcp/tokens";
import { promiseOf, sourcesInOrder, stateIn, type View } from "./view.js";

export interface Marker {
	line: number;
	promise: string;
	text: string;
	tone: "broken" | "ok" | "unknown" | "proves";
}

/**
 * The end-of-line markers for one file: every line carrying a promise's token
 * (the package's one grammar, never re-spelled), with the promise's state
 * (vscode-extension A1–A3, A10). A file the promise lists under its tests
 * proves it; any other file keeps it.
 */
export function markers(file: { path: string; text: string }, view: View | null): Marker[] {
	const out: Marker[] = [];
	const lines = file.text.split("\n");
	lines.forEach((text, line) => {
		for (const m of text.matchAll(anyTokenPattern("promise"))) {
			const name = m[1] as string;
			out.push({ line, promise: name, ...describe(name, file.path, view) });
		}
	});
	return out;
}

function describe(
	name: string,
	path: string,
	view: View | null,
): { text: string; tone: Marker["tone"] } {
	if (!view) return { text: `${name} · not reading`, tone: "unknown" };
	const promise = promiseOf(view, name);
	if (!promise) return { text: `${name} · not in this project`, tone: "unknown" };
	if (promise.tests.some((t) => path === t || path.endsWith(`/${t}`))) {
		return { text: `${name} · proved here`, tone: "proves" };
	}
	if (view.notReading) return { text: `${name} · not reading`, tone: "unknown" };
	if (promise.kind !== "behaviour") return { text: `${name} · watched by the tests`, tone: "ok" };
	const [first, ...rest] = sourcesInOrder(view);
	if (!first) return { text: `${name} · not reading`, tone: "unknown" };
	const lead = stateIn(first, name);
	if (lead.shown === "unreadable" || lead.shown === "watcher blind") {
		return { text: `${name} · ${first.name} ${lead.shown}`, tone: "unknown" };
	}
	if (lead.shown === "broken") return { text: `${name} · broken (${first.name})`, tone: "broken" };
	// A break in a later source (local, beside a production that holds) is
	// still shown on the line: it is the change breaking something before it ships.
	const later = rest.find((s) => stateIn(s, name).shown === "broken");
	if (later) return { text: `${name} · ${lead.shown}, broken (${later.name})`, tone: "broken" };
	return {
		text: `${name} · ${lead.shown}`,
		tone: lead.shown === "holding" || lead.shown === "fixed" ? "ok" : "unknown",
	};
}

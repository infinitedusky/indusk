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
export function markers(
	file: { path: string; text: string },
	view: View | null,
	scope: { nested?: string[] } = {},
): Marker[] {
	if (!inProject(file.path, scope.nested ?? [])) return [];
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

/**
 * Whether a file, by its path from the project's root, is this project's: not
 * outside the root, and not inside a nested InDusk project (dusk's
 * `examples/seat-holds/`), whose promises are its own (vscode-extension A22).
 */
function inProject(path: string, nested: string[]): boolean {
	if (path === ".." || path.startsWith("../") || path.startsWith("/")) return false;
	return !nested.some((n) => path === n || path.startsWith(`${n}/`));
}

function describe(
	name: string,
	path: string,
	view: View | null,
): { text: string; tone: Marker["tone"] } {
	if (promiseOf(view, name)?.tests.some((t) => path === t || path.endsWith(`/${t}`))) {
		return { text: `${name} · proved here`, tone: "proves" };
	}
	const s = stateOf(name, view);
	return { text: `${name} · ${s.text}`, tone: s.tone };
}

/**
 * A promise's state as the editor words it, wherever it is shown — on its
 * line or in the panel — so the two can never word it differently.
 */
export function stateOf(
	name: string,
	view: View | null,
): { text: string; tone: "broken" | "ok" | "unknown" } {
	if (!view) return { text: "not reading", tone: "unknown" };
	const promise = promiseOf(view, name);
	if (!promise) return { text: "not in this project", tone: "unknown" };
	if (view.notReading) return { text: "not reading", tone: "unknown" };
	if (promise.kind !== "behaviour") return { text: "watched by the tests", tone: "ok" };
	const [first, ...rest] = sourcesInOrder(view);
	if (!first) return { text: "not reading", tone: "unknown" };
	const lead = stateIn(first, name);
	if (lead.shown === "unreadable" || lead.shown === "watcher blind") {
		return { text: `${first.name} ${lead.shown}`, tone: "unknown" };
	}
	if (lead.shown === "broken") return { text: `broken (${first.name})`, tone: "broken" };
	// A break in a later source (local, beside a production that holds) is
	// still shown: it is the change breaking something before it ships.
	const later = rest.find((s) => stateIn(s, name).shown === "broken");
	if (later) return { text: `${lead.shown}, broken (${later.name})`, tone: "broken" };
	return {
		text: lead.shown,
		tone: lead.shown === "holding" || lead.shown === "fixed" ? "ok" : "unknown",
	};
}

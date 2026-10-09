import { anyTokenPattern } from "@infinitedusky/indusk-mcp/tokens";
import { stateOf } from "./markers.js";
import { sourcesInOrder, stateIn, type View } from "./view.js";

/** One place a promise lives: a test that proves it, or code that keeps it. */
export interface Location {
	kind: "test" | "site";
	path: string;
	/** The line its token is on, from zero; null when the file no longer carries it. */
	line: number | null;
}

export interface PanelPromise {
	name: string;
	kind: string;
	statement: string;
	/** The state as the markers word it: "broken (production)", "holding", … */
	state: string;
	tone: "broken" | "ok" | "unknown";
	/** Where a broken promise broke, when it last broke, and what the span said. */
	source?: string;
	brokeAt?: string;
	symptom?: string;
	locations: Location[];
	/** The plan that owns the promise. */
	plan?: string;
	/** Its most recent run in any source, or none. */
	lastRun?: string;
}

/** The promises one plan owns, newest run first. */
export interface PanelGroup {
	plan: string;
	promises: PanelPromise[];
}

export interface PanelModel {
	broken: PanelPromise[];
	groups: PanelGroup[];
	notReading: boolean;
}

/**
 * The promises panel (vscode-extension ADR decision 7): every promise with its
 * state, broken ones first as cards, latest break first, then the rest by
 * name; each with its tests and sites at the line its token is on. `files`
 * holds the text of each listed file the editor could read.
 */
export function panelModel(view: View | null, files: Map<string, string>): PanelModel {
	if (!view) return { broken: [], groups: [], notReading: true };
	const all = view.line.promises.map((p): PanelPromise => {
		const { text, tone } = stateOf(p.name, view);
		return {
			name: p.name,
			kind: p.kind,
			statement: p.statement,
			state: text,
			tone,
			...(tone === "broken" ? whereItBroke(view, p.name) : {}),
			...("plan" in p && typeof p.plan === "string" ? { plan: p.plan } : {}),
			...lastRunOf(view, p.name),
			locations: [
				...p.tests.map((path) => locate("test", path, p.name, files)),
				...(p.sites ?? []).map((path) => locate("site", path, p.name, files)),
			],
		};
	});
	return {
		broken: all
			.filter((p) => p.tone === "broken")
			.sort((a, b) => (b.brokeAt ?? "").localeCompare(a.brokeAt ?? "") || byName(a, b)),
		groups: byPlan(all.filter((p) => p.tone !== "broken")),
		notReading: view.notReading,
	};
}

const NO_PLAN = "no plan";

function byName(a: { name: string }, b: { name: string }): number {
	return a.name.localeCompare(b.name);
}

/** Newest run first; promises never run after, by name. */
function byNewestRun(a: PanelPromise, b: PanelPromise): number {
	if (a.lastRun && b.lastRun) return b.lastRun.localeCompare(a.lastRun) || byName(a, b);
	if (a.lastRun) return -1;
	if (b.lastRun) return 1;
	return byName(a, b);
}

/**
 * The promises below the broken cards, grouped by the plan that owns them:
 * each group newest run first; groups by their newest run, then plans never
 * run by name (A29).
 */
function byPlan(promises: PanelPromise[]): PanelGroup[] {
	const groups = new Map<string, PanelPromise[]>();
	for (const p of promises) {
		const plan = p.plan ?? NO_PLAN;
		groups.set(plan, [...(groups.get(plan) ?? []), p]);
	}
	return [...groups]
		.map(([plan, list]) => ({ plan, promises: list.sort(byNewestRun) }))
		.sort((a, b) => {
			const ra = a.promises[0]?.lastRun;
			const rb = b.promises[0]?.lastRun;
			if (ra && rb) return rb.localeCompare(ra) || a.plan.localeCompare(b.plan);
			if (ra) return -1;
			if (rb) return 1;
			return a.plan.localeCompare(b.plan);
		});
}

/** A promise's most recent run in any source that read, or nothing. */
function lastRunOf(view: View, name: string): Pick<PanelPromise, "lastRun"> {
	let last: string | undefined;
	for (const source of view.line.sources) {
		if (!source.ok) continue;
		const seen = source.rows.find((r) => r.promise === name)?.lastSeen;
		if (seen && (!last || seen > last)) last = seen;
	}
	return last ? { lastRun: last } : {};
}

/** The first source, production leading, where the promise is broken, with its facts. */
function whereItBroke(
	view: View,
	name: string,
): Pick<PanelPromise, "source" | "brokeAt" | "symptom"> {
	for (const source of sourcesInOrder(view)) {
		const { shown, row } = stateIn(source, name);
		if (shown !== "broken" || !row) continue;
		return {
			source: source.name,
			...(row.lastSeen ? { brokeAt: row.lastSeen } : {}),
			...(row.symptom ? { symptom: row.symptom } : {}),
		};
	}
	return {};
}

/** Where `name`'s token is in `path`, from the file's text; no line when it is not there. */
function locate(
	kind: Location["kind"],
	path: string,
	name: string,
	files: Map<string, string>,
): Location {
	const lines = files.get(path)?.split("\n") ?? [];
	const line = lines.findIndex((text) =>
		[...text.matchAll(anyTokenPattern("promise"))].some((m) => m[1] === name),
	);
	return { kind, path, line: line === -1 ? null : line };
}

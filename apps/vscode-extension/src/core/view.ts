import type { HealthLine } from "@infinitedusky/indusk-mcp/promises/health";

/**
 * What the editor knows after its latest `indusk promises health --json` line
 * (vscode-extension). The line is the package's one health rule applied; the
 * editor only words it.
 */
export type { HealthLine };

/** A promise's state as the editor words it. */
export type Shown =
	| "holding"
	| "broken"
	| "fixed"
	| "not seen"
	| "known violated"
	| "watched by the tests"
	| "unreadable"
	| "watcher blind"
	| "not reading";

export interface View {
	line: HealthLine;
	/** Two cadences passed without a line. */
	notReading: boolean;
}

type Source = HealthLine["sources"][number];
export type Row = Extract<Source, { ok: true }>["rows"][number];

const WORD: Record<string, Shown> = {
	red: "broken",
	fixed: "fixed",
	green: "holding",
	unverified: "not seen",
	amber: "known violated",
	grey: "holding",
};

/** Production first, then local: the alarm source leads, as the admin's does. */
export function sourcesInOrder(view: View): Source[] {
	return [...view.line.sources].sort((a, b) =>
		a.name === "production" ? -1 : b.name === "production" ? 1 : 0,
	);
}

/** One source's word for one promise. */
export function stateIn(source: Source, promise: string): { shown: Shown; row?: Row } {
	if (!source.ok)
		return { shown: "blind" in source && source.blind ? "watcher blind" : "unreadable" };
	const row = source.rows.find((r) => r.promise === promise);
	return row ? { shown: WORD[row.state] ?? "not seen", row } : { shown: "not seen" };
}

export function promiseOf(view: View | null, name: string) {
	return view?.line.promises.find((p) => p.name === name) ?? null;
}

/** "2026-10-08 12:20", the way the admin stamps a time. */
export function stamp(iso: string): string {
	return iso.slice(0, 16).replace("T", " ");
}

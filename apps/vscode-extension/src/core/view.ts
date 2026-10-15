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
	| "known broken"
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
	amber: "known broken",
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

/**
 * A promise's words as the health line carries them; the handle when the line
 * has none (an older line) or the promise is not in it. The editor never makes
 * words from a handle itself.
 */
export function titleOf(view: View | null, name: string): string {
	const title = promiseOf(view, name)?.title;
	return title ? title : name;
}

/**
 * "2026-10-08 12:20", the way the admin stamps a time, in `timeZone` (an IANA
 * name) or else the machine's own: the person reads their own clock, with no
 * zone suffix. A time that does not parse is shown as it came.
 */
export function stamp(iso: string, timeZone?: string): string {
	const at = new Date(iso);
	if (Number.isNaN(at.getTime())) return iso;
	const parts = new Intl.DateTimeFormat("en-CA", {
		...(timeZone ? { timeZone } : {}),
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(at);
	const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

/**
 * Where a broken promise is shown broken: the first source, production
 * leading, where it reads broken, with that source's row. One rule for the
 * fix action and the panel's card, so they name the same source (A31).
 */
export function whereBroken(
	view: View | null,
	promise: string,
): { source: Extract<Source, { ok: true }>; row: Row } | null {
	if (!view) return null;
	for (const source of sourcesInOrder(view)) {
		if (!source.ok) continue;
		const { shown, row } = stateIn(source, promise);
		if (shown === "broken" && row) return { source, row };
	}
	return null;
}

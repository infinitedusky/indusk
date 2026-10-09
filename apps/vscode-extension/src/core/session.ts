import { type HealthLine, sourcesInOrder, stateIn, type View } from "./view.js";

export interface Break {
	promise: string;
	source: string;
	traceId: string;
	symptom?: string;
}

export interface Problem {
	promise: string;
	source: string;
	message: string;
}

export interface Session {
	cadenceMs: number;
	view: View | null;
	lastLineAt: number | null;
	/** Breaks already notified, by source, promise and trace, so each is told once. */
	told: Set<string>;
}

/**
 * The editor's read session over `indusk promises health --json --every 5`
 * lines (vscode-extension A8–A10). Pure: the extension feeds it each line and
 * a clock, and shows what it returns.
 */
export function startSession(cadenceMs = 5_000): Session {
	return { cadenceMs, view: null, lastLineAt: null, told: new Set() };
}

export function onLine(
	s: Session,
	line: HealthLine,
	now: number,
): { session: Session; notify: Break[] } {
	const view: View = { line, notReading: false };
	const current = breaks(view);
	const key = (b: Break) => `${b.source}\0${b.promise}\0${b.traceId}`;
	const notify = current.filter((b) => !s.told.has(key(b)));
	return {
		session: { ...s, view, lastLineAt: now, told: new Set(current.map(key)) },
		notify,
	};
}

/** No line for two cadences: say "not reading", never keep showing the last state as current. */
export function onTick(s: Session, now: number): Session {
	if (!s.view || s.lastLineAt === null) return s;
	const notReading = now - s.lastLineAt > 2 * s.cadenceMs;
	return notReading === s.view.notReading ? s : { ...s, view: { ...s.view, notReading } };
}

/** The Problems list: every broken promise, by source, with its symptom. */
export function problems(s: Session): Problem[] {
	if (!s.view) return [];
	return breaks(s.view).map((b) => ({
		promise: b.promise,
		source: b.source,
		message: `${b.promise} is broken in ${b.source}${b.symptom ? `: ${b.symptom}` : ""}`,
	}));
}

function breaks(view: View): Break[] {
	const out: Break[] = [];
	for (const source of sourcesInOrder(view)) {
		if (!source.ok) continue;
		for (const row of source.rows) {
			if (stateIn(source, row.promise).shown !== "broken") continue;
			out.push({
				promise: row.promise,
				source: source.name,
				traceId: row.traceId ?? "",
				...(row.symptom ? { symptom: row.symptom } : {}),
			});
		}
	}
	return out;
}

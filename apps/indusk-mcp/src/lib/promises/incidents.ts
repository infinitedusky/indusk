import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { setList, setScalar } from "./frontmatter-edit.js";
import type { IncidentEntry, PromiseEntry, Registry } from "./registry.js";
import type { MarkedSpan } from "./telemetry.js";
import {
	INCIDENTS_SUBDIR,
	type IncidentSource,
	NOT_YET_FIXED,
	UNWRITTEN_ROOT_CAUSE,
} from "./vocabulary.js";

/**
 * Opening and extending incidents from observed violations (day-monitor,
 * ADR D6).
 *
 * An open incident of the violated promise is extended — new trace ids
 * appended, `last_seen` moved forward only; otherwise one is opened as
 * `incidents/i-<date>-<promise>.md`, a suffix on collision. A trace already
 * recorded in any incident of the promise, open or fixed, is never counted
 * again, so a fixed incident is not reopened by the violations that caused it
 * and a second pass over the same window writes nothing.
 *
 * Opening an incident also moves an `enforced` promise to `known-violated`
 * and lists the incident on it — `promises check` refuses an enforced promise
 * with an open incident, and the registry must still pass after a watch.
 */

export interface IncidentChange {
	id: string;
	kind: "opened" | "extended";
	traces: string[];
}

function iso(d: Date): string {
	return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function stringList(v: unknown): string[] {
	return Array.isArray(v) ? v.map(String) : [];
}

/** Trace ids and `last_seen` an incident file already records. */
export function recorded(path: string): { traces: string[]; lastSeen: string | null } {
	const data = matter(readFileSync(path, "utf-8")).data as Record<string, unknown>;
	const last = data.last_seen;
	return {
		traces: stringList(data.traces),
		lastSeen: last instanceof Date ? iso(last) : typeof last === "string" ? last : null,
	};
}

function newIncidentId(dir: string, promise: string, day: string): string {
	const base = `i-${day}-${promise}`;
	if (!existsSync(join(dir, `${base}.md`))) return base;
	for (let n = 2; ; n++) {
		if (!existsSync(join(dir, `${base}-${n}.md`))) return `${base}-${n}`;
	}
}

function incidentText(o: {
	id: string;
	promise: string;
	source: IncidentSource;
	opened: string;
	lastSeen: string;
	traces: string[];
	symptom: string;
	/** From the span, when it carried one (day-always-on D6); omitted entirely when it did not. */
	environment: string | null;
}): string {
	const frontmatter = [
		`id: ${o.id}`,
		`promise: ${o.promise}`,
		`source: ${o.source}`,
		...(o.environment ? [`environment: ${o.environment}`] : []),
		"status: open",
		`date: '${o.opened.slice(0, 10)}'`,
		`opened: '${o.opened}'`,
		`last_seen: '${o.lastSeen}'`,
		"traces:",
		...o.traces.map((t) => `  - '${t}'`),
	];
	return `---\n${frontmatter.join("\n")}\n---\n\n## Symptom\n\n${o.symptom}\n\n## Root cause\n\n${UNWRITTEN_ROOT_CAUSE}\n\n## Fix\n\n${NOT_YET_FIXED}\n`;
}

/**
 * Record `violations` of `promise` in the registry at `registry.dir`. Returns
 * what changed, or null when every trace was already recorded.
 */
export function recordViolations(
	registry: Registry,
	promise: PromiseEntry,
	violations: MarkedSpan[],
	source: IncidentSource,
	now: Date,
): IncidentChange | null {
	const dir = join(registry.dir, INCIDENTS_SUBDIR);
	const mine = registry.incidents.filter((i) => i.promise === promise.name);
	const known = new Set(mine.flatMap((i) => recorded(join(registry.dir, i.file)).traces));
	const fresh = violations.filter((v) => !known.has(v.traceId));
	if (fresh.length === 0) return null;
	const freshIds = [...new Set(fresh.map((v) => v.traceId))];
	const newest = fresh.reduce((a, b) => (b.at > a.at ? b : a));

	const open: IncidentEntry | undefined = mine.find((i) => i.status === "open");
	if (open) {
		const path = join(registry.dir, open.file);
		const before = recorded(path);
		const lastSeen =
			before.lastSeen && before.lastSeen > iso(newest.at) ? before.lastSeen : iso(newest.at);
		let text = readFileSync(path, "utf-8");
		text = setList(text, "traces", [...before.traces, ...freshIds]);
		text = setScalar(text, "last_seen", lastSeen);
		writeFileSync(path, text);
		ensurePromiseCarries(registry, promise, open.id);
		return { id: open.id, kind: "extended", traces: freshIds };
	}

	mkdirSync(dir, { recursive: true });
	const oldest = fresh.reduce((a, b) => (b.at < a.at ? b : a));
	const id = newIncidentId(dir, promise.name, iso(now).slice(0, 10));
	writeFileSync(
		join(dir, `${id}.md`),
		incidentText({
			id,
			promise: promise.name,
			source,
			opened: iso(oldest.at),
			lastSeen: iso(newest.at),
			traces: freshIds,
			symptom: newest.symptom ?? "The span marked the promise violated and carried no symptom.",
			// The newest violation's environment, and no guess when it has
			// none: one server holds staging and production, and an incident
			// that names the wrong one sends a person to the wrong logs.
			environment: newest.environment,
		}),
	);
	ensurePromiseCarries(registry, promise, id);
	return { id, kind: "opened", traces: freshIds };
}

/** An enforced promise with an open incident moves to known-violated, and lists it. */
function ensurePromiseCarries(registry: Registry, promise: PromiseEntry, id: string): void {
	const path = join(registry.dir, promise.file);
	const before = readFileSync(path, "utf-8");
	let text = before;
	if (!promise.incidents.includes(id))
		text = setList(text, "incidents", [...promise.incidents, id]);
	if (promise.state === "enforced") text = setScalar(text, "state", "known-violated");
	if (text !== before) writeFileSync(path, text);
}

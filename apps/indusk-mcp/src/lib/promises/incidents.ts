import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import matter from "gray-matter";
import { setList, setScalar } from "./frontmatter-edit.js";
import type { IncidentEntry, PromiseEntry, Registry } from "./registry.js";
import { rowsNaming } from "./rows.js";
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

export function iso(d: Date): string {
	return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function stringList(v: unknown): string[] {
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

/**
 * The next free incident id for a promise on a day. An id is taken when its
 * file exists OR when `avoid` names it — the ids the owner's Maintenance
 * phases already carry. A phase outlives its incident file, and a deleted
 * file once freed its id for the next incident to collide with
 * (watch-reopen-collision).
 */
export function newIncidentId(
	dir: string,
	promise: string,
	day: string,
	avoid: ReadonlySet<string>,
): string {
	const free = (id: string) => !avoid.has(id) && !existsSync(join(dir, `${id}.md`));
	const base = `i-${day}-${promise}`;
	if (free(base)) return base;
	for (let n = 2; ; n++) {
		if (free(`${base}-${n}`)) return `${base}-${n}`;
	}
}

/**
 * A string that arrived on a span is untrusted input to a plan document.
 *
 * `environment` and `symptom` come from a deployed system, and they are
 * written into committed YAML and markdown. A newline in `environment` adds
 * frontmatter keys — a duplicate key makes js-yaml throw, which takes the
 * whole registry down; a newline in `symptom` forges the `## Root cause`
 * section the registry insists a person writes (A28).
 *
 * Collapsed, not escaped, and not refused: a violation is still real when the
 * system reporting it sends something odd, and losing it would be the worse
 * failure. The oddness is kept visible rather than silently dropped.
 */
export function oneLine(value: string): string {
	return value.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
}

/**
 * The incident's `## Proven by` section (planner-promises ADR D6): every test
 * row, in any plan, that names the broken promise — the plan, the row, and
 * whether it passes. A fix starts from the tests that were vouching: a
 * passing row here is a test that did not catch this break.
 *
 * Written once, when the incident opens. It is a record of what was vouching
 * at the time, not a live view; the rows themselves move on.
 *
 * promise: an-incident-names-its-tests
 */
export function provenBy(planRoot: string, promise: PromiseEntry): string {
	const { rows, unreadable } = rowsNaming(planRoot, promise);
	const lines =
		rows.length === 0
			? [
					`No test row names this promise, so no plan says which test proves it. ${
						promise.tests.length > 0
							? `Its registry entry lists as tests: ${promise.tests.join(", ")}.`
							: "Its registry entry lists no test either."
					}`,
				]
			: rows.map(
					(r) =>
						`- \`${r.plan}\` row ${r.id} — ${r.state}${r.tests.length > 0 ? ` (${r.tests.join(", ")})` : ""}`,
				);
	if (unreadable.length > 0) {
		lines.push(
			"",
			`Not read — the impl could not be parsed: ${unreadable.map((p) => `\`${p}\``).join(", ")}.`,
		);
	}
	return lines.join("\n");
}

/** The section of a release's incident that names what may have caused it (ADR D9). */
export const SUSPECTS = "Suspects";

export function incidentText(o: {
	id: string;
	promise: string;
	source: IncidentSource;
	opened: string;
	lastSeen: string;
	/**
	 * The evidence keys, as frontmatter lines: a watcher's `traces:`, or a
	 * release's `tests:` and `release:` (release-records-its-failures D7).
	 */
	evidence: string[];
	symptom: string;
	/** From the span, when it carried one (day-always-on D6); omitted entirely when it did not. */
	environment: string | null;
	/** The commits that may have caused it, when the source can name them (a release's). */
	suspects?: string;
	/** The rows that were proving the promise, as `provenBy` writes them. */
	provenBy: string;
}): string {
	const frontmatter = [
		`id: ${o.id}`,
		`promise: ${o.promise}`,
		`source: ${o.source}`,
		...(o.environment ? [`environment: ${JSON.stringify(oneLine(o.environment))}`] : []),
		"status: open",
		`date: '${o.opened.slice(0, 10)}'`,
		`opened: '${o.opened}'`,
		`last_seen: '${o.lastSeen}'`,
		...o.evidence,
	];
	const suspects = o.suspects ? `## ${SUSPECTS}\n\n${o.suspects}\n\n` : "";
	return `---\n${frontmatter.join("\n")}\n---\n\n## Symptom\n\n${oneLine(o.symptom)}\n\n${suspects}## Proven by\n\n${o.provenBy}\n\n## Root cause\n\n${UNWRITTEN_ROOT_CAUSE}\n\n## Fix\n\n${NOT_YET_FIXED}\n`;
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
	/** Ids an opened incident must not take: those the owner's Maintenance phases name. */
	avoid: ReadonlySet<string> = new Set(),
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
	const id = newIncidentId(dir, promise.name, iso(now).slice(0, 10), avoid);
	writeFileSync(
		join(dir, `${id}.md`),
		incidentText({
			id,
			promise: promise.name,
			source,
			opened: iso(oldest.at),
			lastSeen: iso(newest.at),
			evidence: ["traces:", ...freshIds.map((t) => `  - '${t}'`)],
			symptom: newest.symptom ?? "The span marked the promise violated and carried no symptom.",
			// The newest violation's environment, and no guess when it has
			// none: one server holds staging and production, and an incident
			// that names the wrong one sends a person to the wrong logs.
			environment: newest.environment,
			// The registry directory is `<plan root>/.indusk/promises`.
			provenBy: provenBy(resolve(registry.dir, "..", ".."), promise),
		}),
	);
	ensurePromiseCarries(registry, promise, id);
	return { id, kind: "opened", traces: freshIds };
}

/** An enforced promise with an open incident moves to known-violated, and lists it. */
export function ensurePromiseCarries(registry: Registry, promise: PromiseEntry, id: string): void {
	const path = join(registry.dir, promise.file);
	const before = readFileSync(path, "utf-8");
	let text = before;
	if (!promise.incidents.includes(id))
		text = setList(text, "incidents", [...promise.incidents, id]);
	if (promise.state === "enforced") text = setScalar(text, "state", "known-violated");
	if (text !== before) writeFileSync(path, text);
}

/** What a violation's incidents say about it (promise-timeline D2). */
export type ViolationState = "unrecorded" | "open" | "fixed";

/**
 * Whether the violation `traceId` is unrecorded, open or fixed — the one rule
 * the chip and the timeline share, so they cannot disagree about a break. A
 * trace recorded by an open incident is open, even if a fixed incident also
 * names it; recorded only by fixed ones, it is fixed; recorded by none, it is
 * work nobody has written down.
 */
export function violationState(traceId: string, incidents: IncidentEntry[]): ViolationState {
	const holding = incidents.filter((i) => i.traces.includes(traceId));
	if (holding.length === 0) return "unrecorded";
	return holding.some((i) => i.status === "open") ? "open" : "fixed";
}

/**
 * Close an incident (promise-timeline D1): `status: fixed` and `fixed: <now>`,
 * and its promise back to `enforced` when no other incident of it is still
 * open. The promise keeps the incident in its `incidents` list — its history.
 * Throws naming the id when it is unknown or already fixed.
 */
export function fixIncident(registry: Registry, id: string, now: Date = new Date()): IncidentEntry {
	const incident = registry.incidents.find((i) => i.id === id);
	if (!incident) throw new Error(`no incident "${id}" under ${INCIDENTS_SUBDIR}/`);
	if (incident.status === "fixed") {
		throw new Error(
			`incident "${id}" is already fixed${incident.fixed ? ` (${incident.fixed})` : ""}`,
		);
	}
	// A fix is a claim about a cause someone found. With the root cause still
	// the line `promises record` wrote, nobody has said what broke (A18).
	if (incident.rootCause.trim() === UNWRITTEN_ROOT_CAUSE) {
		throw new Error(
			`incident "${id}" has no root cause written — replace "${UNWRITTEN_ROOT_CAUSE}" under ## Root cause in ${incident.file} before marking it fixed`,
		);
	}
	const path = join(registry.dir, incident.file);
	let text = readFileSync(path, "utf-8");
	text = setScalar(text, "status", "fixed");
	text = setScalar(text, "fixed", iso(now));
	writeFileSync(path, text);

	const promise = registry.promises.find((p) => p.name === incident.promise);
	const stillOpen = registry.incidents.some(
		(i) => i.id !== id && i.promise === incident.promise && i.status === "open",
	);
	if (promise && promise.state === "known-violated" && !stillOpen) {
		const promisePath = join(registry.dir, promise.file);
		writeFileSync(promisePath, setScalar(readFileSync(promisePath, "utf-8"), "state", "enforced"));
	}
	return { ...incident, status: "fixed", fixed: iso(now) };
}

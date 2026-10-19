import type { Tracer } from "@opentelemetry/api";
import { commandTracer, flushCommandTracer } from "../telemetry/command-tracer.js";
import {
	type ClauseStanding,
	clauseStanding,
	readsSignal,
	reportsOfClause,
	standingWords,
} from "./clause-standing.js";
import { markProjectId } from "./config.js";
import { type HealthRule, healthOf } from "./health.js";
import { markPromise } from "./mark.js";
import type { IncidentEntry, PromiseClause, PromiseEntry } from "./registry.js";
import { type MarkedSpansResult, type PromiseMarks, silencePastExpectation } from "./telemetry.js";

/**
 * `indusk promises status`'s text (day-monitor, ADR D5).
 *
 * One block per promise, opening on a line that starts with its name, blocks
 * separated by a blank line. A behaviour promise gets what telemetry saw in
 * the window: its breaks with their traces, and when it was last seen
 * holding — or "no signal", which is never the same as holding or as zero
 * breaks. State and structure promises are listed as watched by the
 * suite and given no count: telemetry has nothing to say about them. A
 * behaviour promise with breaks reads broken, or broke — fixed, by
 * `healthOf`: the rule the admin and the editor read, so the three agree.
 */

function iso(d: Date): string {
	return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** "the last 7 days", "the last 1 day", or a `--since` value as given ("the last 24h"). */
export function windowPhrase(window: number | string): string {
	if (typeof window === "string") return `the last ${window}`;
	return `the last ${window} day${window === 1 ? "" : "s"}`;
}

/** A split or limit clause as `promises status` shows it: the standing its signal gives it and its newest report. */
export interface ShownClause {
	promise: string;
	clause: string;
	standing: ClauseStanding;
	/** The newest report's time (ISO), or null when nothing reported. */
	lastReport: string | null;
}

/**
 * A split or limit clause's standing from what the read saw (`clauseStanding`;
 * the read succeeded, so its watcher answered).
 */
function shownClause(
	p: PromiseEntry,
	clause: PromiseClause,
	m: PromiseMarks | undefined,
): ShownClause {
	const reports = reportsOfClause(m?.byClause?.[clause.name]);
	return {
		promise: p.name,
		clause: clause.name,
		standing: clauseStanding(clause, { reports, heartbeatOk: true }),
		lastReport: reports.reduce<string | null>((n, r) => (n === null || r.at > n ? r.at : n), null),
	};
}

/**
 * One line per clause the promise states: what its own signal says, never what
 * its tests say. A clause nothing reported reads `no signal`, in the same words
 * the promise page and the admin use (`clauseStanding`); a resting clause names
 * the promise it rests on.
 */
function clauseLines(p: PromiseEntry, m: PromiseMarks | undefined): string[] {
	return (p.clauses ?? []).map((c) => {
		if (c.kind === "rests-on")
			return `  clause ${c.name}: rests on ${c.restsOn ?? "another promise"}`;
		return `  clause ${c.name} (${c.kind}): ${standingWords(shownClause(p, c, m).standing)}`;
	});
}

/**
 * Every split and limit clause `formatStatus` shows for these marks, with the
 * standing it shows — the rows `statusVerdict` judges, so the signal is about
 * exactly what the person reads. Retired promises and those whose telemetry is
 * not read show no clause.
 */
export function shownClauses(promises: PromiseEntry[], marks: MarkedSpansResult): ShownClause[] {
	return promises
		.filter((p) => p.state !== "retired" && readsSignal(p))
		.flatMap((p) =>
			(p.clauses ?? [])
				.filter((c) => c.kind !== "rests-on")
				.map((c) => shownClause(p, c, marks.byPromise.get(p.name))),
		);
}

/** What the signal of `no-signal-is-not-holding` says of one status run. */
export interface StatusVerdict {
	outcome: "upheld" | "broken";
	symptom?: string;
}

/**
 * The signal of `a-clause-is-proved-twice/no-signal-is-not-holding`, judged
 * from what `promises status` is about to show (mark-first decision D-28):
 * broken, naming each clause, when one is shown holding with no report or
 * while its watcher is blind; upheld otherwise. Null when no clause is shown —
 * a run that showed none says nothing about the rule. Pure: the rows and the
 * heartbeat are handed in.
 */
export function statusVerdict(shown: ShownClause[], heartbeatOk: boolean): StatusVerdict | null {
	if (shown.length === 0) return null;
	const wrong = shown.filter(
		(c) => c.standing === "holding" && (c.lastReport === null || !heartbeatOk),
	);
	if (wrong.length === 0) return { outcome: "upheld" };
	return {
		outcome: "broken",
		symptom: `promises status showed ${wrong.map((c) => `${c.promise}/${c.clause}`).join(", ")} holding ${
			heartbeatOk ? "with no report" : "while its watcher was blind"
		}`,
	};
}

const STATUS_PROMISE = "a-clause-is-proved-twice";
const STATUS_CLAUSE = "no-signal-is-not-holding";
const STATUS_SIGNAL = { plan: "mark-first", phase: "Build Phase 7" };

/**
 * Write the verdict as one span through the commands' tracer
 * (`commandTracer()`), with the plan and phase that added it, flushed before
 * a short-lived command exits. Best-effort: writing it never fails the command.
 *
 * promise: a-clause-is-proved-twice
 * clause: a-clause-is-proved-twice/no-signal-is-not-holding
 */
export async function markStatusSignal(
	projectRoot: string,
	verdict: StatusVerdict,
	tracer?: Tracer,
): Promise<void> {
	try {
		const span = (tracer ?? commandTracer()).startSpan("promises.status");
		markPromise(span, {
			promise: STATUS_PROMISE,
			clause: STATUS_CLAUSE,
			project: markProjectId(projectRoot),
			outcome: verdict.outcome,
			signal: STATUS_SIGNAL,
			...(verdict.symptom ? { symptom: verdict.symptom } : {}),
		});
		span.end();
	} catch {
		// A signal is best-effort: writing it must never fail the command.
	}
	if (!tracer) await flushCommandTracer();
}

export function formatStatus(
	promises: PromiseEntry[],
	marks: MarkedSpansResult,
	window: number | string,
	incidents: IncidentEntry[] = [],
	rule: HealthRule = "incidents",
): string {
	const phrase = windowPhrase(window);
	const blocks: string[] = [`Promises observed in ${phrase}, from Jaeger at ${marks.queryUrl}`];
	const sorted = [...promises].sort((a, b) => a.name.localeCompare(b.name));
	for (const p of sorted) {
		const head = `${p.name} (${p.kind}, ${p.domain}, ${p.state})`;
		if (p.state === "retired") {
			blocks.push(`${head}\n  retired — not watched`);
			continue;
		}
		if (!readsSignal(p)) {
			blocks.push(`${head}\n  watched by the suite at head, not by telemetry`);
			continue;
		}
		const m = marks.byPromise.get(p.name);
		const silence = silencePastExpectation(p, marks);
		const attentionLine = silence ? `  needs attention — ${silence}` : null;
		if (!m || (m.violations.length === 0 && m.lastUpheld === null)) {
			const noSignal = `  no signal in ${phrase}`;
			blocks.push(
				[head, noSignal, ...(attentionLine ? [attentionLine] : []), ...clauseLines(p, m)].join(
					"\n",
				),
			);
			continue;
		}
		const lines = [head];
		if (attentionLine) lines.push(attentionLine);
		const n = m.violations.length;
		const health = healthOf(p, { ok: true, at: "", marks }, incidents, rule)?.health;
		const word = health === "red" ? "broken — " : health === "fixed" ? "broke — fixed — " : "";
		lines.push(
			n === 0
				? `  no breaks in ${phrase}`
				: `  ${word}${m.truncated ? "at least " : ""}${n} break${n === 1 ? "" : "s"} in ${phrase}`,
		);
		for (const v of m.violations) {
			lines.push(
				`    ${v.traceId}  ${iso(v.at)}  ${v.service}${v.symptom ? `  ${v.symptom}` : ""}`,
			);
		}
		lines.push(
			m.lastUpheld
				? `  last seen holding ${iso(m.lastUpheld.at)} (${m.lastUpheld.traceId})`
				: `  not seen holding in ${phrase}`,
		);
		lines.push(...clauseLines(p, m));
		blocks.push(lines.join("\n"));
	}
	return blocks.join("\n\n");
}

/** `24h`, `7d`, `90m` → milliseconds; null when unreadable. */
export function parseDuration(text: string): number | null {
	const m = /^(\d+)\s*([mhd])$/.exec(text.trim());
	if (!m) return null;
	const n = Number(m[1]);
	if (n <= 0) return null;
	const unit = { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as "m" | "h" | "d"];
	return n * unit;
}

import { checkPromises, formatSummary } from "../../lib/promises/check.js";
import { getQuietWindowDays } from "../../lib/promises/config.js";
import { fixIncident } from "../../lib/promises/incidents.js";
import { WatcherBlind } from "../../lib/promises/probe.js";
import { readPromises } from "../../lib/promises/registry.js";
import {
	alarmSource,
	JaegerUnreachable,
	readSources,
	type SourceRead,
	sourceAdvice,
} from "../../lib/promises/sources.js";
import { formatStatus, parseDuration } from "../../lib/promises/status.js";
import { watchPromises, watchReport } from "../../lib/promises/watch.js";
import {
	changePromise,
	declarePromise,
	PromiseWriteRefused,
	replacePromise,
} from "../../lib/promises/write.js";

/**
 * `indusk promises check`.
 *
 * Exit 2 with every refusal on stderr, one `path: message` line each — a
 * missing or malformed registry is a refusal too, never a clean run. Exit 0
 * with the one-line summary on stdout: promises by state and by kind, and
 * the incident count. The documented invocation; this repo's suite runs it
 * verbatim against its own root (A15).
 */
export async function promisesCheck(projectRoot: string): Promise<void> {
	const result = await checkPromises(projectRoot);
	if (!result.ok) {
		for (const r of result.refusals) console.error(`${r.file}: ${r.message}`);
		console.error(
			`\n${result.refusals.length} refusal${result.refusals.length === 1 ? "" : "s"} — fix each and run the check again.`,
		);
		process.exitCode = 2;
		return;
	}
	console.info(formatSummary(result.summary));
}

/**
 * `indusk promises status [--since <duration>]` (day-monitor, ADR D5).
 *
 * Read-only. One block per promise per source (promise-sources, ADR D3): with
 * one source, exactly as before; with `local` and `production`, a section
 * each, headed with its name and URL. A source that could not be read says so
 * naming where it looked, and never a count — "0 violations" from a backend
 * nobody reached is the one wrong answer. Exit 2 when the alarm source could
 * not be read. The window defaults to the quiet window
 * (`promises.quiet_window_days`).
 */
export async function promisesStatus(
	projectRoot: string,
	opts: { since?: string } = {},
): Promise<void> {
	const read = readPromises(projectRoot);
	if (!read.ok) {
		if ("missing" in read) console.error(`${read.missing}: no promise registry`);
		else for (const p of read.problems) console.error(`${p.file}: ${p.problem}`);
		process.exitCode = 2;
		return;
	}
	let sinceMs: number | undefined;
	let window: number | string;
	if (opts.since !== undefined) {
		const ms = parseDuration(opts.since);
		if (ms === null) {
			console.error(`--since "${opts.since}": expected a duration like 90m, 24h or 7d`);
			process.exitCode = 2;
			return;
		}
		sinceMs = ms;
		window = opts.since;
	} else {
		window = getQuietWindowDays(projectRoot);
	}
	const promises = read.registry.promises;
	const reads = await readSources(projectRoot, read.registry, { sinceMs });
	const alarm = alarmSource(reads.map((r) => r.name));
	if (reads.length === 1) {
		// One source: today's output, with no section header (A7).
		const [only] = reads;
		if (only.ok) console.info(formatStatus(promises, only.marks, window));
		else {
			console.error(failureText(only));
			process.exitCode = 2;
		}
		return;
	}
	// Every source in its own section, each failure said in its own (ADR D3).
	// The exit code follows the alarm source: a laptop with no daemon beside a
	// production server that answered is not a failed status run.
	const sections = reads.map((r) =>
		r.ok
			? `${r.name} — ${r.label}\n${formatStatus(promises, r.marks, window)}`
			: `${r.name} — ${r.label}\n${failureText(r)}`,
	);
	console.info(sections.join("\n\n"));
	if (reads.some((r) => r.name === alarm && !r.ok)) process.exitCode = 2;
}

/** What a failed source says in place of counts: its error, then what to do. */
function failureText(read: Extract<SourceRead, { ok: false }>): string {
	return `${read.error.message}\nNo count is reported for any behaviour promise. ${sourceAdvice(read.name, read.error)}`;
}

/**
 * `indusk promises fix <incident-id>` (promise-timeline, ADR D1). Close an
 * incident: `status: fixed`, `fixed: <now>`, and its promise back to
 * `enforced` when no other incident of it is open. Writes plan documents,
 * commits nothing. Exit 2 naming the id when it is unknown or already fixed,
 * or when the registry cannot be read.
 */
export async function promisesFix(projectRoot: string, id: string): Promise<void> {
	const read = readPromises(projectRoot);
	if (!read.ok) {
		if ("missing" in read) console.error(`${read.missing}: no promise registry`);
		else for (const p of read.problems) console.error(`${p.file}: ${p.problem}`);
		process.exitCode = 2;
		return;
	}
	try {
		const fixed = fixIncident(read.registry, id);
		console.info(
			`${fixed.id} fixed at ${fixed.fixed}. Run \`indusk promises check\` before committing.`,
		);
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 2;
	}
}

const WATCH_SOURCES = ["local", "smoke", "deployed"] as const;

/**
 * `indusk promises watch [--source local|smoke|deployed]` (day-monitor, ADR
 * D5–D7). One pass: open or extend an incident per behaviour promise with new
 * violations, and append a Maintenance phase to its owner. Writes plan
 * documents, commits nothing. Exit 0 whether or not anything changed; exit 2
 * when Jaeger or the registry cannot be read.
 */
export async function promisesWatch(
	projectRoot: string,
	opts: { source?: string } = {},
): Promise<void> {
	const source = opts.source ?? "local";
	if (!(WATCH_SOURCES as readonly string[]).includes(source)) {
		console.error(`--source "${source}": expected one of ${WATCH_SOURCES.join(" | ")}`);
		process.exitCode = 2;
		return;
	}
	let result: Awaited<ReturnType<typeof watchPromises>>;
	try {
		result = await watchPromises(projectRoot, {
			source: source as (typeof WATCH_SOURCES)[number],
		});
	} catch (err) {
		// The advice has to match the source: telling someone to start a local
		// daemon when the watch read a deployed server sends them to the wrong
		// machine. It comes from the failure, never from re-reading the config.
		const name = source === "deployed" ? "production" : "local";
		console.error(
			err instanceof WatcherBlind || err instanceof JaegerUnreachable
				? `${err.message}\nNothing was recorded. ${sourceAdvice(name, err)}`
				: (err as Error).message,
		);
		process.exitCode = 2;
		return;
	}
	const report = watchReport(result);
	for (const line of report.out) console.info(line);
	for (const line of report.err) console.error(line);
	if (report.exitCode !== 0) process.exitCode = report.exitCode;
}

/** Run a registry write; a refusal goes to stderr with exit 2, anything else is a bug and throws. */
function writing(run: () => string): void {
	try {
		console.info(run());
	} catch (err) {
		if (!(err instanceof PromiseWriteRefused)) throw err;
		console.error(err.message);
		process.exitCode = 2;
	}
}

const AFTER_WRITE = "Run `indusk promises check` before committing.";

/**
 * `indusk promises declare <name> --plan --kind --domain --statement`
 * (planner-promises ADR D4). Writes the promise as `declared`, owned by the
 * plan; commits nothing. Exit 2 naming what was wrong, with nothing written.
 */
export function promisesDeclare(
	projectRoot: string,
	name: string,
	opts: { plan: string; kind: string; domain: string; statement: string },
): void {
	writing(() => {
		declarePromise(projectRoot, { name, ...opts });
		return `${name} declared by ${opts.plan}. ${AFTER_WRITE}`;
	});
}

/**
 * `indusk promises change <name> --plan --statement --reason`. The promise
 * keeps its name; the plan takes it over; its History keeps what it read and
 * whose it was.
 */
export function promisesChange(
	projectRoot: string,
	name: string,
	opts: { plan: string; statement: string; reason: string },
): void {
	writing(() => {
		changePromise(projectRoot, { name, ...opts });
		return `${name} changed by ${opts.plan}; its History keeps the sentence it replaced. ${AFTER_WRITE}`;
	});
}

/**
 * `indusk promises replace <old> --by <new> --plan --kind --domain
 * --statement`. Declares the new promise recording which it replaces; the old
 * one stays in force until the plan closes.
 */
export function promisesReplace(
	projectRoot: string,
	old: string,
	opts: { by: string; plan: string; kind: string; domain: string; statement: string },
): void {
	writing(() => {
		const { by, ...rest } = opts;
		replacePromise(projectRoot, { old, name: by, ...rest });
		return `${by} declared by ${opts.plan}, replacing ${old}, which stays in force until ${opts.plan} closes. ${AFTER_WRITE}`;
	});
}

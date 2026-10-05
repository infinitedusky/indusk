import { readConfig } from "../../lib/config.js";
import { checkPromises, formatSummary } from "../../lib/promises/check.js";
import { getQuietWindowDays } from "../../lib/promises/config.js";
import { WatcherBlind } from "../../lib/promises/probe.js";
import { readPromises } from "../../lib/promises/registry.js";
import {
	alarmSource,
	JaegerUnreachable,
	readSources,
	type SourceRead,
} from "../../lib/promises/sources.js";
import { formatStatus, parseDuration } from "../../lib/promises/status.js";
import { watchPromises, watchReport } from "../../lib/promises/watch.js";

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
			console.error(failureText(projectRoot, only));
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
			: `${r.name} — ${r.label}\n${failureText(projectRoot, r)}`,
	);
	console.info(sections.join("\n\n"));
	if (reads.some((r) => r.name === alarm && !r.ok)) process.exitCode = 2;
}

/** What a failed source says in place of counts, with advice for that source. */
function failureText(projectRoot: string, read: Extract<SourceRead, { ok: false }>): string {
	if (read.error instanceof WatcherBlind) {
		// Answered and did not hear: the 2026-10-01 case. Starting the daemon
		// is the wrong advice — something is already answering.
		return `${read.error.message}\nNo count is reported for any behaviour promise. Whatever answers at ${read.error.where} is not receiving what is sent to ${read.error.intake}.`;
	}
	const named = readConfig(projectRoot)?.promises?.jaeger;
	const hint =
		read.name === "production" && named
			? `Check ${named.url} is up and that ${named.credential_env} holds its credential.`
			: "Start the daemon with `indusk telemetry start`.";
	return `${read.error.message}\nNo count is reported for any behaviour promise. ${hint}`;
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
		// daemon when their project reads a deployed server sends them to the
		// wrong machine.
		const named = readConfig(projectRoot)?.promises?.jaeger;
		const hint =
			named && source === "deployed"
				? `Nothing was recorded. The project reads ${named.url}; check it is up and that ${named.credential_env} holds its credential.`
				: "Nothing was recorded. Start the daemon with `indusk telemetry start`.";
		console.error(
			err instanceof WatcherBlind
				? `${err.message}\nNothing was recorded: a watcher that cannot hear has nothing to record.`
				: err instanceof JaegerUnreachable
					? `${err.message}\n${hint}`
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

import { checkPromises, formatSummary } from "../../lib/promises/check.js";
import { getQuietWindowDays } from "../../lib/promises/config.js";
import { readPromises } from "../../lib/promises/registry.js";
import { formatStatus, parseDuration } from "../../lib/promises/status.js";
import { JaegerUnreachable, markedSpans } from "../../lib/promises/telemetry.js";

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
 * Read-only. Exit 0 with one block per promise when Jaeger answered; exit 2
 * naming where it looked when it could not, and never a count — "0
 * violations" from a backend nobody reached is the one wrong answer. The
 * window defaults to the quiet window (`promises.quiet_window_days`).
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
	let sinceMs: number;
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
		sinceMs = window * 86_400_000;
	}
	const promises = read.registry.promises;
	try {
		const marks = await markedSpans({
			promises: promises.filter((p) => p.kind === "behaviour").map((p) => p.name),
			since: new Date(Date.now() - sinceMs),
		});
		console.info(formatStatus(promises, marks, window));
	} catch (err) {
		if (!(err instanceof JaegerUnreachable)) throw err;
		console.error(
			`${err.message}\nNo count is reported for any behaviour promise. Start the daemon with \`indusk telemetry start\`.`,
		);
		process.exitCode = 2;
	}
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatAge } from "../../lib/promises/age.js";
import { checkPromises, formatSummary } from "../../lib/promises/check.js";
import { getQuietWindowDays } from "../../lib/promises/config.js";
import { confirmPlan } from "../../lib/promises/confirm.js";
import {
	type ContractRefusal,
	checkAllContracts,
	checkPlanContract,
	formatContract,
} from "../../lib/promises/contract.js";
import { type OpenIncident, openIncidents } from "../../lib/promises/health.js";
import { fixIncident } from "../../lib/promises/incidents.js";
import { WatcherBlind } from "../../lib/promises/probe.js";
import { recordBreaks } from "../../lib/promises/record.js";
import { type Registry, readPromises } from "../../lib/promises/registry.js";
import {
	alarmSource,
	JaegerUnreachable,
	readSources,
	type SourceRead,
	sourceAdvice,
} from "../../lib/promises/sources.js";
import { formatStatus, parseDuration } from "../../lib/promises/status.js";
import { watchReport } from "../../lib/promises/watch.js";
import {
	changePromise,
	declarePromise,
	PromiseWriteRefused,
	replacePromise,
	withdrawPromise,
} from "../../lib/promises/write.js";
import { isRootsRefusal, resolveExecutionRoots } from "../../lib/worktree/roots.js";

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
	// Open incidents first, before any source (incident-recording A11): they
	// are files, so they are said even when no Jaeger answers.
	for (const line of openIncidentLines(openIncidents(projectRoot, read.registry))) {
		console.info(line);
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
 * D5–D7). One pass of the one writer (incident-recording, ADR D1): open or
 * extend an incident per behaviour promise with new violations, append a
 * Maintenance phase to its owner, and commit what it wrote, saying so. Exit 0
 * whether or not anything changed; exit 2 when Jaeger or the registry cannot
 * be read.
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
	let result: Awaited<ReturnType<typeof recordBreaks>>;
	try {
		result = await recordBreaks(projectRoot, {
			by: "watch",
			source: source as (typeof WATCH_SOURCES)[number],
		});
		if (result.refused) throw new Error(result.refused);
		// A pass that could not read or write marked itself broken; the person
		// running it by hand is told the way they always were.
		if (result.error) throw result.error;
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
	const report = watchReport({ changes: result.changes, source: result.source });
	for (const line of report.out) console.info(line);
	for (const line of report.err) console.error(line);
	if (result.committed.length > 0) {
		console.info(`committed ${result.committed.length} file(s): ${result.committed.join(", ")}`);
	}
	if (report.exitCode !== 0) process.exitCode = report.exitCode;
}

/**
 * `indusk promises contract <plan> | --all [--impl-stdin]` (planner-promises
 * ADR D2). Read-only: does the plan's brief, its test rows and the registry
 * agree? Exit 2 with every refusal on stderr, each naming the promise, the
 * expectation or the row; exit 0 with one line saying what was checked.
 *
 * `--impl-stdin` judges the impl given on stdin in place of the one on disk:
 * the impl hook asks before a write lands. `--all` checks every plan folder,
 * active and archived.
 */
export function promisesContract(
	projectRoot: string,
	plan: string | undefined,
	opts: { all?: boolean; implStdin?: boolean } = {},
): void {
	const refuse = (refusals: ContractRefusal[]) => {
		for (const r of refusals) console.error(`${r.file}: ${r.message}`);
		console.error(
			`\n${refusals.length} refusal${refusals.length === 1 ? "" : "s"} — the brief, the rows and the registry have to agree before the plan builds.`,
		);
		process.exitCode = 2;
	};
	if (opts.all) {
		if (plan !== undefined || opts.implStdin) {
			console.error("--all checks every plan folder: it takes no plan and no --impl-stdin");
			process.exitCode = 2;
			return;
		}
		const { summaries, refusals } = checkAllContracts(projectRoot);
		if (refusals.length > 0) {
			refuse(refusals);
			return;
		}
		const held = summaries.filter((s) => s.shape === "contract");
		for (const s of held) console.info(formatContract(s));
		const drafts = summaries.filter((s) => s.shape === "draft");
		for (const s of drafts) console.info(formatContract(s));
		console.info(
			`${summaries.length} plan folder${summaries.length === 1 ? "" : "s"} — ${held.length} held to the contract, ${drafts.length} still a draft, ${summaries.length - held.length - drafts.length} written before it or with no brief.`,
		);
		return;
	}
	if (plan === undefined) {
		console.error("name the plan to check (`indusk promises contract <plan>`), or pass --all");
		process.exitCode = 2;
		return;
	}
	const result = checkPlanContract(
		projectRoot,
		plan,
		opts.implStdin ? { implText: readFileSync(0, "utf-8") } : {},
	);
	if (!result.ok) {
		refuse(result.refusals);
		return;
	}
	console.info(formatContract(result.summary));
}

/**
 * `indusk promises confirm <plan> [--code-root <path>]` (planner-promises ADR
 * D5). Closing a plan: each promise it declared becomes `enforced`, with the
 * test files its rows name and the code that carries its token, and what it
 * replaces is retired. Writes plan documents, commits nothing. Exit 2 naming
 * each promise that is not proven, with nothing written.
 *
 * The code root defaults to the project's; in a workbench before landing the
 * plan's tests are only in its own worktree, which `--code-root` names.
 */
export async function promisesConfirm(
	projectRoot: string,
	plan: string,
	opts: { codeRoot?: string } = {},
): Promise<void> {
	let codeRoot: string;
	if (opts.codeRoot !== undefined) codeRoot = resolve(opts.codeRoot);
	else {
		const roots = resolveExecutionRoots(projectRoot);
		if (isRootsRefusal(roots)) {
			console.error(`${roots.error}\nName the plan's code with --code-root <path>.`);
			process.exitCode = 2;
			return;
		}
		codeRoot = roots.codeRoot;
	}
	const result = await confirmPlan({ planRoot: projectRoot, codeRoot, plan });
	if (!result.ok) {
		for (const r of result.refusals) console.error(`${r.file}: ${r.message}`);
		console.error(
			result.written
				? `\n${plan}'s promises were written as enforced, and the registry check then refused the above — fix each and run \`indusk promises check\`.`
				: `\n${plan} cannot close: ${result.refusals.length} refusal${result.refusals.length === 1 ? "" : "s"}, nothing written.`,
		);
		process.exitCode = 2;
		return;
	}
	if (result.confirmed.length === 0) {
		console.info(
			`${plan}: no promise to confirm — it holds none that is still declared, and the links of those in force are current.`,
		);
		return;
	}
	for (const c of result.confirmed) {
		console.info(
			`${c.name}: ${c.inForce ? "links updated" : "enforced"} — ${c.tests.length} test file${c.tests.length === 1 ? "" : "s"}, ${c.sites.length} code site${c.sites.length === 1 ? "" : "s"}${c.retired ? `; ${c.retired} retired` : ""}`,
		);
	}
	console.info(
		`${plan}: ${result.confirmed.length} promise${result.confirmed.length === 1 ? "" : "s"} confirmed; the registry check passes.`,
	);
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

/**
 * `indusk promises withdraw <name> --plan <plan>` (planner-promises A28).
 * Removes a promise the plan declared and then dropped or renamed, before it
 * was ever in force. Exit 2, naming the promise, with nothing removed, when
 * it is in force, another plan's, or carries an incident.
 */
export function promisesWithdraw(projectRoot: string, name: string, opts: { plan: string }): void {
	writing(() => {
		withdrawPromise(projectRoot, { name, plan: opts.plan });
		return `${name} withdrawn by ${opts.plan}: it was never in force, and the registry no longer holds it. Take it out of the brief too. ${AFTER_WRITE}`;
	});
}

/**
 * `indusk promises health --json [--every <seconds>]` (vscode-extension).
 *
 * One JSON line per read: every source's state for every promise, by the one
 * rule the admin's chips use (`promises/health`). Without `--every`, one read
 * and exit; with it, a read per period until the process is stopped — the
 * editor runs it once and reads each line.
 */
/** What `promises health` reads and how it waits, as inputs (vscode-extension A17). */
export interface PromisesHealthDeps {
	readRegistry?: typeof readPromises;
	readHealth?: (
		root: string,
		registry: Registry,
	) => Promise<import("../../lib/promises/health.js").SourceHealthRead[]>;
	write?: (text: string) => void;
	now?: () => Date;
	/** Runs `tick` every `everyMs` until the reader is stopped. */
	repeat?: (everyMs: number, tick: () => Promise<void>) => Promise<void>;
}

function repeatUntilSignal(everyMs: number, tick: () => Promise<void>): Promise<void> {
	return new Promise<void>((resolve) => {
		const timer = setInterval(() => {
			void tick();
		}, everyMs);
		const stop = () => {
			clearInterval(timer);
			resolve();
		};
		process.once("SIGTERM", stop);
		process.once("SIGINT", stop);
	});
}

export async function promisesHealth(
	projectRoot: string,
	opts: { json?: boolean; every?: string } = {},
	deps: PromisesHealthDeps = {},
): Promise<void> {
	const readRegistry = deps.readRegistry ?? readPromises;
	const read = readRegistry(projectRoot);
	let registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	if (!registry) {
		console.error(`${"missing" in read ? read.missing : projectRoot}: no promise registry`);
		process.exitCode = 2;
		return;
	}
	let everyMs: number | null = null;
	if (opts.every !== undefined) {
		const seconds = Number(opts.every);
		if (!Number.isFinite(seconds) || seconds < 1) {
			console.error(`--every "${opts.every}": expected a whole number of seconds, 1 or more`);
			process.exitCode = 2;
			return;
		}
		everyMs = seconds * 1000;
	}
	const { healthLine, readHealth } = await import("../../lib/promises/health.js");
	const { readHealthNames } = await import("../../lib/promises/display.js");
	const readReads =
		deps.readHealth ?? ((root: string, reg: Registry) => readHealth(root, reg, { cacheMs: 0 }));
	const write = deps.write ?? ((text: string) => process.stdout.write(text));
	const now = deps.now ?? (() => new Date());
	// The registry is read before every line, not once: an incident marked
	// fixed, or a promise declared, while the editor is open shows on the next
	// line. A registry caught mid-edit keeps the last one that read whole.
	const reread = () => {
		try {
			const next = readRegistry(projectRoot);
			if (next.ok) registry = next.registry;
		} catch {
			// keep the last registry that read
		}
		return registry as Registry;
	};
	const once = async () => {
		const current = reread();
		const reads = await readReads(projectRoot, current);
		const names = readHealthNames(projectRoot);
		write(`${JSON.stringify(healthLine(current, reads, now(), names))}\n`);
	};
	await once();
	if (everyMs === null) return;
	// One bad read never ends the reader: the next tick tries again.
	await (deps.repeat ?? repeatUntilSignal)(everyMs, () =>
		once().catch((error: unknown) => {
			console.error(`promises health: ${error instanceof Error ? error.message : String(error)}`);
		}),
	);
}

/**
 * One line per open incident, oldest first: its id, its promise, how long it
 * has been open, and its owner — with whether the owner carries its
 * Maintenance phase, since an incident no plan is working is the loudest kind.
 */
export function openIncidentLines(open: OpenIncident[]): string[] {
	return open.map(
		(i) =>
			`open incident ${i.id} — ${i.promise}, open ${formatAge(i.ageMs)}; ${i.owner || "no owner"} ${
				i.ownerHasPhase ? "carries its Maintenance phase" : "carries NO Maintenance phase for it"
			}`,
	);
}

import { createHash } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import type { Tracer } from "@opentelemetry/api";
import { bookkeepingRoots } from "../bookkeeping/roots.js";
import { liveOtlpEndpointSync } from "../telemetry/status.js";
import { type ClauseVerdict, writeClauseSignals } from "./clause-signal.js";
import { movesThroughChecks, parserReadsWrite } from "./shell-write-reading.js";

// The plan-write-guard test reads the parser through this module.
export { parserReadsWrite };

/**
 * The shell guard's decisions, judged by the package (a-run-can-be-trusted,
 * Decision 8). `hooks/plan-write-guard.js` writes a line for each shell command
 * that names a plan path, with the plan folders' state before it; the witness
 * (`hooks/plan-write-witness.js`) writes the state after. A hook cannot send a
 * signal, and a verdict the guard gave itself could never read broken, so the
 * drain here judges each decision from two sources the guard's text rule never
 * touches: what changed on disk between before and after, and a real shell
 * parser (`shell-quote`) reading the command. It reports both clauses of
 * `a-plan-document-is-written-through-its-checks` and removes what it sent.
 *
 * The writing half (`appendDecision`, the snapshot, the pairing key) is
 * mirrored by `hooks/_clause-verdicts.js`, pinned equal by
 * `hook-shared-modules.test.ts`; change the two together.
 *
 * clause: a-plan-document-is-written-through-its-checks/shell-write-refused
 * clause: a-plan-document-is-written-through-its-checks/reads-pass
 */

export const DECISIONS_FILE = "plan-write-decisions.jsonl";
export const PENDING_DIR = "plan-write-pending";
const PROMISE = "a-plan-document-is-written-through-its-checks";
const SIGNAL = { plan: "a-run-can-be-trusted", phase: "Build Phase 3" };
/** A decision with no after line this long is a command that failed or never ran: nothing to judge. */
const UNPAIRED_MAX_AGE_MS = 10 * 60 * 1000;
/** The drain runs at most this often from the command line. */
const DRAIN_EVERY_MS = 60 * 1000;
const DRAINED_STAMP = "plan-write-drained-at";

/** `{ "<root-relative path>": [size, mtimeMs] }`. */
export type Snapshot = Record<string, [number, number]>;

export type DecisionLine = {
	kind: "decision";
	toolUseId: string;
	at: string;
	command: string;
	cwd: string;
	/** The checkout whose plan folders `before` (and the witness's `after`) read; absent on older lines. */
	root?: string;
	decision: "refused" | "allowed";
	/** The plan paths the guard read in the command, root-relative. */
	files: string[];
	before: Snapshot;
};
export type AfterLine = { kind: "after"; toolUseId: string; at?: string; after: Snapshot };
/**
 * A write by the Edit or Write tool to a plan document while a shell command was in flight
 * (A100): the file, root-relative, and its size and modified time just after the tool wrote it.
 */
export type ToolWriteLine = {
	kind: "tool-write";
	at: string;
	root?: string;
	file: string;
	stat: [number, number] | null;
};
export type PlanWriteLine = DecisionLine | AfterLine | ToolWriteLine;

// ─── the writing half (mirrored by hooks/_clause-verdicts.js) ──────────────

export function appendDecision(home: string, line: PlanWriteLine): void {
	mkdirSync(home, { recursive: true });
	appendFileSync(join(home, DECISIONS_FILE), `${JSON.stringify(line)}\n`);
}

export function toolUseKey(event: {
	tool_use_id?: unknown;
	session_id?: unknown;
	tool_input?: { command?: unknown };
}): string {
	if (typeof event.tool_use_id === "string" && event.tool_use_id !== "") {
		return event.tool_use_id.replace(/[^\w-]/g, "_").slice(0, 120);
	}
	const command = typeof event.tool_input?.command === "string" ? event.tool_input.command : "";
	return createHash("sha256")
		.update(`${event.session_id ?? ""}\0${command}`)
		.digest("hex")
		.slice(0, 32);
}

export function planFolderSnapshot(root: string, archived: readonly string[] = []): Snapshot {
	const planning = join(root, ".indusk", "planning");
	const out: Snapshot = {};
	const walk = (dir: string): void => {
		let entries: import("node:fs").Dirent[];
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) {
			const p = join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.isFile()) {
				try {
					const s = statSync(p);
					out[relative(root, p)] = [s.size, Math.round(s.mtimeMs)];
				} catch {
					// gone between the read and the stat
				}
			}
		}
	};
	if (!existsSync(planning)) return out;
	for (const e of readdirSync(planning, { withFileTypes: true })) {
		if (e.isDirectory() && e.name !== "archive") walk(join(planning, e.name));
	}
	for (const plan of new Set(archived)) {
		if (plan && !plan.includes("/") && plan !== "..") walk(join(planning, "archive", plan));
	}
	return out;
}

export function changedFiles(before: Snapshot | undefined, after: Snapshot | undefined): string[] {
	const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
	return [...keys]
		.filter((k) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null))
		.sort();
}

/**
 * One decision's verdict, or null when there is nothing to say: a refusal is
 * judged by the parser (a write: `shell-write-refused` upheld; only a read:
 * `reads-pass` broken); an allowed command by the disk (a plan document
 * changed: `shell-write-refused` broken, naming the files and the command;
 * nothing changed: `reads-pass` upheld for a command that named a plan path).
 */
export function judgeDecision(
	d: DecisionLine,
	after?: Snapshot,
	/** Plan documents an editing tool wrote during the command, as the after snapshot holds them. */
	toolWritten: ReadonlySet<string> = new Set(),
): ClauseVerdict | null {
	if (d.decision === "refused") {
		if (parserReadsWrite(d.command, d.cwd))
			return { promise: PROMISE, clause: "shell-write-refused" };
		return {
			promise: PROMISE,
			clause: "reads-pass",
			broken: `"${d.command}" was refused, and a shell parser reads it as only reading`,
		};
	}
	if (after === undefined) return null;
	const changed = changedFiles(d.before, after).filter((f) => !toolWritten.has(f));
	if (changed.length > 0) {
		if (movesThroughChecks(d.command, d.cwd)) return null;
		return {
			promise: PROMISE,
			clause: "shell-write-refused",
			broken: `${changed.join(", ")} changed under "${d.command}", which the guard allowed`,
		};
	}
	return d.files.length > 0 ? { promise: PROMISE, clause: "reads-pass" } : null;
}

/**
 * The plan documents an editing tool wrote while the command ran: a tool-write line after the
 * decision began (`at`) and before its after line (by `at`, else by its place in the file), for
 * the same checkout, whose recorded size and time are what the after snapshot holds. A file the
 * shell command wrote again after the tool is not among them: its after differs (A100).
 */
export function toolWrittenDuring(
	lines: readonly PlanWriteLine[],
	d: DecisionLine,
	after: AfterLine,
): Set<string> {
	const start = Date.parse(d.at);
	const end = after.at === undefined ? Number.POSITIVE_INFINITY : Date.parse(after.at);
	const afterIndex = lines.indexOf(after);
	const out = new Set<string>();
	lines.forEach((l, i) => {
		if (l.kind !== "tool-write") return;
		const at = Date.parse(l.at);
		if (!(at >= start && at <= end)) return;
		if (after.at === undefined && afterIndex !== -1 && i > afterIndex) return;
		if (l.root !== undefined && d.root !== undefined && l.root !== d.root) return;
		if (l.stat !== null && JSON.stringify(l.stat) === JSON.stringify(after.after[l.file] ?? null))
			out.add(l.file);
	});
	return out;
}

/** The plan a decision concerns, for the span: the first plan path it names or changed. */
function planOfDecision(d: DecisionLine, after?: Snapshot): string {
	for (const f of [...d.files, ...changedFiles(d.before, after)]) {
		const m = /\.indusk\/planning\/(?:archive\/)?([^/]+)\//.exec(f.replace(/\\/g, "/"));
		if (m) return m[1];
	}
	return "unknown";
}

/**
 * Replace the decision file with the lines kept and every line a hook
 * appended after `readText` was read (they follow it in the file), by
 * temporary file and rename; remove the file when nothing is left.
 */
export function rewriteDecisionFile(
	path: string,
	readText: string,
	keep: readonly PlanWriteLine[],
): void {
	const appended = readFileSync(path, "utf-8").slice(readText.length);
	const kept = keep.map((l) => `${JSON.stringify(l)}\n`).join("");
	const rest = `${kept}${appended}`;
	if (rest === "") {
		rmSync(path, { force: true });
		return;
	}
	const tmp = `${path}.${process.pid}.tmp`;
	writeFileSync(tmp, rest);
	renameSync(tmp, path);
}

export interface DrainOptions {
	/** The project's home; default `bookkeepingRoots(root).home`. */
	home?: string;
	tracer?: Tracer;
	now?: Date;
	/** Whether a daemon is there to receive the signals; with none, nothing is sent or removed. */
	live?: () => boolean;
	/** Skip if the last drain was under a minute ago (the command line's call). */
	throttle?: boolean;
}

/**
 * Judge every complete decision in the project's decision file, report its
 * verdict through `writeClauseSignals`, and remove what it judged; an
 * unpaired decision younger than ten minutes waits for its after line.
 * Best-effort: never throws. Nothing is removed until the verdicts are
 * written, and lines appended while it ran are kept.
 */
export async function drainPlanWriteDecisions(
	root: string,
	opts: DrainOptions = {},
): Promise<{ sent: number; kept: number }> {
	try {
		const home = opts.home ?? bookkeepingRoots(root).home;
		const path = join(home, DECISIONS_FILE);
		if (!existsSync(path)) return { sent: 0, kept: 0 };
		const now = opts.now ?? new Date();
		if (opts.throttle) {
			const stamp = join(home, DRAINED_STAMP);
			if (existsSync(stamp) && now.getTime() - statSync(stamp).mtimeMs < DRAIN_EVERY_MS) {
				return { sent: 0, kept: 0 };
			}
			writeFileSync(stamp, now.toISOString());
		}
		const text = readFileSync(path, "utf-8");
		const lines = text.split("\n").filter((l) => l.trim() !== "");
		const live = opts.live ?? (() => liveOtlpEndpointSync() !== null);
		if (!live()) return { sent: 0, kept: lines.length };

		const parsed: PlanWriteLine[] = [];
		for (const l of lines) {
			try {
				parsed.push(JSON.parse(l) as PlanWriteLine);
			} catch {
				// a line that is not JSON is dropped: nothing could ever judge it
			}
		}
		const afters = new Map<string, AfterLine>();
		for (const l of parsed) if (l.kind === "after") afters.set(l.toolUseId, l);
		// An after line whose decision is gone (dropped, or never written) is dropped with it.
		const keep: PlanWriteLine[] = [];
		let sent = 0;
		for (const l of parsed) {
			if (l.kind === "tool-write") {
				// kept while a decision it could account for may still be waiting for its after line
				if (!(now.getTime() - Date.parse(l.at) > UNPAIRED_MAX_AGE_MS)) keep.push(l);
				continue;
			}
			if (l.kind !== "decision") continue;
			const after = afters.get(l.toolUseId);
			const age = now.getTime() - Date.parse(l.at);
			if (l.decision === "allowed" && !after) {
				if (!(age > UNPAIRED_MAX_AGE_MS)) keep.push(l);
				continue;
			}
			const verdict = judgeDecision(
				l,
				after?.after,
				after ? toolWrittenDuring(parsed, l, after) : undefined,
			);
			if (!verdict) continue;
			await writeClauseSignals(
				root,
				"plan-write.decision",
				planOfDecision(l, after?.after),
				SIGNAL,
				[verdict],
				opts.tracer,
			);
			sent++;
		}
		rewriteDecisionFile(path, text, keep);
		return { sent, kept: keep.length };
	} catch {
		return { sent: 0, kept: 0 };
	}
}

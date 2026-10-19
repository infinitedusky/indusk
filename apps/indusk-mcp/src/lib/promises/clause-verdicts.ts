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
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import type { Tracer } from "@opentelemetry/api";
import { parse } from "shell-quote";
import { bookkeepingRoots } from "../bookkeeping/roots.js";
import { liveOtlpEndpointSync } from "../telemetry/status.js";
import { type ClauseVerdict, writeClauseSignals } from "./clause-signal.js";

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
	decision: "refused" | "allowed";
	/** The plan paths the guard read in the command, root-relative. */
	files: string[];
	before: Snapshot;
};
export type AfterLine = { kind: "after"; toolUseId: string; after: Snapshot };
export type PlanWriteLine = DecisionLine | AfterLine;

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

// ─── the parser's reading (independent of the guard's) ─────────────────────

type Token = ReturnType<typeof parse>[number];

/** A path in a plan's folder (`.indusk/planning/[archive/]<plan>/…`, or the folder itself). */
function isPlanPath(word: string, cwd: string): boolean {
	if (!word) return false;
	const p = (isAbsolute(word) ? word : resolve(cwd, word)).replace(/\\/g, "/");
	const m = /\/\.indusk\/planning\/(?:archive\/)?([^/]+)(\/.*)?$/.exec(p);
	if (!m || m[1] === "archive") return false;
	return Boolean(m[2]) || !m[1].includes(".");
}

/** Here-document bodies removed: `shell-quote` reads them as words. */
function withoutHeredocBodies(text: string): string {
	const out: string[] = [];
	const pending: { delim: string; strip: boolean }[] = [];
	for (const line of text.split("\n")) {
		if (pending.length > 0) {
			const doc = pending[0];
			if ((doc.strip ? line.replace(/^\t+/, "") : line) === doc.delim) pending.shift();
			continue;
		}
		out.push(line);
		for (const m of line.matchAll(/<<(-?)\s*(['"]?)([\w.-]+)\2/g)) {
			if (line[(m.index ?? 0) + 2] === "<") continue;
			pending.push({ delim: m[3], strip: m[1] === "-" });
		}
	}
	return out.join("\n");
}

const SEPARATORS = new Set(["&&", "||", ";", "|", "&", "|&", ";;", "(", ")"]);
const WRITE_REDIRECTS = new Set([">", ">>", ">|", "&>", "&>>", "<>"]);
const REMOVERS = new Set([
	"rm",
	"rmdir",
	"unlink",
	"truncate",
	"shred",
	"touch",
	"tee",
	"mv",
	"patch",
]);
const COPIERS = new Set(["cp", "install", "rsync", "ln"]);
const INTERPRETERS = new Set(["node", "python", "python3", "perl", "ruby", "deno", "bun", "tsx"]);
const TREE_MOVING_GIT = new Set([
	"merge",
	"pull",
	"switch",
	"reset",
	"stash",
	"rebase",
	"cherry-pick",
	"revert",
	"am",
]);
const INDUSK = new Set(["indusk", "atdawn", "dev-system"]);

/** The parsed command as simple commands: `{ words, redirects }`, each with the working directory it ran in. */
function simpleCommands(command: string, cwd: string) {
	const tokens: Token[] = parse(withoutHeredocBodies(command), (key) => `$${key}`);
	const out: { words: string[]; redirects: { op: string; target: string }[]; cwd: string }[] = [];
	let cur = { words: [] as string[], redirects: [] as { op: string; target: string }[], cwd };
	let at = cwd;
	const flush = () => {
		if (cur.words.length || cur.redirects.length) {
			out.push(cur);
			const [verb, target] = cur.words;
			if (verb === "cd" && target) at = resolve(at, target);
		}
		cur = { words: [], redirects: [], cwd: at };
	};
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (typeof t === "string") cur.words.push(t);
		else if ("op" in t && t.op === "glob") cur.words.push(t.pattern);
		else if ("op" in t && SEPARATORS.has(t.op)) flush();
		else if ("op" in t) {
			const next = tokens[i + 1];
			const target = typeof next === "string" ? next : "";
			if (typeof next === "string") i++;
			cur.redirects.push({ op: t.op, target });
		}
	}
	flush();
	return out;
}

function verbOf(words: string[]): { verb: string; args: string[] } {
	const w = [...words];
	while (
		w.length &&
		(/^[A-Za-z_]\w*=/.test(w[0]) || ["sudo", "env", "command", "nohup", "time"].includes(w[0]))
	)
		w.shift();
	if ((w[0] === "pnpm" || w[0] === "npx") && w.length > 1) {
		const exec = w.indexOf("exec");
		w.splice(0, exec !== -1 ? exec + 1 : 1);
	}
	return { verb: basename(w[0] ?? ""), args: w.slice(1) };
}

/** Whether the parser reads `command` as writing, moving or removing a plan path. */
export function parserReadsWrite(command: string, cwd: string): boolean {
	let commands: ReturnType<typeof simpleCommands>;
	try {
		commands = simpleCommands(command, cwd);
	} catch {
		return false;
	}
	for (const c of commands) {
		const plan = (w: string) => isPlanPath(w, c.cwd);
		for (const r of c.redirects) {
			if (WRITE_REDIRECTS.has(r.op) && plan(r.target)) return true;
			if (r.op === ">&" && !/^(\d+|-)$/.test(r.target) && plan(r.target)) return true;
		}
		const { verb, args } = verbOf(c.words);
		const operands = args.filter((a) => !a.startsWith("-"));
		if (REMOVERS.has(verb) && operands.some(plan)) return true;
		if (COPIERS.has(verb) && plan(operands.at(-1) ?? "")) return true;
		if (verb === "dd" && args.some((a) => a.startsWith("of=") && plan(a.slice(3)))) return true;
		if (
			(verb === "sed" || verb === "perl") &&
			args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith("--in-place"))
		) {
			if (operands.some(plan)) return true;
		}
		if (verb === "git") {
			const sub = args.find((a) => !a.startsWith("-"));
			if (
				["mv", "rm", "restore", "apply", "clean", "checkout"].includes(sub ?? "") &&
				!args.includes("--cached") &&
				!(sub === "restore" && args.includes("--staged")) &&
				args.some((a) => plan(a.includes("=") ? a.slice(a.indexOf("=") + 1) : a))
			)
				return true;
		}
		if (verb === "find" && (args.includes("-delete") || args.some((a) => a.startsWith("-exec")))) {
			if (operands.some(plan) || (operands.length === 0 && plan(c.cwd))) return true;
		}
		if (["bash", "sh", "zsh", "dash"].includes(verb)) {
			const flag = args.findIndex((a) => /^-[a-z]*c$/.test(a));
			if (flag !== -1 && parserReadsWrite(args[flag + 1] ?? "", c.cwd)) return true;
		}
		if (INTERPRETERS.has(verb)) {
			const text = args.join(" ");
			const namesPlan =
				/\.indusk\/planning\/(?:archive\/)?[\w*-][^\s'"/]*\//.test(text) || plan(c.cwd);
			if (namesPlan && /write|append|unlink|rename|rmSync|truncate|open\([^)]*['"][wa+]/.test(text))
				return true;
		}
	}
	return false;
}

/** An `indusk` command, or a git command that moves the checkout between committed states. */
function movesThroughChecks(command: string, cwd: string): boolean {
	try {
		return simpleCommands(command, cwd).some((c) => {
			const { verb, args } = verbOf(c.words);
			if (INDUSK.has(verb)) return true;
			if (verb === "node" && args.some((a) => a.endsWith("bin/cli.js"))) return true;
			if (verb !== "git") return false;
			const sub = args.find((a) => !a.startsWith("-")) ?? "";
			if (TREE_MOVING_GIT.has(sub)) return true;
			return sub === "checkout" && !args.includes("--");
		});
	} catch {
		return false;
	}
}

/**
 * One decision's verdict, or null when there is nothing to say: a refusal is
 * judged by the parser (a write: `shell-write-refused` upheld; only a read:
 * `reads-pass` broken); an allowed command by the disk (a plan document
 * changed: `shell-write-refused` broken, naming the files and the command;
 * nothing changed: `reads-pass` upheld for a command that named a plan path).
 */
export function judgeDecision(d: DecisionLine, after?: Snapshot): ClauseVerdict | null {
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
	const changed = changedFiles(d.before, after);
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
			if (l.kind !== "decision") continue;
			const after = afters.get(l.toolUseId);
			const age = now.getTime() - Date.parse(l.at);
			if (l.decision === "allowed" && !after) {
				if (!(age > UNPAIRED_MAX_AGE_MS)) keep.push(l);
				continue;
			}
			const verdict = judgeDecision(l, after?.after);
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

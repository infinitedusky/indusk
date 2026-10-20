import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { withLock } from "../agents/lock.js";
import {
	commitNote,
	currentMdPath,
	type NoteCommit,
	oneLine as subjectLine,
} from "../bookkeeping/notes.js";
import { bookkeepingRoots } from "../bookkeeping/roots.js";

/**
 * A plan's decisions, recorded where people read notes (plan-cockpit, ADR
 * decision 4): one dated line per answer in `.indusk/plan-history/<plan>.md`
 * in the main checkout, whichever checkout asks, committed on `main` as
 * `chore(indusk): <plan> — <answer>` by the notes writer `current.md` and the
 * lessons use (`commitNote`) — only that file, so anything a person has staged
 * stays staged and out of it; when `main` cannot take the commit, the line
 * stays written and uncommitted and the reason says why. Written under the
 * `current.md` lock, as every note is. Never by hand.
 *
 * promise: decisions-wait-in-one-place
 * promise: indusk-leaves-main-clean
 */

export interface DecisionEntry {
	/** The decision the plan waited on, in words. */
	decision: string;
	/** The answer given: an option, Approve or Accept, or the person's own words. */
	answer: string;
	/** Who answered — `person`, or a workflow. */
	by: string;
	/** When, as an ISO date-time. */
	at: string;
}

const PLAN_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HISTORY_DIR = join(".indusk", "plan-history");

/** The main checkout's history file for `plan`. */
export function historyPath(anyCheckout: string, plan: string): string {
	return join(bookkeepingRoots(anyCheckout).trunk, HISTORY_DIR, `${plan}.md`);
}

/**
 * Append one answer to `plan`'s history and commit it on `main`. Throws,
 * before anything is written, on a plan name that is not one kebab-case
 * segment: the file is committed as written, so a name that leaves the
 * folder must never be used.
 */
export function appendDecision(
	anyCheckout: string,
	plan: string,
	entry: DecisionEntry,
): { entry: DecisionEntry; commit: NoteCommit } {
	const commit = appendHistoryLine(anyCheckout, plan, lineOf(entry), entry.answer);
	return { entry, commit };
}

/**
 * Append one line to `plan`'s history and commit it, as `appendDecision` does.
 * The one writer of the file: the question records (`questions/history.ts`) write
 * their own line shape through it, so a question and an answer share one lock and
 * one commit path. A line that is not a decision line is skipped by `readHistory`.
 */
export function appendHistoryLine(
	anyCheckout: string,
	plan: string,
	line: string,
	subject: string,
): NoteCommit {
	if (!PLAN_NAME.test(plan)) {
		throw new Error(`${JSON.stringify(plan)} is not a plan name (one kebab-case segment)`);
	}
	const file = historyPath(anyCheckout, plan);
	const lock = `${currentMdPath(anyCheckout)}.lock`;
	mkdirSync(dirname(lock), { recursive: true });
	return withLock(lock, () => {
		mkdirSync(dirname(file), { recursive: true });
		if (!existsSync(file)) appendFileSync(file, header(plan));
		appendFileSync(file, `${line}\n`);
		return commitNote(
			bookkeepingRoots(anyCheckout).trunk,
			[join(HISTORY_DIR, `${plan}.md`)],
			`chore(indusk): ${plan} — ${subjectLine(subject)}`,
		);
	});
}

/** The history file's raw lines for `plan`; none when it has none. */
export function readHistoryLines(anyCheckout: string, plan: string): string[] {
	if (!PLAN_NAME.test(plan)) return [];
	const file = historyPath(anyCheckout, plan);
	return existsSync(file) ? readFileSync(file, "utf-8").split("\n") : [];
}

/** Every answer recorded for `plan`, oldest first; none when it has no history. */
export function readHistory(anyCheckout: string, plan: string): DecisionEntry[] {
	if (!PLAN_NAME.test(plan)) return [];
	const file = historyPath(anyCheckout, plan);
	if (!existsSync(file)) return [];
	return readHistoryLines(anyCheckout, plan)
		.map(parseLine)
		.filter((e): e is DecisionEntry => e !== null);
}

function header(plan: string): string {
	return [
		`# ${plan} — decisions`,
		"",
		"Each decision the plan waited on, the answer and who gave it, as the admin recorded them (`plans/history`). Not edited by hand.",
		"",
		"",
	].join("\n");
}

/** `- <at> — <decision> — answered "<answer>" by <by>`: the answer JSON-quoted so the line parses back. */
function lineOf(e: DecisionEntry): string {
	const by = oneLine(e.by).replace(/\s/g, "-") || "person";
	return `- ${e.at} — ${oneLine(e.decision)} — answered ${JSON.stringify(oneLine(e.answer))} by ${by}`;
}

const LINE = /^- (\S+) — (.*) — answered ("(?:[^"\\]|\\.)*") by (\S+)$/;

function parseLine(line: string): DecisionEntry | null {
	const m = LINE.exec(line);
	if (!m) return null;
	const [, at, decision, quoted, by] = m;
	try {
		return {
			decision: decision ?? "",
			answer: JSON.parse(quoted ?? '""'),
			by: by ?? "",
			at: at ?? "",
		};
	} catch {
		return null;
	}
}

function oneLine(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

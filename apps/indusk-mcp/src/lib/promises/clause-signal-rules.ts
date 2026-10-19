import matter from "gray-matter";
import { fencedLineMask } from "../impl-headings.js";
import type { Trajectory } from "../trajectory/parser.js";
import type { BriefContract } from "./brief-contract.js";

/**
 * The two rules a plan written as clauses holds its impl to
 * (a-plan-with-clauses-carries-its-signals):
 * promise: a-plan-with-clauses-carries-its-signals
 *
 * - every split and limit clause has a task that reports its signal
 *   (`missingSignalTasks`), so a plan cannot be built whose clauses can never
 *   read upheld or broken;
 * - no row that runs only after landing is a clause's proof
 *   (`afterLandingClauseRows`), because a live check cannot pass before the
 *   plan closes and the plan closes only when each clause has a passing proof.
 *
 * Both are pure: text and rows in, refusals out. They take no status; the
 * contract check decides which impls are judged on save (a draft), and
 * `own-impl-signals.test.ts` runs them on this plan's own impl whatever its status.
 */

/** A row as the rule reads it: the id, its level cell and its `For` cell. */
export interface LevelledRow {
	id: string;
	level: string | null | undefined;
	forCell: string | null | undefined;
}

/** A row that cannot run before landing, and the clause it names as its proof. */
export interface AfterLandingClauseRow {
	row: string;
	/** `promise/clause`. */
	clause: string;
}

/** Levels whose test cannot be run when a phase closes: before landing there is nothing for them to run against. */
const AFTER_LANDING_LEVELS = new Set(["live check", "smoke", "promise"]);

/** The tokens of a `For` cell that name a clause: `clause: <promise>/<clause>`. */
const CLAUSE_TOKEN = /^clause:\s*([a-z][a-z0-9-]*\/[a-z][a-z0-9-]*)$/;

/**
 * The rows of level `live check`, `smoke` or `promise` whose `For` names a
 * clause. One clause among several entries still counts, and is the one named.
 */
export function afterLandingClauseRows(rows: readonly LevelledRow[]): AfterLandingClauseRow[] {
	const out: AfterLandingClauseRow[] = [];
	for (const r of rows) {
		if (!AFTER_LANDING_LEVELS.has((r.level ?? "").trim().toLowerCase())) continue;
		for (const part of (r.forCell ?? "").split(",")) {
			const clause = CLAUSE_TOKEN.exec(part.trim())?.[1];
			if (clause) out.push({ row: r.id, clause });
		}
	}
	return out;
}

/** The trajectory's rows in the shape the rule reads. */
export function levelledRows(trajectory: Trajectory): LevelledRow[] {
	return trajectory.rows.map((r) => ({
		id: r.id,
		level: r.levelText,
		forCell: r.purposeText,
	}));
}

/** A path with a directory and a source extension: the file that reports a signal. */
const SOURCE_PATH = /[\w@.-]+(?:\/[\w@.[\]-]+)+\.(?:ts|tsx|js|jsx|mjs|cjs|py|rs|go|sh)\b/;

/** A task's lines: the column-zero checkbox line and every indented or blank line beneath it, fenced lines left out. */
function taskBlocks(impl: string): string[] {
	const lines = impl.split("\n");
	const fenced = fencedLineMask(lines);
	const blocks: string[][] = [];
	let open = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (fenced[i]) continue;
		if (/^- \[[ xX]\]/.test(line)) {
			blocks.push([line]);
			open = true;
		} else if (open && (/^\s+\S/.test(line) || line.trim() === "")) {
			blocks[blocks.length - 1].push(line);
		} else {
			open = false;
		}
	}
	return blocks.map((b) => b.join("\n"));
}

/** Whether one task names the clause, the word signal and the source file that reports it. */
function namesSignal(task: string, clause: string): boolean {
	if (!new RegExp(`(?<![a-z0-9-])${clause}(?![a-z0-9-])`).test(task)) return false;
	if (!/\bsignal/i.test(task)) return false;
	return SOURCE_PATH.test(task);
}

/**
 * Every split and limit clause of the promises the brief makes that no task of
 * the impl names a signal for, as `promise/clause`. A task names a clause's
 * signal when its line or its folded detail contains the clause's name, the
 * word `signal` and the repo path of the source file that reports it, outside
 * a code fence. A resting clause is proved by its promise in force: no task.
 */
export function missingSignalTasks(brief: BriefContract, impl: string): string[] {
	if (!brief.clausesRequired) return [];
	const body = impl.trimStart().startsWith("---") ? safeContent(impl) : impl;
	const tasks = taskBlocks(body);
	const out: string[] = [];
	for (const made of brief.makes) {
		for (const clause of made.clauses) {
			if (clause.kind === "rests-on") continue;
			if (!tasks.some((t) => namesSignal(t, clause.name))) out.push(`${made.name}/${clause.name}`);
		}
	}
	return out;
}

function safeContent(impl: string): string {
	try {
		return matter(impl).content;
	} catch {
		return impl;
	}
}

/** One refusal of the two rules, and which clause of the rules' own promise it is the signal of. */
export interface ClauseSignalRefusal {
	rule: "refused-without-signals" | "a-live-check-proves-no-clause";
	message: string;
}

/**
 * The refusals of both rules, one per clause and one per row, for the contract
 * check. Empty when the brief does not opt in to clauses.
 */
export function clauseSignalRefusals(
	brief: BriefContract,
	impl: string,
	trajectory: Trajectory,
): ClauseSignalRefusal[] {
	if (!brief.clausesRequired) return [];
	const out: ClauseSignalRefusal[] = missingSignalTasks(brief, impl).map((c) => ({
		rule: "refused-without-signals",
		message: `${c}: no task in the impl reports this clause's signal — add a task that says \`signal:\`, names the clause and the repo source file that reports it`,
	}));
	for (const r of afterLandingClauseRows(levelledRows(trajectory))) {
		out.push({
			rule: "a-live-check-proves-no-clause",
			message: `row ${r.row}: ${r.clause} is named by a row whose level runs only after landing — a live check, smoke or promise row proves no clause, because a clause is proved by tests that pass when the plan closes, before any landing; name a reason instead of the clause, and prove the clause with a unit or contract row`,
		});
	}
	return out;
}

import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withLock } from "../agents/lock.js";
import { isUsableSegment } from "../path-segment.js";
import { gitCommonDirOf } from "./layout.js";

/**
 * The plan-worktree assignment record: where it lives, what it holds, and the
 * only code that reads or writes it.
 *
 * `indusk-plan-worktrees.json` in the repository's shared git directory —
 * common to the trunk and every worktree of this clone, per-machine, never in
 * a working tree. Writers take `<record>.lock` from the read to the write, so
 * two sessions assigning at once both land. Readers parse it structurally and
 * report a malformed file rather than guessing around it. The resolver
 * (`plan-worktrees.ts`) and the commands (`plan-worktree-commands.ts`) go
 * through here; nothing else touches the file.
 */

/**
 * Which copy of a plan is the live one.
 *
 * Every checkout of a project holds a copy of every plan — the trunk's and
 * one per worktree — and under worktree-per-plan the one being worked is in
 * its worktree, not on the trunk. This module answers "where is plan X's live
 * copy" for every reader (the MCP plan tools, the admin), from any checkout.
 *
 * The answer comes from a record, never from matching names: the InDusk
 * worktree command writes an assignment when it creates or assigns a
 * worktree, and ends it at release. The record lives in the repository's
 * shared git directory — common to the trunk and every worktree of this
 * clone, per-machine like the worktrees it names, never part of any working
 * tree. Each read checks the record against git's own worktree list, and
 * every mismatch is reported as what it is: a worktree that is gone, a plan
 * with two live worktrees, a record that cannot be read. None is guessed.
 *
 * Inert in a workbench: plan documents there live at the workbench root and
 * never in a code worktree, so every plan reads from the plan root.
 */

export const RECORD_FILE = "indusk-plan-worktrees.json";

const RECORD_VERSION = 1;

export interface Assignment {
	plan: string;
	/** Absolute, realpath-normalized when written. */
	path: string;
	branch: string;
	/** ISO timestamp of the assignment. */
	at: string;
}

/** A refusal from `assignPlan`, `releasePlan` or `createPlanWorktree`: the message names what was refused. */
export class PlanWorktreeRefusal extends Error {
	override name = "PlanWorktreeRefusal";
}

export type RecordRead =
	| { ok: true; file: string; assignments: Assignment[] }
	| { ok: false; file: string; problem: string };

/** Why one assignment is unusable, or null. The reader and the writer share it. */
function assignmentProblem(value: unknown, index: number): string | null {
	if (typeof value !== "object" || value === null) return `assignment ${index} is not an object`;
	const a = value as Record<string, unknown>;
	for (const key of ["plan", "path", "branch", "at"] as const) {
		if (typeof a[key] !== "string" || (a[key] as string).trim() === "") {
			return `assignment ${index} has no ${key}`;
		}
	}
	if (!isUsableSegment(a.plan as string))
		return `assignment ${index} names an unusable plan "${a.plan}"`;
	if (!(a.path as string).startsWith("/"))
		return `assignment ${index} has a relative path "${a.path}"`;
	return null;
}

function parseRecord(text: string, file: string): RecordRead {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch (err) {
		return { ok: false, file, problem: `not valid JSON (${(err as Error).message})` };
	}
	if (typeof data !== "object" || data === null)
		return { ok: false, file, problem: "not an object" };
	const body = data as { version?: unknown; assignments?: unknown };
	if (body.version !== RECORD_VERSION) {
		return {
			ok: false,
			file,
			problem: `version is ${JSON.stringify(body.version)}, expected ${RECORD_VERSION}`,
		};
	}
	if (!Array.isArray(body.assignments))
		return { ok: false, file, problem: "assignments is not a list" };
	for (let i = 0; i < body.assignments.length; i++) {
		const problem = assignmentProblem(body.assignments[i], i);
		if (problem) return { ok: false, file, problem };
	}
	return { ok: true, file, assignments: body.assignments as Assignment[] };
}

function recordPath(anyCheckout: string): string {
	const common = gitCommonDirOf(anyCheckout);
	if (!common) throw new PlanWorktreeRefusal(`${anyCheckout} is not inside a git repository`);
	// The common dir exists whenever git reports it; realpath settles /var ↔ /private/var.
	return join(realpathSync(common), RECORD_FILE);
}

function readRecordFile(file: string): RecordRead {
	if (!existsSync(file)) return { ok: true, file, assignments: [] };
	let text: string;
	try {
		text = readFileSync(file, "utf-8");
	} catch (err) {
		return { ok: false, file, problem: `unreadable (${(err as Error).message})` };
	}
	return parseRecord(text, file);
}

export async function readRecord(anyCheckout: string): Promise<RecordRead> {
	return readRecordFile(recordPath(anyCheckout));
}

/**
 * Read the record, decide, and write it back, holding `<record>.lock` across
 * all three. Two sessions assigning at once would otherwise each write the
 * list they read and the later write would drop the earlier assignment — that
 * plan silently reading the trunk again. The lock is the project's lock for
 * processes on one machine (`lib/agents/lock.ts`); `change` returns the new
 * list, or null to write nothing.
 */
export function updateRecord<T>(
	anyCheckout: string,
	change: (assignments: Assignment[]) => { next: Assignment[] | null; result: T },
): T {
	const file = recordPath(anyCheckout);
	return withLock(`${file}.lock`, () => {
		const record = readRecordFile(file);
		if (!record.ok) refuseUnreadable(record);
		const { next, result } = change(record.assignments);
		if (next) writeRecord(file, next);
		return result;
	});
}

/** Write the record atomically: a reader never sees half a file. */
function writeRecord(file: string, assignments: Assignment[]): void {
	const temp = `${file}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify({ version: RECORD_VERSION, assignments }, null, 2)}\n`);
	renameSync(temp, file);
}

/** The one refusal for a record that cannot be read — every writer and pre-check uses it. */
export function refuseUnreadable(record: { file: string; problem: string }): never {
	throw new PlanWorktreeRefusal(
		`the assignment record ${record.file} cannot be read: ${record.problem} — fix or remove it first`,
	);
}

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isUsableRelPath } from "../path-segment.js";
import { clauseTokenPattern } from "../tokens.js";
import { parseBriefContract } from "./brief-contract.js";
import { type ClauseReport, clauseStanding } from "./clause-standing.js";
import { type PlanFolder, planFolderPath, planFolderStatus } from "./plan-folder.js";
import { type PromiseClause, type PromiseEntry, readPromises } from "./registry.js";
import { type NamingRow, rowsNamingIn, rowsProvingClause } from "./rows.js";

/**
 * A clause is proved twice (mark-first ADR D2): its tests pass when run now,
 * and its signal has reported it upheld in a run of the real system. Closing
 * asks both halves; landing asks the tests half (decision D-8). Both are read
 * through inputs the caller hands in — a test runner and a signal reader — so
 * the rule is decided from values and reads nothing it was not given
 * (`lesson: code-that-decides-takes-its-clock-and-its-reads`). Each refusal
 * names `promise/clause` and says which half is missing.
 *
 * promise: a-clause-is-proved-twice
 * clause: a-clause-is-proved-twice/verified-before-release
 * clause: a-clause-is-proved-twice/upheld-by-its-signal
 */

/** One test file's verdict from a run made now. */
export interface TestFileResult {
	file: string;
	passed: boolean;
	/** Why a file did not pass when it is not a failure, e.g. "ran no test (skipped)". */
	reason?: string;
}

/** Runs test files (paths as the rows name them) and gives each its verdict. */
export type ClauseTestRunner = (files: string[]) => Promise<TestFileResult[]>;

/** What the daemon says of a promise's clauses, or why it could not be asked. */
export type ClauseReports =
	| { ok: true; byClause: Record<string, ClauseReport[]>; heartbeatOk: boolean }
	| { ok: false; reason: string };

/** Asks the daemon what each clause of a promise has reported. */
export type SignalReader = (promise: PromiseEntry) => Promise<ClauseReports>;

/** A promise a plan holds, with the rows of its impl that name it. */
export interface HeldPromise {
	promise: PromiseEntry;
	rows: readonly NamingRow[];
}

/** What one half found: the refusals, and the `promise/clause` keys it judged and refused. */
export interface HalfResult {
	refusals: string[];
	checked: string[];
	refused: string[];
	/** The signal half's `promise/clause` keys that have reported nothing at all (not those that reported broken). */
	noSignal?: string[];
}

/** The clauses a signal reports and a test proves: splits and limits, never a resting clause. */
export function provableClauses(promise: Pick<PromiseEntry, "clauses">): PromiseClause[] {
	return (promise.clauses ?? []).filter((c) => c.kind !== "rests-on");
}

const key = (promise: PromiseEntry, clause: string) => `${promise.name}/${clause}`;

/** The clauses of `promise` (of `among`) whose token the file carries; none when it cannot be read. */
function clausesNamedBy(codeRoot: string, rel: string, promise: PromiseEntry, among: string[]) {
	const abs = join(codeRoot, rel);
	if (!isUsableRelPath(rel) || !existsSync(abs) || !statSync(abs).isFile()) return [];
	const text = readFileSync(abs, "utf-8");
	return among.filter((c) =>
		[promise.name, ...promise.aliases].some((n) => clauseTokenPattern(n, c).test(text)),
	);
}

/**
 * Run, once each, the test files the clause rows of `held` name, and refuse
 * each clause a file fails now, though its row says passing (A1). A failing
 * file is reported against the clauses whose token it carries (A3), or, when
 * it names none, the clauses whose rows name it. A file the runner did not
 * report is failing: a test not run is never a test passed.
 */
export async function clauseTestsHalf(
	held: readonly HeldPromise[],
	codeRoot: string,
	runTests: ClauseTestRunner,
): Promise<HalfResult> {
	const files = [
		...new Set(
			held.flatMap(({ promise, rows }) =>
				provableClauses(promise).flatMap((c) =>
					rowsProvingClause(rows, c.name).flatMap((r) => r.tests),
				),
			),
		),
	];
	const checked = held.flatMap(({ promise }) =>
		provableClauses(promise).map((c) => key(promise, c.name)),
	);
	if (files.length === 0) return { refusals: [], checked, refused: [] };
	let results: TestFileResult[];
	try {
		results = await runTests(files);
	} catch (err) {
		return {
			refusals: [
				`the tests that prove the plan's clauses could not be run, so none counts as passing: ${(err as Error).message}`,
			],
			checked,
			refused: checked,
		};
	}
	const verdict = new Map(results.map((r) => [r.file, r.passed]));
	const why = new Map(results.flatMap((r) => (r.reason ? [[r.file, r.reason] as const] : [])));
	const refusals: string[] = [];
	const refused = new Set<string>();
	for (const { promise, rows } of held) {
		const clauses = provableClauses(promise).map((c) => c.name);
		const byFile = new Map<string, string[]>();
		for (const c of clauses) {
			for (const r of rowsProvingClause(rows, c)) {
				for (const f of r.tests) byFile.set(f, [...(byFile.get(f) ?? []), c]);
			}
		}
		for (const [file, rowClauses] of byFile) {
			const passed = verdict.get(file);
			if (passed === true) continue;
			const named = clausesNamedBy(codeRoot, file, promise, clauses);
			const blamed = named.length > 0 ? named : [...new Set(rowClauses)];
			const states = rows
				.filter((r) => r.tests.includes(file))
				.map((r) => `row ${r.id} says ${r.state}`);
			for (const c of blamed) {
				refused.add(key(promise, c));
				refusals.push(
					`${key(promise, c)}: tests — ${file} ${passed === false ? (why.get(file) ?? "fails when run now") : "was not reported by the test run"}${states.length > 0 ? ` (${[...new Set(states)].join(", ")})` : ""}; a clause's tests pass before the plan closes or lands`,
				);
			}
		}
	}
	return { refusals, checked, refused: [...refused] };
}

/**
 * Ask the daemon, through `readSignals`, whether each split and limit clause's
 * signal has reported it upheld in a real run, and refuse each that has not
 * (A9): `no signal` is never a pass, and neither is a daemon that cannot be
 * read — that refusal says the daemon is not running and how to start it.
 */
export async function clauseSignalHalf(
	held: readonly HeldPromise[],
	readSignals: SignalReader,
): Promise<HalfResult> {
	const refusals: string[] = [];
	const checked: string[] = [];
	const refused: string[] = [];
	const noSignal: string[] = [];
	for (const { promise } of held) {
		const clauses = provableClauses(promise);
		if (clauses.length === 0) continue;
		const keys = clauses.map((c) => key(promise, c.name));
		checked.push(...keys);
		let read: ClauseReports;
		try {
			read = await readSignals(promise);
		} catch (err) {
			read = { ok: false, reason: (err as Error).message };
		}
		if (!read.ok) {
			refused.push(...keys);
			refusals.push(
				`${promise.name}: signal — the daemon is not running or cannot be read, so no clause's signal can be asked (${read.reason}); an unread signal never counts as a pass`,
			);
			continue;
		}
		for (const c of clauses) {
			const reports = read.byClause[c.name] ?? [];
			const standing = clauseStanding(c, { reports, heartbeatOk: read.heartbeatOk });
			if (standing === "holding") continue;
			refused.push(key(promise, c.name));
			if (standing !== "broken") noSignal.push(key(promise, c.name));
			refusals.push(
				standing === "broken"
					? `${key(promise, c.name)}: signal — its signal reports broken; the clause is not upheld`
					: `${key(promise, c.name)}: signal — no signal has reported it upheld in a run of the real system${read.heartbeatOk ? "" : " (the watcher is blind)"}; a passing test never stands in for its signal`,
			);
		}
	}
	return { refusals, checked, refused, noSignal };
}

/** Whether the plan's brief opts in to clauses (`clauses: required`): its promises close on their tests run now and their signals. */
export function writtenAsClauses(folder: PlanFolder): boolean {
	const briefPath = join(folder.dir, "brief.md");
	if (!existsSync(briefPath)) return false;
	const brief = parseBriefContract(readFileSync(briefPath, "utf-8"));
	return brief.shape === "contract" && brief.clausesRequired;
}

/**
 * The promises a plan written as clauses holds with a split or limit clause,
 * each with the rows that name it — what landing runs the tests of. Null for
 * a plan not written as clauses, or with no plan folder (it lands as before);
 * a refusal when its registry or its impl cannot be read, never an empty set.
 */
export function clauseTestPlan(
	planRoot: string,
	plan: string,
): { held: HeldPromise[] } | { refusal: string } | null {
	// No plan folder: nothing is written as clauses, and landing's own checks say what is missing.
	const status = planFolderStatus(planRoot, plan);
	if (status !== "active" && status !== "archived") return null;
	const folder: PlanFolder = {
		plan,
		archived: status === "archived",
		dir: planFolderPath(planRoot, plan, status === "archived"),
	};
	if (!writtenAsClauses(folder)) return null;
	const read = readPromises(planRoot);
	if (!read.ok) {
		return { refusal: `${plan} is written as clauses and its promise registry cannot be read` };
	}
	const implPath = join(folder.dir, "impl.md");
	if (!existsSync(implPath)) return { held: [] };
	let implText: string;
	try {
		implText = readFileSync(implPath, "utf-8");
		const held = read.registry.promises
			.filter((p) => p.owner === plan && p.state !== "retired" && provableClauses(p).length > 0)
			.map((promise) => ({ promise, rows: rowsNamingIn(implText, promise) }));
		return { held };
	} catch (err) {
		return { refusal: `${plan}'s impl cannot be read: ${(err as Error).message}` };
	}
}

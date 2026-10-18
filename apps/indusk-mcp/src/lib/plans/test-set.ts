import type { PhaseKind, PhaseRef } from "../impl-headings.js";
import type { PromiseEntry } from "../promises/registry.js";
import { findPromise } from "../promises/registry.js";
import type { TrajectoryRow } from "../trajectory/parser.js";

/**
 * The tests a plan runs, computed in one place (tests-never-make-us-wait ADR D1).
 *
 * A phase runs the tests of the rows it writes or makes pass, plus the tests
 * its changes reach. A landing runs every row's tests, the tests the plan's
 * changes reach, and the tests of each promise the brief lists as Must not
 * break. Nothing else: a test no row names, no change reaches and no
 * protected promise lists does not run while a plan is built.
 *
 * Pure. What the reads came from (the trajectory parser, `parseBriefContract`,
 * the registry, `vitest related`) is the caller's, so this can be asserted
 * with plain values and its clock-and-reads stay out of it.
 *
 * promise: a-plan-runs-its-tests-and-what-must-not-break
 */

/** The fields of a trajectory row the test set reads. */
export type TestSetRow = Pick<
	TrajectoryRow,
	"id" | "writableAt" | "writableAtKind" | "passesAt" | "passesAtKind" | "test"
>;

/** The fields of a registry entry the test set reads. */
export type TestSetPromise = Pick<PromiseEntry, "name" | "tests"> &
	Partial<Pick<PromiseEntry, "aliases">>;

export interface TestSetReads {
	rows: readonly TestSetRow[];
	/** The promise names the brief lists under Must not break. */
	mustNotBreak: readonly string[];
	registry: readonly TestSetPromise[];
	/** The test files whose imports reach the files the plan changed. */
	reached?: readonly string[];
}

export type TestSetScope = { phase: PhaseRef } | { landing: true };

export interface TestSetFile {
	path: string;
	/** Why it is in the set: `row T1`, `reached`, `must not break: <promise>`. */
	reason: string;
}

export interface TestSet {
	files: TestSetFile[];
	/** Must-not-break promises that name no test, or are not in the registry: listed, never dropped. */
	withoutTests: string[];
	/** Rows' `manual:` references: a person verified them; nothing runs them. */
	manual: string[];
}

const MANUAL = /^manual:\s*/i;

function atPhase(kind: PhaseKind, number: number, phase: PhaseRef): boolean {
	return kind === phase.kind && number === phase.number;
}

export function planTestSet(reads: TestSetReads, scope: TestSetScope): TestSet {
	const files: TestSetFile[] = [];
	const seen = new Set<string>();
	const manual: string[] = [];
	const add = (path: string, reason: string) => {
		if (seen.has(path)) return;
		seen.add(path);
		files.push({ path, reason });
	};

	const phase = "phase" in scope ? scope.phase : null;
	for (const row of reads.rows) {
		if (
			phase &&
			!atPhase(row.writableAtKind, row.writableAt, phase) &&
			!atPhase(row.passesAtKind, row.passesAt, phase)
		) {
			continue;
		}
		for (const ref of row.test ?? []) {
			if (MANUAL.test(ref)) manual.push(`${row.id}: ${ref.replace(MANUAL, "")}`);
			else add(ref, `row ${row.id}`);
		}
	}

	for (const path of reads.reached ?? []) add(path, "reached");

	const withoutTests: string[] = [];
	if (!phase) {
		const registry = reads.registry.map((p) => ({ ...p, aliases: p.aliases ?? [] }));
		for (const name of reads.mustNotBreak) {
			const promise = findPromise(registry, name);
			if (!promise || promise.tests.length === 0) {
				withoutTests.push(name);
				continue;
			}
			for (const path of promise.tests) add(path, `must not break: ${name}`);
		}
	}

	return { files, withoutTests, manual };
}

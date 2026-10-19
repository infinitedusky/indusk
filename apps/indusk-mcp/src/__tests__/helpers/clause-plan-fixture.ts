import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type {
	ClauseReports,
	ClauseTestRunner,
	SignalReader,
} from "../../lib/promises/clause-proof.js";
import { briefText, implText } from "./plan-fixture.js";
import { type PromiseProject, promiseProject, siteFile } from "./promises-fixture.js";

/**
 * A plan written as clauses (`clauses: required`), ready to close: one promise,
 * `a-promise`, with a split and a limit clause, each proved by its own row and
 * test file; optionally a second promise made only of a clause resting on a
 * promise already in force. Built on `promiseProject`, so it is a real project
 * the closing and landing rules read from disk (mark-first, Build Phase 4).
 *
 * The test runner and the signal reader closing takes are handed in by the
 * tests: `passingRun`, `failingRun`, `upheldSignals`, `noSignals`, `stoppedDaemon`.
 */

export const PLAN = "p";
export const PROMISE = "a-promise";
export const RESTING = "b-promise";
export const BASE = "base-promise";
export const CLAUSES = [
	{ name: "a-clause", kind: "split", statement: "A is reached in a second." },
	{ name: "b-clause", kind: "limit", statement: "B never happens twice." },
] as const;
export type ClauseName = (typeof CLAUSES)[number]["name"];

/** The test file that proves a clause. */
export const testOf = (clause: string) => `src/${clause}.test.ts`;

/** A test file carrying the promise's and the clause's tokens, with an assertion. */
export function clauseTestFile(
	clause: string,
	body = 'it("holds", () => expect(1).toBe(1));',
): string {
	return [
		`// promise: ${PROMISE}`,
		`// clause: ${PROMISE}/${clause}`,
		'import { expect, it } from "vitest";',
		body,
		"",
	].join("\n");
}

export interface ClausePlanOptions {
	/** Each clause row's state; `passing` when not given. */
	rowState?: Partial<Record<ClauseName, string>>;
	/** A clause's test file content in place of `clauseTestFile(clause)`. */
	testText?: Partial<Record<ClauseName, string>>;
	/** Also make `b-promise`, made only of a clause resting on `base-promise`. */
	resting?: boolean;
	/** `base-promise`'s state; `enforced` when not given. */
	baseState?: "declared" | "enforced";
	/** Write the brief without `clauses: required`: a plan written before clause plans. */
	legacy?: boolean;
}

function brief(opts: ClausePlanOptions): string {
	const makes = [
		{ name: PROMISE, sentence: `The ${PROMISE} holds.` },
		...(opts.resting ? [{ name: RESTING, sentence: `The ${RESTING} holds.` }] : []),
	];
	const lines: string[] = [];
	for (const line of briefText(PLAN, { makes }).split("\n")) {
		lines.push(line);
		if (line.includes(`**\`${PROMISE}\`**`)) {
			for (const c of CLAUSES) lines.push(`   - **\`${c.name}\`** (${c.kind}). ${c.statement}`);
		}
		if (line.includes(`**\`${RESTING}\`**`)) {
			lines.push(`   - **\`rests-on-base\`** (rests on \`${BASE}\`).`);
		}
	}
	const text = lines.join("\n");
	return opts.legacy
		? text
		: text.replace("workflow: feature", "workflow: feature\nclauses: required");
}

function clausePlan(opts: ClausePlanOptions): string {
	const signal = "- Signal: read from the a span; upheld when it ends ok; broken reports the a.";
	return [
		"---",
		'title: "p — Test Plan"',
		"status: accepted",
		"---",
		"",
		"# p — Test Plan",
		"",
		`## \`${PROMISE}\``,
		"",
		...CLAUSES.flatMap((c) => [`### \`${c.name}\` — ${c.statement}`, "", signal, ""]),
		...(opts.resting ? [`## \`${RESTING}\``, "", "### `rests-on-base`", "", signal, ""] : []),
	].join("\n");
}

function impl(opts: ClausePlanOptions): string {
	return implText(PLAN, {
		keys: ["test_purpose: required"],
		columns: ["For", "Test"],
		rows: CLAUSES.map((c, i) => ({
			id: `A${i + 1}`,
			state: opts.rowState?.[c.name] ?? "passing",
			cells: { For: `clause: ${PROMISE}/${c.name}`, Test: testOf(c.name) },
		})),
	});
}

function declared(name: string, clauses: object[]) {
	return {
		name,
		kind: "state" as const,
		state: "declared" as const,
		domain: "planning",
		owner: PLAN,
		raw: matter.stringify(`The ${name} holds.\n\n## History\n- 2026-10-18 — declared.\n`, {
			name,
			kind: "state",
			lifetime: "holds",
			state: "declared",
			domain: "planning",
			owner: PLAN,
			sites: [],
			tests: [],
			incidents: [],
			clauses,
		}),
	};
}

export function clausePlanProject(opts: ClausePlanOptions = {}): PromiseProject {
	return promiseProject({
		domains: ["planning"],
		activePlans: ["base-plan"],
		promises: [
			declared(
				PROMISE,
				CLAUSES.map((c) => ({ ...c })),
			),
			...(opts.resting
				? [
						declared(RESTING, [{ name: "rests-on-base", kind: "rests-on", rests_on: BASE }]),
						{
							name: BASE,
							kind: "structure" as const,
							state: opts.baseState ?? ("enforced" as const),
							domain: "planning",
							owner: "base-plan",
							statement: "The base holds.",
							tests: ["src/base.test.ts"],
						},
					]
				: []),
		],
		planFiles: {
			[`${PLAN}/brief.md`]: brief(opts),
			[`${PLAN}/test-plan.md`]: clausePlan(opts),
			[`${PLAN}/impl.md`]: impl(opts),
		},
		files: {
			"src/a.ts": siteFile(PROMISE),
			...Object.fromEntries(
				CLAUSES.map((c) => [testOf(c.name), opts.testText?.[c.name] ?? clauseTestFile(c.name)]),
			),
			...(opts.resting
				? {
						"src/base.test.ts": `// promise: ${BASE}\nimport { it } from "vitest";\nit("x", () => {});\n`,
					}
				: {}),
		},
	});
}

/** The registry file's frontmatter for a promise of the project. */
export function registryState(p: PromiseProject, name: string): unknown {
	return matter(readFileSync(join(p.planRoot, ".indusk", "promises", `${name}.md`), "utf-8")).data
		.state;
}

/** Every file passes. Records what it was asked to run. */
export function passingRun(asked: string[][] = []): ClauseTestRunner {
	return async (files) => {
		asked.push([...files]);
		return files.map((file) => ({ file, passed: true }));
	};
}

/** The named files fail, every other passes. */
export function failingRun(...failing: string[]): ClauseTestRunner {
	return async (files) => files.map((file) => ({ file, passed: !failing.includes(file) }));
}

const AT = "2026-10-18T10:00:00.000Z";

/** Every split and limit clause of the promise reported upheld in a real run; `except` clauses reported nothing. */
export function upheldSignals(...except: string[]): SignalReader {
	return async (promise): Promise<ClauseReports> => ({
		ok: true,
		heartbeatOk: true,
		byClause: Object.fromEntries(
			(promise.clauses ?? [])
				.filter((c) => c.kind !== "rests-on" && !except.includes(c.name))
				.map((c) => [c.name, [{ outcome: "upheld" as const, at: AT }]]),
		),
	});
}

/** The daemon answered and nothing ever reported. */
export const noSignals: SignalReader = async () => ({ ok: true, heartbeatOk: true, byClause: {} });

/** The daemon is not running. */
export const stoppedDaemon: SignalReader = async () => ({
	ok: false,
	reason: "no telemetry daemon is running — start it with `indusk telemetry start`",
});

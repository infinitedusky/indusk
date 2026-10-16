import { rmSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { parseBriefContract } from "../lib/promises/brief-contract.js";
import { checkPlanContract } from "../lib/promises/contract.js";
import { CLI_BIN, SHOULD_SKIP } from "./helpers/cli.js";
import { runHook } from "./helpers/hook-runner.js";
import { briefText, type ImplSpec, implText } from "./helpers/plan-fixture.js";
import { type PromiseProject, promiseProject, token } from "./helpers/promises-fixture.js";

/**
 * plans-are-promises A1, A2, A4, A5, A6, A7, A8, A13, A18 — the contract check
 * holds a brief's clauses to the registry, the clause plan and the test rows.
 *
 * promise: a-plan-holds-the-promises-it-lands
 *
 * An opted-in brief (`clauses: required`) states each promise it makes as
 * clauses; the registry keeps the same clauses; `test-plan.md` has a section
 * per promise and per clause with its signal; and the impl's rows name every
 * split and limit clause. A13 is the regression guard: a plan that has not
 * opted in is held to none of it. Through `checkPlanContract`, the one check
 * the CLI and the save hook both run.
 */

const PLAN = "demo";
const FIRST = "first-promise";
const SECOND = "second-promise";
const FAST = "A seat is released in under a second.";
const LOST = "No hold is ever lost.";

interface ClauseSpec {
	name: string;
	kind: "split" | "limit";
	sentence: string;
}
const fast: ClauseSpec = { name: "fast", kind: "split", sentence: FAST };
const neverLost: ClauseSpec = { name: "never-lost", kind: "limit", sentence: LOST };

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const sentenceOf = (name: string) => `The ${name} holds.`;

/** An opted-in brief: each promise with its clauses as sub-entries. */
function brief(
	promises: Array<{ name: string; clauses: ClauseSpec[] }>,
	opts: { optedIn?: boolean } = {},
): string {
	const base = briefText(PLAN, {
		makes: promises.map((p) => ({ name: p.name, sentence: sentenceOf(p.name) })),
	});
	const lines: string[] = [];
	for (const line of base.split("\n")) {
		lines.push(line);
		const made = promises.find((p) => line.includes(`**\`${p.name}\`**`));
		if (made) {
			for (const c of made.clauses) lines.push(`   - **\`${c.name}\`** (${c.kind}). ${c.sentence}`);
		}
	}
	const text = lines.join("\n");
	return opts.optedIn === false
		? text
		: text.replace("workflow: feature", "workflow: feature\nclauses: required");
}

/** A registry file for a promise, carrying `clauses` the way the registry will. */
function registryFile(name: string, clauses: ClauseSpec[] | null): { name: string; raw: string } {
	const data: Record<string, unknown> = {
		name,
		kind: "state",
		lifetime: "holds",
		state: "declared",
		domain: "planning",
		owner: PLAN,
		sites: [],
		tests: [],
		incidents: [],
	};
	if (clauses) {
		data.clauses = clauses.map((c) => ({ name: c.name, kind: c.kind, statement: c.sentence }));
	}
	return {
		name,
		raw: matter.stringify(`${sentenceOf(name)}\n\n## History\n- 2026-10-16 — declared.\n`, data),
	};
}

/** A clause plan: a section per promise, a subsection per clause, a signal unless left out. */
function clausePlan(
	promises: Array<{ name: string; clauses: ClauseSpec[] }>,
	opts: { omitPromise?: string; omitClause?: string; omitSignal?: string } = {},
): string {
	const out = [
		"---",
		'title: "Demo — Test Plan"',
		"status: accepted",
		"---",
		"",
		"# Demo — Test Plan",
		"",
	];
	for (const p of promises) {
		if (p.name === opts.omitPromise) continue;
		out.push(`## \`${p.name}\``, "");
		for (const c of p.clauses) {
			if (c.name === opts.omitClause) continue;
			out.push(`### \`${c.name}\` — ${c.sentence}`, "");
			if (c.name !== opts.omitSignal) {
				out.push(
					"- Signal: read from the seat span; upheld when it ends ok; broken reports the seat.",
					"",
				);
			}
		}
	}
	return out.join("\n");
}

const BOTH = [
	{ name: FIRST, clauses: [fast, neverLost] },
	{ name: SECOND, clauses: [fast, neverLost] },
];

function project(opts: {
	brief: string;
	registry?: Array<{ name: string; raw: string }>;
	testPlan?: string;
	impl?: string;
}): PromiseProject {
	const registry = opts.registry ?? [
		registryFile(FIRST, [fast, neverLost]),
		registryFile(SECOND, [fast, neverLost]),
	];
	fixture = promiseProject({
		domains: ["planning"],
		promises: registry.map((r) => ({
			name: r.name,
			kind: "state",
			state: "declared",
			domain: "planning",
			owner: PLAN,
			raw: r.raw,
		})),
		planFiles: {
			[`${PLAN}/brief.md`]: opts.brief,
			...(opts.testPlan === undefined ? {} : { [`${PLAN}/test-plan.md`]: opts.testPlan }),
			...(opts.impl === undefined ? {} : { [`${PLAN}/impl.md`]: opts.impl }),
		},
	});
	return fixture;
}

const messages = (p: PromiseProject) => {
	const r = checkPlanContract(p.planRoot, PLAN);
	return r.ok ? [] : r.refusals.map((x) => x.message);
};
const refused = (p: PromiseProject) => !checkPlanContract(p.planRoot, PLAN).ok;
/** The refusal that names `needle`, if any. */
const naming = (p: PromiseProject, needle: string, ...also: RegExp[]) =>
	messages(p).find((m) => m.includes(needle) && also.every((re) => re.test(m)));

const rows = (...cells: string[]): string =>
	implText(PLAN, {
		keys: ["test_purpose: required"],
		columns: ["For"],
		rows: cells.map((For) => ({ cells: { For } })),
	});

describe("A1 — a brief that states two promises as clauses", () => {
	it("is read with each promise's clauses, and passes once both are declared with them", () => {
		const text = brief(BOTH);
		const parsed = parseBriefContract(text);
		if (parsed.shape !== "contract") throw new Error("the fixture brief reads as legacy");
		const clauses = (parsed.makes[0] as { clauses?: Array<{ name: string; kind: string }> })
			.clauses;
		expect(clauses?.map((c) => [c.name, c.kind])).toEqual([
			["fast", "split"],
			["never-lost", "limit"],
		]);

		const p = project({ brief: text });
		expect(messages(p)).toEqual([]);
	});
});

describe("A2 — an opted-in brief whose promise has no clause", () => {
	it("is refused, naming the promise", () => {
		const p = project({
			brief: brief([
				{ name: FIRST, clauses: [fast, neverLost] },
				{ name: SECOND, clauses: [] },
			]),
		});
		expect(refused(p), "an opted-in promise with no clause is refused").toBe(true);
		expect(naming(p, SECOND, /clause/i), `a refusal names ${SECOND}`).toBeDefined();
	});
});

describe("A4 — the brief's clauses are the registry's", () => {
	const reworded: ClauseSpec = { ...neverLost, sentence: "Some holds may be lost." };
	it.each([
		[
			"missing from the registry",
			[registryFile(FIRST, [fast]), registryFile(SECOND, [fast, neverLost])],
			"never-lost",
		],
		[
			"extra in the registry",
			[
				registryFile(FIRST, [fast, neverLost, { name: "surplus", kind: "limit", sentence: "x." }]),
				registryFile(SECOND, [fast, neverLost]),
			],
			"surplus",
		],
		[
			"reworded in the registry",
			[registryFile(FIRST, [fast, reworded]), registryFile(SECOND, [fast, neverLost])],
			"never-lost",
		],
	] as Array<[string, Array<{ name: string; raw: string }>, string]>)(
		"refuses a clause %s, naming it",
		(_why, registry, clause) => {
			const p = project({ brief: brief(BOTH), registry });
			expect(refused(p), "brief and registry disagree").toBe(true);
			expect(
				naming(p, clause, /clause/i, /registry/i),
				`a refusal names the clause ${clause} and the registry`,
			).toBeDefined();
		},
	);
});

describe("A5 — the clause plan has a section for every promise and clause", () => {
	it("refuses a missing promise section, naming the promise", () => {
		const p = project({ brief: brief(BOTH), testPlan: clausePlan(BOTH, { omitPromise: SECOND }) });
		expect(refused(p), "a promise with no section is refused").toBe(true);
		expect(naming(p, SECOND, /test-plan|clause plan/i)).toBeDefined();
	});

	it("refuses a missing clause section, naming the clause", () => {
		const p = project({
			brief: brief(BOTH),
			testPlan: clausePlan(BOTH, { omitClause: "never-lost" }),
		});
		expect(refused(p), "a clause with no section is refused").toBe(true);
		expect(naming(p, "never-lost", /test-plan|clause plan/i)).toBeDefined();
	});
});

describe("A6 — every clause in the clause plan has a signal", () => {
	it("refuses a clause with no Signal line, naming the clause", () => {
		const p = project({ brief: brief(BOTH), testPlan: clausePlan(BOTH, { omitSignal: "fast" }) });
		expect(refused(p), "a clause with no signal is refused").toBe(true);
		expect(naming(p, "fast", /signal/i)).toBeDefined();
	});
});

describe("A7 — a row may name only a clause its promise has", () => {
	const missing = `clause: ${FIRST}/no-such`;

	it("is refused by the contract check, naming the clause", () => {
		const p = project({ brief: brief(BOTH), impl: rows(missing) });
		const found = naming(p, "no-such", /clause/i, /row/i);
		expect(found, "a refusal names the clause the promise lacks").toBeDefined();
		expect(found).toMatch(/clause/i);
		expect(found).not.toMatch(/malformed|not as/i);
	});

	it.skipIf(SHOULD_SKIP)("is refused when the impl is saved, naming the clause", async () => {
		const p = project({ brief: brief(BOTH) });
		const r = await runHook(
			"validate-impl-structure.js",
			{
				tool_name: "Write",
				cwd: p.root,
				tool_input: {
					file_path: join(p.planRoot, ".indusk", "planning", PLAN, "impl.md"),
					content: rows(missing),
				},
			},
			{ env: { INDUSK_BIN: `node ${CLI_BIN}`, INDUSK_SKIP_UPDATE_CHECK: "1" } },
		);
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toContain("no-such");
		expect(r.stderr).toMatch(/does not have|no clause/i);
	});
});

describe("A8 — every clause is named by some row", () => {
	it("refuses an impl where no row names a clause, naming it", () => {
		const p = project({
			brief: brief(BOTH),
			impl: rows(`clause: ${FIRST}/fast`, `clause: ${SECOND}/fast`),
		});
		expect(refused(p)).toBe(true);
		const found = naming(p, "never-lost", /clause/i, /row/i);
		expect(found, "a refusal names the clause no row names").toBeDefined();
	});
});

describe("A13 — a plan that has not opted in is held to no clause", () => {
	it("passes the contract check with rows naming its promises", () => {
		const unopted = brief(
			[
				{ name: FIRST, clauses: [] },
				{ name: SECOND, clauses: [] },
			],
			{ optedIn: false },
		);
		const impl: ImplSpec = {
			keys: ["test_purpose: required"],
			columns: ["For"],
			rows: [{ cells: { For: token(FIRST) } }, { cells: { For: token(SECOND) } }],
		};
		const p = project({
			brief: unopted,
			registry: [registryFile(FIRST, null), registryFile(SECOND, null)],
			impl: implText(PLAN, impl),
		});
		expect(messages(p)).toEqual([]);
	});
});

/**
 * A18 — a brief that has not opted in reads an indented bullet as it did
 * before clauses: another promise it makes, not a sub-entry of the entry above.
 */
describe("A18 — an indented bullet in a brief that has not opted in is still a promise", () => {
	const base = briefText(PLAN, { makes: [{ name: FIRST, sentence: sentenceOf(FIRST) }] });
	const withIndented = (indent: string) =>
		base.replace(
			`1. **\`${FIRST}\`** (state). ${sentenceOf(FIRST)}`,
			`1. **\`${FIRST}\`** (state). ${sentenceOf(FIRST)}\n${indent}- **\`${SECOND}\`** (state). ${sentenceOf(SECOND)}`,
		);

	for (const indent of ["  ", "   "]) {
		it(`reads a bullet indented ${indent.length} spaces as a promise it makes`, () => {
			const parsed = parseBriefContract(withIndented(indent));
			if (parsed.shape === "legacy") throw new Error("expected the contract shape");
			expect(parsed.makes.map((m) => m.name)).toEqual([FIRST, SECOND]);
		});
	}
});

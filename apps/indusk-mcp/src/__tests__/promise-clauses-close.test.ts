import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { confirmPlan } from "../lib/promises/confirm.js";
import { checkPlanContract } from "../lib/promises/contract.js";
import { briefText, implText } from "./helpers/plan-fixture.js";
import {
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";

/**
 * plans-are-promises A21 — the whole story, end to end through the library.
 *
 * promise: a-plan-holds-the-promises-it-lands
 * clause: a-plan-holds-the-promises-it-lands/closing-per-clause
 *
 * In a temporary project, a plan states two promises as clauses: the contract
 * check passes; closing refuses while one clause's row is `planned`, naming
 * the clause; and it closes once that row passes. This replaces the manual
 * `indusk promises contract demo && indusk promises confirm demo` run that
 * A16 once named, so closing reads a test file instead of a command.
 */

const PLAN = "demo";
const FIRST = "seat-released-on-timeout";
const SECOND = "seat-map-never-stale";
const FAST = "A seat is released in under a second.";
const LOST = "No hold is ever lost.";
const clauses = [
	{ name: "fast", kind: "split", statement: FAST },
	{ name: "never-lost", kind: "limit", statement: LOST },
];
const testOf = (name: string) => `src/${name}.test.ts`;
const siteOf = (name: string) => `src/${name}.ts`;

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const sentenceOf = (name: string) => `The ${name} holds.`;

/** An opted-in brief: each promise with its two clauses as sub-entries. */
function brief(): string {
	const base = briefText(PLAN, {
		makes: [FIRST, SECOND].map((name) => ({ name, sentence: sentenceOf(name) })),
	});
	const lines: string[] = [];
	for (const line of base.split("\n")) {
		lines.push(line);
		if ([FIRST, SECOND].some((n) => line.includes(`**\`${n}\`**`))) {
			lines.push(`   - **\`fast\`** (split). ${FAST}`, `   - **\`never-lost\`** (limit). ${LOST}`);
		}
	}
	return lines.join("\n").replace("workflow: feature", "workflow: feature\nclauses: required");
}

const clausePlan = [
	"---",
	'title: "Demo — Test Plan"',
	"status: accepted",
	"---",
	"",
	"# Demo — Test Plan",
	"",
	...[FIRST, SECOND].flatMap((name) => [
		`## \`${name}\``,
		"",
		...clauses.flatMap((c) => [
			`### \`${c.name}\` — ${c.statement}`,
			"",
			"- Signal: read from the seat span; upheld when it ends ok; broken reports the seat.",
			"",
		]),
	]),
].join("\n");

/** Every clause's row passes, except the one row `planned` names. */
function impl(planned?: string): string {
	return implText(PLAN, {
		keys: ["test_purpose: required"],
		columns: ["For", "Test"],
		rows: [FIRST, SECOND].flatMap((name) =>
			clauses.map((c) => ({
				id: `${name}-${c.name}`,
				state: `${name}/${c.name}` === planned ? "planned" : "passing",
				cells: { For: `clause: ${name}/${c.name}`, Test: testOf(name) },
			})),
		),
	});
}

function project(): PromiseProject {
	fixture = promiseProject({
		domains: ["planning"],
		promises: [FIRST, SECOND].map((name) => ({
			name,
			kind: "state",
			state: "declared",
			domain: "planning",
			owner: PLAN,
			raw: matter.stringify(`${sentenceOf(name)}\n\n## History\n- 2026-10-16 — declared.\n`, {
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
		})),
		planFiles: {
			[`${PLAN}/brief.md`]: brief(),
			[`${PLAN}/test-plan.md`]: clausePlan,
			[`${PLAN}/impl.md`]: impl("seat-released-on-timeout/never-lost"),
		},
		files: Object.fromEntries(
			[FIRST, SECOND].flatMap((name) => [
				[siteOf(name), siteFile(name)],
				[
					testOf(name),
					`${testFile(name)}// ${clauses.map((c) => `clause: ${name}/${c.name}`).join("\n// ")}\n`,
				],
			]),
		),
	});
	return fixture;
}

describe("plans-are-promises A21 — a plan with two promises as clauses, start to close", () => {
	it("passes the contract, is refused at close while a clause's row is planned, and closes once it passes", async () => {
		const p = project();
		const input = { planRoot: p.planRoot, codeRoot: p.codeRoot, plan: PLAN };

		const contract = checkPlanContract(p.planRoot, PLAN);
		expect(contract.ok ? [] : contract.refusals.map((r) => r.message)).toEqual([]);

		const refused = await confirmPlan(input);
		if (refused.ok) throw new Error("closing confirmed with a clause's row still planned");
		const text = refused.refusals.map((r) => r.message).join("\n");
		expect(text, "the refusal names the unproved clause").toContain("never-lost");
		expect(text).toContain("planned");

		writeFileSync(join(p.planRoot, ".indusk", "planning", PLAN, "impl.md"), impl());
		const closed = await confirmPlan(input);
		if (!closed.ok) throw new Error(closed.refusals.map((r) => r.message).join("\n"));
		expect(closed.confirmed.map((c) => c.name).sort()).toEqual([SECOND, FIRST].sort());
	});
});

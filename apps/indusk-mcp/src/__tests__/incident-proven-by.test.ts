import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { recordViolations } from "../lib/promises/incidents.js";
import { readPromises } from "../lib/promises/registry.js";
import { reopenOwner } from "../lib/promises/reopen.js";
import type { MarkedSpan } from "../lib/promises/telemetry.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { briefText, implText } from "./helpers/plan-fixture.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";

/**
 * promise: an-incident-names-its-tests — planner-promises A12.
 * promise: a-changed-promise-keeps-its-history — planner-promises A27.
 *
 * On numero (2026-10-02) a promise broke in a running system while its one
 * test row stayed green, and nothing the tooling wrote connected the two: the
 * link was prose a person had typed. An incident now lists every row that
 * proves the broken promise — the plan, the row, and whether it passes — so
 * the fix starts from the tests that were vouching. A promise a later plan
 * changed reopens that plan, and its incident lists the rows of both.
 *
 * The violations are given, not read from a Jaeger: what an incident says is
 * a rule about files.
 */

const OLD_PLAN = "seats-v1";
const PLAN = "seats-v2";
const NAME = "seat-never-double-booked";
const TEST = "src/seat.test.ts";
const SITE = "src/seat.ts";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const impl = (plan: string, rows: Array<{ state: string; For: string }>) =>
	implText(plan, {
		status: "completed",
		keys: ["test_purpose: required"],
		columns: ["For", "Test"],
		rows: rows.map((r) => ({ state: r.state, cells: { For: r.For, Test: TEST } })),
	});

function project(opts: { withV2?: boolean; v1Rows?: Array<{ state: string; For: string }> } = {}) {
	fixture = promiseProject({
		domains: ["seating"],
		landed: { [OLD_PLAN]: daysAgo(30) },
		promises: [
			{
				name: NAME,
				kind: "behaviour",
				state: "enforced",
				domain: "seating",
				owner: OLD_PLAN,
				sites: [SITE],
				tests: [TEST],
			},
		],
		planFiles: {
			[`archive/${OLD_PLAN}/impl.md`]: impl(
				OLD_PLAN,
				opts.v1Rows ?? [
					{ state: "passing", For: `promise: ${NAME}` },
					{ state: "passing", For: "a regression guard" },
				],
			),
			...(opts.withV2
				? {
						[`${PLAN}/brief.md`]: briefText(PLAN, {
							changes: [{ name: NAME, sentence: "A seat is held once, for two minutes." }],
						}),
						[`${PLAN}/impl.md`]: impl(PLAN, [{ state: "written", For: `promise: ${NAME}` }]),
					}
				: {}),
		},
		files: { [SITE]: siteFile(NAME), [TEST]: testFile(NAME) },
	});
	return fixture;
}

function violation(): MarkedSpan {
	return {
		promise: NAME,
		outcome: "violated",
		traceId: "0af7651916cd43dd8448eb211c80319c",
		spanId: "aaaaaaaaaaaaaaaa",
		service: "seats-api",
		operation: "hold-seat",
		at: new Date("2026-10-05T12:00:00Z"),
		symptom: "seat 4 held by two players",
		environment: "production",
	};
}

/** Record one violation of the promise; the incident file's text and the promise's owner. */
function record(p: PromiseProject): { incident: string; id: string; owner: string } {
	const read = readPromises(p.planRoot);
	if (!read.ok) throw new Error(`fixture registry did not read: ${JSON.stringify(read)}`);
	const promise = read.registry.promises.find((x) => x.name === NAME);
	if (!promise) throw new Error("fixture promise missing");
	const change = recordViolations(read.registry, promise, [violation()], "deployed", new Date());
	if (!change) throw new Error("nothing was recorded");
	return {
		id: change.id,
		owner: promise.owner,
		incident: readFileSync(
			join(p.planRoot, ".indusk", "promises", "incidents", `${change.id}.md`),
			"utf-8",
		),
	};
}

const provenBy = (incident: string) =>
	/## Proven by\n([\s\S]*?)(?=\n## |$)/.exec(incident)?.[1].trim() ?? null;

describe("A12 — an incident names the rows that prove the broken promise", () => {
	it("lists each row that names it: the plan, the row, and whether it is passing", () => {
		const { incident } = record(project());
		const section = provenBy(incident);
		expect(
			section,
			"lesson: an-incident-starts-from-the-tests-that-vouched\nthe incident has no Proven by section",
		).not.toBeNull();
		expect(section).toMatch(new RegExp(`${OLD_PLAN}.*\\bT1\\b.*passing`));
		expect(section, "a row that is for something else is not listed").not.toMatch(/\bT2\b/);
	});

	it("says so when no row names the promise", () => {
		const { incident } = record(
			project({ v1Rows: [{ state: "passing", For: "a regression guard" }] }),
		);
		expect(provenBy(incident) ?? "(no Proven by section)").toMatch(/no test row names/i);
	});

	it("the registry still reads with the new section, and the check's verdict is about the break", () => {
		const p = project();
		record(p);
		const read = readPromises(p.planRoot);
		expect(read.ok, JSON.stringify(read)).toBe(true);
	});
});

describe.skipIf(SHOULD_SKIP)("A27 — a changed promise reopens the plan that changed it", () => {
	it("its incident lists the rows that name it in both plans, and the changing plan is the one reopened", () => {
		const p = project({ withV2: true });
		const changed = runCli(p.root, [
			"promises",
			"change",
			NAME,
			"--plan",
			PLAN,
			"--statement",
			"A seat is held once, for two minutes.",
			"--reason",
			"holds are now timed",
		]);
		expect(changed.code, changed.stdout + changed.stderr).toBe(0);

		const { incident, id, owner } = record(p);
		expect(owner, "the plan that last described it").toBe(PLAN);
		const section = provenBy(incident);
		expect(section).toMatch(new RegExp(`${OLD_PLAN}.*\\bT1\\b.*passing`));
		expect(section).toMatch(new RegExp(`${PLAN}.*\\bT1\\b.*written`));

		const reopened = reopenOwner(p.planRoot, owner, id, NAME, undefined, "opened");
		expect(reopened.reopened).toBe(true);
		expect(
			readFileSync(join(p.planRoot, ".indusk", "planning", PLAN, "impl.md"), "utf-8"),
		).toContain(`Maintenance — ${id}`);
	});
});

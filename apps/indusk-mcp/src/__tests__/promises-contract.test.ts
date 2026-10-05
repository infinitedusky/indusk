import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	type BriefSpec,
	briefText,
	type ImplSpec,
	implText,
	legacyBriefText,
} from "./helpers/plan-fixture.js";
import {
	daysAgo,
	type PromiseProject,
	type PromiseSpec,
	promiseProject,
	token,
} from "./helpers/promises-fixture.js";

/**
 * planner-promises A3, A4, A6, A14, A15, A18, A24 — the plan's contract.
 *
 * promise: a-briefs-promises-are-in-the-registry
 * promise: every-test-says-what-it-is-for
 * promise: an-expectation-says-how-it-is-measured
 * promise: a-changed-promise-keeps-its-history
 *
 * A plan's brief, its test rows and the registry have to agree before the
 * plan builds: `indusk promises contract <plan>` is the one check, and the
 * impl hook and `promises check` both run it. Each refusal names the promise,
 * the expectation or the row. Through the CLI, the way the hook reaches it.
 */

const PLAN = "seats-v2";
const OLD_PLAN = "seats-v1";
const MADE = "seat-released-on-timeout";
const MADE_SENTENCE = "A held seat is released when its hold runs out.";
const KEPT = "seat-never-double-booked";
const LESSON = "a-seat-is-held-in-one-statement";
const NO_SUCH_LESSON = "a-lesson-nobody-wrote";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const made = (over: Partial<PromiseSpec> = {}): PromiseSpec => ({
	name: MADE,
	kind: "state",
	state: "declared",
	domain: "seating",
	owner: PLAN,
	statement: MADE_SENTENCE,
	...over,
});
const kept = (over: Partial<PromiseSpec> = {}): PromiseSpec => ({
	name: KEPT,
	kind: "structure",
	state: "enforced",
	domain: "seating",
	owner: OLD_PLAN,
	tests: ["src/seat.test.ts"],
	...over,
});

function project(opts: {
	brief?: BriefSpec | "legacy";
	impl?: ImplSpec;
	promises?: PromiseSpec[];
}): PromiseProject {
	const brief = opts.brief ?? { makes: [{ name: MADE, sentence: MADE_SENTENCE }] };
	fixture = promiseProject({
		domains: ["seating"],
		landed: { [OLD_PLAN]: daysAgo(30) },
		promises: opts.promises ?? [made()],
		planFiles: {
			[`${PLAN}/brief.md`]: brief === "legacy" ? legacyBriefText(PLAN) : briefText(PLAN, brief),
			...(opts.impl ? { [`${PLAN}/impl.md`]: implText(PLAN, opts.impl) } : {}),
		},
		files: {
			"src/seat.test.ts": `// promise: ${KEPT}\n`,
			[`.claude/lessons/${LESSON}.md`]: "# A seat is held in one statement\n",
		},
	});
	return fixture;
}

const contract = (p: PromiseProject, plan = PLAN) => runCli(p.root, ["promises", "contract", plan]);

const rows = (...cells: string[]): ImplSpec => ({
	keys: ["test_purpose: required"],
	columns: ["For"],
	rows: cells.map((For) => ({ cells: { For } })),
});

describe.skipIf(SHOULD_SKIP)("A3 — the promises a brief makes are in the registry", () => {
	it("passes when each is there, owned by the plan, with the brief's sentence", () => {
		const r = contract(project({}));
		expect(r.code, r.stdout + r.stderr).toBe(0);
	});

	it("refuses one the registry does not hold, naming it", () => {
		const r = contract(project({ promises: [] }));
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(MADE);
	});

	it("refuses one another plan owns, naming the promise and that plan", () => {
		const r = contract(project({ promises: [made({ owner: OLD_PLAN })] }));
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(MADE);
		expect(r.stderr).toContain(OLD_PLAN);
	});

	it("refuses one whose sentence in the registry is not the brief's", () => {
		const r = contract(project({ promises: [made({ statement: "Seats are fine." })] }));
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(MADE);
		expect(r.stderr).toMatch(/sentence/i);
	});
});

describe.skipIf(SHOULD_SKIP)("A4 — the existing promises a brief names exist", () => {
	const brief = (extra: BriefSpec): BriefSpec => ({
		makes: [{ name: MADE, sentence: MADE_SENTENCE }],
		...extra,
	});

	it("passes when a promise it must not break is in force", () => {
		const r = contract(
			project({ brief: brief({ mustNotBreak: [KEPT] }), promises: [made(), kept()] }),
		);
		expect(r.code, r.stdout + r.stderr).toBe(0);
	});

	it.each([
		["must not break", { mustNotBreak: ["seat-map-never-stale"] }],
		["changes", { changes: [{ name: "seat-map-never-stale", sentence: "The map is fresh." }] }],
		["replaces", { replaces: [{ old: "seat-map-never-stale", by: MADE }] }],
	] as Array<[string, BriefSpec]>)(
		"refuses one listed under %s that does not exist, naming it",
		(_list, extra) => {
			const r = contract(project({ brief: brief(extra) }));
			expect(r.code, r.stdout + r.stderr).toBe(2);
			expect(r.stderr).toContain("seat-map-never-stale");
		},
	);

	it("refuses one that is already retired", () => {
		const r = contract(
			project({
				brief: brief({ mustNotBreak: [KEPT] }),
				promises: [made(), kept({ state: "retired" })],
			}),
		);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(KEPT);
		expect(r.stderr).toMatch(/retired/);
	});
});

describe.skipIf(SHOULD_SKIP)("A14, A15 — an expectation says how it is measured", () => {
	const withExpectations = (expectations: BriefSpec["expectations"]) =>
		project({ brief: { expectations, makes: [{ name: MADE, sentence: MADE_SENTENCE }] } });

	it("refuses an expectation with no measure, naming it", () => {
		const r = contract(
			withExpectations([{ text: "People seat themselves", look: "in two weeks" }]),
		);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain("People seat themselves");
		expect(r.stderr).toMatch(/measure/i);
	});

	it("refuses an expectation with no time to look, naming it", () => {
		const r = contract(
			withExpectations([{ text: "People seat themselves", measure: "seats taken per day" }]),
		);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain("People seat themselves");
		expect(r.stderr).toMatch(/look/i);
	});

	it("accepts a brief that says it has no expectations, with the reason", () => {
		const r = contract(
			withExpectations({ none: "a bugfix; the promise holding again is the point" }),
		);
		expect(r.code, r.stdout + r.stderr).toBe(0);
	});
});

describe.skipIf(SHOULD_SKIP)("A6 — what a row names exists", () => {
	it("passes rows naming a promise the plan makes, a lesson on file, and a reason", () => {
		const r = contract(
			project({ impl: rows(`promise: ${MADE}`, `lesson: ${LESSON}`, "a regression guard") }),
		);
		expect(r.code, r.stdout + r.stderr).toBe(0);
	});

	it("refuses a row naming a promise the registry does not hold, naming the row and the promise", () => {
		const r = contract(project({ impl: rows(token(MADE), token("seat-map-never-stale")) }));
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toMatch(/\bT2\b/);
		expect(r.stderr).toContain("seat-map-never-stale");
	});

	it("refuses a row naming a retired promise", () => {
		const r = contract(
			project({
				brief: { makes: [{ name: MADE, sentence: MADE_SENTENCE }], mustNotBreak: [] },
				promises: [made(), kept({ state: "retired" })],
				impl: rows(`promise: ${KEPT}`),
			}),
		);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(KEPT);
	});

	it("refuses a row naming a lesson with no file, naming the lesson", () => {
		const r = contract(project({ impl: rows(`lesson: ${NO_SUCH_LESSON}`) }));
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toMatch(/\bT1\b/);
		expect(r.stderr).toContain(NO_SUCH_LESSON);
	});
});

describe.skipIf(SHOULD_SKIP)(
	"A24 — a row naming another plan's promise is addressed in the brief",
	() => {
		it("refuses the row when the brief does not list that promise", () => {
			const r = contract(project({ promises: [made(), kept()], impl: rows(`promise: ${KEPT}`) }));
			expect(r.code, r.stdout + r.stderr).toBe(2);
			expect(r.stderr).toMatch(/\bT1\b/);
			expect(r.stderr).toContain(KEPT);
			expect(r.stderr).toMatch(/must not break|changes|replaces/i);
		});

		it("accepts it once the brief lists the promise under must not break", () => {
			const r = contract(
				project({
					brief: { makes: [{ name: MADE, sentence: MADE_SENTENCE }], mustNotBreak: [KEPT] },
					promises: [made(), kept()],
					impl: rows(`promise: ${KEPT}`),
				}),
			);
			expect(r.code, r.stdout + r.stderr).toBe(0);
		});
	},
);

describe.skipIf(SHOULD_SKIP)(
	"A18 — documents written before this plan are accepted as they were",
	() => {
		it("a brief with no Promises section is not held to the contract", () => {
			const r = contract(project({ brief: "legacy", promises: [] }));
			expect(r.code, r.stdout + r.stderr).toBe(0);
		});

		it("every plan folder in this repository, active and archived, passes", () => {
			const r = runCli(REPO_ROOT, ["promises", "contract", "--all"]);
			expect(r.code, r.stdout + r.stderr).toBe(0);
		});

		it("a plan that is not a plan folder is refused by name, never passed", () => {
			const r = contract(project({}), "seats-v9");
			expect(r.code, r.stdout + r.stderr).toBe(2);
			expect(r.stderr).toContain("seats-v9");
		});
	},
);

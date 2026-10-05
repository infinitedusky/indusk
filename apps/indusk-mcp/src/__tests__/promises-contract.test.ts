import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_BIN, REPO_ROOT, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { runHook } from "./helpers/hook-runner.js";
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
	/** The brief's whole text, for a brief the fixture would never write. */
	briefRaw?: string;
	impl?: ImplSpec;
	promises?: PromiseSpec[];
}): PromiseProject {
	const brief = opts.brief ?? { makes: [{ name: MADE, sentence: MADE_SENTENCE }] };
	fixture = promiseProject({
		domains: ["seating"],
		landed: { [OLD_PLAN]: daysAgo(30) },
		promises: opts.promises ?? [made()],
		planFiles: {
			[`${PLAN}/brief.md`]:
				opts.briefRaw ?? (brief === "legacy" ? legacyBriefText(PLAN) : briefText(PLAN, brief)),
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

	it("refuses one whose kind in the registry is not the brief's", () => {
		const r = contract(project({ promises: [made({ kind: "behaviour" })] }));
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(MADE);
		expect(r.stderr).toMatch(/kind/i);
	});

	it("reads a sentence wrapped over several lines as one sentence", () => {
		const wrapped = briefText(PLAN, { makes: [{ name: MADE, sentence: MADE_SENTENCE }] }).replace(
			"is released when",
			"is released\n   when",
		);
		const r = contract(project({ briefRaw: wrapped }));
		expect(r.code, r.stdout + r.stderr).toBe(0);
	});
});

describe.skipIf(SHOULD_SKIP)("A3 — the registry check runs every open plan's contract", () => {
	const check = (p: PromiseProject) => runCli(p.root, ["promises", "check"]);

	it("passes a registry whose open plan's brief agrees with it", () => {
		const r = check(project({ promises: [made(), kept()] }));
		expect(r.code, r.stdout + r.stderr).toBe(0);
	});

	it("refuses an otherwise clean registry while an open plan's brief makes a promise it does not hold", () => {
		const r = check(project({ promises: [kept()] }));
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(MADE);
		expect(r.stderr).toContain(`.indusk/planning/${PLAN}/brief.md`);
	});
});

describe.skipIf(SHOULD_SKIP)("A3 — a brief out of shape is refused, never read as empty", () => {
	const clean = () =>
		briefText(PLAN, { makes: [{ name: MADE, sentence: MADE_SENTENCE }], mustNotBreak: [KEPT] });
	const refused = (briefRaw: string) => {
		const r = contract(project({ briefRaw, promises: [made(), kept()] }));
		expect(r.code, r.stdout + r.stderr).toBe(2);
		return r.stderr;
	};

	it("precondition: the brief these cases break passes as written", () => {
		const r = contract(project({ briefRaw: clean(), promises: [made(), kept()] }));
		expect(r.code, r.stdout + r.stderr).toBe(0);
	});

	it("a list label with words after it, which would hide the promises under it", () => {
		const stderr = refused(
			clean().replace("**Must not break**", "**Must not break**, for this plan:"),
		);
		expect(stderr).toMatch(/Must not break/);
		expect(stderr).toMatch(/own line/i);
	});

	it("a promise named under Existing promises but under none of the three lists", () => {
		const stderr = refused(clean().replace("**Must not break**\n\n", ""));
		expect(stderr).toContain(KEPT);
		expect(stderr).toMatch(/must not break|changes|replaces/i);
	});

	it("an entry in a list that does not name a promise", () => {
		const stderr = refused(clean().replace(`- **\`${KEPT}\`**. Still true.`, "- the seat rule"));
		expect(stderr).toContain("the seat rule");
	});

	it("a promise this plan makes that is not written with its name", () => {
		const stderr = refused(clean().replace(`**\`${MADE}\`** (state).`, "Seats are released."));
		expect(stderr).toContain("Seats are released.");
	});

	it("a Promises section with no list of what this plan makes", () => {
		const stderr = refused(clean().replace("### This plan makes", "### What we make"));
		expect(stderr).toMatch(/This plan makes/);
	});

	it("ignores what is inside a code fence", () => {
		const fenced = clean().replace(
			"### Not promised",
			"```markdown\n**Must not break**\n- **`seat-map-never-stale`**. An example.\n```\n\n### Not promised",
		);
		const r = contract(project({ briefRaw: fenced, promises: [made(), kept()] }));
		expect(r.code, r.stdout + r.stderr).toBe(0);
	});
});

describe.skipIf(SHOULD_SKIP)(
	"A3 — an impl cannot be saved as building while the contract is broken",
	() => {
		const implPath = (p: PromiseProject) =>
			join(p.planRoot, ".indusk", "planning", PLAN, "impl.md");
		const DEV_CLI = { INDUSK_BIN: `node ${CLI_BIN}`, INDUSK_SKIP_UPDATE_CHECK: "1" };
		/** The impl hook, asked about a Write of `impl` to the plan's impl.md. */
		const write = (p: PromiseProject, impl: ImplSpec, env: Record<string, string> = DEV_CLI) =>
			runHook(
				"validate-impl-structure.js",
				{
					tool_name: "Write",
					cwd: p.root,
					tool_input: { file_path: implPath(p), content: implText(PLAN, impl) },
				},
				{ env },
			);

		it("accepts the write when the brief, the rows and the registry agree", async () => {
			const r = await write(project({}), rows(token(MADE)));
			expect(r.exitCode, r.stderr).toBe(0);
		});

		it("refuses it while the brief makes a promise the registry does not hold, naming the promise", async () => {
			const r = await write(project({ promises: [] }), rows("a regression guard"));
			expect(r.exitCode, r.stderr).toBe(2);
			expect(r.stderr).toContain(MADE);
		});

		it("judges the rows being written, not the impl on disk", async () => {
			const r = await write(project({}), rows(token(MADE), token("seat-map-never-stale")));
			expect(r.exitCode, r.stderr).toBe(2);
			expect(r.stderr).toMatch(/\bT2\b/);
			expect(r.stderr).toContain("seat-map-never-stale");
		});

		it("checks an edit that only changes the status: a draft saved as approved", async () => {
			const p = project({
				promises: [],
				impl: { ...rows("a regression guard"), status: "draft" },
			});
			const r = await runHook(
				"validate-impl-structure.js",
				{
					tool_name: "Edit",
					cwd: p.root,
					tool_input: {
						file_path: implPath(p),
						old_string: "status: draft",
						new_string: "status: approved",
					},
				},
				{ env: DEV_CLI },
			);
			expect(r.exitCode, r.stderr).toBe(2);
			expect(r.stderr).toContain(MADE);
		});

		it("does not hold a draft to it: the promises may not be saved yet", async () => {
			const r = await write(project({ promises: [] }), {
				...rows("a regression guard"),
				status: "draft",
			});
			expect(r.exitCode, r.stderr).toBe(0);
		});

		it("does not run for an impl that has not opted in", async () => {
			const r = await write(project({ promises: [] }), { rows: [{}] });
			expect(r.exitCode, r.stderr).toBe(0);
		});

		it("refuses, saying why, when the check cannot be run: a gate that cannot run is never a pass", async () => {
			const r = await write(project({}), rows(token(MADE)), {
				INDUSK_BIN: "definitely-not-a-real-indusk-xyz",
			});
			expect(r.exitCode, r.stderr).toBe(2);
			expect(r.stderr).toContain("definitely-not-a-real-indusk-xyz");
			expect(r.stderr).toMatch(/could not be checked/i);
			expect(r.stderr, "the refusal names its lesson on its own line").toMatch(
				/^lesson: detectors-must-distinguish-could-not-check-from-checked-and-failed$/m,
			);
		});

		it("judges an edit that replaces every occurrence as the file it would leave", async () => {
			const unwritten = `lesson: ${NO_SUCH_LESSON}`;
			const p = project({ impl: rows(unwritten, unwritten) });
			const r = await runHook(
				"validate-impl-structure.js",
				{
					tool_name: "Edit",
					cwd: p.root,
					tool_input: {
						file_path: implPath(p),
						old_string: unwritten,
						new_string: "a regression guard",
						replace_all: true,
					},
				},
				{ env: DEV_CLI },
			);
			expect(r.exitCode, r.stderr).toBe(0);
		});
	},
);

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

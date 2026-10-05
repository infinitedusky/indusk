import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { checkRetrospectiveReadiness } from "../lib/cleanup/gate.js";
import { registerPlanTools } from "../tools/plan-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { briefText, type ImplSpec, implText } from "./helpers/plan-fixture.js";
import {
	type PromiseProject,
	type PromiseSpec,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * promise: a-closed-plan-kept-its-promises — planner-promises A8–A11.
 *
 * A plan closes with its promises proven or it does not close. `indusk
 * promises confirm <plan>` moves each promise the plan declared to `enforced`,
 * with the test files its rows name and the code sites that carry its token —
 * and refuses, naming the promise, when no passing row names it. The
 * retrospective's gate reads the same answer. Through the CLI.
 */

const PLAN = "seats-v2";
const NAME = "seat-released-on-timeout";
const SENTENCE = "A held seat is released when its hold runs out.";
const TEST = "src/seat-release.test.ts";
const SITE = "src/seat-release.ts";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const declared: PromiseSpec = {
	name: NAME,
	kind: "state",
	state: "declared",
	domain: "seating",
	owner: PLAN,
	statement: SENTENCE,
};

const impl = (rows: ImplSpec["rows"]): ImplSpec => ({
	keys: ["test_purpose: required"],
	columns: ["For", "Test"],
	rows,
});

const proving = (state = "passing") => ({
	state,
	cells: { For: `promise: ${NAME}`, Test: TEST },
});

function project(opts: {
	rows?: ImplSpec["rows"];
	promises?: PromiseSpec[];
	makes?: boolean;
	files?: Record<string, string>;
	planRoot?: string;
	codeRoot?: string;
}): PromiseProject {
	fixture = promiseProject({
		domains: ["seating"],
		promises: opts.promises ?? [declared],
		planFiles: {
			[`${PLAN}/brief.md`]: briefText(PLAN, {
				makes: opts.makes === false ? [] : [{ name: NAME, sentence: SENTENCE }],
			}),
			[`${PLAN}/impl.md`]: implText(PLAN, impl(opts.rows ?? [proving()])),
		},
		files: opts.files ?? { [SITE]: siteFile(NAME), [TEST]: testFile(NAME) },
		...(opts.planRoot ? { planRoot: opts.planRoot } : {}),
		...(opts.codeRoot ? { codeRoot: opts.codeRoot } : {}),
	});
	return fixture;
}

const promise = (p: PromiseProject) =>
	matter(readFileSync(join(p.planRoot, ".indusk", "promises", `${NAME}.md`), "utf-8"));
const planDir = (p: PromiseProject) => join(p.planRoot, ".indusk", "planning", PLAN);
const readiness = (p: PromiseProject) =>
	checkRetrospectiveReadiness(planDir(p), readFileSync(join(planDir(p), "impl.md"), "utf-8"));

describe.skipIf(SHOULD_SKIP)("A9 — closing confirms the plan's promises", () => {
	it("moves each to enforced with its tests and sites, and the registry check then passes", () => {
		const p = project({});
		const r = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(r.code, r.stdout + r.stderr).toBe(0);

		const file = promise(p);
		expect(file.data.state).toBe("enforced");
		expect(file.data.tests, "the files its rows name").toEqual([TEST]);
		expect(file.data.sites, "the other files that carry its token").toEqual([SITE]);
		expect(file.content).toMatch(new RegExp(`## History[\\s\\S]*enforced[\\s\\S]*${PLAN}`));

		const check = runCli(p.planRoot, ["promises", "check"]);
		expect(check.code, check.stderr).toBe(0);
	});

	it("is safe to run again: nothing is declared, nothing changes", () => {
		const p = project({});
		expect(runCli(p.planRoot, ["promises", "confirm", PLAN]).code).toBe(0);
		const before = readFileSync(join(p.planRoot, ".indusk", "promises", `${NAME}.md`), "utf-8");
		const again = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(again.code, again.stdout + again.stderr).toBe(0);
		expect(readFileSync(join(p.planRoot, ".indusk", "promises", `${NAME}.md`), "utf-8")).toBe(
			before,
		);
	});
});

describe.skipIf(SHOULD_SKIP)(
	"A9 — the retrospective's tool confirms what the command confirms",
	() => {
		it("confirm_promises writes the same registry, and a refusal is an error that names the promise", async () => {
			const unproven = project({ rows: [proving("written")] });
			const refused = await toolCaller((server) =>
				registerPlanTools(server, unproven.planRoot),
			).call("confirm_promises", { plan: PLAN });
			expect(refused.isError).toBe(true);
			expect(JSON.stringify(refused.json)).toContain(NAME);
			expect(promise(unproven).data.state).toBe("declared");
			rmSync(unproven.root, { recursive: true, force: true });

			const p = project({});
			const done = await toolCaller((server) => registerPlanTools(server, p.planRoot)).call(
				"confirm_promises",
				{ plan: PLAN },
			);
			expect(done.isError, JSON.stringify(done.json)).toBe(false);
			expect(done.json).toMatchObject({
				confirmed: [{ name: NAME, tests: [TEST], sites: [SITE] }],
			});
			expect(promise(p).data.state).toBe("enforced");
		});
	},
);

describe.skipIf(SHOULD_SKIP)("A8 — a plan cannot close with a promise unproven", () => {
	it.each([
		["no row names it", [{ cells: { For: "a regression guard", Test: TEST } }]],
		["the row that names it is not passing", [proving("written")]],
	] as Array<[string, ImplSpec["rows"]]>)(
		"refuses when %s, naming the promise, and changes nothing",
		(_why, rows) => {
			const p = project({ rows });
			const r = runCli(p.planRoot, ["promises", "confirm", PLAN]);
			expect(r.code, r.stdout + r.stderr).toBe(2);
			expect(r.stderr).toContain(NAME);
			expect(promise(p).data.state, "still declared").toBe("declared");
		},
	);

	it("refuses when the test file its row names does not carry the promise's token, naming the file", () => {
		const p = project({ files: { [SITE]: siteFile(NAME), [TEST]: "// no token here\n" } });
		const r = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(TEST);
		expect(promise(p).data.state).toBe("declared");
	});

	it("refuses when the rows that name it name no test file", () => {
		const p = project({ rows: [{ cells: { For: `promise: ${NAME}`, Test: "" } }] });
		const r = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(NAME);
		expect(r.stderr).toMatch(/no test file/);
		expect(promise(p).data.state).toBe("declared");
	});

	it("refuses when no code carries its token: a promise about state names the code that keeps it", () => {
		const p = project({ files: { [TEST]: testFile(NAME) } });
		const r = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(NAME);
		expect(r.stderr).toMatch(/no code/);
		expect(promise(p).data.state, "nothing written").toBe("declared");
	});

	it("the retrospective's gate says promises are missing, by name", () => {
		const p = project({ rows: [proving("written")] });
		const ready = readiness(p) as ReturnType<typeof checkRetrospectiveReadiness> & {
			unprovenPromises?: string[];
		};
		expect(ready.missing).toContain("promises");
		expect(ready.unprovenPromises).toEqual([NAME]);
	});
});

describe.skipIf(SHOULD_SKIP)("A10 — a plan that made no promise closes as before", () => {
	it("confirm has nothing to do and says so; the gate does not mention promises", () => {
		const p = project({
			promises: [],
			makes: false,
			rows: [{ cells: { For: "a regression guard", Test: TEST } }],
		});
		const r = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(r.code, r.stdout + r.stderr).toBe(0);
		expect(r.stdout).toMatch(/no promise/i);
		expect(readiness(p).missing).not.toContain("promises");
	});
});

describe.skipIf(SHOULD_SKIP)("A11 — a workbench: the plan's code is not beside the plan", () => {
	it("confirms against the code root it is given, where the plan's tests are", () => {
		const p = project({ planRoot: "workbench", codeRoot: "repo-worktree" });
		const blind = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(blind.code, "beside the plan there is no code to read").toBe(2);
		expect(blind.stderr).toContain(TEST);

		const r = runCli(p.planRoot, ["promises", "confirm", PLAN, "--code-root", p.codeRoot]);
		expect(r.code, r.stdout + r.stderr).toBe(0);
		expect(promise(p).data.state).toBe("enforced");
		expect(promise(p).data.tests).toEqual([TEST]);
	});
});

/**
 * planner-promises A36 — the gate resolves the folder it is given. It looked
 * for the planning root in the path as written, so a relative path found none
 * and the gate reported no unproven promise.
 */
describe.skipIf(SHOULD_SKIP)("A36 — the gate, given the plan's folder as a relative path", () => {
	it("names the unproven promise when the path is relative to the project root", () => {
		const p = project({ rows: [proving("written")] });
		const before = process.cwd();
		process.chdir(p.planRoot);
		try {
			const dir = join(".indusk", "planning", PLAN);
			const ready = checkRetrospectiveReadiness(dir, readFileSync(join(dir, "impl.md"), "utf-8"));
			expect(ready.missing).toContain("promises");
			expect(ready.unprovenPromises).toEqual([NAME]);
		} finally {
			process.chdir(before);
		}
	});
});

/**
 * planner-promises A41 — a test is not the code that keeps a promise. Every
 * file carrying the token that a proving row did not name was taken for a
 * code site, so a state promise named only by tests was confirmed, its second
 * test listed as its site.
 */
describe.skipIf(SHOULD_SKIP)("A41 — a file a row names as a test is never a code site", () => {
	const OTHER = "src/seat-release-race.test.ts";
	const rowsWithGuard = [proving(), { cells: { For: "a regression guard", Test: OTHER } }];

	it("refuses a state promise whose name appears only in test files", () => {
		const p = project({
			rows: rowsWithGuard,
			files: { [TEST]: testFile(NAME), [OTHER]: testFile(NAME) },
		});
		const r = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(NAME);
		expect(r.stderr).toMatch(/no code/);
		expect(promise(p).data.state).toBe("declared");
	});

	it("records only the code as its site when another row's test also carries the token", () => {
		const p = project({
			rows: rowsWithGuard,
			files: { [SITE]: siteFile(NAME), [TEST]: testFile(NAME), [OTHER]: testFile(NAME) },
		});
		const r = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(r.code, r.stdout + r.stderr).toBe(0);
		expect(promise(p).data.sites).toEqual([SITE]);
	});
});

/**
 * planner-promises A43 — an archived plan's declared promise is not a dead
 * end. A plan that closed without its retrospective (a bugfix may skip it)
 * left the promise declared; the registry check refused it, and confirm and
 * withdraw refused an archived plan, so only a hand edit could clear it.
 */
describe.skipIf(SHOULD_SKIP)("A43 — a plan archived with a promise still declared", () => {
	const DROPPED = "seat-count-matches-table";

	it("the check names the commands; withdraw and confirm work on the archived plan", () => {
		fixture = promiseProject({
			domains: ["seating"],
			promises: [declared, { ...declared, name: DROPPED, statement: "Seats match the table." }],
			planFiles: {
				[`archive/${PLAN}/brief.md`]: briefText(PLAN, {
					makes: [{ name: NAME, sentence: SENTENCE }],
				}),
				[`archive/${PLAN}/impl.md`]: implText(PLAN, impl([proving()])),
			},
			files: { [SITE]: siteFile(NAME), [TEST]: testFile(NAME) },
		});
		const p = fixture;

		const before = runCli(p.planRoot, ["promises", "check"]);
		expect(before.code).toBe(2);
		expect(before.stderr).toContain("indusk promises confirm");
		expect(before.stderr).toContain("indusk promises withdraw");

		const withdrawn = runCli(p.planRoot, ["promises", "withdraw", DROPPED, "--plan", PLAN]);
		expect(withdrawn.code, withdrawn.stdout + withdrawn.stderr).toBe(0);
		const confirmed = runCli(p.planRoot, ["promises", "confirm", PLAN]);
		expect(confirmed.code, confirmed.stdout + confirmed.stderr).toBe(0);
		expect(promise(p).data.state).toBe("enforced");

		const after = runCli(p.planRoot, ["promises", "check"]);
		expect(after.code, after.stderr).toBe(0);
	});
});

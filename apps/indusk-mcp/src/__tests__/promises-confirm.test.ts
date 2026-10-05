import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { checkRetrospectiveReadiness } from "../lib/cleanup/gate.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { briefText, type ImplSpec, implText } from "./helpers/plan-fixture.js";
import {
	type PromiseProject,
	type PromiseSpec,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";

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

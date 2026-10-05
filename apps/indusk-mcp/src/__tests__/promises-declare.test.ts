import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { type PromiseProject, promiseProject } from "./helpers/promises-fixture.js";

/**
 * promise: a-briefs-promises-are-in-the-registry — planner-promises A1, A2.
 *
 * A promise reaches the registry from the planning conversation through a
 * command, never by a person typing a file: `indusk promises declare` writes
 * it as `declared`, owned by its plan, with the sentence the person approved.
 * Through the CLI, the way the planner reaches it.
 */

const NAME = "seat-never-double-booked";
const SENTENCE = "A seat is never held by two players at once.";
const PLAN = "seats-v2";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

function project(domains: string[] | undefined): PromiseProject {
	fixture = promiseProject({ domains, activePlans: [PLAN] });
	return fixture;
}

const declare = (p: PromiseProject, over: Record<string, string> = {}) => {
	const a = {
		name: NAME,
		plan: PLAN,
		kind: "state",
		domain: "seating",
		statement: SENTENCE,
		...over,
	};
	return runCli(p.root, [
		"promises",
		"declare",
		a.name,
		"--plan",
		a.plan,
		"--kind",
		a.kind,
		"--domain",
		a.domain,
		"--statement",
		a.statement,
	]);
};

const promiseFile = (p: PromiseProject, name = NAME) =>
	join(p.planRoot, ".indusk", "promises", `${name}.md`);

describe.skipIf(SHOULD_SKIP)("planner-promises A1 — a promise is written by a command", () => {
	it("is in the registry as declared, owned by its plan, with the sentence approved, and the check passes", () => {
		const p = project(["seating"]);
		const r = declare(p);
		expect(r.code, r.stdout + r.stderr).toBe(0);

		const file = matter(readFileSync(promiseFile(p), "utf-8"));
		expect(file.data).toMatchObject({
			name: NAME,
			kind: "state",
			state: "declared",
			domain: "seating",
			owner: PLAN,
		});
		expect(file.content.trim().split("\n")[0], "the sentence is the statement").toBe(SENTENCE);
		expect(file.content, "its History says where it came from").toMatch(
			new RegExp(`## History[\\s\\S]*declared[\\s\\S]*${PLAN}`),
		);

		const check = runCli(p.root, ["promises", "check"]);
		expect(check.code, check.stderr).toBe(0);
	});

	it("refuses a name the registry already holds, and leaves the file as it was", () => {
		const p = project(["seating"]);
		expect(declare(p).code).toBe(0);
		const before = readFileSync(promiseFile(p), "utf-8");
		const again = declare(p, { statement: "Something else entirely." });
		expect(again.code, again.stdout + again.stderr).toBe(2);
		expect(again.stderr).toContain(NAME);
		expect(readFileSync(promiseFile(p), "utf-8")).toBe(before);
	});

	it("refuses a plan that is not a plan folder, a kind that is not a kind, and writes nothing", () => {
		const p = project(["seating"]);
		const noPlan = declare(p, { plan: "seats-v9" });
		expect(noPlan.code, noPlan.stdout + noPlan.stderr).toBe(2);
		expect(noPlan.stderr).toContain("seats-v9");
		const noKind = declare(p, { kind: "feeling" });
		expect(noKind.code, noKind.stdout + noKind.stderr).toBe(2);
		expect(noKind.stderr).toMatch(/behaviour.*state.*structure/s);
		expect(existsSync(promiseFile(p))).toBe(false);
	});
});

describe.skipIf(SHOULD_SKIP)(
	"planner-promises A2 — a project's first promise declares its domain",
	() => {
		it("in a project that declares no domains, the promise's domain is declared with it and the check passes", () => {
			const p = project(undefined);
			const r = declare(p);
			expect(r.code, r.stdout + r.stderr).toBe(0);
			const config = JSON.parse(readFileSync(join(p.planRoot, ".indusk", "config.json"), "utf-8"));
			expect(config.promises?.domains).toEqual(["seating"]);
			const check = runCli(p.root, ["promises", "check"]);
			expect(check.code, check.stderr).toBe(0);
		});

		it("in a project that declares its domains, one it does not declare is refused, naming the ones it does", () => {
			const p = project(["checkout"]);
			const r = declare(p);
			expect(r.code, r.stdout + r.stderr).toBe(2);
			expect(r.stderr).toContain("seating");
			expect(r.stderr).toContain("checkout");
			expect(existsSync(promiseFile(p))).toBe(false);
		});
	},
);

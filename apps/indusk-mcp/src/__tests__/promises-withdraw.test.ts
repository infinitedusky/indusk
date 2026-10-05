import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	type PromiseProject,
	type PromiseSpec,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * planner-promises A28 — a declared promise can be withdrawn.
 *
 * A planning conversation changes its mind: a promise the person agreed to is
 * dropped, or given a better name. Until this command, the only way out of
 * the registry was deleting the file by hand, which is the thing the commands
 * exist to end. Only a promise that was never in force can be withdrawn, and
 * only by the plan that declared it; anything else is refused by name with
 * nothing removed. Through the CLI, the way the planner reaches it.
 */

const PLAN = "seats-v2";
const OTHER_PLAN = "seats-v3";
const NAME = "seat-released-on-timeout";
const INCIDENT = "i-2026-10-05-seat-released-on-timeout";
const TEST = "src/seat-release.test.ts";
const SITE = "src/seat-release.ts";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const declared = (over: Partial<PromiseSpec> = {}): PromiseSpec => ({
	name: NAME,
	kind: "state",
	state: "declared",
	domain: "seating",
	owner: PLAN,
	...over,
});

function project(
	promises: PromiseSpec[],
	extra: { incident?: boolean; code?: boolean } = {},
): PromiseProject {
	fixture = promiseProject({
		domains: ["seating"],
		activePlans: [PLAN, OTHER_PLAN],
		promises,
		...(extra.incident
			? { incidents: [{ id: INCIDENT, promise: NAME, source: "desk", status: "open" }] }
			: {}),
		// A promise still being planned has no code yet; one in force has its links.
		...(extra.code ? { files: { [SITE]: siteFile(NAME), [TEST]: testFile(NAME) } } : {}),
	});
	return fixture;
}

const withdraw = (p: PromiseProject, name = NAME, plan = PLAN) =>
	runCli(p.root, ["promises", "withdraw", name, "--plan", plan]);
const held = (p: PromiseProject, name = NAME) =>
	existsSync(join(p.planRoot, ".indusk", "promises", `${name}.md`));

describe.skipIf(SHOULD_SKIP)("A28 — a declared promise can be withdrawn", () => {
	it("removes a promise its plan declared and never proved", () => {
		const p = project([declared()]);
		const r = withdraw(p);
		expect(r.code, r.stdout + r.stderr).toBe(0);
		expect(r.stdout).toContain(NAME);
		expect(held(p), "the registry no longer holds it").toBe(false);
		const check = runCli(p.root, ["promises", "check"]);
		expect(check.code, check.stdout + check.stderr).toBe(0);
	});

	it("a rename is a withdrawal and a declaration, and the registry then holds only the new name", () => {
		const p = project([declared()]);
		expect(withdraw(p).code).toBe(0);
		const renamed = runCli(p.root, [
			"promises",
			"declare",
			"seat-freed-when-hold-expires",
			"--plan",
			PLAN,
			"--kind",
			"state",
			"--domain",
			"seating",
			"--statement",
			"A held seat is free again when its hold expires.",
		]);
		expect(renamed.code, renamed.stdout + renamed.stderr).toBe(0);
		expect(held(p)).toBe(false);
		expect(held(p, "seat-freed-when-hold-expires")).toBe(true);
	});

	it.each([
		["enforced", { state: "enforced", sites: [SITE], tests: [TEST] }],
		["retired", { state: "retired" }],
	] as Array<[string, Partial<PromiseSpec>]>)(
		"refuses one that is %s, naming it and its state, and removes nothing",
		(state, over) => {
			const p = project([declared(over)], { code: true });
			const r = withdraw(p);
			expect(r.code, r.stdout + r.stderr).toBe(2);
			expect(r.stderr).toContain(NAME);
			expect(r.stderr).toContain(state);
			expect(held(p)).toBe(true);
		},
	);

	it("refuses a promise another plan declared, naming that plan", () => {
		const p = project([declared({ owner: OTHER_PLAN })]);
		const r = withdraw(p);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(NAME);
		expect(r.stderr).toContain(OTHER_PLAN);
		expect(held(p)).toBe(true);
	});

	it("refuses one that lists an incident: its history is not this command's to remove", () => {
		const p = project([declared({ incidents: [INCIDENT] })], { incident: true });
		const r = withdraw(p);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(INCIDENT);
		expect(held(p)).toBe(true);
	});

	it("refuses one that another promise records replacing, until that one is withdrawn", () => {
		const p = project([declared()]);
		const replacement = "seat-freed-when-hold-expires";
		const replaced = runCli(p.root, [
			"promises",
			"replace",
			NAME,
			"--by",
			replacement,
			"--plan",
			PLAN,
			"--kind",
			"state",
			"--domain",
			"seating",
			"--statement",
			"A held seat is free again when its hold expires.",
		]);
		expect(replaced.code, replaced.stdout + replaced.stderr).toBe(0);

		const r = withdraw(p);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(replacement);
		expect(held(p)).toBe(true);

		expect(withdraw(p, replacement).code).toBe(0);
		expect(withdraw(p).code).toBe(0);
		expect(held(p)).toBe(false);
	});

	it("refuses a promise the registry does not hold, and a plan that is not open, by name", () => {
		const p = project([declared()]);
		const unknown = withdraw(p, "seat-map-never-stale");
		expect(unknown.code, unknown.stdout + unknown.stderr).toBe(2);
		expect(unknown.stderr).toContain("seat-map-never-stale");

		const noPlan = withdraw(p, NAME, "seats-v9");
		expect(noPlan.code, noPlan.stdout + noPlan.stderr).toBe(2);
		expect(noPlan.stderr).toContain("seats-v9");
		expect(held(p)).toBe(true);
	});

	it("the planner's tool removes what the command removes, and a refusal is an error that names the promise", async () => {
		const p = project([
			declared(),
			declared({ name: "seat-count-matches-table", owner: OTHER_PLAN }),
		]);
		const tools = toolCaller((server) => registerPlanTools(server, p.planRoot));

		const refused = await tools.call("withdraw_promise", {
			name: "seat-count-matches-table",
			plan: PLAN,
		});
		expect(refused.isError).toBe(true);
		expect(JSON.stringify(refused.json)).toContain("seat-count-matches-table");

		const done = await tools.call("withdraw_promise", { name: NAME, plan: PLAN });
		expect(done.isError, JSON.stringify(done.json)).toBe(false);
		expect(done.json).toMatchObject({ withdrawn: NAME });
		expect(held(p)).toBe(false);
		expect(held(p, "seat-count-matches-table")).toBe(true);
	});
});

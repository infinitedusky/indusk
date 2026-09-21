import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { type LocalJaeger, newTraceId, startLocalJaeger } from "./helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * day-always-on — A18–A20: the session can ask what the promises are doing
 * (ADR D9).
 *
 * The raising half of "raise a violation": a violation is only raised if the
 * agent answering "what's next" knows about it. A18 and A19 are the tool —
 * what it reports, and that it agrees with the CLI over the same project and
 * window, because two surfaces disagreeing about health is worse than one.
 * A20 is the skill text that makes the session ask at all.
 *
 * Red today: `promise_health` is not a registered tool (the call is refused by
 * name, at the tool boundary — not a load error), and `/catchup` says nothing
 * about promises. Green after Build Phase 5.
 */

const PROMISE = "seat-never-double-booked";
const OTHER = "seat-release-on-timeout";
const OWNER = "seats-v2";

const REPO_ROOT = resolve(__dirname, "../../../..");
const CATCHUP_SKILL = join(REPO_ROOT, ".claude/skills/catchup/SKILL.md");

function health(json: unknown, name: string): Record<string, unknown> {
	const promises = (json as { promises?: Record<string, unknown>[] }).promises ?? [];
	const row = promises.find((p) => p.name === name);
	if (!row) throw new Error(`no health row for ${name} in ${JSON.stringify(json)}`);
	return row;
}

describe.skipIf(SHOULD_SKIP)("day-always-on — promise health for the session", () => {
	let jaeger: LocalJaeger;
	let fixture: PromiseProject;
	let tools: ReturnType<typeof toolCaller>;
	let violated = "";
	let previousHome: string | undefined;

	beforeAll(async () => {
		fixture = promiseProject({
			domains: ["seating"],
			landed: { [OWNER]: daysAgo(30) },
			promises: [
				{
					name: PROMISE,
					kind: "behaviour",
					state: "enforced",
					domain: "seating",
					owner: OWNER,
					sites: [`src/${PROMISE}.ts`],
					tests: [`src/${PROMISE}.test.ts`],
				},
				{
					name: OTHER,
					kind: "behaviour",
					state: "enforced",
					domain: "seating",
					owner: OWNER,
					sites: [`src/${OTHER}.ts`],
					tests: [`src/${OTHER}.test.ts`],
				},
			],
			files: {
				[`src/${PROMISE}.ts`]: siteFile(PROMISE),
				[`src/${PROMISE}.test.ts`]: testFile(PROMISE),
				[`src/${OTHER}.ts`]: siteFile(OTHER),
				[`src/${OTHER}.test.ts`]: testFile(OTHER),
			},
		});
		jaeger = await startLocalJaeger();
		violated = newTraceId();
		await jaeger.load([
			{
				service: "seats-api",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "violated",
				symptom: "seat 4 held by two players",
				traceId: violated,
			},
			{ service: "seats-api", name: "release-seat", promise: OTHER, outcome: "upheld" },
		]);
		previousHome = process.env.INDUSK_HOME;
		process.env.INDUSK_HOME = jaeger.home;
		tools = toolCaller((server) => registerPlanTools(server, fixture.planRoot));
	}, 120_000);

	afterAll(() => {
		if (previousHome === undefined) delete process.env.INDUSK_HOME;
		else process.env.INDUSK_HOME = previousHome;
		jaeger?.stop();
		if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("A18 — reports violations in the window, open incidents, and what is not yet an incident", async () => {
		const { json, isError } = await tools.call("promise_health", {});
		expect(isError, JSON.stringify(json)).toBe(false);

		const violatedRow = health(json, PROMISE);
		expect(violatedRow.violations).toBe(1);
		expect(violatedRow.incidents).toBe(0);
		expect(
			violatedRow.unrecorded,
			"a violation nobody has recorded as an incident is the thing to raise",
		).toBe(1);
		expect(JSON.stringify(violatedRow)).toContain(violated);

		const upheldRow = health(json, OTHER);
		expect(upheldRow.violations).toBe(0);
		expect(upheldRow.unrecorded).toBe(0);
	});

	it("A19 — agrees with the CLI over the same project and window", async () => {
		const { json } = await tools.call("promise_health", {});
		const fromTool = health(json, PROMISE).violations;

		const cli = runCli(fixture.root, ["promises", "status"], { INDUSK_HOME: jaeger.home });
		const text = cli.stdout + cli.stderr;
		expect(cli.code, text).toBe(0);
		const printed = text.match(/(\d+) violations?\b/);
		expect(printed, `the CLI printed no violation count:\n${text}`).not.toBeNull();
		expect(Number(printed?.[1]), "the two surfaces report the same number").toBe(fromTool);
	});

	it("A20 — /catchup asks for promise health, and open violations come before the roadmap", () => {
		const skill = readFileSync(CATCHUP_SKILL, "utf-8");
		expect(skill).toMatch(/promise_health/);
		expect(skill, "the skill says what to do with the answer").toMatch(
			/open violations?[\s\S]{0,200}(before|ahead of)[\s\S]{0,80}(roadmap|plan)/i,
		);
	});
});

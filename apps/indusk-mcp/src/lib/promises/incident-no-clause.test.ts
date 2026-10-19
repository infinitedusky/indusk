import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { implText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "../../__tests__/helpers/promises-fixture.js";
import { recordViolations } from "./incidents.js";
import { readPromises } from "./registry.js";
import type { MarkedSpan } from "./telemetry.js";

// promise: an-incident-names-its-tests

/**
 * A27 of mark-first, a regression guard: a promise written before clauses
 * still opens an incident whose "Proven by" section names the tests that
 * proved it. It passes today and must keep passing once an incident names a
 * clause first.
 */

const PLAN = "seats-v1";
const NAME = "seat-never-double-booked";
const TEST = "src/seat.test.ts";
const SITE = "src/seat.ts";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

describe("A27 — a promise with no clauses opens an incident that names its tests", () => {
	it("lists the row that names the promise, with its test file", () => {
		fixture = promiseProject({
			git: false,
			domains: ["seating"],
			promises: [
				{
					name: NAME,
					kind: "behaviour",
					state: "enforced",
					domain: "seating",
					owner: PLAN,
					sites: [SITE],
					tests: [TEST],
				},
			],
			planFiles: {
				[`archive/${PLAN}/impl.md`]: implText(PLAN, {
					status: "completed",
					keys: ["test_purpose: required"],
					columns: ["For", "Test"],
					rows: [{ state: "passing", cells: { For: `promise: ${NAME}`, Test: TEST } }],
				}),
			},
			files: { [SITE]: siteFile(NAME), [TEST]: testFile(NAME) },
		});
		const read = readPromises(fixture.planRoot);
		if (!read.ok) throw new Error(JSON.stringify(read));
		const promise = read.registry.promises.find((p) => p.name === NAME);
		if (!promise) throw new Error("fixture promise missing");
		const violation: MarkedSpan = {
			promise: NAME,
			outcome: "broken",
			traceId: "0af7651916cd43dd8448eb211c80319c",
			spanId: "aaaaaaaaaaaaaaaa",
			service: "seats-api",
			operation: "hold-seat",
			at: new Date("2026-10-05T12:00:00Z"),
			symptom: "seat 4 held by two players",
			environment: "production",
		};
		const change = recordViolations(read.registry, promise, [violation], "deployed", new Date());
		if (!change) throw new Error("nothing was recorded");
		const text = readFileSync(
			join(fixture.planRoot, ".indusk", "promises", "incidents", `${change.id}.md`),
			"utf-8",
		);
		const section = /## Proven by\n([\s\S]*?)(?=\n## |$)/.exec(text)?.[1] ?? "";
		expect(section).toMatch(new RegExp(`${PLAN}.*\\bT1\\b.*passing`));
		expect(section).toContain(TEST);
	});
});

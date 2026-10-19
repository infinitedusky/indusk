import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type PromiseProject, promiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { clauseStanding } from "./clause-standing.js";
import { recordViolations } from "./incidents.js";
import { readPromises } from "./registry.js";
import type { MarkedSpan } from "./telemetry.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/upheld-by-its-signal

/**
 * A7 of mark-first, the whole story of a break: a clause whose signal reports
 * broken reads broken, and an incident opens naming the clause and its
 * symptom. The reading half passes with Build Phase 3; the incident half
 * passes with Build Phase 5, which teaches the incident writer to name a clause.
 */

const NAME = "seat-never-double-booked";
const CLAUSE = "never-twice";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

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
	clause: CLAUSE,
};

describe("A7 — a broken clause is broken, and its incident names it", () => {
	it("the clause reads broken from the signal that reported it", () => {
		const reports = [{ outcome: violation.outcome, at: violation.at.toISOString() }];
		expect(clauseStanding({ kind: "limit" }, { reports, heartbeatOk: true })).toBe("broken");
	});

	it("the incident it opens names the promise, the clause and the symptom", () => {
		fixture = promiseProject({
			git: false,
			domains: ["seating"],
			promises: [
				{
					name: NAME,
					kind: "behaviour",
					state: "enforced",
					domain: "seating",
					owner: "seats-v1",
					sites: [],
					tests: [],
				},
			],
		});
		const read = readPromises(fixture.planRoot);
		if (!read.ok) throw new Error(JSON.stringify(read));
		const promise = read.registry.promises.find((p) => p.name === NAME);
		if (!promise) throw new Error("fixture promise missing");
		const [change] = recordViolations(read.registry, promise, [violation], "deployed", new Date());
		if (!change) throw new Error("nothing was recorded");
		const text = readFileSync(
			join(fixture.planRoot, ".indusk", "promises", "incidents", `${change.id}.md`),
			"utf-8",
		);
		expect(text).toMatch(new RegExp(`^clause: ${CLAUSE}$`, "m"));
		expect(text).toContain(`${NAME}/${CLAUSE}`);
		expect(text).toContain("seat 4 held by two players");
	});
});

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import {
	clausePlanProject,
	PLAN,
	PROMISE,
	testOf,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { incidentText, recordViolations } from "./incidents.js";
import { readPromises } from "./registry.js";
import { type JaegerSpan, type MarkedSpan, parseMarkedSpan } from "./telemetry.js";

// clause: a-clause-is-proved-twice/a-break-names-its-clause

/**
 * A17 and A18 of mark-first: the incident a broken clause opens names the
 * promise and the clause first and the plan and phase that added the signal
 * second, as a pointer; and from the incident a person reaches the clause's
 * tests and the place that emits its signal, without searching by file name.
 */

const CLAUSE = "a-clause";
const SITE = "src/a.ts";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

const base = {
	id: "i-2026-10-18-a-promise",
	promise: PROMISE,
	source: "deployed" as const,
	opened: "2026-10-18T10:00:00Z",
	lastSeen: "2026-10-18T10:00:00Z",
	evidence: ["traces:", "  - 'aaaa'"],
	symptom: "the seat was held twice",
	environment: "production",
	provenBy: "- none",
};

const violation: MarkedSpan = {
	promise: PROMISE,
	outcome: "broken",
	traceId: "0af7651916cd43dd8448eb211c80319c",
	spanId: "aaaaaaaaaaaaaaaa",
	service: "api",
	operation: "hold-seat",
	at: new Date("2026-10-18T12:00:00Z"),
	symptom: "A is not reached in a second",
	environment: "production",
	clause: CLAUSE,
	signal: { plan: PLAN, phase: "Build Phase 2" },
};

/** The incident a break of the fixture's clause opens, read back from disk. */
function openedIncident(span: MarkedSpan = violation): string {
	fixture = clausePlanProject();
	// The promise's site carries the clause's token: it is where the signal is emitted.
	writeFileSync(
		join(fixture.codeRoot, SITE),
		`// promise: ${PROMISE}\n// clause: ${PROMISE}/${CLAUSE}\nexport const emit = 1;\n`,
	);
	const file = join(fixture.planRoot, ".indusk", "promises", `${PROMISE}.md`);
	const parsed = matter(readFileSync(file, "utf-8"));
	writeFileSync(file, matter.stringify(parsed.content, { ...parsed.data, sites: [SITE] }));
	const read = readPromises(fixture.planRoot);
	if (!read.ok) throw new Error(JSON.stringify(read));
	const promise = read.registry.promises.find((p) => p.name === PROMISE);
	if (!promise) throw new Error("fixture promise missing");
	const change = recordViolations(read.registry, promise, [span], "deployed", new Date());
	if (!change) throw new Error("nothing was recorded");
	return readFileSync(
		join(fixture.planRoot, ".indusk", "promises", "incidents", `${change.id}.md`),
		"utf-8",
	);
}

describe("A17 — the incident names the promise and the clause, the plan and phase second", () => {
	it("names promise/clause first and the pointer after it", () => {
		const text = incidentText({
			...base,
			clause: "reaches-seat",
			pointer: { plan: "p", phase: "Build Phase 2" },
		});
		expect(text).toMatch(/^clause: reaches-seat$/m);
		const named = text.indexOf(`${PROMISE}/reaches-seat`);
		expect(named, "the incident does not name promise/clause").toBeGreaterThan(-1);
		const pointer = text.indexOf("Build Phase 2");
		expect(pointer, "the incident carries no pointer").toBeGreaterThan(-1);
		expect(named).toBeLessThan(pointer);
	});

	it("reads the clause and the pointer from the break's span", () => {
		const span: JaegerSpan = {
			traceID: "0af7651916cd43dd8448eb211c80319c",
			spanID: "aaaaaaaaaaaaaaaa",
			operationName: "hold-seat",
			startTime: 1_000_000,
			duration: 10,
			processID: "p1",
			tags: [
				{ key: "indusk.promise", value: PROMISE },
				{ key: "indusk.promise.outcome", value: "broken" },
				{ key: "indusk.clause", value: CLAUSE },
			],
			logs: [
				{
					timestamp: 1_000_000,
					fields: [
						{ key: "event", value: "indusk.promise.violated" },
						{ key: "indusk.promise.symptom", value: "slow" },
						{ key: "indusk.signal.plan", value: PLAN },
						{ key: "indusk.signal.phase", value: "Build Phase 2" },
					],
				},
			],
		};
		const marked = parseMarkedSpan(span, "api");
		expect(marked?.clause).toBe(CLAUSE);
		expect(marked?.signal).toEqual({ plan: PLAN, phase: "Build Phase 2" });
	});

	it("the incident a clause's break opens carries the clause and the pointer", () => {
		const text = openedIncident();
		expect(text).toMatch(new RegExp(`^clause: ${CLAUSE}$`, "m"));
		expect(text).toContain(`${PROMISE}/${CLAUSE}`);
		expect(text).toContain("Build Phase 2");
	});
});

describe("A33 — a break written by an app's own helper names the plan and phase that added it", () => {
	/**
	 * The app helper (`templates/signal.ts`, `signal.py`) writes
	 * `indusk.signal.plan`/`phase` on the span and only the symptom on the
	 * break event; `markPromise` puts them on the event. Both reach the incident.
	 */
	const helperSpan: JaegerSpan = {
		traceID: "1af7651916cd43dd8448eb211c80319c",
		spanID: "bbbbbbbbbbbbbbbb",
		operationName: "hold-seat",
		startTime: 1_000_000,
		duration: 10,
		processID: "p1",
		tags: [
			{ key: "indusk.promise", value: PROMISE },
			{ key: "indusk.promise.outcome", value: "broken" },
			{ key: "indusk.clause", value: CLAUSE },
			{ key: "indusk.signal.plan", value: PLAN },
			{ key: "indusk.signal.phase", value: "Build Phase 3" },
		],
		logs: [
			{
				timestamp: 1_000_000,
				fields: [
					{ key: "event", value: "indusk.promise.violated" },
					{ key: "indusk.promise.symptom", value: "slow" },
				],
			},
		],
	};

	it("the pointer on the span is read when the break event carries none", () => {
		expect(parseMarkedSpan(helperSpan, "api")?.signal).toEqual({
			plan: PLAN,
			phase: "Build Phase 3",
		});
	});

	it("the incident it opens carries that plan and phase on its Signal line", () => {
		const marked = parseMarkedSpan(helperSpan, "api");
		if (!marked) throw new Error("the helper's span was not read as a signal");
		const text = openedIncident(marked);
		expect(text).toMatch(
			new RegExp(`^Signal: \`${PROMISE}/${CLAUSE}\` — added by plan \`${PLAN}\`, Build Phase 3$`, "m"),
		);
	});
});

describe("A18 — from the incident a person reaches the clause's tests and its signal", () => {
	it("lists the clause's test file and the file that emits its signal under Proven by", () => {
		const text = openedIncident();
		const section = /## Proven by\n([\s\S]*?)(?=\n## |$)/.exec(text)?.[1] ?? "";
		expect(section, "the clause's test file is not reachable").toContain(testOf(CLAUSE));
		expect(section, "the signal's emit place is not reachable").toContain(SITE);
		expect(section, "the row that proves the clause is not named").toMatch(/\bA1\b.*passing/);
	});

	it("does not list another clause's test as this clause's", () => {
		const text = openedIncident();
		const section = /## Proven by\n([\s\S]*?)(?=\n## |$)/.exec(text)?.[1] ?? "";
		expect(section).not.toContain(testOf("b-clause"));
	});
});

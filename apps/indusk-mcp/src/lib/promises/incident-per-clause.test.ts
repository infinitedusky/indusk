import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { promiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { incidentsIn, JAEGER, OWNER, OWNER_IMPL } from "../../__tests__/helpers/record-fixture.js";
import type { IncidentVerdict } from "./incident-signal.js";
import { recordViolations } from "./incidents.js";
import { recordBreaks } from "./record.js";
import { readPromises } from "./registry.js";
import type { MarkedSpan, MarkedSpansResult } from "./telemetry.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/a-break-names-its-clause

/**
 * A32 of mark-first (Build Phase 7, falsification): an incident is keyed by
 * `promise/clause`. When two clauses of one promise break — in one recorder
 * pass or in two — each break is recorded in an incident naming its own
 * clause; a second clause's break never extends the first clause's open
 * incident, and the recorder writes its verdict on each incident it opened.
 */

const NAME = "seat-hold-limits";
const CLAUSES = [
	{ name: "never-twice", kind: "limit", statement: "A seat is never held twice." },
	{ name: "released-in-time", kind: "split", statement: "A hold is released in a minute." },
];

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const c of cleanups.splice(0).reverse()) c();
});

function project() {
	const fx = promiseProject({
		domains: ["seating"],
		archivedPlans: [OWNER],
		planFiles: { [`archive/${OWNER}/impl.md`]: OWNER_IMPL },
		promises: [
			{
				name: NAME,
				kind: "state",
				state: "enforced",
				domain: "seating",
				owner: OWNER,
				raw: matter.stringify(`The ${NAME} holds.\n\n## History\n- 2026-10-18 — declared.\n`, {
					name: NAME,
					kind: "state",
					lifetime: "holds",
					state: "enforced",
					domain: "seating",
					owner: OWNER,
					sites: [],
					tests: [],
					incidents: [],
					clauses: CLAUSES,
				}),
			},
		],
		extraConfig: { promises: { domains: ["seating"], jaeger: JAEGER } },
	});
	cleanups.push(() => rmSync(fx.root, { recursive: true, force: true }));
	return fx;
}

function brokenSpan(clause: string, trace: string, at: string): MarkedSpan {
	return {
		promise: NAME,
		outcome: "broken",
		traceId: trace,
		spanId: "00f067aa0ba902b7",
		service: "seat-holds",
		operation: "hold",
		at: new Date(at),
		symptom: `${clause} broke`,
		environment: "production",
		clause,
	};
}

const A = brokenSpan("never-twice", "a".repeat(32), "2026-10-08T20:00:00Z");
const B = brokenSpan("released-in-time", "b".repeat(32), "2026-10-08T21:00:00Z");

/** Each incident file of the project: its clause and the traces it records. */
function incidents(root: string): { clause: unknown; traces: string[]; text: string }[] {
	return incidentsIn(root).map((file) => {
		const text = readFileSync(join(root, ".indusk", "promises", "incidents", file), "utf-8");
		const data = matter(text).data;
		return { clause: data.clause, traces: (data.traces ?? []).map(String), text };
	});
}

function record(root: string, spans: MarkedSpan[]): void {
	const read = readPromises(root);
	if (!read.ok) throw new Error(JSON.stringify(read));
	const promise = read.registry.promises.find((p) => p.name === NAME);
	if (!promise) throw new Error("fixture promise missing");
	recordViolations(read.registry, promise, spans, "deployed", new Date("2026-10-09T00:00:00Z"));
}

describe("A32 — each clause's break is recorded in an incident naming its own clause", () => {
	it("two clauses breaking in one pass open two incidents, one per clause", () => {
		const fx = project();
		record(fx.root, [A, B]);
		const found = incidents(fx.root);
		expect(found.map((i) => i.clause).sort()).toEqual(["never-twice", "released-in-time"]);
		const a = found.find((i) => i.clause === "never-twice");
		expect(a?.traces).toEqual([A.traceId]);
		expect(a?.text).toContain(`${NAME}/never-twice`);
		const b = found.find((i) => i.clause === "released-in-time");
		expect(b?.traces).toEqual([B.traceId]);
		expect(b?.text).toContain(`${NAME}/released-in-time`);
	});

	it("a second clause breaking while the first's incident is open opens its own, never extending the first", () => {
		const fx = project();
		record(fx.root, [A]);
		record(fx.root, [B]);
		const found = incidents(fx.root);
		expect(found).toHaveLength(2);
		const a = found.find((i) => i.clause === "never-twice");
		expect(a?.traces, "the first clause's incident took the second clause's break").toEqual([
			A.traceId,
		]);
		expect(found.find((i) => i.clause === "released-in-time")?.traces).toEqual([B.traceId]);
		// The promise lists both incidents.
		const promise = readPromises(fx.root);
		if (!promise.ok) throw new Error("registry unreadable");
		const entry = promise.registry.promises.find((p) => p.name === NAME);
		expect(entry?.incidents).toHaveLength(2);
	});

	it("the same clause breaking again extends its own open incident", () => {
		const fx = project();
		record(fx.root, [A]);
		const again = { ...A, traceId: "c".repeat(32), at: new Date("2026-10-08T22:00:00Z") };
		record(fx.root, [again]);
		const found = incidents(fx.root);
		expect(found).toHaveLength(1);
		expect(found[0]?.traces).toEqual([A.traceId, again.traceId]);
	});

	it("the recorder writes its verdict on each incident it opens, in one pass or in two", async () => {
		const fx = project();
		const home = mkdtempSync(join(tmpdir(), "incident-per-clause-home-"));
		cleanups.push(() => rmSync(home, { recursive: true, force: true }));
		const reads = (spans: MarkedSpan[]) => async (): Promise<MarkedSpansResult> => ({
			queryUrl: JAEGER.url,
			since: new Date("2026-10-01T00:00:00Z"),
			byPromise: new Map([[NAME, { violations: spans, truncated: false, lastUpheld: null }]]),
		});
		const verdicts: IncidentVerdict[] = [];
		const deps = {
			mark: () => {},
			home,
			markIncident: async (v: IncidentVerdict) => {
				verdicts.push(v);
			},
		};
		await recordBreaks(
			fx.root,
			{ by: "admin", source: "deployed" },
			{ ...deps, reads: reads([A]) },
		);
		await recordBreaks(
			fx.root,
			{ by: "admin", source: "deployed" },
			{ ...deps, reads: reads([B, A]) },
		);
		expect(verdicts, "one upheld verdict per incident opened, each naming its clause").toEqual([
			{ outcome: "upheld" },
			{ outcome: "upheld" },
		]);
		expect(
			incidents(fx.root)
				.map((i) => i.clause)
				.sort(),
		).toEqual(["never-twice", "released-in-time"]);
	});
});

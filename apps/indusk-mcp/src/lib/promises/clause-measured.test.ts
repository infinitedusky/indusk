import { rmSync } from "node:fs";
import matter from "gray-matter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeJaegerFetch, type HeldSpan } from "../../__tests__/helpers/fake-jaeger.js";
import { promiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { clauseStanding } from "./clause-standing.js";
import { localSignalReader } from "./closing-inputs.js";
import { readPromises } from "./registry.js";
import { readStanding } from "./standing.js";
import { jaegerEndpoint, markedSpans } from "./telemetry.js";

// promise: a-clause-is-proved-twice
// clause: a-clause-is-proved-twice/upheld-by-its-signal

/**
 * A34 of mark-first (Build Phase 7, falsification): a span reported `upheld`
 * whose measured `indusk.signal.value` is over its `indusk.signal.bound` reads
 * broken for a limit clause — through the real readers (`parseMarkedSpan`, then
 * `localSignalReader` for closing and `readStanding` for the status and the
 * admin), not only when `clauseStanding` is handed the numbers itself. The app
 * helper's documented `signal.upheld({ …, value: 1200, bound: 1000 })` is
 * exactly this span.
 */

const NAME = "hold-latency";
const CLAUSE = "under-a-second";
const QUERY = "http://jaeger.test";
const CREDENTIAL_ENV = "CLAUSE_MEASURED_JAEGER";

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const c of cleanups.splice(0).reverse()) c();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

function project() {
	const fx = promiseProject({
		domains: ["seating"],
		activePlans: ["owner-plan"],
		promises: [
			{
				name: NAME,
				kind: "state",
				state: "enforced",
				domain: "seating",
				owner: "owner-plan",
				raw: matter.stringify(`The ${NAME} holds.\n\n## History\n- 2026-10-18 — declared.\n`, {
					name: NAME,
					kind: "state",
					lifetime: "holds",
					state: "enforced",
					domain: "seating",
					owner: "owner-plan",
					sites: [],
					tests: [],
					incidents: [],
					clauses: [{ name: CLAUSE, kind: "limit", statement: "A hold answers in a second." }],
				}),
			},
		],
		extraConfig: {
			promises: {
				domains: ["seating"],
				jaeger: { url: QUERY, credential_env: CREDENTIAL_ENV },
			},
		},
	});
	cleanups.push(() => rmSync(fx.root, { recursive: true, force: true }));
	return fx;
}

/** An upheld report of the clause carrying a measurement; Jaeger answers numeric tags as numbers. */
function measured(spanId: string, value: unknown, bound: unknown): HeldSpan {
	return {
		service: "seat-holds",
		name: "hold",
		spanId,
		tags: {
			"indusk.promise": NAME,
			"indusk.promise.outcome": "upheld",
			"indusk.clause": CLAUSE,
			"indusk.signal.value": value,
			"indusk.signal.bound": bound,
		} as unknown as Record<string, string>,
	};
}

describe("A34 — a measurement over its bound breaks a limit clause through the real readers", () => {
	it("closing's reader hands the measurement on, so the clause reads broken", async () => {
		const fx = project();
		vi.stubGlobal("fetch", fakeJaegerFetch([measured("s1", 1200, 1000)]));
		const read = readPromises(fx.root);
		if (!read.ok) throw new Error(JSON.stringify(read));
		const promise = read.registry.promises.find((p) => p.name === NAME);
		if (!promise) throw new Error("fixture promise missing");
		// The daemon's read, against the fake Jaeger: the real span parser runs.
		const reads = async () =>
			markedSpans({
				promises: [NAME],
				since: new Date(Date.now() - 3_600_000),
				endpoint: jaegerEndpoint(QUERY),
			});
		const reports = await localSignalReader(fx.root, reads)(promise);
		expect(reports).toMatchObject({ ok: true });
		if (!reports.ok) return;
		const clause = promise.clauses?.find((c) => c.name === CLAUSE);
		if (!clause) throw new Error("fixture clause missing");
		expect(
			clauseStanding(clause, {
				reports: reports.byClause[CLAUSE] ?? [],
				heartbeatOk: reports.heartbeatOk,
			}),
			"an upheld report measured over its bound read as holding",
		).toBe("broken");
	});

	it("the standing every page reads gives the clause broken, and the promise broken", async () => {
		const fx = project();
		vi.stubEnv(CREDENTIAL_ENV, "user:secret");
		vi.stubGlobal("fetch", fakeJaegerFetch([measured("s1", 1200, 1000)]));
		const rows = await readStanding(fx.root, { health: [], heard: [] });
		const row = rows.find((r) => r.entry.name === NAME);
		expect(row?.clauses?.find((c) => c.clause === CLAUSE)?.standing).toBe("broken");
		expect(row?.signal).toBe("broken");
	});

	it("a measurement inside its bound holds, and one that is not a number is not a measurement", async () => {
		const fx = project();
		vi.stubEnv(CREDENTIAL_ENV, "user:secret");
		vi.stubGlobal(
			"fetch",
			fakeJaegerFetch([measured("s1", 800, 1000), measured("s2", "1200", "1000")]),
		);
		const rows = await readStanding(fx.root, { health: [], heard: [] });
		const row = rows.find((r) => r.entry.name === NAME);
		expect(row?.clauses?.find((c) => c.clause === CLAUSE)?.standing).toBe("holding");
	});
});

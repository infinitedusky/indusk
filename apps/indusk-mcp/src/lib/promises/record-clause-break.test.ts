import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { incidentsIn, JAEGER, OWNER, OWNER_IMPL } from "../../__tests__/helpers/record-fixture.js";
import { recordBreaks } from "./record.js";
import type { MarkedSpansResult } from "./telemetry.js";

// promise: a-production-break-is-recorded-unasked
// clause: a-clause-is-proved-twice/a-break-names-its-clause

/**
 * The recorder reads a clause's break the way it reads a behaviour promise's:
 * a promise of any kind with a clause a signal can report is read, and the
 * incident it opens names the clause and the plan and phase that added the
 * signal (mark-first, Build Phase 5).
 */

const NAME = "seat-hold-limits";
let home: string;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "record-clause-home-"));
	cleanups.push(() => rmSync(home, { recursive: true, force: true }));
});
afterEach(() => {
	for (const c of cleanups.splice(0).reverse()) c();
});

describe("the recorder opens an incident from a clause's break", () => {
	it("a state promise with a limit clause: the incident names the clause and the pointer", async () => {
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
						clauses: [{ name: "never-twice", kind: "limit", statement: "Never held twice." }],
					}),
				},
			],
			extraConfig: { promises: { domains: ["seating"], jaeger: JAEGER } },
		});
		cleanups.push(() => rmSync(fx.root, { recursive: true, force: true }));
		const reads = async (): Promise<MarkedSpansResult> => ({
			queryUrl: JAEGER.url,
			since: new Date("2026-10-01T00:00:00Z"),
			byPromise: new Map([
				[
					NAME,
					{
						violations: [
							{
								promise: NAME,
								outcome: "broken" as const,
								traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
								spanId: "00f067aa0ba902b7",
								service: "seat-holds",
								operation: "hold",
								at: new Date("2026-10-08T20:00:00Z"),
								symptom: "seat 4 held twice",
								environment: "production",
								clause: "never-twice",
								signal: { plan: "seat-holds", phase: "Build Phase 1" },
							},
						],
						truncated: false,
						lastUpheld: null,
					},
				],
			]),
		});
		const result = await recordBreaks(
			fx.root,
			{ by: "admin", source: "deployed" },
			{ reads, mark: () => {}, home },
		);
		expect(result.opened).toEqual([expect.objectContaining({ promise: NAME })]);
		const [file] = incidentsIn(fx.root);
		const text = readFileSync(join(fx.root, ".indusk", "promises", "incidents", file), "utf-8");
		expect(text).toMatch(/^clause: never-twice$/m);
		expect(text).toContain(`${NAME}/never-twice`);
		expect(text).toContain("Build Phase 1");
	});
});

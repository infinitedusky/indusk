import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { reportRows, type SourceHealthRead } from "../lib/promises/health.js";
import { proofOf } from "../lib/promises/proof.js";
import { readPromises } from "../lib/promises/registry.js";
import { readStanding } from "../lib/promises/standing.js";
import type { MarkedSpan, MarkedSpansResult } from "../lib/promises/telemetry.js";
import { behaviourPromise, codeFilesFor, promiseProject } from "./helpers/promises-fixture.js";

// promise: the-editor-shows-the-same-health-as-the-admin

/**
 * cockpit-audit-fixes A10: for one project, what `indusk promises status`
 * reports (`reportRows`, the CLI's per-source state), what the dashboard reads
 * (`readStanding`) and what a promise's page reads (`proofOf`) are one state
 * per promise and source. plan-cockpit's A33 held two of the three; this
 * holds all of them over one fixture, two sources, a red and a green.
 */

const NOW = Date.UTC(2026, 9, 10, 12, 0);
const at = (min: number) => new Date(Date.UTC(2026, 9, 8, 12, min));
const span = (promise: string, outcome: "upheld" | "violated", min: number, id: string) =>
	({
		promise,
		outcome,
		traceId: id,
		spanId: `s-${id}`,
		service: "seat-holds",
		operation: "hold",
		at: at(min),
		symptom: outcome === "violated" ? "held twice" : null,
		environment: "production",
	}) as MarkedSpan;

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("A10 — one state per promise and source on all three surfaces", () => {
	it("the CLI's rows, the dashboard's standing and the page's proof agree", async () => {
		const p = promiseProject({
			promises: [
				behaviourPromise("seats-held", { owner: "demo", domain: "demo" }),
				behaviourPromise("seats-released", { owner: "demo", domain: "demo" }),
			],
			domains: ["demo"],
			files: codeFilesFor("seats-held", "seats-released"),
		});
		roots.push(p.root);
		const read = readPromises(p.planRoot);
		if (!read.ok) throw new Error("fixture registry did not read");
		const marks: MarkedSpansResult = {
			queryUrl: "https://example.fly.dev:16687",
			since: at(0),
			byPromise: new Map([
				[
					"seats-held",
					{
						violations: [span("seats-held", "violated", 20, "t1")],
						truncated: false,
						lastUpheld: span("seats-held", "upheld", 10, "u1"),
					},
				],
				[
					"seats-released",
					{
						violations: [],
						truncated: false,
						lastUpheld: span("seats-released", "upheld", 15, "u2"),
					},
				],
			]),
		};
		const reads: SourceHealthRead[] = (["local", "production"] as const).map((name) => ({
			name,
			label: name,
			ok: true as const,
			at: at(30).toISOString(),
			marks,
		}));
		const standing = await readStanding(p.planRoot, {
			health: reads,
			now: () => NOW,
			resolve: async () => [],
		});
		for (const name of ["seats-held", "seats-released"]) {
			const proof = await proofOf(p.planRoot, name, {
				health: reads,
				now: () => NOW,
				marks: async () => [],
			});
			const row = standing.find((s) => s.entry.name === name);
			for (const r of reads) {
				const cli = reportRows(read.registry, r.marks, at(30)).find((x) => x.name === name)?.health;
				expect(row?.health[r.name], `${name} on ${r.name}: dashboard vs CLI`).toBe(cli);
				expect(proof?.standing.health[r.name], `${name} on ${r.name}: page vs CLI`).toBe(cli);
			}
		}
	});
});

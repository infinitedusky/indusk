import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { promisesHealth } from "../bin/commands/promises.js";
import type { SourceHealthRead } from "../lib/promises/health.js";
import type { MarkedSpan } from "../lib/promises/telemetry.js";
import {
	behaviourPromise,
	openIncidentSpec,
	promiseProject,
	writeIncident,
	writePromise,
} from "./helpers/promises-fixture.js";

/**
 * vscode-extension A17: `indusk promises health --every` reads the registry
 * before each line, so a break recorded and then marked fixed while the editor
 * is open reads `fixed`, and a promise declared meanwhile appears. Reads and
 * the schedule are inputs: nothing is fetched and nothing waits.
 *
 * promise: a-break-reaches-the-editor
 */

const at = new Date(Date.UTC(2026, 9, 8, 12, 30));
const violation = {
	promise: "seats-held",
	outcome: "violated",
	traceId: "t-held",
	spanId: "s-held",
	service: "seat-holds",
	operation: "release",
	at: new Date(Date.UTC(2026, 9, 8, 12, 20)),
	symptom: "seat 4 released late",
	environment: "production",
} as MarkedSpan;

const reads = async (): Promise<SourceHealthRead[]> => [
	{
		name: "production",
		label: "https://x.fly.dev:16687",
		ok: true,
		at: at.toISOString(),
		marks: {
			queryUrl: "https://x.fly.dev:16687",
			since: new Date(Date.UTC(2026, 9, 1)),
			byPromise: new Map([
				["seats-held", { violations: [violation], truncated: false, lastUpheld: null }],
			]),
		},
	} as SourceHealthRead,
];

describe("A17 — promises health --every reads the registry on every line", () => {
	it("a break marked fixed meanwhile reads fixed, and a promise declared meanwhile appears", async () => {
		const p = promiseProject({
			promises: [behaviourPromise("seats-held", { owner: "demo", domain: "demo" })],
			domains: ["demo"],
			incidents: [
				openIncidentSpec("i-2026-10-08-seats-held", "seats-held", { traces: ["t-held"] }),
			],
		});
		const registry = join(p.planRoot, ".indusk", "promises");
		const lines: {
			promises: { name: string }[];
			sources: { rows: { promise: string; state: string }[] }[];
		}[] = [];
		await promisesHealth(
			p.planRoot,
			{ json: true, every: "5" },
			{
				readHealth: reads,
				now: () => at,
				write: (text) => lines.push(JSON.parse(text)),
				repeat: async (_everyMs, tick) => {
					writeIncident(
						join(registry, "incidents"),
						openIncidentSpec("i-2026-10-08-seats-held", "seats-held", {
							traces: ["t-held"],
							status: "fixed",
							fixed: "2026-10-08T12:25:00Z",
						}),
					);
					writePromise(
						registry,
						behaviourPromise("seats-booked", { owner: "demo", domain: "demo" }),
					);
					await tick();
				},
			},
		);
		const state = (i: number) =>
			lines[i]?.sources[0]?.rows.find((r) => r.promise === "seats-held")?.state;
		expect(state(0), "the open break, first line").toBe("red");
		expect(state(1), "the same break after it was marked fixed").toBe("fixed");
		expect(lines[1]?.promises.map((x) => x.name)).toContain("seats-booked");
	});
});

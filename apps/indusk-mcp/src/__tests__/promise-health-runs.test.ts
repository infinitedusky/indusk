import { describe, expect, it } from "vitest";
import { type HealthDeps, healthLine, readHealth } from "../lib/promises/health.js";
import { readPromises } from "../lib/promises/registry.js";
import type { MarkSource, ProbedSource, ResolvedSource } from "../lib/promises/sources.js";
import type { TimelineRead } from "../lib/promises/timeline.js";
import { behaviourPromise, promiseProject } from "./helpers/promises-fixture.js";

/**
 * vscode-extension A26: each health line names the newest recorded runs, from
 * the same store read the state comes from. Sources are fakes; nothing is
 * fetched and nothing waits.
 *
 * promise: the-editor-shows-each-run-as-it-happens
 * promise: every-promise-is-listed-in-the-editor
 */

const NOW = Date.UTC(2026, 9, 8, 12, 30);
const iso = (min: number, s = 0) => new Date(Date.UTC(2026, 9, 8, 12, min, s)).toISOString();

function deps(): HealthDeps {
	const source = (name: "local" | "production"): MarkSource => ({
		name,
		endpoint: {} as MarkSource["endpoint"],
		label: `http://${name}.test:16686`,
		remote: name === "production",
		intakeUrl: `http://${name}.test:4318`,
	});
	const marks: Record<string, { at: string; outcome: "upheld" | "violated"; traceId: string }[]> = {
		local: [
			{ at: iso(10), outcome: "upheld", traceId: "l-1" },
			{ at: iso(20), outcome: "violated", traceId: "l-2" },
		],
		production: [{ at: iso(15), outcome: "upheld", traceId: "p-1" }],
	};
	return {
		now: () => NOW,
		cacheMs: 0,
		probe: async (): Promise<ProbedSource[]> => [
			{ name: "production", label: "http://production.test:16686", ok: true },
			{ name: "local", label: "http://local.test:16686", ok: true },
		],
		resolve: async (): Promise<ResolvedSource[]> => [
			{ name: "production", ok: true, source: source("production") },
			{ name: "local", ok: true, source: source("local") },
		],
		read: async (_root, _reg, o): Promise<TimelineRead[]> => {
			const name = o.source ?? "production";
			return [
				{
					name,
					label: `http://${name}.test:16686`,
					ok: true,
					from: o.from.toISOString(),
					to: o.to.toISOString(),
					byPromise: new Map([
						[
							"seats-held",
							{
								marks: (marks[name] ?? []).map((m) => ({ ...m, environment: null })),
								atLeast: [],
							},
						],
					]),
				},
			];
		},
	};
}

describe("A26 — the health line names the newest runs", () => {
	it("every source's runs, newest first, each with its outcome, source, time and trace", async () => {
		const p = promiseProject({
			promises: [behaviourPromise("seats-held", { owner: "demo", domain: "demo" })],
			domains: ["demo"],
			extraConfig: {
				promises: { domains: ["demo"], jaeger: { url: "http://production.test:16686" } },
			},
		});
		const read = readPromises(p.planRoot);
		if (!read.ok) throw new Error("fixture registry did not read");
		const reads = await readHealth(p.planRoot, read.registry, deps());
		const line = healthLine(read.registry, reads, new Date(NOW)) as unknown as {
			runs?: { promise: string; source: string; outcome: string; at: string; traceId: string }[];
		};
		expect(line.runs).toEqual([
			{ promise: "seats-held", source: "local", outcome: "violated", at: iso(20), traceId: "l-2" },
			{
				promise: "seats-held",
				source: "production",
				outcome: "upheld",
				at: iso(15),
				traceId: "p-1",
			},
			{ promise: "seats-held", source: "local", outcome: "upheld", at: iso(10), traceId: "l-1" },
		]);
	});

	it("A30 — each promise on the line names the plan that owns it", () => {
		const p = promiseProject({
			promises: [behaviourPromise("seats-held", { owner: "demo", domain: "demo" })],
			domains: ["demo"],
		});
		const read = readPromises(p.planRoot);
		if (!read.ok) throw new Error("fixture registry did not read");
		const line = healthLine(read.registry, [], new Date(NOW)) as unknown as {
			promises: { name: string; plan?: string }[];
		};
		expect(line.promises).toEqual([expect.objectContaining({ name: "seats-held", plan: "demo" })]);
	});
});

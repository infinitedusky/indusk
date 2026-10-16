import { describe, expect, it } from "vitest";
import type { PlanDates } from "../lib/promises/display.js";
import { type HealthDeps, healthLine, readHealth } from "../lib/promises/health.js";
import { readPromises } from "../lib/promises/registry.js";
import type { MarkSource, ProbedSource, ResolvedSource } from "../lib/promises/sources.js";
import type { TimelineRead } from "../lib/promises/timeline.js";
import { behaviourPromise, promiseProject } from "./helpers/promises-fixture.js";

/**
 * display-names A7: each health line names each promise's words, its plan's
 * title and its plan's dates, so the editor names plans without reading plan
 * files.
 *
 * promise: a-plan-reads-by-its-title
 * promise: a-plan-shows-when-it-shipped
 */

describe("A7 — the health line carries the names", () => {
	it("each promise has title, planTitle and planDates", () => {
		const p = promiseProject({
			promises: [
				behaviourPromise("a-fly-deploy-is-one-command", { owner: "demo", domain: "demo" }),
			],
			domains: ["demo"],
		});
		const read = readPromises(p.planRoot);
		if (!read.ok) throw new Error("fixture registry did not read");
		const dates: PlanDates = {
			started: "2026-10-08",
			landed: "2026-10-09",
			released: { version: "1.68.0", date: "2026-10-09" },
		};
		const line = healthLine(read.registry, [], new Date(0), {
			planTitles: { demo: "The demo" },
			planDates: { demo: dates },
			words: {},
		});
		expect(line.promises).toEqual([
			expect.objectContaining({
				name: "a-fly-deploy-is-one-command",
				title: "A Fly deploy is one command",
				planTitle: "The demo",
				planDates: dates,
			}),
		]);
	});
});

/**
 * plan-stories A10: a promise whose plan the checkout cannot read is grouped under
 * its plan's handle in words, never the bare handle.
 *
 * promise: a-plan-reads-by-its-title
 */
describe("A10 — a plan the checkout cannot read reads as its handle in words", () => {
	it("a promise owned by a plan with no planTitles entry carries the handle in words", () => {
		const p = promiseProject({
			promises: [
				behaviourPromise("a-fly-deploy-is-one-command", { owner: "gone-plan", domain: "demo" }),
			],
			domains: ["demo"],
		});
		const read = readPromises(p.planRoot);
		if (!read.ok) throw new Error("fixture registry did not read");
		const line = healthLine(read.registry, [], new Date(0), {
			planTitles: {},
			planDates: {},
			words: {},
		});
		expect(line.promises[0]?.planTitle).toBe("Gone plan");
	});
});

/**
 * A3 of panel-last-broke-time: a row for a promise with violations carries the
 * newest violation's time, apart from the newest run's. Sources are fakes.
 *
 * promise: a-broken-promise-says-when-it-last-broke
 */
const NOW = Date.UTC(2026, 9, 10, 22, 0);
const at = (day: number, hour: number) => new Date(Date.UTC(2026, 9, day, hour, 0)).toISOString();

function lastBrokeDeps(): HealthDeps {
	const source: MarkSource = {
		name: "local",
		endpoint: {} as MarkSource["endpoint"],
		label: "http://local.test:16686",
		remote: false,
		intakeUrl: "http://local.test:4318",
	};
	return {
		now: () => NOW,
		cacheMs: 0,
		probe: async (): Promise<ProbedSource[]> => [
			{ name: "local", label: "http://local.test:16686", ok: true },
		],
		resolve: async (): Promise<ResolvedSource[]> => [{ name: "local", ok: true, source }],
		read: async (_root, _reg, o): Promise<TimelineRead[]> => [
			{
				name: "local",
				label: "http://local.test:16686",
				ok: true,
				from: o.from.toISOString(),
				to: o.to.toISOString(),
				byPromise: new Map([
					[
						"seats-held",
						{
							marks: [
								{ at: at(9, 17), outcome: "broken", traceId: "v-old", environment: null },
								{ at: at(10, 21), outcome: "upheld", traceId: "u-new", environment: null },
							],
							atLeast: [],
						},
					],
				]),
			},
		],
	};
}

describe("A3 — the health line carries the newest violation's time", () => {
	it("a row with violations has lastBroke, beside lastSeen, which stays the newest run", async () => {
		const p = promiseProject({
			promises: [behaviourPromise("seats-held", { owner: "demo", domain: "demo" })],
			domains: ["demo"],
		});
		const read = readPromises(p.planRoot);
		if (!read.ok) throw new Error("fixture registry did not read");
		const reads = await readHealth(p.planRoot, read.registry, lastBrokeDeps());
		const line = healthLine(read.registry, reads, new Date(NOW)) as unknown as {
			sources: { ok: boolean; rows?: { lastSeen: string; lastBroke?: string }[] }[];
		};
		const row = line.sources[0]?.rows?.[0];
		expect(row?.lastSeen).toBe(at(10, 21));
		expect(row?.lastBroke).toBe(at(9, 17));
	});
});

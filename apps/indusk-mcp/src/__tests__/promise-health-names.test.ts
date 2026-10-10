import { describe, expect, it } from "vitest";
import type { PlanDates } from "../lib/promises/display.js";
import { healthLine } from "../lib/promises/health.js";
import { readPromises } from "../lib/promises/registry.js";
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

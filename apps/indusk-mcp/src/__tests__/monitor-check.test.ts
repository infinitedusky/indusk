import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { type PromiseProject, promiseProject, siteFile } from "./helpers/promises-fixture.js";

/**
 * day-monitor — A6: a test that asserts a promise through the trace-shape
 * helper is that promise's test link, with no other citation.
 *
 * The helper's calling convention puts the promise token directly inside a
 * quoted argument — `"promise: <name>"` — which `promises check` already
 * counts (day-promises: a token counts directly inside a quote). The check
 * reads text, so the helper need not exist for this to be authored; the row
 * pins that the convention stays inside the rule. A regression guard: it
 * passes when written.
 */

const NAME = "seat-never-double-booked";

const HELPER_TEST = `import { captureSpans, expectPromiseUpheld } from "@infinitedusky/indusk-mcp/testing/trace-shape";
import { it } from "vitest";
import { holdSeat } from "./seats";

it("holding a seat upholds its promise", async () => {
	const spans = await captureSpans(() => holdSeat(4));
	expectPromiseUpheld(spans, "promise: ${NAME}", { parent: "handle-request" });
});
`;

describe.skipIf(SHOULD_SKIP)("day-monitor — A6", () => {
	let project: PromiseProject;

	beforeAll(() => {
		project = promiseProject({
			domains: ["seating"],
			archivedPlans: ["lab-v0"],
			promises: [
				{
					name: NAME,
					kind: "behaviour",
					state: "enforced",
					domain: "seating",
					owner: "lab-v0",
					sites: ["src/seats.ts"],
					tests: ["src/seats.test.ts"],
				},
			],
			files: {
				"src/seats.ts": siteFile(NAME),
				"src/seats.test.ts": HELPER_TEST,
			},
		});
	});

	afterAll(() => {
		if (project) rmSync(project.root, { recursive: true, force: true });
	});

	it("A6 — `promises check` accepts the helper call as the promise's test link", () => {
		const r = runCli(project.root, ["promises", "check"]);
		expect(r.stderr + r.stdout).not.toMatch(/refus/i);
		expect(r.code).toBe(0);
	});
});

import { describe, expect, it } from "vitest";
import { line, site } from "./fixture.js";
import { hover } from "./hover.js";
import { markers } from "./markers.js";

/**
 * vscode-extension A1–A4: every line that carries a promise's token shows the
 * promise's name and its state.
 *
 * promise: a-promise-shows-where-it-is-kept
 */

const view = (o = {}) => ({ line: line(o), notReading: false });
const code = site("seats-held", 'span.setAttribute("indusk.promise", "seats-held"); ');

describe("markers", () => {
	it("A1 — a line keeping a promise shows its name and state, production first", () => {
		expect(
			markers({ path: "src/telemetry.ts", text: code }, view({ productionState: "red" })),
		).toEqual([
			{ line: 0, promise: "seats-held", text: "seats-held · broken (production)", tone: "broken" },
		]);
		expect(markers({ path: "src/telemetry.ts", text: code }, view())[0]?.text).toBe(
			"seats-held · holding",
		);
		expect(markers({ path: "src/page.ts", text: site("page-answers") }, view())[0]?.text).toBe(
			"page-answers · watched by the tests",
		);
	});

	it("A2 — a token for a promise the project does not have says so", () => {
		expect(markers({ path: "src/x.ts", text: `\n${site("no-such-promise")}` }, view())).toEqual([
			{
				line: 1,
				promise: "no-such-promise",
				text: "no-such-promise · not in this project",
				tone: "unknown",
			},
		]);
	});

	it("A3 — a test's token says the test proves the promise", () => {
		expect(
			markers({ path: "src/seats.test.ts", text: site("seats-held") }, view())[0],
		).toMatchObject({
			text: "seats-held · proved here",
			tone: "proves",
		});
	});

	it("A4 — the hover gives the sentence, each source's state and when it last broke", () => {
		const h = hover("seats-held", view({ productionState: "red" }));
		expect(h).toContain("A seat is never held by two players at once.");
		expect(h).toMatch(/production: broken/);
		expect(h).toMatch(/local: holding/);
		expect(h).toContain("2026-10-08 12:20");
	});

	it("A22 — a file outside the project, or inside a nested InDusk project, gets no marker from this one", () => {
		const scope = { nested: ["examples/seat-holds"] };
		const call = markers as unknown as (f: unknown, v: unknown, s: unknown) => unknown[];
		expect(call({ path: "../other/src/x.ts", text: code }, view(), scope)).toEqual([]);
		expect(
			call({ path: "examples/seat-holds/src/telemetry.ts", text: code }, view(), scope),
		).toEqual([]);
		expect(call({ path: "src/telemetry.ts", text: code }, view(), scope)).toHaveLength(1);
	});
});

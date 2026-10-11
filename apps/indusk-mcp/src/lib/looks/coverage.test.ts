import { describe, expect, it } from "vitest";
import { componentsIn } from "./coverage.js";

/**
 * promise: every-part-of-the-ui-is-covered — ui-promises A12's reading of a
 * rendered component. The rows themselves (A10–A12) run `indusk looks coverage`
 * over the fixture in `__tests__/looks-cli.test.ts`; this pins the spellings of
 * the attribute the coverage counts, so a JSX expression is not read as nothing.
 */

describe("componentsIn — the data-component names in markup", () => {
	it("reads the HTML and JSX spellings", () => {
		const text = [
			'<main data-component="card">',
			"<span data-component='badge'>",
			'<Row data-component={"row"} />',
			"<Cell data-component={`cell`} />",
		].join("\n");
		expect([...componentsIn(text)].sort()).toEqual(["badge", "card", "cell", "row"]);
	});

	it("does not read a computed name or another attribute", () => {
		expect([...componentsIn('<b data-component={name} data-componentx="x" />')]).toEqual([]);
	});
});

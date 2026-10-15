import { afterEach, describe, expect, it } from "vitest";
import { componentFindings } from "../lib/looks/lint-components.js";
import { readApp } from "../lib/looks/mockups.js";
import { contentApp } from "./helpers/component-content-app.js";
import { removeApps } from "./helpers/looks-cli.js";

/**
 * promise: placed-content-is-only-words-and-components — component-content
 * Test Phase 1, A6–A8: what a mockup may put inside a placed component.
 */

afterEach(removeApps);

const page = (body: string) => `<!doctype html>\n<html><body>\n${body}\n</body></html>\n`;

async function findingsFor(mockups: Record<string, string>, rule: string) {
	const root = contentApp(mockups);
	const app = await readApp(root, "demo");
	return (await componentFindings(root, app)).filter((f) => f.rule === rule);
}

describe("placed content is only words and components", () => {
	// A6
	it("A6 refuses an element inside a placed component, naming file, line and element", async () => {
		const found = await findingsFor(
			{
				"home.words": page(
					'<indusk-component name="button" state="default">\n<div>Create</div>\n</indusk-component>',
				),
			},
			"content-not-words-or-components",
		);
		expect(found).toHaveLength(1);
		expect(found[0]).toMatchObject({
			file: expect.stringContaining("home.words.html"),
			line: 4,
			value: "div",
		});
	});

	// A7
	it("A7 refuses content for a property the state does not take, naming the component and the property", async () => {
		const found = await findingsFor(
			{
				"home.words": page(
					'<indusk-component name="button" state="default"><indusk-content for="label">Go</indusk-content></indusk-component>',
				),
			},
			"component-takes-no-content",
		);
		expect(found).toHaveLength(1);
		expect(found[0]?.message).toContain("button");
		expect(found[0]?.message).toContain("label");
	});

	// A8
	it("A8 accepts text and placed components inside a placed component", async () => {
		const root = contentApp({
			"home.words": page(
				'<indusk-component name="button" state="default">Create project</indusk-component>\n<indusk-component name="box" state="default"><indusk-component name="button" state="default">Go</indusk-component></indusk-component>',
			),
		});
		const app = await readApp(root, "demo");
		const found = (await componentFindings(root, app)).filter(
			(f) =>
				f.rule === "content-not-words-or-components" || f.rule === "component-takes-no-content",
		);
		expect(found).toEqual([]);
	});
});

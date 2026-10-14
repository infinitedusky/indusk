import { afterEach, describe, expect, it } from "vitest";
import { compose } from "../lib/looks/compose.js";
import { componentFindings } from "../lib/looks/lint-components.js";
import { readApp } from "../lib/looks/mockups.js";
import { contentApp } from "./helpers/component-content-app.js";
import { removeApps } from "./helpers/looks-cli.js";

/**
 * Component-content Build Phase 4, the falsification: places recorded from
 * one render and filled in another (A12, A13, A15, A16, A17).
 *
 * promise: a-placed-component-shows-its-content
 * promise: placed-content-is-only-words-and-components
 */

afterEach(removeApps);

const page = (body: string) => `<!doctype html>\n<html><body>\n${body}\n</body></html>\n`;

const snapshots = new Map([
	[
		"part-section.open",
		{
			html: '<div data-component="part-section"><b>Part</b>· open</div>',
			hash: "h-part",
			content: { summary: [{ at: [0, 1], before: "· " }] },
		},
	],
	[
		"decision-card.ask",
		{
			html: '<div data-component="decision-card"><h3>Title</h3><p>Story ask</p><div><button>Approve</button></div><i>old note</i></div>',
			hash: "h-card",
			content: { children: [{ at: [0, 1], nodes: 2 }], note: [[0, 3, 0]] },
		},
	],
	[
		"button.default",
		{
			html: '<button data-component="button">Marker</button>',
			hash: "h-button",
			content: { children: [[0, 0]] },
		},
	],
]);

async function findingsFor(mockups: Record<string, string>, rule: string) {
	const root = contentApp(mockups);
	const app = await readApp(root, "demo");
	return (await componentFindings(root, app)).filter((f) => f.rule === rule);
}

describe("places recorded from one render, filled in another", () => {
	// A12
	it("A12 keeps the static words that share a text node with the property", () => {
		const source =
			'<indusk-component name="part-section" state="open"><indusk-content for="summary">3 · none</indusk-content></indusk-component>';
		const { html } = compose(source, snapshots);
		expect(html).toBe('<div data-component="part-section"><b>Part</b>· 3 · none</div>');
	});

	// A13
	it("A13 replaces every node the story's children are, and later places still land", () => {
		const source =
			'<indusk-component name="decision-card" state="ask">Mine<indusk-content for="note">New</indusk-content></indusk-component>';
		const { html } = compose(source, snapshots);
		expect(html).toBe('<div data-component="decision-card"><h3>Title</h3>Mine<i>New</i></div>');
		expect(html).not.toContain("Approve");
	});

	// A15
	it("A15 never emits an indusk-content with no for, or a nested one", () => {
		const bare = compose(
			'<indusk-component name="button"><indusk-content>Raw</indusk-content></indusk-component>',
			snapshots,
		);
		expect(bare.html).not.toContain("indusk-content");
		const nested = compose(
			'<indusk-component name="button"><indusk-content for="children">A<indusk-content for="x">B</indusk-content></indusk-content></indusk-component>',
			snapshots,
		);
		expect(nested.html).not.toContain("indusk-content");
	});

	it("A15 refuses an indusk-content with no for, or inside another, naming the line", async () => {
		const found = await findingsFor(
			{
				"home.words": page(
					[
						'<indusk-component name="button" state="default">',
						"<indusk-content>Raw</indusk-content>",
						"</indusk-component>",
						'<indusk-component name="button" state="default"><indusk-content for="children">',
						'<indusk-content for="children">Inner</indusk-content></indusk-content></indusk-component>',
					].join("\n"),
				),
			},
			"content-not-words-or-components",
		);
		expect(found.map((f) => f.line).sort()).toEqual([4, 7]);
		expect(found.every((f) => f.value === "indusk-content")).toBe(true);
	});

	// A16
	it("A16 refuses a property given twice, naming the component, the property and both lines", async () => {
		const found = await findingsFor(
			{
				"home.words": page(
					[
						'<indusk-component name="button" state="default">',
						'<indusk-content for="children">One</indusk-content>',
						'<indusk-content for="children">Two</indusk-content>',
						"</indusk-component>",
						'<indusk-component name="button" state="default">Words<indusk-content for="children">Named</indusk-content></indusk-component>',
					].join("\n"),
				),
			},
			"content-given-twice",
		);
		expect(found).toHaveLength(2);
		expect(found[0]?.message).toContain("button");
		expect(found[0]?.message).toContain("children");
		expect(found[0]?.message).toContain("4");
		expect(found[0]?.message).toContain("5");
	});

	// A17
	it("A17 composes a self-closing reference without swallowing what follows", async () => {
		const { html } = compose(
			'<indusk-component name="button" state="default" /><p>after</p>',
			snapshots,
		);
		expect(html).toBe('<button data-component="button">Marker</button><p>after</p>');
		const found = await findingsFor(
			{ "home.words": page('<indusk-component name="button" state="default" />\n<p>after</p>') },
			"content-not-words-or-components",
		);
		expect(found).toEqual([]);
	});
});

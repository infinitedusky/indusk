import { describe, expect, it } from "vitest";
import { compose } from "./compose.js";

/**
 * promise: a-mockup-composes-approved-components — the composition every
 * reader of a mockup reads (storybook-components Build Phase 3).
 */

const snapshots = new Map([
	["badge.ok", { html: '<span data-component="badge">Held</span>', hash: "h-ok" }],
	["card.default", { html: '<main data-component="card">Card</main>', hash: "h-card" }],
]);

describe("compose", () => {
	it("replaces each reference with its snapshot and touches nothing else", () => {
		const source = [
			"<body>",
			'  <indusk-component name="badge" state="ok"></indusk-component>',
			'  <p>between</p><indusk-component name="card"></indusk-component>',
			"</body>",
		].join("\n");
		const { html, uses } = compose(source, snapshots);
		expect(html).toBe(
			[
				"<body>",
				'  <span data-component="badge">Held</span>',
				'  <p>between</p><main data-component="card">Card</main>',
				"</body>",
			].join("\n"),
		);
		expect(uses).toEqual([
			{ name: "badge", state: "ok", line: 2, story: "badge.ok", snapshotHash: "h-ok" },
			{ name: "card", state: "default", line: 3, story: "card.default", snapshotHash: "h-card" },
		]);
	});

	it("leaves a reference with no snapshot as written, its hash null", () => {
		const source = '<body><indusk-component name="badge" state="warn"></indusk-component></body>';
		const { html, uses } = compose(source, snapshots);
		expect(html).toBe(source);
		expect(uses[0]).toMatchObject({ story: "badge.warn", snapshotHash: null });
	});

	it("returns a mockup that names no component byte for byte", () => {
		const source =
			'<!doctype html>\n<html><body><span data-component="badge">x</span></body></html>\n';
		expect(compose(source, snapshots)).toEqual({ html: source, uses: [] });
	});
});

/**
 * promise: a-placed-component-shows-its-content — a component placed with its
 * own words (component-content Test Phase 1, A1–A4). Snapshots carry a
 * `content` map: per property, the child-index paths from the root.
 */
const withContent = new Map([
	[
		"button.default",
		{
			html: '<button data-component="button">Marker</button>',
			hash: "h-button",
			content: { children: [[0, 0]] },
		},
	],
	[
		"step.default",
		{
			html: '<li data-component="step"><b>1</b><span>Story name</span></li>',
			hash: "h-step",
			content: { name: [[0, 1, 0]] },
		},
	],
	[
		"box.default",
		{
			html: '<section data-component="box"><h2>Title</h2><p>Story body</p></section>',
			hash: "h-box",
			content: { children: [[0, 1]] },
		},
	],
]);

describe("compose with content", () => {
	// A1
	it("A1 a button placed with its words shows them and none of the story's", () => {
		const source = '<indusk-component name="button">Create project</indusk-component>';
		const { html } = compose(source, withContent);
		expect(html).toBe('<button data-component="button">Create project</button>');
		expect(html).not.toContain("Marker");
	});

	// A2
	it("A2 a step placed with content for its name shows that name, its look unchanged", () => {
		const source =
			'<indusk-component name="step"><indusk-content for="name">Name it</indusk-content></indusk-component>';
		const { html } = compose(source, withContent);
		expect(html).toBe('<li data-component="step"><b>1</b><span>Name it</span></li>');
	});

	// A3
	it("A3 a container placed with components inside shows them composed where its content was", () => {
		const source =
			'<indusk-component name="box"><indusk-component name="button">Go</indusk-component></indusk-component>';
		const { html, uses } = compose(source, withContent);
		expect(html).toBe(
			'<section data-component="box"><h2>Title</h2><button data-component="button">Go</button></section>',
		);
		expect(uses.map((u) => u.story)).toEqual(["box.default", "button.default"]);
	});

	// A4
	it("A4 a component placed with no content shows the story's words exactly as before", () => {
		const source = '<indusk-component name="button"></indusk-component>';
		expect(compose(source, withContent).html).toBe(
			'<button data-component="button">Marker</button>',
		);
	});
});

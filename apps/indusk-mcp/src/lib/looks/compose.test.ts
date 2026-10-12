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

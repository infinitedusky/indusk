import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ApprovalEntry } from "./approvals.js";
import { componentsIn, coverageOf } from "./coverage.js";
import { componentsHashOf, type LooksApp } from "./mockups.js";

/**
 * promise: every-part-of-the-ui-is-covered — ui-promises A12's reading of a
 * rendered component, and A34's reading of a mockup. The rows themselves
 * (A10–A12) run `indusk looks coverage` over the fixture in
 * `__tests__/looks-cli.test.ts`; this pins the spellings of the attribute the
 * coverage counts, so a JSX expression is not read as nothing, and that a
 * mockup covers a component only with an element that carries it.
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

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/**
 * An app held in memory, its one mockup approved as it is: whatever the
 * record binds (the mockup, the foundation, the declarations) is set to the
 * same strings on both sides, so only the mockup's markup decides coverage.
 */
function appWith(
	mockupHtml: string,
	source: string,
): { app: LooksApp; approvals: ApprovalEntry[] } {
	const root = mkdtempSync(join(tmpdir(), "looks-coverage-"));
	roots.push(root);
	mkdirSync(join(root, "src"));
	writeFileSync(join(root, "src", "View.jsx"), source);
	const app = {
		app: "demo",
		dir: join(root, ".indusk/mockups/demo"),
		foundation: { tokens: [], hash: "f" },
		declarationsHash: "d",
		devices: [],
		screens: [{ name: "home", states: ["empty"] }],
		sources: ["src"],
		ignore: [],
		stories: [],
		mockups: [
			{
				name: "home.empty",
				screen: "home",
				state: "empty",
				file: ".indusk/mockups/demo/screens/home.empty.html",
				source: mockupHtml,
				html: mockupHtml,
				hash: "m",
				// It composes no component: the hash an entry without one binds.
				uses: [],
				componentsHash: componentsHashOf([]),
				declaresNew: [],
				declaresNewComponents: [],
			},
		],
	} as unknown as LooksApp;
	const entry = {
		mockup: "home.empty",
		mockupHash: "m",
		foundationHash: "f",
		declarationsHash: "d",
		by: "sandy",
		at: "2026-10-11T00:00:00.000Z",
	} as ApprovalEntry;
	return { app: Object.assign(app, { root }), approvals: [entry] };
}

describe("A34 — a mockup covers a component only with an element that carries it", () => {
	it("A34 a data-component named in a comment, a script or a style covers nothing", async () => {
		const html = [
			"<!doctype html><html><head>",
			'<style>/* data-component="badge" */ .card { padding: var(--space-3); }</style>',
			"<script>const label = 'data-component=\"chip\"';</script>",
			"</head><body>",
			'<!-- data-component="tag" -->',
			'<main data-component="card">A seat.</main>',
			"</body></html>",
		].join("\n");
		const source = [
			"export const View = () => (",
			'\t<main data-component="card">',
			'\t\t<b data-component="badge" /><i data-component="chip" /><u data-component="tag" />',
			"\t</main>",
			");",
		].join("\n");
		const { app, approvals } = appWith(html, source);
		const root = (app as unknown as { root: string }).root;
		const coverage = await coverageOf(root, app, approvals);
		expect(coverage.components).toEqual(["badge", "chip", "tag"]);
	});
});

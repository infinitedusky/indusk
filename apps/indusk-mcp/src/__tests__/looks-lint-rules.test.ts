import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	app,
	finding,
	lineOf,
	mockupFile,
	rawMockup,
	removeApps,
	run,
} from "./helpers/looks-cli.js";

/**
 * promise: a-mockup-leaves-nothing-undefined — ui-promises A31, A32, A33 and, through the lint's own modules, A38.
 * promise: a-mockup-is-approved-by-a-person — ui-promises A33 (an approval binds only its own bytes).
 * promise: every-part-of-the-ui-is-covered — ui-promises A34 (the source half).
 *
 * The lint's rules beyond the first five — a redefined token, a raw value
 * behind a function or in a size property, a mockup reaching outside itself —
 * and the coverage's unresolved component, each through `indusk looks`.
 */

afterEach(removeApps);

/** A mockup whose head and body are given whole, loading the generated tokens like the real ones. */
function mockupWith(
	head: string,
	body = '<main class="card" data-component="card"></main>',
): string {
	return [
		"<!doctype html>",
		'<html lang="en">',
		"\t<head>",
		'\t\t<meta charset="utf-8" />',
		'\t\t<link rel="stylesheet" href="../tokens.css" />',
		head,
		"\t</head>",
		`\t<body>${body}</body>`,
		"</html>",
		"",
	].join("\n");
}

/** Lines of the output that name `file` at all. */
const linesNaming = (out: string, file: string) => out.split("\n").filter((l) => l.includes(file));

describe("looks lint — a token the foundation defines is not redefined (A31)", () => {
	// A31
	it("A31 a mockup that redefines a foundation token is refused, naming file, line and token", () => {
		const root = app();
		const file = mockupFile("raw.redefine");
		writeFileSync(
			join(root, file),
			mockupWith("\t\t<style>\n\t\t\t:root { --color-dusk: #ff00ff; }\n\t\t</style>"),
		);
		const { code, out } = run(root, ["lint", "demo"]);
		const line = lineOf(root, file, "--color-dusk: #ff00ff");
		const found = finding(out, file, line, "--color-dusk");
		expect(found, out).not.toEqual([]);
		expect(found.join("\n")).toMatch(/redefined-token/);
		expect(code).toBe(1);
	});

	it("A31 an app stylesheet that redefines one is refused, outside the generated file alone", () => {
		const root = app();
		writeFileSync(join(root, "src/theme.css"), ":root {\n\t--color-dusk: #ff00ff;\n}\n");
		writeFileSync(
			join(root, "src/foundation.generated.css"),
			"/* Generated from foundation.tokens.json — do not edit. */\n:root {\n\t--color-dusk: #c2620b;\n}\n",
		);
		const { out } = run(root, ["lint", "demo"]);
		const found = finding(out, "src/theme.css", 2, "--color-dusk");
		expect(found, out).not.toEqual([]);
		expect(found.join("\n")).toMatch(/redefined-token/);
		expect(linesNaming(out, "src/foundation.generated.css"), out).toEqual([]);
	});
});

describe("looks lint — a raw value behind a function, in a size property, in a custom property (A32)", () => {
	const declarations: Array<{ kind: string; declaration: string; value: string }> = [
		{ kind: "rgb", declaration: "color: rgb(255 0 0);", value: "rgb(255 0 0)" },
		{ kind: "calc", declaration: "padding: calc(13px * 2);", value: "13px" },
		{
			kind: "gradient",
			declaration: "background: linear-gradient(#f00, #00f);",
			value: "#f00",
		},
		{ kind: "fallback", declaration: "color: var(--color-dusk, #ff0000);", value: "#ff0000" },
		{ kind: "border-top", declaration: "border-top: 1px solid #ff0000;", value: "#ff0000" },
		{ kind: "border-width", declaration: "border-width: 13px;", value: "13px" },
		{ kind: "width", declaration: "width: 13px;", value: "13px" },
		{ kind: "font", declaration: "font: 13px Arial;", value: "13px" },
		{ kind: "custom", declaration: "--local: 13px; padding: var(--local);", value: "13px" },
	];

	// A32
	it("A32 each is refused like a hex colour, naming file, line and value", () => {
		const root = app();
		for (const d of declarations) {
			writeFileSync(join(root, mockupFile(`raw.${d.kind}`)), rawMockup(d.declaration));
		}
		const { out } = run(root, ["lint", "demo"]);
		for (const d of declarations) {
			const file = mockupFile(`raw.${d.kind}`);
			const line = lineOf(root, file, d.declaration);
			const found = finding(out, file, line, d.value).filter((l) => /raw-value/.test(l));
			expect(found, `${d.kind}: ${out}`).not.toEqual([]);
		}
	});

	it("A32 an app's own custom property with a raw value is refused", () => {
		const root = app();
		writeFileSync(join(root, "src/local.css"), ".x {\n\t--gap: 13px;\n\tgap: var(--gap);\n}\n");
		const { out } = run(root, ["lint", "demo"]);
		expect(finding(out, "src/local.css", 2, "13px"), out).not.toEqual([]);
	});

	it("A32 percentages, viewport units, fr, 0, auto, keywords and token arithmetic stay allowed", () => {
		const root = app();
		const file = mockupFile("raw.allowed");
		writeFileSync(
			join(root, file),
			rawMockup(
				[
					"width: 50%;",
					"height: 100vh;",
					"min-width: 0;",
					"max-width: none;",
					"margin: auto;",
					"inset: 0;",
					"border: 0;",
					"grid-template-columns: 1fr 2fr;",
					"padding: calc(var(--space-2) * 2);",
					"width: calc(100% - var(--space-4));",
					"color: var(--color-dusk);",
					"font: inherit;",
				].join(" "),
			),
		);
		const { out } = run(root, ["lint", "demo"]);
		expect(linesNaming(out, file), out).toEqual([]);
	});
});

describe("looks lint — a mockup is self-contained (A33)", () => {
	const reaches: Array<{
		kind: string;
		head?: string;
		body?: string;
		value: string;
		needle: string;
	}> = [
		{
			kind: "link",
			head: '\t\t<link rel="stylesheet" href="https://example.com/theme.css" />',
			value: "https://example.com/theme.css",
			needle: "example.com/theme.css",
		},
		{
			kind: "import",
			head: '\t\t<style>\n\t\t\t@import url("theme.css");\n\t\t</style>',
			value: "theme.css",
			needle: "@import",
		},
		{
			kind: "img",
			body: '<img src="logo.png" alt="" />',
			value: "logo.png",
			needle: "logo.png",
		},
		{
			kind: "url",
			head: "\t\t<style>\n\t\t\t.card { background-image: url(bg.png); }\n\t\t</style>",
			value: "bg.png",
			needle: "url(bg.png)",
		},
	];

	// A33
	it("A33 a <link>, an @import, an <img> or a url() that is not a data: URI is refused", () => {
		const root = app();
		for (const r of reaches) {
			writeFileSync(join(root, mockupFile(`reach.${r.kind}`)), mockupWith(r.head ?? "", r.body));
		}
		const { code, out } = run(root, ["lint", "demo"]);
		for (const r of reaches) {
			const file = mockupFile(`reach.${r.kind}`);
			const line = lineOf(root, file, r.needle);
			const found = finding(out, file, line, r.value);
			expect(found, `${r.kind}: ${out}`).not.toEqual([]);
			expect(found.join("\n"), r.kind).toMatch(/external-reference/);
		}
		expect(code).toBe(1);
	});

	it("A33 a data: URI and the generated tokens link are the mockup's own", () => {
		const root = app();
		const file = mockupFile("reach.data");
		writeFileSync(
			join(root, file),
			mockupWith("", '<img src="data:image/png;base64,iVBORw0KGgo=" alt="" />'),
		);
		const { out } = run(root, ["lint", "demo"]);
		expect(linesNaming(out, file), out).toEqual([]);
		expect(out).not.toMatch(/external-reference.*tokens\.css|tokens\.css.*external-reference/);
	});
});

describe("looks coverage — a computed component name is named, never ignored (A34)", () => {
	// A34 (the source half)
	it("A34 a data-component that is not a literal is listed unresolved, with its file and line, and fails", () => {
		const root = app();
		writeFileSync(
			join(root, "src/Dynamic.jsx"),
			"export function Dynamic({ name }) {\n\treturn <div data-component={name} />;\n}\n",
		);
		const { code, out } = run(root, ["coverage", "demo"]);
		expect(out).toMatch(/^\s*unresolved component:\s*src\/Dynamic\.jsx:2\s*$/m);
		expect(code).toBe(1);
	});
});

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "./helpers/cli.js";

/**
 * promise: a-mockup-is-approved-by-a-person — ui-promises A1 (status half), A3 (command half), A4.
 * promise: a-mockup-leaves-nothing-undefined — ui-promises A5, A6, A7, A8, A31, A32, A33.
 * promise: every-part-of-the-ui-is-covered — ui-promises A10, A11, A12, A34 (the source half).
 * promise: a-mockup-is-approved-by-a-person — ui-promises A33 (an approval binds only its own bytes).
 *
 * `indusk looks lint | status | coverage | approve` over a copy of the fixture
 * app in `fixtures/looks-app/`. Every row reaches its subject as a process, so
 * each is red today on its own assertion: `indusk` has no `looks` command and
 * every call exits 1 with "unknown command", with none of the lines below.
 *
 * The output these rows read is the contract Build Phases 1 and 2 build to:
 *
 *   lint      one finding per line, `<file>:<line>` then the value or token it names;
 *             exit 1 on any finding, 0 on none
 *   status    one line per mockup, `<screen>.<state>` then `approved` or `proposed`;
 *             a proposed mockup that has an approved version names that version's
 *             first eight hash characters, the reference the app is held to
 *   coverage  `uncovered screen: <name>`, `uncovered state: <screen>.<state>`,
 *             `uncovered component: <name>`; exit 1 when any is listed
 *   approve   exit 2, naming the cockpit's Approve; it never writes
 *
 * A mockup declares a token new with `<meta name="indusk-new-tokens" content="--a, --b">`.
 */

const FIXTURE = join(__dirname, "fixtures", "looks-app");
const MOCKUPS = ".indusk/mockups/demo";

const roots: string[] = [];

afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A copy of the fixture app as a project of its own, so a case may change it. */
function app(): string {
	const root = mkdtempSync(join(tmpdir(), "looks-cli-"));
	roots.push(root);
	cpSync(FIXTURE, root, { recursive: true });
	mkdirSync(join(root, ".indusk"), { recursive: true });
	writeFileSync(join(root, ".indusk/config.json"), JSON.stringify({ mode: "local" }));
	return root;
}

function run(root: string, args: string[]): { code: number; out: string } {
	const r = runCli(root, ["looks", ...args]);
	return { code: r.code, out: `${r.stdout}\n${r.stderr}` };
}

/** The 1-based line of the first line of `file` that holds `needle`. */
function lineOf(root: string, file: string, needle: string): number {
	const lines = readFileSync(join(root, file), "utf-8").split("\n");
	const i = lines.findIndex((l) => l.includes(needle));
	if (i < 0) throw new Error(`${file} has no line holding ${needle}`);
	return i + 1;
}

/** Output lines that name `file:line` and `value` together. */
function finding(out: string, file: string, line: number, value: string): string[] {
	return out.split("\n").filter((l) => l.includes(`${file}:${line}`) && l.includes(value));
}

/** The status line for `mockup`, or an empty string so a missing line fails an assertion, not a type. */
function statusLine(out: string, mockup: string): string {
	const escaped = mockup.replace(/\./g, "\\.");
	const pattern = new RegExp(`^\\s*${escaped}\\s+(approved|proposed)\\b`);
	return out.split("\n").find((l) => pattern.test(l)) ?? "";
}

/** A mockup whose one rule holds `declaration`, loading the generated tokens like the real ones. */
function rawMockup(declaration: string): string {
	return [
		"<!doctype html>",
		'<html lang="en">',
		"\t<head>",
		'\t\t<meta charset="utf-8" />',
		'\t\t<link rel="stylesheet" href="../tokens.css" />',
		"\t\t<style>",
		`\t\t\t.card { ${declaration} }`,
		"\t\t</style>",
		"\t</head>",
		'\t<body><main class="card" data-component="card"></main></body>',
		"</html>",
		"",
	].join("\n");
}

const mockupFile = (name: string) => `${MOCKUPS}/screens/${name}.html`;

describe("looks lint — a mockup leaves nothing undefined", () => {
	// A5
	it("a raw size in a mockup is refused, naming the file, the line and the value", () => {
		const root = app();
		const file = mockupFile("home.full");
		const line = lineOf(root, file, "13px");
		const { code, out } = run(root, ["lint", "demo"]);
		expect(finding(out, file, line, "13px"), out).not.toEqual([]);
		expect(code).toBe(1);
	});

	// A5 — one mockup per kind of value the promise names, so none is left to a later phase.
	it("a raw colour, size, space, radius, shadow, font or duration is each refused", () => {
		const root = app();
		const kinds: Array<{ kind: string; declaration: string; value: string }> = [
			{ kind: "colour", declaration: "color: #c2620b;", value: "#c2620b" },
			{ kind: "size", declaration: "font-size: 18px;", value: "18px" },
			{ kind: "space", declaration: "margin: 20px;", value: "20px" },
			{ kind: "radius", declaration: "border-radius: 9px;", value: "9px" },
			{
				kind: "shadow",
				declaration: "box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);",
				value: "0 1px 2px",
			},
			{ kind: "font", declaration: "font-family: Arial, sans-serif;", value: "Arial" },
			{ kind: "duration", declaration: "transition: opacity 250ms;", value: "250ms" },
		];
		for (const k of kinds) {
			writeFileSync(join(root, mockupFile(`raw.${k.kind}`)), rawMockup(k.declaration));
		}
		const { out } = run(root, ["lint", "demo"]);
		for (const k of kinds) {
			const file = mockupFile(`raw.${k.kind}`);
			const line = lineOf(root, file, k.declaration);
			expect(finding(out, file, line, k.value), `${k.kind}: ${out}`).not.toEqual([]);
		}
	});

	// A6
	it("the app's styles are held to the same rule: a raw value, a stock class, an arbitrary value", () => {
		const root = app();
		const { code, out } = run(root, ["lint", "demo"]);
		const css = lineOf(root, "src/styles.css", "#c2620b");
		expect(finding(out, "src/styles.css", css, "#c2620b"), out).not.toEqual([]);
		const classes = lineOf(root, "src/Badge.jsx", "bg-amber-50");
		expect(finding(out, "src/Badge.jsx", classes, "bg-amber-50"), out).not.toEqual([]);
		expect(finding(out, "src/Badge.jsx", classes, "p-[13px]"), out).not.toEqual([]);
		// Card.jsx is written on the foundation's classes alone and is not named.
		expect(out).not.toMatch(/src\/Card\.jsx/);
		expect(code).toBe(1);
	});

	// A7
	it("a token the foundation does not define is refused, naming the token", () => {
		const root = app();
		const file = mockupFile("detail.default");
		const line = lineOf(root, file, "--undefined-token");
		const { out } = run(root, ["lint", "demo"]);
		const found = finding(out, file, line, "--undefined-token");
		expect(found, out).not.toEqual([]);
		expect(found.join("\n")).toMatch(/undefined/i);
	});

	// A8
	it("a token a mockup adds is refused unless the mockup declares it new", () => {
		const root = app();
		const file = mockupFile("home.full.next");
		const line = lineOf(root, file, "--new-token: ");
		const undeclared = run(root, ["lint", "demo"]);
		const found = finding(undeclared.out, file, line, "--new-token");
		expect(found, undeclared.out).not.toEqual([]);
		expect(found.join("\n")).toMatch(/declar/i);

		const source = readFileSync(join(root, file), "utf-8");
		writeFileSync(
			join(root, file),
			source.replace(
				'<meta charset="utf-8" />',
				'<meta charset="utf-8" />\n\t\t<meta name="indusk-new-tokens" content="--new-token" />',
			),
		);
		const declared = run(root, ["lint", "demo"]);
		// Declaring removes this finding and only this one: home.full's raw 13px is still named.
		const raw = lineOf(root, mockupFile("home.full"), "13px");
		expect(finding(declared.out, mockupFile("home.full"), raw, "13px"), declared.out).not.toEqual(
			[],
		);
		expect(declared.out.split("\n").filter((l) => l.includes("--new-token"))).toEqual([]);
	});
});

describe("looks status — a mockup is approved by a person", () => {
	// A1 (status half)
	it("a mockup nobody approved reads proposed", () => {
		const { out } = run(app(), ["status", "demo"]);
		expect(statusLine(out, "detail.default"), out).toMatch(/proposed/);
		expect(statusLine(out, "home.full.next"), out).toMatch(/proposed/);
		expect(statusLine(out, "home.empty"), out).toMatch(/approved/);
	});

	// A3 (command half)
	it("approve from the command line is refused, naming the cockpit, and writes nothing", () => {
		const root = app();
		const record = join(root, MOCKUPS, "approved.json");
		const before = readFileSync(record, "utf-8");
		const { code, out } = run(root, ["approve", "demo", "home.full"]);
		expect(code).toBe(2);
		expect(out).toMatch(/cockpit/i);
		expect(out).toMatch(/approve/i);
		expect(readFileSync(record, "utf-8")).toBe(before);
	});

	// A3 (a hand edit of the record)
	it("an entry whose hash is not the mockup's reads proposed, however it got there", () => {
		const root = app();
		const record = join(root, MOCKUPS, "approved.json");
		const entries = JSON.parse(readFileSync(record, "utf-8")).approvals as Array<
			Record<string, string>
		>;
		// home.full is in the record with a stale hash; copy home.empty's true hashes onto another mockup.
		entries.push({ ...entries[0], mockup: "detail.default" });
		writeFileSync(record, JSON.stringify({ approvals: entries }, null, "\t"));
		const { out } = run(root, ["status", "demo"]);
		expect(statusLine(out, "home.full"), out).toMatch(/proposed/);
		expect(statusLine(out, "detail.default"), out).toMatch(/proposed/);
	});

	// A4
	it("changing an approved mockup returns it to proposed, the app held to the approved version meanwhile", () => {
		const root = app();
		const record = JSON.parse(readFileSync(join(root, MOCKUPS, "approved.json"), "utf-8"));
		const approved = record.approvals[0].mockupHash as string;
		expect(statusLine(run(root, ["status", "demo"]).out, "home.empty")).toMatch(/approved/);

		const file = join(root, mockupFile("home.empty"));
		writeFileSync(file, `${readFileSync(file, "utf-8")}<!-- a change a person has not seen -->\n`);
		const { out } = run(root, ["status", "demo"]);
		const line = statusLine(out, "home.empty");
		expect(line, out).toMatch(/proposed/);
		expect(line, out).toContain(approved.slice(0, 8));
	});

	it("changing the foundation returns every approved mockup to proposed", () => {
		const root = app();
		const foundation = join(root, MOCKUPS, "foundation.tokens.json");
		writeFileSync(
			foundation,
			readFileSync(foundation, "utf-8").replace('"value": 12', '"value": 14'),
		);
		const { out } = run(root, ["status", "demo"]);
		expect(statusLine(out, "home.empty"), out).toMatch(/proposed/);
	});
});

describe("looks coverage — every part of the UI is covered", () => {
	// A10
	it("a declared screen with no approved mockup is reported uncovered, by name", () => {
		const { code, out } = run(app(), ["coverage", "demo"]);
		expect(out).toMatch(/^\s*uncovered screen:\s*detail\s*$/m);
		// home has an approved state: its gap is a state, not a screen.
		expect(out).not.toMatch(/uncovered screen:\s*home\b/);
		expect(code).toBe(1);
	});

	// A11
	it("a declared state of a screen with no approved mockup is reported uncovered", () => {
		const { out } = run(app(), ["coverage", "demo"]);
		expect(out).toMatch(/^\s*uncovered state:\s*home\.full\s*$/m);
		expect(out).not.toMatch(/uncovered state:\s*home\.empty\b/);
	});

	// A12
	it("a component the app renders that no approved mockup shows is reported uncovered", () => {
		const { out } = run(app(), ["coverage", "demo"]);
		expect(out).toMatch(/^\s*uncovered component:\s*badge\s*$/m);
		// card is shown by home.empty, which is approved.
		expect(out).not.toMatch(/uncovered component:\s*card\b/);
	});
});

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

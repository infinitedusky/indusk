import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	app,
	finding,
	lineOf,
	MOCKUPS,
	mockupFile,
	rawMockup,
	removeApps,
	run,
	statusLine,
} from "./helpers/looks-cli.js";

/**
 * promise: a-mockup-is-approved-by-a-person — ui-promises A1 (status half), A3 (command half), A4.
 * promise: a-mockup-leaves-nothing-undefined — ui-promises A5, A6, A7, A8, and A38 (the lint unchanged by its decomposition).
 * promise: every-part-of-the-ui-is-covered — ui-promises A10, A11, A12.
 * A31–A34 are in `looks-lint-rules.test.ts`.
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

afterEach(removeApps);

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

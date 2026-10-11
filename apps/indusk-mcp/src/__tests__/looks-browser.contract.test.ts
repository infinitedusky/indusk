import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { generateCss } from "../lib/looks/foundation.js";
import { readApp } from "../lib/looks/mockups.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * promise: tokens-are-held-exactly — ui-promises A18, A19, A20.
 *
 * System tier: `indusk looks check demo --url <page>` drives real Chromium
 * over a small page served from this file. The fixture app's `home.empty` is
 * approved at its true hashes, so the check opens it at both reference
 * devices; the page's own CSS is the thing under test.
 *
 * Output grammar read here (and written in `bin/commands/looks.ts`):
 *   held    <screen>.<state> @ <device>
 *   broken  <screen>.<state> @ <device>, then one indented line per finding:
 *     token <name>  approved <value>  actual <value>
 *     element <selector>  <property>  actual <value>  nearest <token (value)>
 */

const FIXTURE = join(__dirname, "fixtures", "looks-app");

let css = "";
let page = "";
let server: Server;
let url = "";
const roots: string[] = [];

/** The page: every visual value is a token of the approved foundation. */
function pageWith(extraCss = "", buttonCss = ""): string {
	return `<!doctype html><html><head><style>
${css}
body { margin: 0; background: var(--color-paper); color: var(--color-ink); font-family: var(--font-sans); font-size: var(--space-4); }
button.primary { border: 0; padding: var(--space-3); border-radius: var(--radius-md); background: var(--color-dusk); color: var(--color-paper); font: inherit; ${buttonCss} }
${extraCss}
</style></head><body><button class="primary">Go</button></body></html>`;
}

beforeAll(async () => {
	const app = await readApp(FIXTURE, "demo");
	css = generateCss(app.foundation);
	server = createServer((_req, res) => {
		res.setHeader("content-type", "text/html");
		res.end(page);
	});
	await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
	url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
	server?.close();
});

afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** The fixture as a project of its own, with the local telemetry mark switched off. */
function project(): string {
	const root = mkdtempSync(join(tmpdir(), "looks-browser-"));
	roots.push(root);
	cpSync(FIXTURE, root, { recursive: true });
	writeFileSync(
		join(root, ".indusk/config.json"),
		JSON.stringify({ mode: "local", eval: { otel: { enabled: false } } }),
	);
	return root;
}

function check(): { code: number; out: string } {
	const r = runCli(project(), ["looks", "check", "demo", "--url", url]);
	return { code: r.code, out: `${r.stdout}\n${r.stderr}` };
}

describe.skipIf(SHOULD_SKIP)("indusk looks check — the running app held by value", () => {
	it("A18: elements rendering with their tokens' approved values are held", () => {
		page = pageWith();
		const { code, out } = check();
		expect(out).toMatch(/held\s+home\.empty @ phone/);
		expect(out).toMatch(/held\s+home\.empty @ desktop/);
		expect(out).not.toMatch(/broken/);
		expect(code).toBe(0);
	});

	it("A19: a token changed in the app alone breaks the token and every element using it", () => {
		page = pageWith(":root { --color-dusk: #c2620c; }");
		const { code, out } = check();
		expect(code).toBe(1);
		expect(out).toMatch(/broken\s+home\.empty @ phone/);
		expect(out).toMatch(/token --color-dusk\s+approved #c2620b\s+actual #c2620c/);
		expect(out).toMatch(/element button\.primary\s+background-color\s+actual rgb\(194, 98, 12\)/);
	});

	it("A20: a duration or an easing that differs from its approved value is broken like a colour", () => {
		page = pageWith(
			"",
			"transition-duration: 250ms; transition-timing-function: var(--easing-standard);",
		);
		const { code, out } = check();
		expect(code).toBe(1);
		expect(out).toMatch(
			/element button\.primary\s+transition-duration\s+actual 0\.25s\s+nearest --duration-fast \(200ms\)/,
		);
	});
});

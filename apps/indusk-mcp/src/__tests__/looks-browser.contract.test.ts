import { type ChildProcess, spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { approve } from "../lib/looks/approve.js";
import { generateCss } from "../lib/looks/foundation.js";
import { readApp } from "../lib/looks/mockups.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * promise: tokens-are-held-exactly — ui-promises A18, A19, A20, A37.
 * promise: every-part-of-the-ui-is-covered — ui-promises A36.
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
let pageFile = "";
let server: ChildProcess | undefined;
let url = "";
const roots: string[] = [];
const projects: string[] = [];

/**
 * The page: every visual value is a token of the approved foundation. It says
 * which screen state it rendered (`data-look-state` on `<html>`, A36) unless
 * told not to, and `htmlAttrs` adds to its root element.
 */
function pageWith(
	extraCss = "",
	buttonCss = "",
	{
		states = "home.empty",
		htmlAttrs = "",
		tokens = css,
	}: { states?: string | null; htmlAttrs?: string; tokens?: string } = {},
): string {
	const reported = states === null ? "" : ` data-look-state="${states}"`;
	return `<!doctype html><html${reported}${htmlAttrs ? ` ${htmlAttrs}` : ""}><head><style>
${tokens}
body { margin: 0; background: var(--color-paper); color: var(--color-ink); font-family: var(--font-sans); font-size: var(--space-4); }
button.primary { border: 0; padding: var(--space-3); border-radius: var(--radius-md); background: var(--color-dusk); color: var(--color-paper); font: inherit; ${buttonCss} }
${extraCss}
</style></head><body><button class="primary">Go</button></body></html>`;
}

/**
 * The page is served from a process of its own: `runCli` blocks this one
 * (`spawnSync`), so a server in-process would never answer Chromium.
 */
const SERVER = `
const http = require("node:http"), fs = require("node:fs");
http.createServer((_q, r) => { r.setHeader("content-type", "text/html"); r.end(fs.readFileSync(process.argv[1])); })
  .listen(0, "127.0.0.1", function () { console.log(this.address().port); });
`;

beforeAll(async () => {
	const app = await readApp(FIXTURE, "demo");
	css = generateCss(app.foundation);
	const dir = mkdtempSync(join(tmpdir(), "looks-browser-page-"));
	roots.push(dir);
	pageFile = join(dir, "page.html");
	writeFileSync(pageFile, pageWith());
	server = spawn("node", ["-e", SERVER, pageFile], { stdio: ["ignore", "pipe", "inherit"] });
	const port = await new Promise<string>((ok, fail) => {
		server?.stdout?.once("data", (d) => ok(String(d).trim()));
		server?.once("error", fail);
	});
	url = `http://127.0.0.1:${port}`;
});

afterAll(() => {
	server?.kill();
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

afterEach(() => {
	for (const r of projects.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** The fixture as a project of its own, with the local telemetry mark switched off. */
function project(): string {
	const root = mkdtempSync(join(tmpdir(), "looks-browser-"));
	projects.push(root);
	cpSync(FIXTURE, root, { recursive: true });
	writeFileSync(
		join(root, ".indusk/config.json"),
		JSON.stringify({ mode: "local", eval: { otel: { enabled: false } } }),
	);
	return root;
}

function check(root = project()): { code: number; out: string } {
	const r = runCli(root, ["looks", "check", "demo", "--url", url]);
	return { code: r.code, out: `${r.stdout}\n${r.stderr}` };
}

/**
 * The fixture with dark values beside its colours, `home.empty` approved on
 * that foundation through the package's own writer — the hashes it binds are
 * whatever the record binds, computed by the code that reads them.
 */
async function darkProject(): Promise<{ root: string; tokens: string }> {
	const root = project();
	const file = join(root, ".indusk/mockups/demo/foundation.tokens.json");
	const tree = JSON.parse(readFileSync(file, "utf-8"));
	const dark: Record<string, string> = { paper: "#1f1a17", ink: "#faf7f2", dusk: "#e08a3c" };
	for (const [name, value] of Object.entries(dark)) {
		tree.color[name].$extensions = { "dev.indusk": { dark: value } };
	}
	writeFileSync(file, `${JSON.stringify(tree, null, "\t")}\n`);
	const r = await approve(root, "demo", "home.empty", "contract");
	if (!r.approved) throw new Error(r.reason);
	const app = await readApp(root, "demo");
	return { root, tokens: generateCss(app.foundation) };
}

describe.skipIf(SHOULD_SKIP)("indusk looks check — the running app held by value", () => {
	it("A18: elements rendering with their tokens' approved values are held", () => {
		writeFileSync(pageFile, pageWith());
		const { code, out } = check();
		expect(out).toMatch(/held\s+home\.empty @ phone/);
		expect(out).toMatch(/held\s+home\.empty @ desktop/);
		expect(out).not.toMatch(/broken/);
		expect(code).toBe(0);
	});

	it("A19: a token changed in the app alone breaks the token and every element using it", () => {
		writeFileSync(pageFile, pageWith(":root { --color-dusk: #c2620c; }"));
		const { code, out } = check();
		expect(code).toBe(1);
		expect(out).toMatch(/broken\s+home\.empty @ phone/);
		expect(out).toMatch(/token --color-dusk\s+approved #c2620b\s+actual #c2620c/);
		expect(out).toMatch(/element button\.primary\s+background-color\s+actual rgb\(194, 98, 12\)/);
	});

	it("A20: a duration or an easing that differs from its approved value is broken like a colour", () => {
		writeFileSync(
			pageFile,
			pageWith(
				"",
				"transition-duration: 250ms; transition-timing-function: var(--easing-standard);",
			),
		);
		const { code, out } = check();
		expect(code).toBe(1);
		expect(out).toMatch(
			/element button\.primary\s+transition-duration\s+actual 0\.25s\s+nearest --duration-fast \(200ms\)/,
		);
	});

	it("A36: a page that does not say which state it rendered is unchecked, naming why, never held", () => {
		writeFileSync(pageFile, pageWith("", "", { states: null }));
		const { code, out } = check();
		expect(out).toMatch(/unchecked\s+home\.empty @ phone — the page did not report state empty/);
		expect(out).toMatch(/unchecked\s+home\.empty @ desktop — the page did not report state empty/);
		expect(out).not.toMatch(/held\s+home\.empty/);
		expect(code).toBe(1);
	});

	it("A37: a token whose dark value changed in the app alone is broken under the dark scheme only", async () => {
		const { root, tokens } = await darkProject();
		writeFileSync(
			pageFile,
			pageWith(
				// The app's own dark block, as specific as the generated one it overrides.
				'@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --color-dusk: #000001; } }',
				"",
				{
					tokens,
				},
			),
		);
		const { code, out } = check(root);
		expect(out).toMatch(/held\s+home\.empty @ phone\s*$/m);
		expect(out).toMatch(/broken\s+home\.empty @ phone\/dark/);
		expect(out).toMatch(/token --color-dusk\s+approved #e08a3c\s+actual #000001/);
		expect(code).toBe(1);
	});

	it("A37: a look under a scheme the foundation names is held only when that scheme was opened", async () => {
		const { root, tokens } = await darkProject();
		writeFileSync(pageFile, pageWith("", "", { tokens }));
		const opened = check(root);
		expect(opened.out).toMatch(/held\s+home\.empty @ phone\/dark/);
		expect(opened.code).toBe(0);

		// The page pins itself light: the dark scheme was asked for and never drawn.
		writeFileSync(pageFile, pageWith("", "", { tokens, htmlAttrs: 'data-theme="light"' }));
		const pinned = check(root);
		expect(pinned.out).toMatch(/held\s+home\.empty @ phone\s*$/m);
		expect(pinned.out).toMatch(
			/unchecked\s+home\.empty @ phone\/dark — the page did not render the dark scheme/,
		);
		expect(pinned.out).not.toMatch(/held\s+home\.empty @ phone\/dark/);
		// Two CLI runs (about 6 s with the first launch): more than vitest's 5 s default.
	}, 60_000);
});

import { type ChildProcess, spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { approve } from "../lib/looks/approve.js";
import { generateCss } from "../lib/looks/foundation.js";
import { readApp } from "../lib/looks/mockups.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * promise: a-look-check-runs-what-changed — looks-check-speed A10, A11, A12, A14.
 * promise: tokens-are-held-exactly — looks-check-speed A12 (a page measured in
 * place still reads the approved values), A36 (a page that reads its size once
 * on mount is measured as a fresh load would).
 *
 * System tier: `indusk looks check demo --url <page>` drives real Chromium over
 * a page served from a process of its own, which appends every request's path
 * to a log this file reads. The fixture app's `home.empty` is approved, so the
 * check opens it at each reference device (and each scheme the foundation names).
 *
 * A12 is a regression guard: it passes today (every device and scheme is a
 * fresh load) and goes red if measuring in place reads a colour mid-transition
 * or at the wrong pixel ratio.
 */

const FIXTURE = join(__dirname, "fixtures", "looks-app");

/** The served page logs each request; the page body is whatever the file holds. */
const SERVER = `
const http = require("node:http"), fs = require("node:fs");
http.createServer((q, r) => {
  fs.appendFileSync(process.argv[2], q.url + "\\n");
  r.setHeader("content-type", "text/html"); r.end(fs.readFileSync(process.argv[1]));
}).listen(0, "127.0.0.1", function () { console.log(this.address().port); });
`;

let dir = "";
let pageFile = "";
let logFile = "";
let server: ChildProcess | undefined;
let url = "";
const temps: string[] = [];

function page(tokens: string, extraCss = "", buttonCss = "", head = ""): string {
	return `<!doctype html><html data-look-state="home.empty"><head>${head}<style>
${tokens}
body { margin: 0; background: var(--color-paper); color: var(--color-ink); font-family: var(--font-sans); font-size: var(--space-4); }
button.primary { border: 0; padding: var(--space-3); border-radius: var(--radius-md); background: var(--color-dusk); color: var(--color-paper); font: inherit; ${buttonCss} }
${extraCss}
</style></head><body><button class="primary">Go</button></body></html>`;
}

beforeAll(async () => {
	dir = mkdtempSync(join(tmpdir(), "looks-check-speed-"));
	pageFile = join(dir, "page.html");
	logFile = join(dir, "requests.log");
	writeFileSync(pageFile, "");
	server = spawn("node", ["-e", SERVER, pageFile, logFile], {
		stdio: ["ignore", "pipe", "inherit"],
	});
	const port = await new Promise<string>((ok, fail) => {
		server?.stdout?.once("data", (d) => ok(String(d).trim()));
		server?.once("error", fail);
	});
	url = `http://127.0.0.1:${port}`;
});

afterAll(() => {
	server?.kill();
	rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
	for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

/** The pages the server was asked for, favicon aside. */
function requests(): string[] {
	if (!existsSync(logFile)) return [];
	return readFileSync(logFile, "utf-8")
		.split("\n")
		.filter((l) => l && !l.includes("favicon"));
}

function clearRequests(): void {
	writeFileSync(logFile, "");
}

/** The fixture as a project of its own with dark values beside its colours; `devices` reorders its reference devices. */
async function darkProject(
	devices?: string[],
): Promise<{ root: string; tokens: string; home: string }> {
	const root = mkdtempSync(join(tmpdir(), "looks-check-speed-project-"));
	const home = mkdtempSync(join(tmpdir(), "looks-check-speed-home-"));
	temps.push(root, home);
	cpSync(FIXTURE, root, { recursive: true });
	writeFileSync(
		join(root, ".indusk/config.json"),
		JSON.stringify({ mode: "local", eval: { otel: { enabled: false } } }),
	);
	const file = join(root, ".indusk/mockups/demo/foundation.tokens.json");
	const tree = JSON.parse(readFileSync(file, "utf-8"));
	const dark: Record<string, string> = { paper: "#1f1a17", ink: "#faf7f2", dusk: "#e08a3c" };
	for (const [name, value] of Object.entries(dark)) {
		tree.color[name].$extensions = { "dev.indusk": { dark: value } };
	}
	writeFileSync(file, `${JSON.stringify(tree, null, "\t")}\n`);
	if (devices) {
		const devicesFile = join(root, ".indusk/mockups/demo/devices.json");
		const declared = JSON.parse(readFileSync(devicesFile, "utf-8")) as {
			devices: { name: string }[];
		};
		declared.devices = devices.map((name) => {
			const d = declared.devices.find((x) => x.name === name);
			if (!d) throw new Error(`the fixture has no device ${name}`);
			return d;
		});
		writeFileSync(devicesFile, JSON.stringify(declared));
	}
	const r = await approve(root, "demo", "home.empty", "contract");
	if (!r.approved) throw new Error(r.reason);
	const app = await readApp(root, "demo");
	return { root, home, tokens: generateCss(app.foundation) };
}

function check(root: string, home: string): { code: number; out: string; err: string } {
	const r = runCli(root, ["looks", "check", "demo", "--url", url], { INDUSK_HOME: home });
	return { code: r.code, out: r.stdout, err: r.stderr };
}

describe.skipIf(SHOULD_SKIP)("indusk looks check — cost follows what changed", () => {
	it("A10: a second run with nothing changed requests only the app's root, no look's page, and says each look was reused", async () => {
		const { root, home, tokens } = await darkProject();
		writeFileSync(pageFile, page(tokens));
		clearRequests();
		const first = check(root, home);
		expect(first.code, `${first.out}\n${first.err}`).toBe(0);
		expect(requests().length).toBeGreaterThan(0);

		clearRequests();
		const second = check(root, home);
		// One plain read of the app's root tells which build is served (a reused result
		// is keyed on it); no look is opened, so no browser asks for anything.
		expect(
			requests(),
			"the second run asked the server for more than the build's identity",
		).toEqual(["/"]);
		expect(second.out).toMatch(/reused\s+home\.empty — held /);
		expect(second.out).toMatch(/\b1 reused\b/);
		expect(second.code).toBe(0);
	}, 120_000);

	it("A11: each look's page is requested once and reported at every device and scheme", async () => {
		const { root, home, tokens } = await darkProject();
		writeFileSync(pageFile, page(tokens));
		clearRequests();
		const run = check(root, home);
		expect(run.code, `${run.out}\n${run.err}`).toBe(0);
		expect(requests().filter((r) => r.startsWith("/home?state=empty"))).toHaveLength(1);
		for (const name of ["phone", "phone/dark", "desktop", "desktop/dark"]) {
			expect(run.out).toMatch(new RegExp(`held\\s+home\\.empty @ ${name}\\s*$`, "m"));
		}
	}, 120_000);

	it("A12: a page whose colours transition, or that changes with the pixel ratio, still holds at every device and scheme", async () => {
		const { root, home, tokens } = await darkProject();
		writeFileSync(
			pageFile,
			page(
				tokens,
				// Wrong below 2 device pixels per CSS pixel, approved at and above it: a read at
				// the wrong ratio is off-token. Both reference devices are at 2 or 3.
				":root { --color-dusk: #000002; } @media (min-resolution: 2dppx) { :root { --color-dusk: #c2620b; } }",
				"transition-property: color, background-color; transition-duration: var(--duration-fast); transition-timing-function: var(--easing-standard);",
			),
		);
		const run = check(root, home);
		expect(run.out).not.toMatch(/broken/);
		for (const name of ["phone", "phone/dark", "desktop", "desktop/dark"]) {
			expect(run.out).toMatch(new RegExp(`held\\s+home\\.empty @ ${name}\\s*$`, "m"));
		}
		expect(run.code).toBe(0);
	}, 120_000);

	it("A36: a page that reads its viewport once on mount, with no listener, is measured at every device as a fresh load would", async () => {
		// Phone is not the first device, so a page measured in place mounts at desktop's width.
		const { root, home, tokens } = await darkProject(["desktop", "phone"]);
		writeFileSync(
			pageFile,
			page(tokens).replace(
				"</body>",
				'<script>if (innerWidth < 600) document.querySelector("button").style.color = "#ff0000";</script></body>',
			),
		);
		const run = check(root, home);
		expect(run.out, `${run.out}\n${run.err}`).toMatch(/broken\s+home\.empty @ phone\s*$/m);
		expect(run.out).toMatch(/held\s+home\.empty @ desktop\s*$/m);
		expect(run.code).toBe(1);
	}, 120_000);

	it("A14: a development server's page is refused before any look is held", async () => {
		const { root, home, tokens } = await darkProject();
		writeFileSync(
			pageFile,
			page(
				tokens,
				"",
				"",
				'<script src="/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_0b1mqtk._.js"></script>',
			),
		);
		const run = check(root, home);
		expect(run.code).toBe(1);
		expect(`${run.out}\n${run.err}`).toMatch(/development server/);
		expect(run.out).not.toMatch(/held\s+home\.empty/);
	}, 120_000);
});

import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLI_BIN, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * promise: the-demo-app-starts-with-its-promise-holding — demo-app-template A4.
 * promise: the-demo-break-is-caught-locally — demo-app-template A7.
 *
 * `indusk demo` copies the seat-holds example, starts the local telemetry
 * daemon and the example, and prints the page. Over HTTP, a held seat lapses
 * and InDusk reads the promise held (A4); with the fault switch on, a lapse
 * comes free late and InDusk reads it broken, naming the trace, within ten
 * seconds; with the switch off, it reads held again (A7). System tier: it
 * starts a daemon and a server, and installs the example's dependencies.
 */

const PROMISE = "a-held-seat-is-released-in-time";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let home: string;
let parent: string;
let dir: string;
let demo: ChildProcess | null = null;
let page = "";
let output = "";

function status(): string {
	const r = runCli(dir, ["promises", "status", "--since", "15m"], { INDUSK_HOME: home });
	return `${r.stdout}\n${r.stderr}`;
}

/** Poll `promises status` until `ok` holds or `ms` passes; the last read either way. */
async function statusUntil(ok: (out: string) => boolean, ms: number): Promise<string> {
	const deadline = Date.now() + ms;
	let out = status();
	while (!ok(out) && Date.now() < deadline) {
		await sleep(1000);
		out = status();
	}
	return out;
}

async function post(path: string, body: unknown): Promise<Response> {
	return fetch(new URL(path, page), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

/** When the newest "last seen upheld" in a status read happened, or 0. */
function lastUpheldAt(out: string): number {
	const m = out.match(/last seen upheld (\S+)/);
	return m?.[1] ? Date.parse(m[1]) : 0;
}

describe.skipIf(SHOULD_SKIP)(
	"indusk demo — the seat-holds example, its promise held and broken",
	() => {
		beforeAll(async () => {
			home = mkdtempSync(join(tmpdir(), "demo-home-"));
			parent = mkdtempSync(join(tmpdir(), "demo-dir-"));
			dir = join(parent, "seat-holds");
			demo = spawn("node", [CLI_BIN, "demo", dir, "--no-open"], {
				env: { ...process.env, INDUSK_HOME: home, INDUSK_SKIP_UPDATE_CHECK: "1" },
				stdio: ["ignore", "pipe", "pipe"],
			});
			demo.stdout?.on("data", (c: Buffer) => {
				output += c.toString();
			});
			demo.stderr?.on("data", (c: Buffer) => {
				output += c.toString();
			});
			const deadline = Date.now() + 240_000;
			while (Date.now() < deadline && demo.exitCode === null) {
				const m = output.match(/Seat page:\s*(http\S+)/);
				if (m?.[1]) {
					page = m[1];
					break;
				}
				await sleep(500);
			}
		}, 260_000);

		afterAll(() => {
			demo?.kill("SIGINT");
			runCli(parent, ["telemetry", "stop"], { INDUSK_HOME: home });
			rmSync(parent, { recursive: true, force: true });
			rmSync(home, { recursive: true, force: true });
		});

		it("A4 — the page starts, and a lapsed hold reads as the promise held", async () => {
			expect(page, `indusk demo printed no seat page:\n${output}`).toMatch(/^http/);
			expect((await post("/hold", { seat: 1, who: "ann" })).status).toBe(200);
			const out = await statusUntil((s) => /last seen upheld/.test(s), 30_000);
			expect(out).toContain(PROMISE);
			expect(out).toMatch(/last seen upheld/);
		}, 60_000);

		it("A7 — with the switch on, a late release reads broken with its trace; off, held again", async () => {
			expect(page, `indusk demo printed no seat page:\n${output}`).toMatch(/^http/);
			expect((await post("/fault", { on: true })).status).toBe(200);
			expect((await post("/hold", { seat: 2, who: "bob" })).status).toBe(200);
			const broken = await statusUntil((s) => /\b[1-9]\d* violations?\b/.test(s), 30_000);
			expect(broken).toMatch(/\b[1-9]\d* violations?\b/);
			expect(broken, "the violation names its trace").toMatch(/\b[0-9a-f]{32}\b.*seat 2/);

			const brokenAt = Date.now();
			expect((await post("/fault", { on: false })).status).toBe(200);
			expect((await post("/hold", { seat: 3, who: "cy" })).status).toBe(200);
			const held = await statusUntil((s) => lastUpheldAt(s) > brokenAt, 30_000);
			expect(lastUpheldAt(held), "held again after the switch is off").toBeGreaterThan(brokenAt);
		}, 90_000);
	},
);

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REPO_ROOT, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * promise: tokens-are-held-exactly — looks-check-speed A27.
 *
 * System tier, run in the background after landing and at release (it never
 * blocks either): the full check of the admin — `indusk looks check admin
 * --all`, every look opened — against the bundled admin's production build,
 * started here on a port of its own in a temporary INDUSK_HOME that registers
 * this checkout as `dusk` (the name the admin's mockups address pages by).
 * Every look must hold. A broken look fails the slow tests, which route the
 * failure to `tokens-are-held-exactly` as an incident.
 *
 * Ports 3939 and 4939 belong to the person's own daemon; this test asks for 3940
 * and takes the next free one if it is busy, and stops only what it started.
 */

let home = "";
let url = "";

beforeAll(() => {
	if (SHOULD_SKIP) return;
	home = mkdtempSync(join(tmpdir(), "looks-admin-all-"));
	const now = new Date().toISOString();
	writeFileSync(
		join(home, "projects.json"),
		JSON.stringify({
			version: 1,
			projects: [{ name: "dusk", path: REPO_ROOT, registeredAt: now, lastSeenAt: now }],
		}),
	);
	const start = runCli(REPO_ROOT, ["ui", "start", "--no-open", "--port", "3940"], {
		INDUSK_HOME: home,
	});
	const port = /Starting admin UI on http:\/\/localhost:(\d+)\//.exec(start.stdout)?.[1];
	if (!port) throw new Error(`the admin did not start:\n${start.stdout}\n${start.stderr}`);
	url = `http://localhost:${port}`;
}, 120_000);

afterAll(() => {
	if (SHOULD_SKIP || !home) return;
	runCli(REPO_ROOT, ["ui", "stop"], { INDUSK_HOME: home });
	rmSync(home, { recursive: true, force: true });
}, 60_000);

describe.skipIf(SHOULD_SKIP)("indusk looks check admin --all — the full check of the admin", () => {
	it(
		"A27: every look of the admin, each opened, holds against its production build",
		() => {
			const started = Date.now();
			const run = runCli(REPO_ROOT, ["looks", "check", "admin", "--all", "--url", url], {
				INDUSK_HOME: home,
			});
			console.info(`full check of the admin: ${((Date.now() - started) / 1000).toFixed(1)} s`);
			const out = `${run.stdout}\n${run.stderr}`;
			expect(out).not.toMatch(/unknown option/);
			expect(out).not.toMatch(/^broken /m);
			expect(run.code, out).toBe(0);
		},
		30 * 60_000,
	);
});

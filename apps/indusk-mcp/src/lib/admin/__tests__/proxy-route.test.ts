import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_HOSTNAME, deregisterAdminRoute, registerAdminRoute } from "../proxy-route.js";

/**
 * Reload is always exercised against a deliberately-missing Caddy config
 * path (`INDUSK_CADDY_CONFIG_PATH` pointed at a tmpdir path that doesn't
 * exist) so these tests never shell out to a real `caddy` binary — they
 * assert the pure file-write/remove behavior, matching the plan's scope:
 * live Caddy reload is a manual smoke step, not an automated test.
 */

let testHome: string;
let sitesDir: string;

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "indusk-home-"));
	process.env.INDUSK_HOME = testHome;
	process.env.INDUSK_CADDY_CONFIG_PATH = join(testHome, "no-such-caddyfile");
	sitesDir = join(testHome, "proxy", "sites");
});

afterEach(() => {
	delete process.env.INDUSK_HOME;
	delete process.env.INDUSK_CADDY_CONFIG_PATH;
	rmSync(testHome, { recursive: true, force: true });
});

describe("registerAdminRoute", () => {
	it("no-ops when the shared proxy sites directory doesn't exist", async () => {
		const result = await registerAdminRoute(3939);
		expect(result.changed).toBe(false);
		expect(result.reloaded).toBe(false);
		expect(result.reason).toContain("no shared proxy sites directory");
	});

	it("writes a Caddyfile block routing indusk.dawn to the given port", async () => {
		mkdirSync(sitesDir, { recursive: true });
		const result = await registerAdminRoute(4242);

		expect(result.changed).toBe(true);
		const sitePath = join(sitesDir, "indusk-admin.caddyfile");
		expect(existsSync(sitePath)).toBe(true);
		const content = readFileSync(sitePath, "utf-8");
		expect(content).toContain(`${ADMIN_HOSTNAME} {`);
		expect(content).toContain("reverse_proxy 127.0.0.1:4242");
		expect(content).toContain("issuer internal");
	});

	it("overwrites the block on a second call with a different port (idempotent)", async () => {
		mkdirSync(sitesDir, { recursive: true });
		await registerAdminRoute(1111);
		await registerAdminRoute(2222);

		const content = readFileSync(join(sitesDir, "indusk-admin.caddyfile"), "utf-8");
		expect(content).toContain("reverse_proxy 127.0.0.1:2222");
		expect(content).not.toContain("127.0.0.1:1111");
	});

	it("reports reloaded:false with a reason when no Caddy config is found", async () => {
		mkdirSync(sitesDir, { recursive: true });
		const result = await registerAdminRoute(3939);
		expect(result.reloaded).toBe(false);
		expect(result.reason).toContain("no Caddy config found");
	});
});

describe("deregisterAdminRoute", () => {
	it("no-ops when no route is currently registered", async () => {
		const result = await deregisterAdminRoute();
		expect(result.changed).toBe(false);
		expect(result.reloaded).toBe(false);
		expect(result.reason).toContain("no route was registered");
	});

	it("removes the Caddyfile block that registerAdminRoute wrote", async () => {
		mkdirSync(sitesDir, { recursive: true });
		await registerAdminRoute(3939);
		const sitePath = join(sitesDir, "indusk-admin.caddyfile");
		expect(existsSync(sitePath)).toBe(true);

		const result = await deregisterAdminRoute();
		expect(result.changed).toBe(true);
		expect(existsSync(sitePath)).toBe(false);
	});
});

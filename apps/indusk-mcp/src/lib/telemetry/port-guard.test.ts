import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * The startup port guard.
 *
 * `findFreePort` falls back to a random high port when the requested one is
 * taken, and says nothing. That is how a leaked jaeger on `:4318` made a whole
 * dev stack's traces disappear: the daemon came up elsewhere, the exporter kept
 * posting to `:4318`, and the stray answered 404 because it is not an OTLP
 * receiver. Everything reported healthy.
 *
 * These tests bind real sockets rather than stubbing the probe — the bug was a
 * real port being really occupied, and a stub would only prove the guard reads
 * whatever the stub returns.
 */

describe("daemonStart port guard", { timeout: 30000 }, () => {
	let home: string;
	let servers: Server[];
	let originalHome: string | undefined;

	function occupy(): Promise<number> {
		return new Promise((resolve, reject) => {
			const s = createServer();
			servers.push(s);
			s.once("error", reject);
			s.listen(0, "127.0.0.1", () => {
				const addr = s.address();
				if (typeof addr === "object" && addr !== null) resolve(addr.port);
				else reject(new Error("no port"));
			});
		});
	}

	beforeEach(() => {
		// A fresh INDUSK_HOME means daemonStatus() reports not-running, which is
		// exactly the state in which the old code would silently bump the port.
		home = mkdtempSync(join(tmpdir(), "port-guard-home-"));
		originalHome = process.env.INDUSK_HOME;
		process.env.INDUSK_HOME = home;
		servers = [];
	});

	afterEach(async () => {
		for (const s of servers) await new Promise((r) => s.close(() => r(null)));
		process.env.INDUSK_HOME = originalHome;
		rmSync(home, { recursive: true, force: true });
	});

	it("refuses to start when the requested OTLP port is already served", async () => {
		const { daemonStart } = await import("./daemon.js");
		const taken = await occupy();

		await expect(daemonStart({ otlpPort: taken, uiPort: 0 })).rejects.toThrow(
			/Refusing to start.*OTLP :\d+.*already in use/s,
		);
	});

	it("names the reap command, because a leaked daemon is the common cause", async () => {
		const { daemonStart } = await import("./daemon.js");
		const taken = await occupy();

		await expect(daemonStart({ otlpPort: taken, uiPort: 0 })).rejects.toThrow(
			/indusk telemetry reap/,
		);
	});

	it("refuses on the UI port too, not just OTLP", async () => {
		const { daemonStart } = await import("./daemon.js");
		const taken = await occupy();

		await expect(daemonStart({ otlpPort: 0, uiPort: taken })).rejects.toThrow(/Jaeger UI :\d+/);
	});

	// The two cases below assert the guard LETS something through. They call the
	// guard directly rather than daemonStart, because daemonStart would go on to
	// spawn a real detached daemon into this temp INDUSK_HOME — which afterEach
	// then deletes, orphaning it. The first version of this file did exactly
	// that and leaked four processes, which is the bug the guard exists to
	// prevent the consequences of. Testing the seam is not a weaker assertion
	// here: the three cases above already prove the guard is wired into
	// daemonStart, because they reach it through daemonStart.

	it("port 0 means 'any', so an occupied port is not a conflict", async () => {
		const { assertRequestedPortsFree } = await import("./daemon.js");
		await occupy();

		await expect(assertRequestedPortsFree({ otlpPort: 0, uiPort: 0 })).resolves.toBeUndefined();
	});

	it("--allow-port-bump restores the old silent-bump behaviour deliberately", async () => {
		const { assertRequestedPortsFree } = await import("./daemon.js");
		const taken = await occupy();

		await expect(
			assertRequestedPortsFree({ otlpPort: taken, uiPort: 0, allowPortBump: true }),
		).resolves.toBeUndefined();
	});
});

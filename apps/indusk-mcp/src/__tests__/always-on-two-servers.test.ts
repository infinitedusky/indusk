import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { SHOULD_SKIP } from "./helpers/cli.js";

/**
 * day-always-on-deploy — A8: two always-on servers start on one host.
 *
 * The server's config set the OTLP and query ports and left Jaeger's gRPC
 * query port to its default, 16685. A second server on the same host then
 * failed to bind it and exited — found when `always-on-server` and
 * `always-on-falsification` collided in a parallel run (watcher-heartbeat,
 * 2026-10-03), and the reason every always-on test file runs alone.
 */

describe.skipIf(SHOULD_SKIP)("A8 — two servers on one host", () => {
	const servers: AlwaysOnServer[] = [];

	afterAll(async () => {
		for (const s of servers) {
			await s.stop();
			rmSync(s.volume, { recursive: true, force: true });
		}
	});

	it("both start and both answer", async () => {
		const started = await Promise.allSettled([startAlwaysOnServer(), startAlwaysOnServer()]);
		for (const s of started) if (s.status === "fulfilled") servers.push(s.value);
		const refused = started
			.filter((s): s is PromiseRejectedResult => s.status === "rejected")
			.map((s) => String(s.reason).slice(0, 600));
		expect(
			refused,
			"lesson: a-port-left-to-its-default-is-a-port-two-instances-share — every port a server binds comes from its settings",
		).toEqual([]);
		for (const s of servers) {
			const res = await s.query("/api/services");
			expect(res.status).toBe(200);
		}
	}, 120_000);
});

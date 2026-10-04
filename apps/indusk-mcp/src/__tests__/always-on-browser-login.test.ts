import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { newTraceId } from "./helpers/local-jaeger.js";

/**
 * day-always-on-deploy — A12: a person who opens a trace link in a browser
 * is asked to log in, and once logged in sees the trace.
 *
 * Jaeger's basic auth (the collector's `basicauth` extension) rejects a
 * request with a bare 401 and no `WWW-Authenticate` challenge. Programs send
 * credentials up front and never notice; a browser that is never challenged
 * never shows a login box, so the Slack trace link said "no basic auth
 * provided" and nothing else (found on the first real deploy, 2026-10-04).
 */

describe.skipIf(SHOULD_SKIP)("A12 — the query door asks a browser to log in", () => {
	let server: AlwaysOnServer;
	const traceId = newTraceId();

	beforeAll(async () => {
		server = await startAlwaysOnServer();
		await server.load([{ service: "seats-api", name: "hold-seat", traceId }]);
	}, 60_000);

	afterAll(async () => {
		await server?.stop();
		if (server) rmSync(server.volume, { recursive: true, force: true });
	});

	it("without credentials: 401 with a Basic challenge, so a browser shows a login box", async () => {
		const res = await server.query(`/trace/${traceId}`, { authenticated: false });
		expect(res.status).toBe(401);
		expect(
			res.headers.get("www-authenticate") ?? "",
			"lesson: a-401-without-a-challenge-is-a-door-a-browser-cannot-open",
		).toMatch(/^Basic\b/);
	});

	it("with credentials: the trace page and the trace itself", async () => {
		const page = await server.query(`/trace/${traceId}`);
		expect(page.status).toBe(200);
		expect(await page.text()).toMatch(/<html/i);
		const api = await server.query(`/api/traces/${traceId}`);
		expect(api.status).toBe(200);
		const json = (await api.json()) as { data?: unknown[] };
		expect(json.data?.length).toBe(1);
	});

	it("wrong credentials are refused with the same challenge", async () => {
		const res = await fetch(`${server.queryUrl}/api/services`, {
			headers: { authorization: `Basic ${Buffer.from("indusk:wrong").toString("base64")}` },
		});
		expect(res.status).toBe(401);
		expect(res.headers.get("www-authenticate") ?? "").toMatch(/^Basic\b/);
	});
});

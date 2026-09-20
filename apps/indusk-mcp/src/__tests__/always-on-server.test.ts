import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { newTraceId, otlpBody } from "./helpers/local-jaeger.js";

/**
 * day-always-on — A1–A4: the server keeps what it is sent, and refuses what
 * arrives without credentials (ADR D1).
 *
 * The real binary in its server configuration, started through
 * `indusk telemetry serve` on free ports with a volume the test owns: a stub
 * would test our guess at Jaeger's auth and storage rather than Jaeger's.
 *
 * Red today: `telemetry serve` is not a command, so the helper's start throws
 * with the CLI's "unknown command" in its message. Green after Build Phase 1.
 */

const PROMISE = "seat-never-double-booked";

describe.skipIf(SHOULD_SKIP)("day-always-on — the server keeps what it is sent", () => {
	let server: AlwaysOnServer;
	let kept: string;

	beforeAll(async () => {
		server = await startAlwaysOnServer();
		[kept] = await server.load([
			{
				service: "fixture-app",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "violated",
				symptom: "seat 4 held by two players",
				traceId: newTraceId(),
				attributes: { "deployment.environment": "staging" },
			},
		]);
	}, 120_000);

	afterAll(async () => {
		await server?.stop();
		if (server) rmSync(server.volume, { recursive: true, force: true });
	});

	it("A1 — a marked span sent with valid credentials is queryable afterwards", async () => {
		const res = await server.query(`/api/traces/${kept}`);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: { spans: { tags: { key: string }[] }[] }[] };
		expect(json.data).toHaveLength(1);
		const tags = json.data[0].spans[0].tags.map((t) => t.key);
		expect(tags).toContain("indusk.promise");
	});

	it("A2 — the same span is still there after the server restarts", async () => {
		await server.restart();
		const res = await server.query(`/api/traces/${kept}`);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: unknown[] };
		expect(json.data, "the trace survived the restart").toHaveLength(1);
	});

	it("A3 — OTLP without credentials is refused, and nothing is stored", async () => {
		const traceId = newTraceId();
		const { body } = otlpBody([
			{
				service: "fixture-app",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "violated",
				traceId,
			},
		]);
		const refused = await server.postOtlp(body, { authenticated: false });
		expect(refused.status).toBe(401);
		// Nothing was stored: the trace never becomes queryable.
		await new Promise((r) => setTimeout(r, 2_000));
		const res = await server.query(`/api/traces/${traceId}`);
		const json = res.ok ? ((await res.json()) as { data?: unknown[] }) : { data: [] };
		expect(json.data ?? []).toHaveLength(0);
	});

	it("A4 — a query without credentials is refused", async () => {
		const res = await server.query("/api/services", { authenticated: false });
		expect(res.status).toBe(401);
	});
});

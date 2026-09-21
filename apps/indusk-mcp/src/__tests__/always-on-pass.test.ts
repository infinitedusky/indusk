import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { runCliAsync, SHOULD_SKIP } from "./helpers/cli.js";
import { newTraceId } from "./helpers/local-jaeger.js";
import { refusingSlackUrl, type SlackCapture, startSlackCapture } from "./helpers/slack-capture.js";

/**
 * day-always-on — A5–A9: the pass announces a violation once, and never
 * loses one it could not announce (ADR D2, D3).
 *
 * The pass is driven through `indusk telemetry announce --once` — the same
 * pass the server runs on its interval, entered once so a test can say when
 * it happened rather than waiting on a clock. Slack is a capture server; the
 * violations are real spans in the real server.
 *
 * Red today: `telemetry announce` is not a command. Green after Build Phase 2.
 */

const PROMISE = "seat-never-double-booked";
const OTHER = "seat-release-on-timeout";

function announce(server: AlwaysOnServer, webhook: string) {
	// Async on purpose: the Slack capture lives in this process, and a
	// synchronous spawn would block the event loop it answers on.
	return runCliAsync(server.volume, ["telemetry", "announce", "--once"], {
		INDUSK_SERVER_VOLUME: server.volume,
		INDUSK_SERVER_QUERY_URL: server.queryUrl,
		INDUSK_SERVER_CREDENTIAL: server.credential,
		INDUSK_SERVER_SLACK_WEBHOOK: webhook,
	});
}

describe.skipIf(SHOULD_SKIP)("day-always-on — the pass announces", () => {
	let server: AlwaysOnServer;
	let slack: SlackCapture;
	let violated = "";

	beforeAll(async () => {
		server = await startAlwaysOnServer();
		slack = await startSlackCapture();
		violated = newTraceId();
		await server.load([
			{
				service: "seats-api",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "violated",
				symptom: "seat 4 held by two players",
				traceId: violated,
				attributes: { "deployment.environment": "staging" },
			},
			{
				service: "seats-api",
				name: "release-seat",
				promise: OTHER,
				outcome: "upheld",
				attributes: { "deployment.environment": "staging" },
			},
		]);
	}, 120_000);

	afterAll(async () => {
		await server?.stop();
		await slack?.close();
		if (server) rmSync(server.volume, { recursive: true, force: true });
	});

	it("A5 — one message naming the promise, the symptom, the environment and the trace", async () => {
		const r = await announce(server, slack.url);
		expect(r.stdout + r.stderr, "the pass ran").not.toMatch(/unknown command/);
		expect(r.code, r.stdout + r.stderr).toBe(0);
		const posts = await slack.waitForPosts(1, 10_000);
		expect(posts).toHaveLength(1);
		const text = slack.texts()[0];
		expect(text).toContain(PROMISE);
		expect(text).toContain("seat 4 held by two players");
		expect(text).toMatch(/staging/);
		expect(text).toContain(violated);
	});

	it("A6 — a second pass over the same violation says nothing more", async () => {
		const before = slack.posts().length;
		const r = await announce(server, slack.url);
		expect(r.code).toBe(0);
		expect(slack.posts()).toHaveLength(before);
	});

	it("A7 — an upheld promise is never announced", () => {
		expect(slack.texts().some((t) => t.includes(OTHER))).toBe(false);
	});
});

describe.skipIf(SHOULD_SKIP)("day-always-on — an environment nobody set", () => {
	let server: AlwaysOnServer;
	let slack: SlackCapture;

	beforeAll(async () => {
		server = await startAlwaysOnServer();
		slack = await startSlackCapture();
		await server.load([
			{
				service: "seats-api",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "violated",
				symptom: "seat 9 held by two players",
				traceId: newTraceId(),
			},
		]);
	}, 120_000);

	afterAll(async () => {
		await server?.stop();
		await slack?.close();
		if (server) rmSync(server.volume, { recursive: true, force: true });
	});

	it("A8 — reads 'environment unknown' rather than a guess", async () => {
		const r = await announce(server, slack.url);
		expect(r.code).toBe(0);
		await slack.waitForPosts(1, 10_000);
		const text = slack.texts()[0];
		expect(text).toMatch(/environment unknown/i);
		expect(text).not.toMatch(/\bstaging\b|\bproduction\b/);
	});
});

describe.skipIf(SHOULD_SKIP)("day-always-on — Slack unreachable", () => {
	let server: AlwaysOnServer;
	let slack: SlackCapture;
	let gone = "";

	beforeAll(async () => {
		server = await startAlwaysOnServer();
		slack = await startSlackCapture();
		gone = await refusingSlackUrl();
		await server.load([
			{
				service: "seats-api",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "violated",
				symptom: "seat 7 held by two players",
				traceId: newTraceId(),
				attributes: { "deployment.environment": "production" },
			},
		]);
	}, 120_000);

	afterAll(async () => {
		await server?.stop();
		await slack?.close();
		if (server) rmSync(server.volume, { recursive: true, force: true });
	});

	it("A9 — the violation stays unannounced and is said so; the next pass announces it", async () => {
		const failed = await announce(server, gone);
		const said = failed.stdout + failed.stderr;
		expect(said, "the pass says it could not announce").toMatch(/could not announce|unannounced/i);

		const recovered = await announce(server, slack.url);
		expect(recovered.code).toBe(0);
		const posts = await slack.waitForPosts(1, 10_000);
		expect(posts, "the violation Slack never received is announced by the next pass").toHaveLength(
			1,
		);
		expect(slack.texts()[0]).toContain(PROMISE);
	});
});

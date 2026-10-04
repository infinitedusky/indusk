import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { newTraceId } from "./helpers/local-jaeger.js";
import { type SlackCapture, startSlackCapture } from "./helpers/slack-capture.js";

/**
 * day-always-on-deploy — A11: the trace link in a Slack announcement opens
 * the trace from wherever the person reading Slack is.
 *
 * The first real deploy announced `http://127.0.0.1:16686/trace/<id>` — the
 * address the server's own pass uses to query its own Jaeger, which goes
 * nowhere from anyone's Slack client. No test asserted the link, so the suite
 * passed with a link nobody could open. The server now takes the address
 * people use, `INDUSK_SERVER_PUBLIC_QUERY_URL`; without it the message names
 * the trace and says how to get a link, rather than offering a loopback one.
 */

const PROMISE = "seat-never-double-booked";

async function announced(slack: SlackCapture, traceId: string): Promise<string> {
	const deadline = Date.now() + 20_000;
	for (;;) {
		const text = slack.texts().find((t) => t.includes(traceId));
		if (text) return text;
		if (Date.now() > deadline) throw new Error(`no announcement for ${traceId}: ${slack.texts()}`);
		await new Promise((r) => setTimeout(r, 250));
	}
}

describe.skipIf(SHOULD_SKIP)("A11 — the trace link opens from outside the server", () => {
	let server: AlwaysOnServer | undefined;
	let slack: SlackCapture | undefined;

	afterEach(async () => {
		await server?.stop();
		if (server) rmSync(server.volume, { recursive: true, force: true });
		await slack?.close();
		server = undefined;
		slack = undefined;
	});

	it("with the public address set, the link is that address and it opens the trace", async () => {
		slack = await startSlackCapture();
		// The test reaches the server at its query URL; that is the public
		// address here, as https://<app>.fly.dev:16687 is on Fly.
		const placeholder = "https://public.example";
		server = await startAlwaysOnServer({
			env: {
				INDUSK_SERVER_PASS_INTERVAL_MS: "1000",
				INDUSK_SERVER_SLACK_WEBHOOK: slack.url,
				INDUSK_SERVER_PUBLIC_QUERY_URL: placeholder,
			},
		});
		const traceId = newTraceId();
		await server.load([
			{ service: "seats-api", name: "hold-seat", promise: PROMISE, outcome: "violated", traceId },
		]);
		const text = await announced(slack, traceId);
		expect(text).toContain(`${placeholder}/trace/${traceId}`);
		expect(text, "never the server's own loopback address").not.toMatch(/127\.0\.0\.1|localhost/);
		// The path is one the query API serves: the same trace, by the same path.
		const res = await server.query(`/api/traces/${traceId}`);
		expect(res.status).toBe(200);
	}, 60_000);

	it("without it, the message names the trace and says how to get a link — no loopback link", async () => {
		slack = await startSlackCapture();
		server = await startAlwaysOnServer({
			env: { INDUSK_SERVER_PASS_INTERVAL_MS: "1000", INDUSK_SERVER_SLACK_WEBHOOK: slack.url },
		});
		const traceId = newTraceId();
		await server.load([
			{ service: "seats-api", name: "hold-seat", promise: PROMISE, outcome: "violated", traceId },
		]);
		const text = await announced(slack, traceId);
		expect(text).toContain(traceId);
		expect(text).not.toMatch(/127\.0\.0\.1|localhost/);
		expect(text).toMatch(/INDUSK_SERVER_PUBLIC_QUERY_URL/);
	}, 60_000);
});

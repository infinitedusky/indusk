import { describe, expect, it } from "vitest";
import {
	MissingServerSetting,
	PUBLIC_QUERY_URL_ENV,
	readServerSettings,
} from "../lib/telemetry/server.js";

/**
 * day-always-on-deploy — A15: the public query URL is checked at start
 * (Build Phase 4, falsification).
 *
 * The server posts `INDUSK_SERVER_PUBLIC_QUERY_URL` into every Slack
 * announcement and every "watcher blind" message. It was only trimmed of
 * trailing slashes, so a URL with the credential in it — a natural way to make
 * a link "just work" — posted the password to the channel, and a URL without
 * a scheme posted a link Slack cannot open. Both are refused by name, the way
 * every other setting is.
 */

const BASE: NodeJS.ProcessEnv = {
	INDUSK_SERVER_VOLUME: "/data",
	INDUSK_SERVER_OTLP_PORT: "4318",
	INDUSK_SERVER_QUERY_PORT: "16687",
	INDUSK_SERVER_USER: "indusk",
	INDUSK_SERVER_PASSWORD: "hunter2-hunter2",
	INDUSK_SERVER_SLACK_WEBHOOK: "https://hooks.slack.test/x",
};

function withPublic(url: string) {
	return () => readServerSettings({ ...BASE, [PUBLIC_QUERY_URL_ENV]: url });
}

describe("A15 — a public query URL that cannot be posted is refused by name", () => {
	it.each([
		["a user and password", "https://indusk:hunter2-hunter2@app.fly.dev:16687"],
		["a user alone", "https://indusk@app.fly.dev:16687"],
		["no scheme", "app.fly.dev:16687"],
		["a scheme Slack will not open", "ftp://app.fly.dev:16687"],
		["a query string, which /trace/<id> would land inside", "https://app.fly.dev:16687/?x=1"],
		["a fragment", "https://app.fly.dev:16687/#top"],
		["not a URL at all", "the fly app"],
	])("refuses %s", (_what, url) => {
		const read = withPublic(url);
		expect(read).toThrow(MissingServerSetting);
		expect(read).toThrow(PUBLIC_QUERY_URL_ENV);
		// The refusal is printed to the server's log: it must not carry the
		// secret it refused.
		try {
			read();
		} catch (err) {
			expect((err as Error).message).not.toContain("hunter2");
		}
	});

	it.each([
		["https://app.fly.dev:16687/", "https://app.fly.dev:16687"],
		["  http://10.0.0.5:16687  ", "http://10.0.0.5:16687"],
		["https://ops.example.com/jaeger/", "https://ops.example.com/jaeger"],
	])("accepts %j as %j", (url, expected) => {
		expect(withPublic(url)().publicQueryUrl).toBe(expected);
	});
});

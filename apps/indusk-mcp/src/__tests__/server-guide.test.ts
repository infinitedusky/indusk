import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as server from "../lib/telemetry/server.js";
import { MissingServerSetting, readServerSettings } from "../lib/telemetry/server.js";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * server-provisioning A21: the guide for running your own recording server
 * names everything a person on another host must set. A server setting added
 * without a line in the guide is the 2026-10-04 deploy again, where the
 * written steps and the server disagreed.
 *
 * Which settings are required is asked of the server's own reader — each one
 * removed from a complete environment in turn — never listed here.
 *
 * A regression guard; no promise.
 */

const GUIDE = join(REPO_ROOT, "apps/docs/src/guide/run-your-own-server.md");

const COMPLETE: NodeJS.ProcessEnv = {
	[server.VOLUME_ENV]: "/data",
	[server.OTLP_PORT_ENV]: "4318",
	[server.QUERY_PORT_ENV]: "16686",
	[server.USER_ENV]: "indusk",
	[server.PASSWORD_ENV]: "guide-test",
	[server.SLACK_WEBHOOK_ENV]: "https://hooks.slack.com/services/T/B/x",
};

/** Every `INDUSK_SERVER_*` the module names, read from its exports. */
const settings = Object.values(server).filter(
	(v): v is string => typeof v === "string" && v.startsWith("INDUSK_SERVER_"),
);

function requiredSettings(): string[] {
	return settings.filter((name) => {
		const env = { ...COMPLETE };
		delete env[name];
		try {
			readServerSettings(env);
			return false;
		} catch (e) {
			return e instanceof MissingServerSetting;
		}
	});
}

describe("A21 — the run-your-own-server guide names what the server needs", () => {
	it("the complete environment starts the reader, so the probe below means something", () => {
		expect(() => readServerSettings(COMPLETE)).not.toThrow();
		expect(requiredSettings()).toContain(server.PASSWORD_ENV);
	});

	it("the guide exists", () => {
		expect(existsSync(GUIDE), "apps/docs/src/guide/run-your-own-server.md").toBe(true);
	});

	it("names every required setting, the volume, both ports and the connect command", () => {
		const guide = existsSync(GUIDE) ? readFileSync(GUIDE, "utf-8") : "";
		const missing = [
			...requiredSettings(),
			server.VOLUME_ENV,
			server.OTLP_PORT_ENV,
			server.QUERY_PORT_ENV,
			"indusk server connect",
		].filter((needle) => !guide.includes(needle));
		expect(missing, "not named in the guide").toEqual([]);
	});
});

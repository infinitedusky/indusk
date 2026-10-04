import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { heartbeatPass, watcherStatePath } from "../lib/always-on/heartbeat.js";
import { jaegerEndpoint } from "../lib/promises/telemetry.js";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	type FakeQueryPort,
	type LocalJaeger,
	startFakeQueryPort,
	startLocalJaeger,
} from "./helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";
import { type SlackCapture, startSlackCapture } from "./helpers/slack-capture.js";
import { block } from "./helpers/status-output.js";

/**
 * watcher-heartbeat — Build Phase 4, falsification. Six hypotheses found by
 * reading the built code; each row is red until its fix lands.
 *
 * A9  — `--since` is widened by `expect_every` and counts outside the window shown.
 * A10 — a server restarted while blind tells Slack "recovered" with no beat landing.
 * A11 — an unwritable watcher state makes "blind" repeat every pass.
 * A12 — with more beats than one query returns, the newest is not the one read.
 * A14 — `expect_every` on a state promise is accepted and never acted on.
 * (A13 is the admin's, in `http-watcher-blind.test.ts`.)
 */

const OWNER = "seats-v2";

function behaviour(name: string, extra: Record<string, unknown> = {}) {
	return {
		name,
		kind: "behaviour" as const,
		state: "enforced" as const,
		domain: "seating",
		owner: OWNER,
		sites: [`src/${name}.ts`],
		tests: [`src/${name}.test.ts`],
		...extra,
	};
}

describe.skipIf(SHOULD_SKIP)("A9 — --since is the window counted", () => {
	const DAILY = "every-commit-evaluated";
	let jaeger: LocalJaeger;
	let fixture: PromiseProject;

	beforeAll(async () => {
		fixture = promiseProject({
			domains: ["seating"],
			landed: { [OWNER]: daysAgo(30) },
			promises: [behaviour(DAILY, { expect_every: "1d" })],
			files: { [`src/${DAILY}.ts`]: siteFile(DAILY), [`src/${DAILY}.test.ts`]: testFile(DAILY) },
		});
		jaeger = await startLocalJaeger();
		await jaeger.load([
			{
				service: "app",
				name: "evaluate",
				promise: DAILY,
				outcome: "violated",
				symptom: "twenty hours ago",
				at: new Date(Date.now() - 20 * 3_600_000),
			},
		]);
	}, 120_000);

	afterAll(() => {
		jaeger?.stop();
		if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("a violation from twenty hours ago is not counted in the last 90m", () => {
		const r = runCli(fixture.root, ["promises", "status", "--since", "90m"], {
			INDUSK_HOME: jaeger.home,
		});
		const b = block(r.stdout + r.stderr, DAILY);
		expect(b, r.stdout + r.stderr).not.toBe("");
		expect(b).not.toMatch(/\b1 violation\b/);
		expect(b).not.toContain("twenty hours ago");
	}, 60_000);
});

describe.skipIf(SHOULD_SKIP)("A10, A11 — the heartbeat's state", () => {
	let slack: SlackCapture;
	let volume: string;
	let fake: FakeQueryPort | undefined;

	beforeAll(async () => {
		slack = await startSlackCapture();
	});

	afterEach(async () => {
		await fake?.close();
		fake = undefined;
		if (volume) rmSync(volume, { recursive: true, force: true });
	});

	afterAll(async () => {
		await slack?.close();
	});

	it("A10 — restarted while blind, with no beat landing: no 'recovered'", async () => {
		volume = mkdtempSync(join(tmpdir(), "watcher-volume-"));
		const since = new Date(Date.now() - 3_600_000).toISOString();
		writeFileSync(watcherStatePath(volume), JSON.stringify({ state: "blind", since }));
		// A Jaeger that answers and holds no heartbeat: nothing has landed.
		const home = mkdtempSync(join(tmpdir(), "watcher-fake-home-"));
		fake = await startFakeQueryPort(home, '{"data":[]}');
		const url = `http://127.0.0.1:${fake.port}`;
		const before = slack.texts().length;

		await heartbeatPass({
			volume,
			endpoint: jaegerEndpoint(url),
			intakeUrl: url,
			webhook: slack.url,
			staleMs: 180_000,
			startedAt: new Date(), // the server has just restarted
		});

		const said = slack.texts().slice(before);
		expect(
			said.filter((t) => /recovered/i.test(t)),
			said.join("\n"),
		).toEqual([]);
		const state = JSON.parse(readFileSync(watcherStatePath(volume), "utf-8"));
		expect(state.state).toBe("blind");
		rmSync(home, { recursive: true, force: true });
	});

	it("A11 — the state cannot be written: Slack hears 'blind' once at most, not every pass", async () => {
		volume = mkdtempSync(join(tmpdir(), "watcher-volume-"));
		// A directory where the state file belongs: every write fails.
		mkdirSync(watcherStatePath(volume));
		const refused = "http://127.0.0.1:1"; // nothing listens: the read fails, so blind
		const before = slack.texts().length;

		for (let i = 0; i < 3; i++) {
			await heartbeatPass({
				volume,
				endpoint: jaegerEndpoint(refused),
				intakeUrl: refused,
				webhook: slack.url,
				staleMs: 180_000,
				startedAt: new Date(Date.now() - 3_600_000),
				timeoutMs: 1_000,
			}).catch(() => undefined);
		}

		const blind = slack
			.texts()
			.slice(before)
			.filter((t) => /blind/i.test(t));
		expect(
			blind.length,
			`lesson: an-alarm-must-not-travel-the-path-it-reports — prove the state writable before telling\n${blind.join("\n")}`,
		).toBeLessThanOrEqual(1);
	}, 30_000);
});

describe.skipIf(SHOULD_SKIP)("A12 — more heartbeats than one query returns", () => {
	let server: AlwaysOnServer;
	let slack: SlackCapture;

	beforeAll(async () => {
		slack = await startSlackCapture();
		server = await startAlwaysOnServer({
			env: {
				INDUSK_SERVER_PASS_INTERVAL_MS: "1000",
				INDUSK_SERVER_WATCHER_STALE_MS: "5000",
				INDUSK_SERVER_SLACK_WEBHOOK: slack.url,
			},
		});
	}, 60_000);

	afterAll(async () => {
		await server?.stop();
		if (server) rmSync(server.volume, { recursive: true, force: true });
		await slack?.close();
	});

	it("after 60+ passes the server still reads its newest beat and stays listening", async () => {
		await new Promise((r) => setTimeout(r, 70_000));
		const blind = slack.texts().filter((t) => /watcher blind/i.test(t));
		expect(blind, blind.join("\n")).toEqual([]);
	}, 120_000);
});

describe.skipIf(SHOULD_SKIP)("A14 — expect_every on a promise nothing would judge", () => {
	let fixture: PromiseProject;

	beforeAll(() => {
		fixture = promiseProject({
			domains: ["seating"],
			landed: { [OWNER]: daysAgo(30) },
			promises: [
				{
					name: "seat-count-matches-table",
					kind: "state",
					state: "enforced",
					domain: "seating",
					owner: OWNER,
					statement: "A table's seat count equals the seats stored for it.",
					sites: ["src/table.ts"],
					tests: ["src/table.test.ts"],
					expect_every: "1d",
				},
			],
			files: {
				"src/table.ts": siteFile("seat-count-matches-table"),
				"src/table.test.ts": testFile("seat-count-matches-table"),
			},
		});
	});

	afterAll(() => {
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("promises check refuses it, naming expect_every", () => {
		const r = runCli(fixture.root, ["promises", "check"]);
		const text = r.stdout + r.stderr;
		expect(r.code, text).not.toBe(0);
		expect(text).toMatch(/expect_every/);
	});
});

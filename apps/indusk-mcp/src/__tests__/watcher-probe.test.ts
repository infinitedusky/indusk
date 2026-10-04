import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import { CLI_BIN, SHOULD_SKIP } from "./helpers/cli.js";
import {
	type FakeQueryPort,
	type LocalJaeger,
	newTraceId,
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
import { toolCaller } from "./helpers/tool-call.js";

/**
 * watcher-heartbeat — A1–A4: every promise read proves the watcher can hear
 * before it reports anything (ADR D1).
 *
 * A2 is the founding case. On 2026-10-01 a test's leaked Jaeger answered on
 * the default ports and every reader reported this repository's behaviour
 * promises healthy after seven silent days. The fake here answers every
 * request the way an empty Jaeger does (`{"data":[]}`) and stores nothing —
 * reachable, not listening.
 *
 * A1 and A3 are regression guards: a listening daemon reads as it always has,
 * and a stopped one is still "cannot be reached", never a count.
 *
 * Red today: A2 reads "not seen" with exit 0; A4 finds no probe span.
 */

const PROMISE = "seat-never-double-booked";
const OWNER = "seats-v2";
const EMPTY_JAEGER = '{"data":[]}';
const LESSON =
	"lesson: reachable-is-not-listening — a Jaeger that answers is not one that hears; probe before reporting";

function project(): PromiseProject {
	return promiseProject({
		domains: ["seating"],
		landed: { [OWNER]: daysAgo(30) },
		promises: [
			{
				name: PROMISE,
				kind: "behaviour",
				state: "enforced",
				domain: "seating",
				owner: OWNER,
				sites: [`src/${PROMISE}.ts`],
				tests: [`src/${PROMISE}.test.ts`],
			},
		],
		files: {
			[`src/${PROMISE}.ts`]: siteFile(PROMISE),
			[`src/${PROMISE}.test.ts`]: testFile(PROMISE),
		},
	});
}

/** The CLI, spawned asynchronously: a fake port answers from this process. */
function status(root: string, home: string): Promise<{ code: number; text: string }> {
	return new Promise((resolve) => {
		execFile(
			process.execPath,
			[CLI_BIN, "promises", "status"],
			{ cwd: root, env: { ...process.env, INDUSK_HOME: home, INDUSK_SKIP_UPDATE_CHECK: "1" } },
			(err, stdout, stderr) =>
				resolve({
					code: err ? ((err as { code?: number }).code ?? 1) : 0,
					text: stdout + stderr,
				}),
		);
	});
}

/** `promise_health`, in this process, reading the daemon recorded in `home`. */
async function health(root: string, home: string): Promise<{ json: unknown; isError: boolean }> {
	const previous = process.env.INDUSK_HOME;
	process.env.INDUSK_HOME = home;
	try {
		const tools = toolCaller((server) => registerPlanTools(server, root));
		return await tools.call("promise_health", {});
	} finally {
		if (previous === undefined) delete process.env.INDUSK_HOME;
		else process.env.INDUSK_HOME = previous;
	}
}

/** Every span named `watcher.probe` the daemon holds from the `indusk-watcher` service. */
async function probeSpans(queryUrl: string): Promise<number> {
	const res = await fetch(
		`${queryUrl}/api/traces?service=indusk-watcher&operation=watcher.probe&limit=1000&lookback=1h`,
	);
	if (!res.ok) return 0;
	const json = (await res.json()) as { data?: { spans?: { operationName: string }[] }[] } | null;
	return (json?.data ?? [])
		.flatMap((t) => t.spans ?? [])
		.filter((s) => s.operationName === "watcher.probe").length;
}

describe.skipIf(SHOULD_SKIP)("watcher-heartbeat — a listening daemon", () => {
	let jaeger: LocalJaeger;
	let fixture: PromiseProject;
	const upheld = newTraceId();

	beforeAll(async () => {
		fixture = project();
		jaeger = await startLocalJaeger();
		await jaeger.load([
			{
				service: "seats-api",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "upheld",
				traceId: upheld,
			},
		]);
	}, 120_000);

	afterAll(() => {
		jaeger?.stop();
		if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("A1 — status and promise_health read the promise exactly as before", async () => {
		const cli = await status(fixture.root, jaeger.home);
		expect(cli.code, cli.text).toBe(0);
		expect(cli.text).toContain(upheld);
		expect(cli.text).not.toMatch(/watcher blind/i);

		const { json, isError } = await health(fixture.root, jaeger.home);
		expect(isError, JSON.stringify(json)).toBe(false);
		const row = (json as { promises: Record<string, unknown>[] }).promises.find(
			(p) => p.name === PROMISE,
		);
		expect(row?.violations).toBe(0);
		expect(JSON.stringify(json)).not.toMatch(/watcher blind/i);
	}, 60_000);
});

describe.skipIf(SHOULD_SKIP)("watcher-heartbeat — A4: the cost of probing", () => {
	// Its own daemon: the probe cache is per process and per query URL, so a
	// daemon another test in this file already read would start A4 cached.
	let jaeger: LocalJaeger;
	let fixture: PromiseProject;

	beforeAll(async () => {
		fixture = project();
		jaeger = await startLocalJaeger();
	}, 120_000);

	afterAll(() => {
		jaeger?.stop();
		if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("five reads within half a minute send one probe, not five", async () => {
		const before = await probeSpans(jaeger.queryUrl);
		for (let i = 0; i < 5; i++) await health(fixture.root, jaeger.home);
		// The probe is read back before the read continues, so it is already
		// queryable; allow Jaeger a moment for any later one to land too.
		await new Promise((r) => setTimeout(r, 2_000));
		const after = await probeSpans(jaeger.queryUrl);
		expect(after - before, "probe spans added by five reads in one process").toBe(1);
	}, 60_000);
});

describe.skipIf(SHOULD_SKIP)(
	"watcher-heartbeat — A2: a Jaeger that answers and hears nothing",
	() => {
		let fixture: PromiseProject;
		let home: string;
		let fake: FakeQueryPort;

		beforeAll(async () => {
			fixture = project();
			home = mkdtempSync(join(tmpdir(), "indusk-deaf-jaeger-home-"));
			fake = await startFakeQueryPort(home, EMPTY_JAEGER);
		});

		afterAll(async () => {
			await fake?.close();
			if (fixture) rmSync(fixture.root, { recursive: true, force: true });
			if (home) rmSync(home, { recursive: true, force: true });
		});

		it("status says watcher blind, names where it looked, exits 2, and gives no count", async () => {
			const cli = await status(fixture.root, home);
			expect(cli.text, LESSON).toMatch(/watcher blind/i);
			expect(cli.text).toContain(`http://localhost:${fake.port}`);
			expect(cli.code, cli.text).toBe(2);
			expect(cli.text).not.toMatch(/\b\d+ violations?\b/);
			expect(cli.text).not.toMatch(/not seen|upheld/i);
		}, 30_000);

		it("promise_health is an error saying watcher blind, with no promise rows", async () => {
			const { json, isError } = await health(fixture.root, home);
			const text = JSON.stringify(json);
			expect(text, LESSON).toMatch(/watcher blind/i);
			expect(isError, text).toBe(true);
			expect((json as { promises?: unknown[] }).promises ?? [], "no promise rows").toHaveLength(0);
		}, 30_000);
	},
);

describe.skipIf(SHOULD_SKIP)("watcher-heartbeat — A3: no daemon at all", () => {
	let fixture: PromiseProject;
	let home: string;

	beforeAll(() => {
		fixture = project();
		home = mkdtempSync(join(tmpdir(), "indusk-no-jaeger-home-"));
	});

	afterAll(() => {
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
		if (home) rmSync(home, { recursive: true, force: true });
	});

	it("status and promise_health say it cannot be reached, and never a count", async () => {
		const cli = await status(fixture.root, home);
		expect(cli.code, cli.text).toBe(2);
		expect(cli.text).toContain(join(home, "telemetry.json"));
		expect(cli.text).not.toMatch(/\b\d+ violations?\b/);

		const { json, isError } = await health(fixture.root, home);
		expect(isError, JSON.stringify(json)).toBe(true);
		expect((json as { promises?: unknown[] }).promises ?? [], "no promise rows").toHaveLength(0);
	}, 30_000);
});

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { runCliAsync } from "../src/__tests__/helpers/cli.js";
import { newTraceId, otlpBody } from "../src/__tests__/helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "../src/__tests__/helpers/promises-fixture.js";

/**
 * day-always-on-deploy — the scripted half of the smoke procedure, against a
 * real deployment (A2, A4, A6, A7).
 *
 * The guide's smoke procedure, as a test that runs against whatever server
 * the environment names, so the next deployment — a workbench's own — runs
 * the same checks:
 *
 *   INDUSK_DEPLOYED_QUERY_URL   https://<app>.fly.dev:16687   (the query API)
 *   INDUSK_DEPLOYED_OTLP_URL    https://<app>.fly.dev         (the OTLP intake)
 *   INDUSK_DEPLOYED_CREDENTIAL  user:password                 (never committed)
 *   INDUSK_DEPLOYED_FLY_APP     <app>                          (A4's restart only)
 *
 * Skipped by name when the first three are unset. A3 and A5 — a person reading
 * the Slack channel — are recorded in the plan, not asserted here: this file
 * sends the violation they read.
 */

const QUERY_URL = process.env.INDUSK_DEPLOYED_QUERY_URL?.replace(/\/+$/, "");
const OTLP_URL = process.env.INDUSK_DEPLOYED_OTLP_URL?.replace(/\/+$/, "");
const CREDENTIAL = process.env.INDUSK_DEPLOYED_CREDENTIAL;
const FLY_APP = process.env.INDUSK_DEPLOYED_FLY_APP;
const NAMED = Boolean(QUERY_URL && OTLP_URL && CREDENTIAL);

const PROMISE = "smoke-promise-reaches-the-server";
const OWNER = "smoke-owner";
const CRED_ENV = "INDUSK_DEPLOYED_CREDENTIAL";

function auth(): Record<string, string> {
	return { authorization: `Basic ${Buffer.from(CREDENTIAL ?? "").toString("base64")}` };
}

async function status(url: string, init: RequestInit = {}): Promise<number> {
	const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
	return res.status;
}

async function send(spans: Parameters<typeof otlpBody>[0]): Promise<string[]> {
	const { body, traceIds } = otlpBody(spans);
	const res = await fetch(`${OTLP_URL}/v1/traces`, {
		method: "POST",
		headers: { "content-type": "application/json", ...auth() },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(20_000),
	});
	if (!res.ok) throw new Error(`the deployed intake refused the span (${res.status})`);
	return traceIds;
}

async function traceFound(traceId: string): Promise<boolean> {
	const res = await fetch(`${QUERY_URL}/api/traces/${traceId}`, {
		headers: auth(),
		signal: AbortSignal.timeout(20_000),
	});
	if (!res.ok) return false;
	const json = (await res.json()) as { data?: unknown[] };
	return (json.data?.length ?? 0) > 0;
}

async function eventually(check: () => Promise<boolean>, ms: number): Promise<boolean> {
	const deadline = Date.now() + ms;
	for (;;) {
		if (await check().catch(() => false)) return true;
		if (Date.now() > deadline) return false;
		await new Promise((r) => setTimeout(r, 2_000));
	}
}

describe.skipIf(!NAMED)("day-always-on-deploy — the deployed server", () => {
	let fixture: PromiseProject | undefined;

	afterAll(() => {
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("A2 — both doors refuse without credentials and accept with them", async () => {
		const { body } = otlpBody([{ service: "smoke", name: "door-check" }]);
		const post = (headers: Record<string, string>) =>
			status(`${OTLP_URL}/v1/traces`, {
				method: "POST",
				headers: { "content-type": "application/json", ...headers },
				body: JSON.stringify(body),
			});
		expect(await post({}), "the intake without credentials").toBe(401);
		expect(await status(`${QUERY_URL}/api/services`), "the query API without credentials").toBe(
			401,
		);
		expect(await post(auth()), "the intake with credentials").toBeLessThan(300);
		expect(await status(`${QUERY_URL}/api/services`, { headers: auth() })).toBe(200);
	});

	it("A6 — a developer machine naming the server reads the violation, not blind", async () => {
		fixture = promiseProject({
			domains: ["smoke"],
			landed: { [OWNER]: daysAgo(30) },
			promises: [
				{
					name: PROMISE,
					kind: "behaviour",
					state: "enforced",
					domain: "smoke",
					owner: OWNER,
					sites: [`src/${PROMISE}.ts`],
					tests: [`src/${PROMISE}.test.ts`],
				},
			],
			files: {
				[`src/${PROMISE}.ts`]: siteFile(PROMISE),
				[`src/${PROMISE}.test.ts`]: testFile(PROMISE),
			},
			extraConfig: {
				promises: {
					domains: ["smoke"],
					jaeger: { url: QUERY_URL, otlp_url: OTLP_URL, credential_env: CRED_ENV },
				},
			},
		});
		const traceId = newTraceId();
		await send([
			{
				service: "smoke-app",
				name: "smoke-check",
				promise: PROMISE,
				outcome: "violated",
				symptom: "sent by the deploy smoke",
				traceId,
				resourceAttributes: { "deployment.environment": "smoke" },
			},
		]);
		expect(await eventually(() => traceFound(traceId), 60_000), "the trace landed").toBe(true);

		const r = await runCliAsync(fixture.root, ["promises", "status"], {
			[CRED_ENV]: CREDENTIAL,
		});
		const text = r.stdout + r.stderr;
		expect(text).not.toMatch(/watcher blind/i);
		expect(r.code, text).toBe(0);
		expect(text).toContain(QUERY_URL);
		expect(text).toContain(traceId);
	}, 120_000);

	it("A7 — the server holds a heartbeat younger than two pass intervals", async () => {
		const params = new URLSearchParams({
			service: "indusk-watcher",
			operation: "watcher.heartbeat",
			lookback: "1h",
			limit: "20",
		});
		const res = await fetch(`${QUERY_URL}/api/traces?${params}`, {
			headers: auth(),
			signal: AbortSignal.timeout(20_000),
		});
		expect(res.status).toBe(200);
		const json = (await res.json()) as { data?: { spans?: { startTime: number }[] }[] };
		const newest = Math.max(
			0,
			...(json.data ?? []).flatMap((t) => t.spans ?? []).map((s) => s.startTime / 1000),
		);
		expect(Date.now() - newest, "age of the newest heartbeat, ms").toBeLessThan(120_000);
	});

	it.skipIf(!FLY_APP)(
		"A4 — a trace sent before a machine restart is still there after",
		async () => {
			const [traceId] = await send([{ service: "smoke-app", name: "before-restart" }]);
			expect(await eventually(() => traceFound(traceId), 60_000), "landed before restart").toBe(
				true,
			);

			const list = spawnSync("fly", ["machine", "list", "-a", FLY_APP ?? "", "--json"], {
				encoding: "utf-8",
			});
			const machines = JSON.parse(list.stdout || "[]") as { id: string }[];
			expect(machines.length, list.stderr).toBe(1);
			const restart = spawnSync(
				"fly",
				["machine", "restart", machines[0].id, "-a", FLY_APP ?? ""],
				{
					encoding: "utf-8",
					timeout: 180_000,
				},
			);
			expect(restart.status, restart.stderr).toBe(0);

			expect(
				await eventually(() => traceFound(traceId), 120_000),
				"the trace survives the restart",
			).toBe(true);
		},
		360_000,
	);

	it.skipIf(!FLY_APP)(
		"A10 — the server's records survive a restart: both still parse, so it keeps announcing",
		async () => {
			// A pass writes both records every interval; a restart soon after
			// one left announced.json empty on the first deploy, and every pass
			// after refused to announce. Read them as the server will.
			const read = spawnSync(
				"fly",
				[
					"ssh",
					"console",
					"-a",
					FLY_APP ?? "",
					"-C",
					"sh -c 'cat /data/announced.json; echo; echo ---; cat /data/watcher-state.json'",
				],
				{ encoding: "utf-8", timeout: 90_000 },
			);
			expect(read.status, read.stderr).toBe(0);
			const [announced, state] = read.stdout.split("\n---\n").map((t) => t.trim());
			expect(
				() => JSON.parse(announced ?? ""),
				`lesson: a-rename-is-not-a-write-until-the-data-is-flushed — announced.json: ${JSON.stringify(announced)}`,
			).not.toThrow();
			expect(
				() => JSON.parse(state ?? ""),
				`watcher-state.json: ${JSON.stringify(state)}`,
			).not.toThrow();
		},
		120_000,
	);
});

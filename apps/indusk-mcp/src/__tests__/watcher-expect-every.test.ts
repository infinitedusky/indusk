import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { type LocalJaeger, startLocalJaeger } from "./helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";
import { block } from "./helpers/status-output.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * watcher-heartbeat — A8: a promise about something known to happen
 * regularly can say how silent is too silent (ADR D3).
 *
 * Silence from a listening watcher is the good outcome for most promises —
 * "an empty form is never submitted" should be quiet. Only a promise that
 * declares `expect_every` turns a quiet stretch into something to look at.
 * Both promises here were last marked three hours ago; one expects a mark
 * every hour.
 *
 * Red today: `expect_every` is a key nothing reads, and neither promise needs
 * attention.
 */

const EXPECTING = "every-commit-evaluated";
const QUIET = "empty-form-never-submitted";
const OWNER = "seats-v2";

describe.skipIf(SHOULD_SKIP)("watcher-heartbeat — A8: expect_every", () => {
	let jaeger: LocalJaeger;
	let fixture: PromiseProject;
	let previousHome: string | undefined;

	beforeAll(async () => {
		const behaviour = (name: string) => ({
			name,
			kind: "behaviour" as const,
			state: "enforced" as const,
			domain: "seating",
			owner: OWNER,
			sites: [`src/${name}.ts`],
			tests: [`src/${name}.test.ts`],
		});
		fixture = promiseProject({
			domains: ["seating"],
			landed: { [OWNER]: daysAgo(30) },
			promises: [{ ...behaviour(EXPECTING), expect_every: "1h" }, behaviour(QUIET)],
			files: Object.fromEntries(
				[EXPECTING, QUIET].flatMap((n) => [
					[`src/${n}.ts`, siteFile(n)],
					[`src/${n}.test.ts`, testFile(n)],
				]),
			),
		});
		jaeger = await startLocalJaeger();
		const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000);
		await jaeger.load([
			{
				service: "app",
				name: "evaluate",
				promise: EXPECTING,
				outcome: "upheld",
				at: threeHoursAgo,
			},
			{ service: "app", name: "submit", promise: QUIET, outcome: "upheld", at: threeHoursAgo },
		]);
		previousHome = process.env.INDUSK_HOME;
		process.env.INDUSK_HOME = jaeger.home;
	}, 120_000);

	afterAll(() => {
		if (previousHome === undefined) delete process.env.INDUSK_HOME;
		else process.env.INDUSK_HOME = previousHome;
		jaeger?.stop();
		if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("promise_health: the promise expecting a mark every hour needs attention; the other does not", async () => {
		const tools = toolCaller((server) => registerPlanTools(server, fixture.planRoot));
		const { json, isError } = await tools.call("promise_health", {});
		expect(isError, JSON.stringify(json)).toBe(false);
		const health = json as { needsAttention: string[]; promises: Record<string, unknown>[] };
		expect(health.needsAttention).toContain(EXPECTING);
		expect(health.needsAttention).not.toContain(QUIET);
		const row = JSON.stringify(health.promises.find((p) => p.name === EXPECTING));
		expect(row).toMatch(/silent for/i);
		expect(row).toMatch(/expected every 1h/i);
	}, 60_000);

	it("promises status says the same", () => {
		const r = runCli(fixture.root, ["promises", "status"], { INDUSK_HOME: jaeger.home });
		const text = r.stdout + r.stderr;
		expect(r.code, text).toBe(0);
		expect(block(text, EXPECTING)).toMatch(/expected every 1h/i);
		expect(block(text, QUIET)).not.toMatch(/expected every/i);
	}, 60_000);
});

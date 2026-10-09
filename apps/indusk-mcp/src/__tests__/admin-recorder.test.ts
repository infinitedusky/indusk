import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addProject } from "../lib/admin/registry.js";
import { gitOut, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { newTraceId } from "./helpers/local-jaeger.js";
import { RELEASED, startTwoSources, type TwoSources } from "./helpers/two-sources.js";

/**
 * incident-recording A5 — promise: a-production-break-is-recorded-unasked.
 *
 * The thing no unit test can show: the admin daemon itself — `next start`,
 * with no page open — runs the recorder. A project naming a real always-on
 * server as its production source is registered; the daemon is started; a
 * violation is marked on the server; within a minute the incident is
 * committed on the project's trunk by the admin, and nothing was typed.
 *
 * System tier: it starts a Jaeger, an always-on server and the admin daemon.
 */

const MINUTE = 60_000;

let t: TwoSources;
beforeAll(async () => {
	t = await startTwoSources({ promises: [RELEASED], localMarks: [], productionMarks: [] });
	const previous = process.env.INDUSK_HOME;
	process.env.INDUSK_HOME = t.env.INDUSK_HOME;
	try {
		addProject(t.project.root);
	} finally {
		if (previous === undefined) delete process.env.INDUSK_HOME;
		else process.env.INDUSK_HOME = previous;
	}
}, 120_000);

afterAll(async () => {
	runCli(t.project.root, ["ui", "stop"], t.env);
	await t.stop();
}, 60_000);

const incidents = () => {
	const dir = join(t.project.root, ".indusk", "promises", "incidents");
	return existsSync(dir) ? readdirSync(dir) : [];
};

describe.skipIf(SHOULD_SKIP)("A5 — the running admin records a production break, unasked", () => {
	it(
		"within a minute of the break, with no page open, the incident is committed by the admin",
		async () => {
			const start = runCli(t.project.root, ["ui", "start", "--no-open", "--port", "0"], t.env);
			expect(start.code, `${start.stdout}\n${start.stderr}`).toBe(0);

			await t.production.load([
				{
					service: "seat-holds",
					name: "release",
					promise: RELEASED,
					outcome: "violated",
					symptom: "a held seat was not released",
					traceId: newTraceId(),
				},
			]);
			const marked = Date.now();

			while (incidents().length === 0 && Date.now() - marked < MINUTE) {
				await new Promise((r) => setTimeout(r, 1_000));
			}
			expect(incidents(), "no incident within a minute of the break").toHaveLength(1);
			expect(gitOut(t.project.root, ["log", "-1", "--format=%s"])).toMatch(
				/^chore\(indusk\): incident i-.* recorded by admin/,
			);
			expect(gitOut(t.project.root, ["status", "--porcelain"])).toBe("");
		},
		3 * MINUTE,
	);
});

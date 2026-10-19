// promise: a-production-break-is-recorded-unasked
// clause: landing-tests-hold-under-load/recorder-waits-for-its-break
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addProject } from "../lib/admin/registry.js";
import { readScanRecords, scanFinishedAfter } from "../lib/admin/scan-record.js";
import { INCIDENT_WAIT_UPPER_BOUND_MS, waitForIncident } from "../lib/admin/wait-for-incident.js";
import { gitOut, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { newTraceId } from "./helpers/local-jaeger.js";
import { RELEASED, startTwoSources, type TwoSources } from "./helpers/two-sources.js";

/**
 * incident-recording A5 — promise: a-production-break-is-recorded-unasked.
 *
 * The thing no unit test can show: the admin daemon itself — `next start`,
 * with no page open — runs the recorder. A project naming a real always-on
 * server as its production source is registered; the daemon is started; a
 * violation is marked on the server; the incident is committed on the
 * project's trunk by the admin, and nothing was typed. The test waits for
 * that incident, or for the admin to finish a scan after the break was loaded
 * and find none (`waitForIncident`) — never for a fixed minute.
 *
 * System tier: it starts a Jaeger, an always-on server and the admin daemon.
 */

/**
 * a-run-can-be-trusted A59, A61 — clause: landing-tests-hold-under-load/recorder-waits-for-its-break.
 * A61 is the baseline the patient test must keep (one incident, the admin's subject, a clean
 * tree) and passes from the start. A59 delays the admin's scan past the old fixed minute the
 * way a busy machine does, by pausing the admin daemon (SIGSTOP) and resuming it (SIGCONT),
 * which adds no load to any other landing running beside this one.
 */
const PAUSE_PAST_THE_OLD_MINUTE = 75_000;

/** Startup, the pause and the commit's git work, on top of the wait's own upper bound. */
const SETUP_AND_PAUSE_MARGIN_MS = 120_000;

function recorderSuite(title: string, pauseAdminMs: number) {
	describe.skipIf(SHOULD_SKIP)(title, () => {
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

		// The test's machine state holds only this project; its key is the registry's path for it
		// (a resolved path on macOS), so the latest record is read rather than a guessed key.
		const lastScan = () =>
			Object.values(readScanRecords(t.env.INDUSK_HOME)).sort(
				(a, b) => b.startedAt - a.startedAt,
			)[0];

		const adminPid = () =>
			Number.parseInt(readFileSync(join(t.env.INDUSK_HOME, "admin-ui.pid"), "utf-8").trim(), 10);

		it(
			"after the break, with no page open, the incident is committed by the admin",
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
				const breakName = `seat-holds/release (${RELEASED}) violated`;

				const pid = adminPid();
				let resume: ReturnType<typeof setTimeout> | undefined;
				if (pauseAdminMs > 0) {
					process.kill(pid, "SIGSTOP");
					resume = setTimeout(() => process.kill(pid, "SIGCONT"), pauseAdminMs);
				}
				try {
					await waitForIncident({
						now: Date.now,
						sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
						incident: () => incidents()[0] ?? null,
						scanFinishedAfterBreak: () => scanFinishedAfter(lastScan(), marked),
						lastScanError: () => lastScan()?.error,
						breakName,
					});
					expect(incidents(), `${breakName} was not recorded`).toHaveLength(1);
					expect(gitOut(t.project.root, ["log", "-1", "--format=%s"])).toMatch(
						/^chore\(indusk\): incident i-.* recorded by admin/,
					);
					expect(gitOut(t.project.root, ["status", "--porcelain"])).toBe("");
				} finally {
					if (resume) clearTimeout(resume);
					if (pauseAdminMs > 0) {
						try {
							process.kill(pid, "SIGCONT");
						} catch {
							// the daemon is already gone
						}
					}
				}
			},
			INCIDENT_WAIT_UPPER_BOUND_MS + SETUP_AND_PAUSE_MARGIN_MS,
		);
	});
}

recorderSuite("A5 — the running admin records a production break, unasked", 0);
recorderSuite(
	"A59 — the admin's scan delayed past the old minute still records the break",
	PAUSE_PAST_THE_OLD_MINUTE,
);

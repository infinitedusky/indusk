import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, runCli } from "../src/__tests__/helpers/cli.js";
import { probeWatcher } from "../src/lib/promises/probe.js";
import { jaegerEndpoint } from "../src/lib/promises/telemetry.js";
import { secretsFile } from "../src/lib/server/secrets-file.js";

/**
 * server-provisioning A8 and A4 — the live checks. They create a real server
 * in the signed-in Fly account, so they cost money while it exists and run
 * only by hand: `INDUSK_LIVE_FLY=1`, with `fly` signed in, and
 * `INDUSK_LIVE_FLY_ORG` when the account has several organisations. The
 * scratch app is destroyed by hand afterwards (`fly apps destroy
 * indusk-sp-live`); teardown is not something the command does.
 *
 * Before any release has published the image, deploy builds it from this
 * checkout's tarball (`--build-from`), the path an unreleased build takes.
 *
 * promise: a-fly-deploy-is-one-command
 * promise: a-project-connects-to-its-server-in-one-command
 */

const LIVE = process.env.INDUSK_LIVE_FLY === "1";
const APP = process.env.INDUSK_LIVE_FLY_APP ?? "indusk-sp-live";
const ORG = process.env.INDUSK_LIVE_FLY_ORG;
const PKG = join(REPO_ROOT, "apps/indusk-mcp");
const home = mkdtempSync(join(tmpdir(), "sp-live-home-"));

function packed(): string {
	const dir = mkdtempSync(join(tmpdir(), "sp-live-pack-"));
	const r = spawnSync("pnpm", ["pack", "--pack-destination", dir], { cwd: PKG, encoding: "utf-8" });
	if (r.status !== 0) throw new Error(`pnpm pack failed: ${r.stderr}`);
	return join(dir, readdirSync(dir).find((f) => f.endsWith(".tgz")) as string);
}

describe.skipIf(!LIVE)("live — a recording server on Fly in one command", () => {
	it(
		"A8 — deploy ends with the project connected and its first production read alive, within ten minutes",
		async () => {
			const project = mkdtempSync(join(tmpdir(), "sp-live-project-"));
			cpSync(join(PKG, "examples/seat-holds"), project, { recursive: true });
			const started = Date.now();
			const r = runCli(
				project,
				[
					"server",
					"deploy",
					"--app",
					APP,
					"--build-from",
					packed(),
					...(ORG ? ["--org", ORG] : []),
				],
				{ INDUSK_HOME: home },
			);
			const minutes = (Date.now() - started) / 60_000;
			console.info(`A8: deploy took ${minutes.toFixed(1)} min\n${r.stdout}${r.stderr}`);
			expect(r.code, `${r.stdout}${r.stderr}`).toBe(0);
			expect(minutes).toBeLessThan(10);

			const config = JSON.parse(readFileSync(join(project, ".indusk/config.json"), "utf-8"));
			expect(config.promises.jaeger.url).toBe(`https://${APP}.fly.dev:16687`);
			const credential = secretsFile(join(home, "config.env")).get(
				config.promises.jaeger.credential_env,
			);
			expect(credential, "the credential is on the machine").toBeTruthy();
			await expect(
				probeWatcher(
					{
						endpoint: jaegerEndpoint(config.promises.jaeger.url, credential),
						intakeUrl: config.promises.jaeger.otlp_url,
					},
					{ project: "sp-live" },
				),
			).resolves.toBeUndefined();
		},
		15 * 60_000,
	);

	it(
		"A4 — the demo app connected to that server reads its promises from production",
		() => {
			const project = mkdtempSync(join(tmpdir(), "sp-live-demo-"));
			cpSync(join(PKG, "examples/seat-holds"), project, { recursive: true });
			const stored = readFileSync(join(home, "config.env"), "utf-8").match(
				/^([A-Z_]+_CREDENTIAL)=/m,
			)?.[1];
			expect(stored, "A8 stored a credential to connect with").toBeTruthy();
			const r = runCli(
				project,
				[
					"server",
					"connect",
					`https://${APP}.fly.dev:16687`,
					"--intake",
					`https://${APP}.fly.dev`,
					"--credential-env",
					"SP_LIVE_CREDENTIAL",
				],
				{
					INDUSK_HOME: home,
					SP_LIVE_CREDENTIAL: secretsFile(join(home, "config.env")).get(stored as string),
				},
			);
			expect(r.code, `${r.stdout}${r.stderr}`).toBe(0);
			// The admin's Promises page reads through the same sources reader as the
			// CLI; the status output names both sources and the demo's promise.
			const status = runCli(project, ["promises", "status"], { INDUSK_HOME: home });
			const out = `${status.stdout}${status.stderr}`;
			console.info(`A4:\n${out}`);
			expect(out).toContain("production");
			expect(out).not.toMatch(/watcher blind/);
		},
		5 * 60_000,
	);
});

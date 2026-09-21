/**
 * The always-on server's commands — `indusk telemetry serve` and
 * `indusk telemetry announce --once` (day-always-on, Build Phase 8).
 *
 * Split from `telemetry.ts`, which had grown to hold two products sharing a
 * CLI noun: a developer machine's daemon lifecycle (start/stop/restart/
 * status/reap/register) and a deployed server. They import disjoint libraries
 * and change for unrelated reasons. `cli.ts` imports each command lazily, so
 * one namespace across two modules costs nothing.
 */

/**
 * Run the always-on server in the foreground (day-always-on).
 *
 * This is not the daemon: no registry, no PID file, no port picking. A
 * supervisor starts it, it reads its settings from the environment, and it
 * exits with Jaeger's exit code. A missing setting is a refusal naming the
 * variable, never a server that starts without its credentials.
 */
export async function telemetryServe(): Promise<void> {
	const { serve, MissingServerSetting } = await import("../../lib/telemetry/server.js");
	try {
		const code = await serve();
		process.exitCode = code;
	} catch (err) {
		if (err instanceof MissingServerSetting) {
			console.error(`indusk telemetry serve: ${err.message}`);
			process.exitCode = 1;
			return;
		}
		throw err;
	}
}

/**
 * Run one always-on pass and exit (day-always-on).
 *
 * The same pass the server runs on its interval, entered once from outside
 * it — so a test can say when a pass happened rather than wait on a clock,
 * and a person can check a deployment without restarting anything. Reads the
 * server's query URL and credential from the environment, because the server
 * it asks may not be the machine it runs on.
 */
export async function telemetryAnnounce(opts: { once?: boolean }): Promise<void> {
	if (!opts.once) {
		console.error(
			"indusk telemetry announce: --once is required. The scheduled pass belongs to `indusk telemetry serve`, which runs it in the server's own process.",
		);
		process.exitCode = 2;
		return;
	}
	const { readPassSettings, MissingServerSetting } = await import("../../lib/telemetry/server.js");
	const { runPass, describePassResult } = await import("../../lib/always-on/pass.js");
	const { jaegerEndpoint } = await import("../../lib/promises/telemetry.js");

	let settings: Awaited<ReturnType<typeof readPassSettings>>;
	try {
		settings = readPassSettings();
	} catch (err) {
		if (err instanceof MissingServerSetting) {
			console.error(`indusk telemetry announce: ${err.message}`);
			process.exitCode = 1;
			return;
		}
		throw err;
	}

	const result = await runPass({
		volume: settings.volume,
		endpoint: jaegerEndpoint(settings.queryUrl, settings.credential),
		webhook: settings.slackWebhook,
		windowMs: settings.windowMs,
	});

	const said = describePassResult(result);
	for (const line of said.errors) console.error(line);
	for (const line of said.info) console.info(line);
	if (result.recordProblem) {
		process.exitCode = 1;
		return;
	}
	if (result.unannounced.length > 0) process.exitCode = 1;
}

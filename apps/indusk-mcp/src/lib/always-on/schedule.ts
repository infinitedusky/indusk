import { jaegerEndpoint } from "../promises/telemetry.js";
import type { ServerSettings } from "../telemetry/server.js";
import { describePassResult, runPass } from "./pass.js";

/**
 * The pass's cadence, beside the pass (day-always-on, Build Phase 8).
 *
 * It lived in `telemetry/server.ts` because `serve()` calls it, and reached
 * across to import `runPass` anyway. A scheduler belongs with the thing it
 * schedules; `server.ts` is about the server — its settings, its config, its
 * process.
 */

/**
 * Run the pass on the server's own interval, in the server's own process
 * (ADR D2). No scheduler, no second container, no cron entry to get wrong:
 * the thing that is always on is already always on.
 *
 * A pass that throws is logged and the interval continues. The server's job
 * is to keep receiving spans; a Jaeger that is briefly unqueryable — it has
 * just started, it is compacting — must not take the process down with it.
 */
export function startPass(settings: ServerSettings): NodeJS.Timeout {
	const endpoint = jaegerEndpoint(
		`http://127.0.0.1:${settings.queryPort}`,
		`${settings.user}:${settings.password}`,
	);
	const tick = async (): Promise<void> => {
		try {
			const result = await runPass({
				volume: settings.volume,
				endpoint,
				webhook: settings.slackWebhook,
				windowMs: settings.passWindowMs,
			});
			const said = describePassResult(result);
			for (const line of said.errors) console.error(line);
			for (const line of said.info) console.info(line);
		} catch (err) {
			console.error(`always-on pass failed: ${(err as Error).message}`);
		}
	};

	const timer = setInterval(() => {
		void tick();
	}, settings.passIntervalMs);
	timer.unref?.();
	return timer;
}

import { lintApp } from "../../lib/looks/lint.js";
import { readApp } from "../../lib/looks/mockups.js";

/**
 * `indusk looks lint <app>` — every raw value, undefined token and stock class
 * in an app's mockups and declared sources, one per line as
 * `<file>:<line> <value> — <message>`. Exit 1 on any, 0 on none.
 */
export async function looksLint(projectRoot: string, appName: string): Promise<void> {
	try {
		const app = await readApp(projectRoot, appName);
		const findings = await lintApp(projectRoot, app);
		for (const f of findings)
			console.info(`${f.file}:${f.line}  ${f.value}  ${f.rule} — ${f.message}`);
		if (findings.length > 0) {
			console.error(`${findings.length} finding${findings.length === 1 ? "" : "s"} in ${appName}`);
			process.exitCode = 1;
		} else {
			console.info(`${appName}: no raw value, no undefined token`);
		}
	} catch (err) {
		// A missing app or an unreadable foundation is a refusal, never a clean app.
		console.error((err as Error).message);
		process.exitCode = 1;
	}
}

import { approvalOf, readApprovals } from "../../lib/looks/approvals.js";
import { coverageOf } from "../../lib/looks/coverage.js";
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

/**
 * `indusk looks status <app>` — one line per mockup, `<screen>.<state>` then
 * `approved` or `proposed`; a proposed mockup with an approved version names
 * that version's first eight hash characters, the reference the app is held
 * to meanwhile.
 */
export async function looksStatus(projectRoot: string, appName: string): Promise<void> {
	try {
		const app = await readApp(projectRoot, appName);
		const approvals = readApprovals(app);
		for (const mockup of app.mockups) {
			const a = approvalOf(app, mockup, approvals);
			if (a.state === "approved") {
				console.info(`${mockup.name}  approved  by ${a.entry.by} at ${a.entry.at}`);
			} else if (a.reference) {
				console.info(
					`${mockup.name}  proposed  held to ${a.reference.mockupHash.slice(0, 8)} (approved by ${a.reference.by} at ${a.reference.at})`,
				);
			} else {
				console.info(`${mockup.name}  proposed  never approved`);
			}
		}
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
	}
}

/**
 * `indusk looks coverage <app>` — `uncovered screen: <name>`, `uncovered
 * state: <screen>.<state>`, `uncovered component: <name>`. Exit 1 when any is
 * listed, 0 when every part is covered.
 */
export async function looksCoverage(projectRoot: string, appName: string): Promise<void> {
	try {
		const app = await readApp(projectRoot, appName);
		const c = await coverageOf(projectRoot, app, readApprovals(app));
		const lines = [
			...c.screens.map((n) => `uncovered screen: ${n}`),
			...c.states.map((n) => `uncovered state: ${n}`),
			...c.components.map((n) => `uncovered component: ${n}`),
		];
		for (const line of lines) console.info(line);
		if (lines.length > 0) {
			console.error(`${lines.length} uncovered in ${appName}`);
			process.exitCode = 1;
		} else {
			console.info(`${appName}: every screen, state and component covered by an approved mockup`);
		}
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
	}
}

/**
 * `indusk looks approve` — refused, always. A mockup becomes the reference
 * only when a person approves it with the cockpit's Approve; a command an
 * agent can run is not that. Exit 2, nothing written.
 */
export function looksApprove(): void {
	console.error(
		[
			"indusk looks approve: refused — a mockup is approved only by a person, with the cockpit's Approve.",
			"Open the cockpit (`indusk ui`), go to the app's Looks page, open the mockup at each device and press Approve.",
			"promise: a-mockup-is-approved-by-a-person",
		].join("\n"),
	);
	process.exitCode = 2;
}

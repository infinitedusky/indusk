import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { initEvalOtel, shutdownEvalOtel } from "../../lib/eval/otel.js";
import { type Approval, approvalOf, boundToNow, readApprovals } from "../../lib/looks/approvals.js";
import { checkApp } from "../../lib/looks/check.js";
import { coverageOf } from "../../lib/looks/coverage.js";
import { generateCss } from "../../lib/looks/foundation.js";
import { lintApp } from "../../lib/looks/lint.js";
import { type LooksApp, type Mockup, readApp } from "../../lib/looks/mockups.js";
import { describe, type LookResult, reportLooks } from "../../lib/looks/report.js";
import { markProjectId } from "../../lib/promises/config.js";

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
 * `<screen>.<state>  approved|proposed  …` — the status grammar
 * `looks-cli.test.ts` reads. A proposed mockup is held to its last approved
 * version only while that version's foundation and declarations are the
 * current ones (`boundToNow`); otherwise the line says nothing is held.
 */
function statusLine(app: LooksApp, mockup: Mockup, a: Approval): string {
	if (a.state === "approved") return `${mockup.name}  approved  by ${a.entry.by} at ${a.entry.at}`;
	if (a.reference) {
		const { mockupHash, by, at } = a.reference;
		const last = `${mockupHash.slice(0, 8)} (approved by ${by} at ${at})`;
		return boundToNow(app, a.reference)
			? `${mockup.name}  proposed  held to ${last}`
			: `${mockup.name}  proposed  last approved ${last} on another foundation or declarations — nothing held`;
	}
	return `${mockup.name}  proposed  never approved`;
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
			console.info(statusLine(app, mockup, approvalOf(app, mockup, approvals)));
		}
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
	}
}

/**
 * `indusk looks coverage <app>` — `uncovered screen: <name>`, `uncovered
 * state: <screen>.<state>`, `uncovered component: <name>`, and `unresolved
 * component: <file>:<line>` for a name decided at run time; with a catalog,
 * `not in catalog: <name>` for a marked component it omits and `no story:
 * <name>.<state>` for a state a mockup places that no story covers. Exit 1
 * when any is listed, 0 when every part is covered.
 */
export async function looksCoverage(projectRoot: string, appName: string): Promise<void> {
	try {
		const app = await readApp(projectRoot, appName);
		const c = await coverageOf(projectRoot, app, readApprovals(app));
		const lines = [
			...c.screens.map((n) => `uncovered screen: ${n}`),
			...c.states.map((n) => `uncovered state: ${n}`),
			...c.components.map((n) => `uncovered component: ${n}`),
			...c.unresolved.map((at) => `unresolved component: ${at}`),
			...c.notInCatalog.map((n) => `not in catalog: ${n}`),
			...c.noStory.map((n) => `no story: ${n}`),
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

/** A look's output: `held|broken <screen>.<state> @ <device>`, then one indented line per finding. */
function lookLines(r: LookResult): string[] {
	const head = `${r.verdict.state === "held" ? "held   " : "broken "} ${r.screen}.${r.state} @ ${r.device}`;
	return [head, ...r.verdict.findings.map((f) => `  ${describe(f)}`)];
}

/**
 * `indusk looks check <app> [--url]` — opens each declared screen state with
 * an approved mockup at each reference device in Chromium and judges the
 * running app by value. One `held`/`broken` line per screen state and device,
 * each finding indented under a broken one (`token <name> approved <v> actual
 * <v>` or `element <selector> <property> actual <v> nearest <token (v)>`),
 * then the screen states not checked and why. Each look is also a span.
 * Exit 1 on any broken look, and when nothing could be checked: a run that
 * checked nothing must not read as held.
 */
export async function looksCheck(
	projectRoot: string,
	appName: string,
	opts: { url?: string },
): Promise<void> {
	try {
		const app = await readApp(projectRoot, appName);
		const { results, unchecked } = await checkApp(app, readApprovals(app), opts.url);
		for (const r of results) for (const line of lookLines(r)) console.info(line);
		for (const u of unchecked) {
			console.info(`unchecked ${u.mockup}${u.device ? ` @ ${u.device}` : ""} — ${u.reason}`);
		}
		reportLooks(results, initEvalOtel(projectRoot), { project: markProjectId(projectRoot) });
		await shutdownEvalOtel();
		const broken = results.filter((r) => r.verdict.state === "broken").length;
		// Unchecked is counted beside held and broken, never folded into either.
		const notChecked = unchecked.length > 0 ? `, ${unchecked.length} unchecked` : "";
		if (results.length === 0) {
			console.error(
				`${appName}: nothing checked${notChecked} — no approved mockup, or no page said it drew the state`,
			);
			process.exitCode = 1;
		} else if (broken > 0) {
			console.error(`${broken} of ${results.length} looks broken in ${appName}${notChecked}`);
			process.exitCode = 1;
		} else {
			console.info(`${appName}: ${results.length} looks held${notChecked}`);
		}
	} catch (err) {
		// A missing driver, browser, URL or app is a refusal, never a held look.
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

/**
 * `indusk looks tokens <app> [--tailwind] [--out <file>]` — the foundation as
 * CSS: `:root` custom properties for a mockup, or with `--tailwind` an
 * `@theme` block that resets the stock theme to the foundation so a stock
 * class has no value to compile. To stdout, or to `--out` (the app's
 * generated stylesheet, committed beside its source).
 */
export async function looksTokens(
	projectRoot: string,
	appName: string,
	opts: { tailwind?: boolean; out?: string },
): Promise<void> {
	try {
		const app = await readApp(projectRoot, appName);
		const css = generateCss(app.foundation, { tailwind: opts.tailwind === true });
		if (opts.out) {
			const file = resolve(projectRoot, opts.out);
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, css);
			console.info(`${appName}: wrote ${opts.out}`);
		} else {
			process.stdout.write(css);
		}
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
	}
}

/**
 * `indusk looks stories <app>` — render every story of the app's Storybook to
 * a snapshot (`.indusk/mockups/<app>/components/<name>.<state>.html`) and
 * write the catalog (`components.json`) an agent reads before it writes a
 * component. One line per component with its file and states. Exit 1 when a
 * story cannot be rendered, naming it.
 */
export async function looksStories(projectRoot: string, appName: string): Promise<void> {
	try {
		const { renderStories } = await import("../../lib/looks/stories.js");
		const result = await renderStories(projectRoot, appName);
		for (const c of result.components) {
			console.info(`${c.name}  ${c.file}  ${c.states.map((s) => s.name).join(", ")}`);
		}
		for (const file of result.removed) console.info(`removed ${file} — no story renders it`);
		console.info(
			`${appName}: ${result.snapshots.length} snapshots for ${result.components.length} components, catalog in .indusk/mockups/${appName}/components.json`,
		);
	} catch (err) {
		// A story that cannot render, a missing Storybook or browser, is a refusal, never a catalog.
		console.error((err as Error).message);
		process.exitCode = 1;
	}
}

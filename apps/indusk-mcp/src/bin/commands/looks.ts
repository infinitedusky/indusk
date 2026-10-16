import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { initEvalOtel, shutdownEvalOtel } from "../../lib/eval/otel.js";
import {
	type Approval,
	approvalOf,
	boundToNow,
	readApprovals,
	readStoryApprovals,
	readWithdrawals,
	type StoryApproval,
	storyApprovalOf,
} from "../../lib/looks/approvals.js";
import { checkApp } from "../../lib/looks/check.js";
import { coverageOf } from "../../lib/looks/coverage.js";
import { generateCss } from "../../lib/looks/foundation.js";
import { lintApp } from "../../lib/looks/lint.js";
import { type LooksApp, type Mockup, readApp } from "../../lib/looks/mockups.js";
import { describe, type LookResult, reportLooks } from "../../lib/looks/report.js";
import { markProjectId } from "../../lib/promises/config.js";

/**
 * `indusk looks lint <app>` — every raw value, undefined token and stock class
 * in an app's mockups and declared sources, and the component rules, one per
 * line as `<file>:<line> <value> — <message>`. Exit 1 on any finding, 0 on
 * none; a notice (`needs a story`) is listed and fails nothing.
 */
export async function looksLint(projectRoot: string, appName: string): Promise<void> {
	try {
		const app = await readApp(projectRoot, appName);
		const findings = await lintApp(projectRoot, app);
		for (const f of findings)
			console.info(`${f.file}:${f.line}  ${f.value}  ${f.rule} — ${f.message}`);
		const failing = findings.filter((f) => !f.notice).length;
		if (failing > 0) {
			console.error(`${failing} finding${failing === 1 ? "" : "s"} in ${appName}`);
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
	if (a.withdrawn) {
		return `${mockup.name}  proposed  withdrawn by ${a.withdrawn.by} at ${a.withdrawn.at} — nothing held until a person approves it again`;
	}
	if (a.reference) {
		const { mockupHash, by, at } = a.reference;
		const last = `${mockupHash.slice(0, 8)} (approved by ${by} at ${at})`;
		const changed = a.componentsChanged
			? `component changed: ${a.componentsChanged.join(", ")} — `
			: "";
		return boundToNow(app, a.reference)
			? `${mockup.name}  proposed  ${changed}held to ${last}`
			: `${mockup.name}  proposed  ${changed}last approved ${last} on another foundation or declarations — nothing held`;
	}
	return `${mockup.name}  proposed  never approved`;
}

/** `story <name>.<state>  approved|proposed  …` — a story's line, after the mockups'. */
function storyLine(name: string, a: StoryApproval): string {
	if (a.state === "approved") return `story ${name}  approved  by ${a.entry.by} at ${a.entry.at}`;
	if (a.withdrawn) {
		return `story ${name}  proposed  withdrawn by ${a.withdrawn.by} at ${a.withdrawn.at} — nothing held until a person approves it again`;
	}
	if (a.reference) {
		const { snapshotHash, by, at } = a.reference;
		return `story ${name}  proposed  changed since ${snapshotHash.slice(0, 8)} (approved by ${by} at ${at})`;
	}
	return `story ${name}  proposed  never approved`;
}

/**
 * `indusk looks status <app>` — one line per mockup, `<screen>.<state>` then
 * `approved` or `proposed`; a proposed mockup with an approved version names
 * that version's first eight hash characters, the reference the app is held
 * to meanwhile, and `component changed: <name>` when a component it composes
 * changed. Then one line per story, `story <name>.<state>` then `approved`
 * or `proposed`.
 */
export async function looksStatus(projectRoot: string, appName: string): Promise<void> {
	try {
		const app = await readApp(projectRoot, appName);
		const approvals = readApprovals(app);
		const withdrawals = readWithdrawals(app);
		for (const mockup of app.mockups) {
			console.info(statusLine(app, mockup, approvalOf(app, mockup, approvals, withdrawals)));
		}
		const stories = readStoryApprovals(app);
		for (const story of app.stories) {
			console.info(storyLine(story.name, storyApprovalOf(app, story, stories, withdrawals)));
		}
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
	}
}

/**
 * `indusk looks coverage <app>` — `uncovered screen: <name>`, `uncovered
 * state: <screen>.<state>`, `uncovered component: <name>`, and `unresolved
 * component: <file>:<line>` for a name decided at run time; `unimplemented
 * component: <name>` for a component a mockup names that no file marks; with a catalog,
 * `not in catalog: <name>` for a marked component it omits and `no story:
 * <name>.<state>` for a state a mockup places that no story covers; and
 * `uncovered story: <name>.<state>` for a story no person has approved as it
 * is. Exit 1 when any is listed, 0 when every part is covered.
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
			...c.unimplemented.map((n) => `unimplemented component: ${n}`),
			...c.notInCatalog.map((n) => `not in catalog: ${n}`),
			...c.noStory.map((n) => `no story: ${n}`),
			...c.stories.map((n) => `uncovered story: ${n}`),
		];
		for (const line of lines) console.info(line);
		if (lines.length > 0) {
			console.error(`${lines.length} uncovered in ${appName}`);
			process.exitCode = 1;
		} else {
			console.info(
				`${appName}: every screen, state and component covered by an approved mockup or story`,
			);
		}
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
	}
}

/** A look's output: `held|broken <screen>.<state> @ <device>`, then one indented line per finding. */
function lookLines(r: LookResult): string[] {
	const subject = `${r.kind === "story" ? "story " : ""}${r.screen}.${r.state}`;
	const head = `${r.verdict.state === "held" ? "held   " : "broken "} ${subject} @ ${r.device}`;
	return [head, ...r.verdict.findings.map((f) => `  ${describe(f)}`)];
}

/**
 * `indusk looks check <app> [--url]` — opens each declared screen state with
 * an approved mockup, and each approved story in the Storybook the app's
 * server serves at `/storybook`, at each reference device in Chromium and
 * judges the running app by value. One `held`/`broken` line per screen state and device,
 * each finding indented under a broken one (`token <name> approved <v> actual
 * <v>` or `element <selector> <property> actual <v> nearest <token (v)>`),
 * then the screen states not checked and why. Each look is also a span.
 * Exit 1 on any broken look, and when nothing could be checked: a run that
 * checked nothing must not read as held. `--only` checks just the looks named
 * (a screen state or a story); a name no look has is refused.
 */
export async function looksCheck(
	projectRoot: string,
	appName: string,
	opts: { url?: string; only?: string[] },
): Promise<void> {
	try {
		const app = await readApp(projectRoot, appName);
		const only = opts.only?.flatMap((n) => n.split(",")).filter((n) => n !== "");
		const { results, unchecked } = await checkApp(
			app,
			readApprovals(app),
			opts.url,
			readStoryApprovals(app),
			only && only.length > 0 ? { only } : {},
		);
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
 * `indusk looks unapprove` — refused, always. An approval is taken back only
 * by a person, with the cockpit's Unapprove (storybook-components ADR decision
 * 11); a command an agent can run is not that. Exit 2, nothing written.
 */
export function looksUnapprove(): void {
	console.error(
		[
			"indusk looks unapprove: refused — an approval is taken back only by a person, with the cockpit's Unapprove.",
			"Open the cockpit (`indusk ui`), go to the app's Looks page, find the approved mockup or story and press Unapprove.",
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

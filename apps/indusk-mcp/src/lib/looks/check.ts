import { execFileSync } from "node:child_process";
import pMap from "p-map";
import type { Browser } from "playwright-core";
import {
	type ApprovalEntry,
	approvalOf,
	boundToNow,
	type StoryApprovalEntry,
	storyApprovalOf,
} from "./approvals.js";
import { storybookIds } from "./components.js";
import type { Device, LooksApp } from "./mockups.js";
import type { LookResult } from "./report.js";
import { MEASURED_PROPERTIES, type MeasuredElement, verdict } from "./verdict.js";

/**
 * The browser half of the look check (ui-promises ADR decision 6): open each
 * declared screen at each reference device against the app's URL, read the
 * foundation's custom properties off `:root` and each element's computed
 * visual properties, and hand them to `verdict`. This module only measures;
 * whether a look is held is `verdict`'s to say, from values it is given.
 *
 * `playwright-core` is an optional dependency, loaded here and refused by
 * name when it is absent — `indusk` itself must install without a browser
 * driver, and a check that cannot run must not read as a check that passed.
 *
 * promise: tokens-are-held-exactly
 */

export class LooksCheckError extends Error {}

/** One screen state to open: the screen, its state and the path it is served at, when declared. */
export interface LookTarget {
	screen: string;
	state: string;
	path?: string;
	/** The screen's seed and unseed commands (`DeclaredScreen`), when it declares them. */
	seed?: string;
	unseed?: string;
}

/** A screen state that was not checked, and why; at one device when the page was opened there. */
export interface Unchecked {
	mockup: string;
	device?: string;
	reason: string;
}

export interface CheckReport {
	results: LookResult[];
	unchecked: Unchecked[];
}

/**
 * Read inside the page. A string, not a function, because the package has no
 * DOM types and the code must run in the browser as written. It returns
 * `{ runtime, elements }`: the named custom properties on `:root`, and every
 * measured property of `body` and its descendants, with a selector for each.
 */
function measureScript(
	tokenNames: string[],
	properties: readonly string[],
	ignore: readonly string[],
	scope = "body",
): string {
	return `(() => {
	const tokenNames = ${JSON.stringify(tokenNames)};
	// Which screen states the page says it drew (A36): \`data-look-state\` on
	// <html> or on any element, each a space-separated list of <screen>.<state>.
	const states = [document.documentElement, ...document.querySelectorAll("[data-look-state]")]
		.flatMap((el) => (el.getAttribute("data-look-state") || "").split(/\\s+/))
		.filter(Boolean);
	// Which scheme it drew (A37): a page that pins data-theme says so; else the media query.
	const theme = document.documentElement.getAttribute("data-theme");
	const scheme = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)
		? "dark"
		: "light";
	const properties = ${JSON.stringify(properties)};
	const ignored = ${JSON.stringify(ignore.map((t) => t.toUpperCase()))};
	const rootStyle = getComputedStyle(document.documentElement);
	const runtime = {};
	for (const name of tokenNames) {
		const v = rootStyle.getPropertyValue(name).trim();
		if (v !== "") runtime[name] = v;
	}
	const selectorOf = (el) => {
		let s = el.tagName.toLowerCase();
		if (el.id) s += "#" + el.id;
		const cls = typeof el.className === "string" ? el.className.trim().split(/\\s+/).filter(Boolean) : [];
		if (cls.length) s += "." + cls.join(".");
		return s;
	};
	const elements = [];
	// A page is measured from its body; a story from its own root, so what the
	// Storybook frame draws around it (its loader, its error display) is not read.
	const root = document.querySelector(${JSON.stringify(scope)}) || document.body;
	const nodes = [root, ...root.querySelectorAll("*")];
	for (const el of nodes) {
		if (["SCRIPT", "STYLE", "LINK", "META", "TITLE", "NOSCRIPT", "OPTION", "OPTGROUP"].includes(el.tagName) || ignored.includes(el.tagName)) continue;
		const style = getComputedStyle(el);
		const selector = selectorOf(el);
		for (const property of properties) {
			// A border that is not drawn has a colour the author never chose.
			const side = property.match(/^border-(top|right|bottom|left)-color$/);
			if (side && style.getPropertyValue("border-" + side[1] + "-width") === "0px") continue;
			// A margin of \`auto\` is computed to the pixels it resolved to; the
			// computed value (typed OM) is the keyword the author wrote.
			const typed = property.startsWith("margin-") && el.computedStyleMap
				? String(el.computedStyleMap().get(property))
				: "";
			const actual = (typed === "auto" ? typed : style.getPropertyValue(property)).trim();
			if (actual !== "") elements.push({ selector, property, actual });
		}
	}
	return { runtime, elements, states, scheme };
})()`;
}

/** A colour scheme a look is opened under. */
export type Scheme = "light" | "dark";

/** What the page gave back: the measurements, and what it says it drew. */
export interface Measured {
	runtime: Record<string, string>;
	elements: MeasuredElement[];
	/** `<screen>.<state>` names the page reported with `data-look-state`. */
	states: string[];
	/** The scheme the page drew. */
	scheme: Scheme;
}

/**
 * One look, judged from what the page gave back: unchecked when the page did
 * not say it drew this screen state, or did not draw the scheme it was opened
 * under — a value check of a page that is not the state says nothing about
 * the state (lesson: a-value-check-that-says-held-has-not-seen-the-layout) —
 * else the verdict on its values. `device` is the name the look is reported
 * under (`phone`, `phone/dark`).
 */
export function judgeLook(input: {
	app: string;
	look: LookTarget;
	device: string;
	scheme: Scheme;
	approved: Record<string, string>;
	seen: Measured;
}): { result: LookResult } | { unchecked: Unchecked } {
	const { app, look, device, scheme, approved, seen } = input;
	const mockup = `${look.screen}.${look.state}`;
	if (!seen.states.includes(mockup)) {
		return { unchecked: { mockup, device, reason: `the page did not report state ${look.state}` } };
	}
	if (seen.scheme !== scheme) {
		return {
			unchecked: { mockup, device, reason: `the page did not render the ${scheme} scheme` },
		};
	}
	return {
		result: {
			app,
			screen: look.screen,
			state: look.state,
			device,
			verdict: verdict({ approved, runtime: seen.runtime, elements: seen.elements }),
		},
	};
}

/** A story to open: its snapshot's name, the component and state, and the Storybook id it is served under. */
export interface StoryTarget {
	name: string;
	component: string;
	state: string;
	id: string;
}

/**
 * One story, judged from what its served page gave back: unchecked when the
 * page did not draw the scheme it was opened under, else the verdict on its
 * values. A story's page does not report a state — the URL names the story —
 * so unlike `judgeLook` there is no state to demand. Reported as the
 * component and state, marked `story`.
 */
export function judgeStory(input: {
	app: string;
	story: StoryTarget;
	device: string;
	scheme: Scheme;
	approved: Record<string, string>;
	seen: Measured;
}): { result: LookResult } | { unchecked: Unchecked } {
	const { app, story, device, scheme, approved, seen } = input;
	if (seen.scheme !== scheme) {
		return {
			unchecked: {
				mockup: `story ${story.name}`,
				device,
				reason: `the page did not render the ${scheme} scheme`,
			},
		};
	}
	return {
		result: {
			app,
			screen: story.component,
			state: story.state,
			device,
			kind: "story",
			verdict: verdict({ approved, runtime: seen.runtime, elements: seen.elements }),
		},
	};
}

async function loadChromium(): Promise<typeof import("playwright-core").chromium> {
	try {
		return (await import("playwright-core")).chromium;
	} catch {
		throw new LooksCheckError(
			"indusk looks check needs playwright-core, which is not installed — install it (`npm install playwright-core`) and a browser (`npx playwright-core install chromium`)",
		);
	}
}

async function launch(chromium: Awaited<ReturnType<typeof loadChromium>>): Promise<Browser> {
	try {
		return await chromium.launch();
	} catch (err) {
		throw new LooksCheckError(
			`indusk looks check could not start Chromium (${(err as Error).message.split("\n")[0]}) — install it with \`npx playwright-core install chromium\``,
		);
	}
}

/**
 * The schemes a look is opened under: light, and dark too when the
 * foundation names a dark value for any token (A37). A scheme the foundation
 * names is held only once it has been opened and drawn.
 */
export function schemesOf(app: LooksApp): Scheme[] {
	return app.foundation.tokens.some((t) => t.dark !== undefined) ? ["light", "dark"] : ["light"];
}

/** The name a look is reported under at a device: `phone` in light, `phone/dark` in dark. */
export const lookDevice = (device: string, scheme: Scheme): string =>
	scheme === "light" ? device : `${device}/${scheme}`;

/** The foundation's approved values under a scheme: each token's dark value in dark, where it names one. */
export function approvedValues(app: LooksApp, scheme: Scheme): Record<string, string> {
	return Object.fromEntries(
		app.foundation.tokens.map((t) => [t.name, scheme === "dark" ? (t.dark ?? t.value) : t.value]),
	);
}

/** Where `screen` in `state` is served: the app's base URL, the screen's path, the state as `?state=`. */
export function pageUrl(
	base: string,
	screenName: string,
	path: string | undefined,
	state: string,
): string {
	const url = new URL(path ?? `/${screenName}`, base);
	url.searchParams.set("state", state);
	return url.toString();
}

/**
 * The screen states to check: each declared screen x state whose mockup is
 * approved as it is, or whose last approved version was approved on this very
 * foundation and these declarations (the app is held to it while the mockup is
 * being changed). A
 * proposed mockup is nothing to check against (A1), and a foundation changed
 * since approval leaves no approved values to hold the app to.
 */
export function checkable(
	app: LooksApp,
	approvals: readonly ApprovalEntry[],
): { checked: LookTarget[]; unchecked: Unchecked[] } {
	const checked: LookTarget[] = [];
	const unchecked: Unchecked[] = [];
	for (const screen of app.screens) {
		for (const state of screen.states) {
			const name = `${screen.name}.${state}`;
			const mockup = app.mockups.find((m) => m.name === name);
			if (!mockup) {
				unchecked.push({ mockup: name, reason: "no mockup" });
				continue;
			}
			const approval = approvalOf(app, mockup, approvals);
			const heldTo =
				approval.state === "approved" ||
				(approval.reference !== null && boundToNow(app, approval.reference));
			if (heldTo) {
				const path = screen.paths?.[state] ?? screen.path;
				checked.push({
					screen: screen.name,
					state,
					...(path ? { path } : {}),
					...(screen.seed ? { seed: screen.seed } : {}),
					...(screen.unseed ? { unseed: screen.unseed } : {}),
				});
			} else {
				unchecked.push({
					mockup: name,
					reason: approval.reference
						? "the foundation or the declarations changed since this mockup was approved"
						: "proposed, never approved",
				});
			}
		}
	}
	return { checked, unchecked };
}

/**
 * Where a story is served: the app's Storybook build under `/storybook`, the
 * story's id, and the scheme as the theme global the preview's decorator reads.
 */
export function storyUrl(base: string, id: string, scheme: Scheme): string {
	const url = new URL("/storybook/iframe.html", base);
	url.searchParams.set("id", id);
	url.searchParams.set("viewMode", "story");
	url.searchParams.set("globals", `theme:${scheme}`);
	return url.toString();
}

/** Runs a shell command and returns its stdout; throws when it fails. */
export type RunCommand = (command: string) => string;

const shellCommand: RunCommand = (command) =>
	execFileSync("sh", ["-c", command], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "inherit"],
	});

const substitute = (text: string, seed: string): string => text.replaceAll("{seed}", seed);

/**
 * Open a screen's states with its seed in place. A screen that declares no
 * `seed` just runs `body` with each look unchanged. Otherwise the seed command
 * runs once, its trimmed stdout is `{seed}` in every look's path, and `unseed`
 * runs after `body` whether it finished or threw - a seed that is not taken
 * away is the check leaving something behind.
 */
export async function withScreenSeed<T>(
	looks: readonly LookTarget[],
	body: (looks: LookTarget[]) => Promise<T>,
	run: RunCommand = shellCommand,
): Promise<T> {
	const first = looks[0];
	if (!first?.seed) return body([...looks]);
	const seed = run(first.seed).trim();
	if (seed === "") {
		throw new LooksCheckError(`the seed for ${first.screen} printed nothing: ${first.seed}`);
	}
	try {
		return await body(
			looks.map((l) => ({ ...l, ...(l.path ? { path: substitute(l.path, seed) } : {}) })),
		);
	} finally {
		if (first.unseed) run(substitute(first.unseed, seed));
	}
}

/** The checked looks grouped by screen, in order. */
function byScreen(looks: readonly LookTarget[]): LookTarget[][] {
	const groups = new Map<string, LookTarget[]>();
	for (const look of looks) groups.set(look.screen, [...(groups.get(look.screen) ?? []), look]);
	return [...groups.values()];
}

/**
 * The stories to check, mirroring `checkable`: each story with a Storybook id
 * in the catalog whose snapshot is approved as it is, or whose last approved
 * version was approved on this very foundation and these declarations.
 */
export function checkableStories(
	app: LooksApp,
	approvals: readonly StoryApprovalEntry[],
): { checked: StoryTarget[]; unchecked: Unchecked[] } {
	const ids = storybookIds(app);
	const checked: StoryTarget[] = [];
	const unchecked: Unchecked[] = [];
	for (const story of app.stories) {
		const mockup = `story ${story.name}`;
		const approval = storyApprovalOf(app, story, approvals);
		const heldTo =
			approval.state === "approved" ||
			(approval.reference !== null && boundToNow(app, approval.reference));
		if (!heldTo) {
			unchecked.push({
				mockup,
				reason: approval.reference
					? "the foundation or the declarations changed since this story was approved"
					: "proposed, never approved",
			});
			continue;
		}
		const id = ids.get(story.name);
		if (!id) {
			unchecked.push({
				mockup,
				reason: `no Storybook id in the catalog — run \`indusk looks stories ${app.app}\``,
			});
			continue;
		}
		checked.push({ name: story.name, component: story.component, state: story.state, id });
	}
	return { checked, unchecked };
}

/** A page that did not load, or a story that did not draw, within its time. */
class LookTimedOut extends Error {}

const isTimeout = (e: unknown): boolean =>
	e instanceof LookTimedOut || (e instanceof Error && e.name === "TimeoutError");

/**
 * Open a look, trying again once when it runs out of time. A look that times
 * out twice is the reason it was not checked, named — never the end of the
 * run: one slow page used to throw away every look measured before it. Any
 * other failure (a page that answers 404) still ends the run, loudly.
 */
export async function openWithinTime<T>(
	open: () => Promise<T>,
	tries = 2,
): Promise<T | { timedOut: string }> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await open();
		} catch (e) {
			if (!isTimeout(e)) throw e;
			if (attempt >= tries) {
				return { timedOut: `timed out ${tries} times: ${(e as Error).message.split("\n")[0]}` };
			}
		}
	}
}

async function measure(
	browser: Browser,
	device: Device,
	scheme: Scheme,
	url: string,
	script: string,
	/** A selector that appears once a story has drawn; absent for a page, which is read at `load`. */
	rendered?: string,
): Promise<Measured> {
	const context = await browser.newContext({
		viewport: { width: device.width, height: device.height },
		deviceScaleFactor: device.pixelRatio,
		colorScheme: scheme,
	});
	try {
		const page = await context.newPage();
		const response = await page.goto(url, { waitUntil: "load" });
		if (!response?.ok()) {
			throw new LooksCheckError(`${url} answered ${response ? response.status() : "nothing"}`);
		}
		if (rendered) {
			try {
				await page.waitForSelector(rendered, { timeout: 30_000 });
			} catch {
				throw new LookTimedOut(`${url} did not draw its story within 30s`);
			}
		}
		return (await page.evaluate(script)) as Measured;
	} finally {
		await context.close();
	}
}

/**
 * Stories open this many at a time: each is a static file in the served
 * Storybook, so the app's own server does no rendering for it; in turn, a
 * run over the admin's 342 story looks took six minutes. Screens stay one at
 * a time — each is a render by the app's server.
 */
const STORIES_AT_ONCE = 8;

/**
 * Open each story in the app's served Storybook at every device and scheme
 * and judge it, in the stories' order. The script reads `#storybook-root`
 * only, and waits for the story's first element: Storybook marks the body
 * shown before React has drawn, and a story measured then is empty and holds
 * with nothing judged.
 */
async function checkStories(
	browser: Browser,
	app: LooksApp,
	base: string,
	stories: readonly StoryTarget[],
): Promise<CheckReport> {
	const results: LookResult[] = [];
	const unchecked: Unchecked[] = [];
	const script = measureScript(
		app.foundation.tokens.map((t) => t.name),
		MEASURED_PROPERTIES,
		app.ignore,
		"#storybook-root",
	);
	const opens = stories.flatMap((story) =>
		app.devices.flatMap((device) => schemesOf(app).map((scheme) => ({ story, device, scheme }))),
	);
	const judgements = await pMap(
		opens,
		async ({ story, device, scheme }) => {
			const url = storyUrl(base, story.id, scheme);
			const seen = await openWithinTime(() =>
				measure(browser, device, scheme, url, script, "#storybook-root > *"),
			);
			if ("timedOut" in seen) {
				return {
					unchecked: {
						mockup: `story ${story.name}`,
						device: lookDevice(device.name, scheme),
						reason: seen.timedOut,
					},
				};
			}
			return judgeStory({
				app: app.app,
				story,
				device: lookDevice(device.name, scheme),
				scheme,
				approved: approvedValues(app, scheme),
				seen,
			});
		},
		{ concurrency: STORIES_AT_ONCE },
	);
	for (const judged of judgements) {
		if ("result" in judged) results.push(judged.result);
		else unchecked.push(judged.unchecked);
	}
	return { results, unchecked };
}

/**
 * Open every checkable screen state, and every checkable story in the app's
 * served Storybook, at every device of `app` and judge each. `baseUrl` is
 * `--url`, else the app's own `url`; with neither the check is refused rather
 * than guessed.
 */
export async function checkApp(
	app: LooksApp,
	approvals: readonly ApprovalEntry[],
	baseUrl: string | undefined,
	storyApprovals: readonly StoryApprovalEntry[] = [],
): Promise<CheckReport> {
	const base = baseUrl ?? app.url;
	if (!base) {
		throw new LooksCheckError(
			`${app.app} has no URL to open — pass --url, or set "url" in .indusk/mockups/${app.app}/screens.json`,
		);
	}
	if (app.devices.length === 0) {
		throw new LooksCheckError(`${app.app} declares no reference devices (devices.json)`);
	}
	const { checked, unchecked } = checkable(app, approvals);
	const stories = checkableStories(app, storyApprovals);
	unchecked.push(...stories.unchecked);
	const results: LookResult[] = [];
	if (checked.length === 0 && stories.checked.length === 0) return { results, unchecked };

	const chromium = await loadChromium();
	const browser = await launch(chromium);
	const script = measureScript(
		app.foundation.tokens.map((t) => t.name),
		MEASURED_PROPERTIES,
		app.ignore,
	);
	try {
		for (const group of byScreen(checked)) {
			await withScreenSeed(group, async (seeded) => {
				for (const look of seeded) {
					for (const device of app.devices) {
						for (const scheme of schemesOf(app)) {
							const url = pageUrl(base, look.screen, look.path, look.state);
							const seen = await openWithinTime(() =>
								measure(browser, device, scheme, url, script),
							);
							if ("timedOut" in seen) {
								unchecked.push({
									mockup: `${look.screen}.${look.state}`,
									device: lookDevice(device.name, scheme),
									reason: seen.timedOut,
								});
								continue;
							}
							const judged = judgeLook({
								app: app.app,
								look,
								device: lookDevice(device.name, scheme),
								scheme,
								approved: approvedValues(app, scheme),
								seen,
							});
							if ("result" in judged) results.push(judged.result);
							else unchecked.push(judged.unchecked);
						}
					}
				}
			});
		}
		const found = await checkStories(browser, app, base, stories.checked);
		results.push(...found.results);
		unchecked.push(...found.unchecked);
	} finally {
		await browser.close();
	}
	return { results, unchecked };
}

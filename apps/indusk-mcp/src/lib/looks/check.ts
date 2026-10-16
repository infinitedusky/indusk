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
import { pageSourceFilter, readCatalog, storybookIds } from "./components.js";
import { devServerMarker } from "./dev-server.js";
import {
	configHashOf,
	type Device,
	type LooksApp,
	pageSourcesHashOf,
	servedBuildOf,
	sourcesHashOf,
} from "./mockups.js";
import type { LookResult } from "./report.js";
import {
	type Build,
	type Held,
	type LookKey,
	lookKey,
	readHeld,
	reuseOf,
	writeHeld,
} from "./reuse.js";
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

/** A look reported from its last held result, without being opened (looks-check-speed ADR decision 5). */
export interface Reused {
	app: string;
	/** `home.empty` for a screen state; `badge.ok` for a story. */
	look: string;
	kind: "screen" | "story";
	/** The screen, or the story's component. */
	screen: string;
	state: string;
	/** When it was really measured and held. */
	at: string;
	/** The names it is reported under, one per device and scheme (`phone`, `phone/dark`). */
	devices: string[];
}

export interface CheckReport {
	results: LookResult[];
	unchecked: Unchecked[];
	/** Looks unchanged since they last held, reported from that result; none were opened. */
	reused: Reused[];
	/** Why looks that might have been reused were opened, when the person can act on it (render the stories). */
	notice?: string;
}

/**
 * Read inside the page. A string, not a function, because the package has no
 * DOM types and the code must run in the browser as written. It returns
 * `{ runtime, elements }`: the named custom properties on `:root`, and every
 * measured property of `body` and its descendants, with a selector for each —
 * as one JSON string, because a string crosses from the page to Node in a
 * tenth of the time an object of 75,000 values does.
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
	return JSON.stringify({ runtime, elements, states, scheme });
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
 * Where a story is served: the app's Storybook build under `/storybook` and
 * the story's id. No theme global: the preview's decorator then leaves
 * `data-theme` off and the story follows `prefers-color-scheme`, which the
 * check switches on the page, as it does for a screen.
 */
export function storyUrl(base: string, id: string): string {
	const url = new URL("/storybook/iframe.html", base);
	url.searchParams.set("id", id);
	url.searchParams.set("viewMode", "story");
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

/**
 * A page that answers 404: its plan or screen is not in the project the check
 * runs against (the plan and brief screens are drawn at plans only A10's
 * fixture project holds). A fact about the project, not about the page.
 */
export class LookNotHere extends LooksCheckError {}

const isTimeout = (e: unknown): boolean =>
	e instanceof LookTimedOut || (e instanceof Error && e.name === "TimeoutError");

/**
 * Open a look, trying again once when it runs out of time. A look that times
 * out twice is the reason it was not checked, named — never the end of the
 * run: one slow page used to throw away every look measured before it. A page
 * that answers 404 is not in this project: it is unchecked at once (a second
 * try would answer the same), and the run goes on. Any other failure (a 500, a
 * refused connection) is a broken check, not a missing look, and still ends the
 * run, loudly.
 */
export async function openWithinTime<T>(
	open: () => Promise<T>,
	tries = 2,
): Promise<T | { timedOut: string } | { unchecked: string }> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await open();
		} catch (e) {
			if (e instanceof LookNotHere) return { unchecked: `${e.message} — not in this project` };
			if (!isTimeout(e)) throw e;
			if (attempt >= tries) {
				return { timedOut: `timed out ${tries} times: ${(e as Error).message.split("\n")[0]}` };
			}
		}
	}
}

/** How long a page is given to settle after `load` before it is read. */
const SETTLE_MS = 3_000;

/** Two frames for the switch to take effect, then every running colour transition run to its end. */
const FINISH_TRANSITIONS = `new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
	for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish();
	done();
})))`;

/**
 * Open `url` once and read it at every device and scheme, on that page: the
 * device's size and pixel ratio are set through Chromium's own device-metrics
 * override and the scheme by `emulateMedia`, so six reads cost one load. A
 * switch in place starts the page's colour transitions, which a fresh load
 * never does, so each is finished before the read — a button read half-way
 * through its transition is off its token. Answers in device x scheme order.
 */
async function measureInPlace(
	browser: Browser,
	devices: readonly Device[],
	schemes: readonly Scheme[],
	url: string,
	script: string,
	/** A selector that appears once a story has drawn; absent for a page, which is read at `load`. */
	rendered?: string,
): Promise<Measured[]> {
	const first = devices[0] as Device;
	const context = await browser.newContext({
		viewport: { width: first.width, height: first.height },
		deviceScaleFactor: first.pixelRatio,
		colorScheme: schemes[0],
	});
	try {
		const page = await context.newPage();
		const response = await page.goto(url, { waitUntil: "load" });
		if (!response?.ok()) {
			const answer = `${url} answered ${response ? response.status() : "nothing"}`;
			throw response?.status() === 404 ? new LookNotHere(answer) : new LooksCheckError(answer);
		}
		// A page that sets its look state, or anything it draws, after hydration
		// (the nav's width, asked for in the address) has not said so at `load`:
		// give it until the network is quiet, but never hold a look to a page
		// that never settles (a poll, a stream).
		if (!rendered)
			await page.waitForLoadState("networkidle", { timeout: SETTLE_MS }).catch(() => {});
		if (rendered) {
			try {
				await page.waitForSelector(rendered, { timeout: 30_000 });
			} catch {
				throw new LookTimedOut(`${url} did not draw its story within 30s`);
			}
		}
		const cdp = await context.newCDPSession(page);
		const seen: Measured[] = [];
		for (const device of devices) {
			await cdp.send("Emulation.setDeviceMetricsOverride", {
				width: device.width,
				height: device.height,
				deviceScaleFactor: device.pixelRatio,
				mobile: false,
			});
			for (const scheme of schemes) {
				await page.emulateMedia({ colorScheme: scheme });
				await page.evaluate(FINISH_TRANSITIONS);
				seen.push(JSON.parse((await page.evaluate(script)) as string) as Measured);
			}
		}
		return seen;
	} finally {
		await context.close();
	}
}

/** What a look is opened for: its name as it is reported, where it is served, and what shows it drew. */
export interface OpenTarget {
	/** `home.empty` for a screen state; `story badge.ok` for a story. */
	look: string;
	url: string;
	/** A selector that appears once a story has drawn; absent for a page. */
	rendered?: string;
}

/** What opens a look, so `checkApp`'s decisions can be tested without a browser. */
export interface LookOpener {
	/** Opens the look once and measures it at each device x scheme; launches the browser on first use. */
	open(target: OpenTarget, devices: Device[], schemes: Scheme[]): Promise<Measured[]>;
	close(): Promise<void>;
}

/** Chromium, launched when the first look is opened, so a run that opens nothing starts no browser. */
function chromiumOpener(app: LooksApp): LookOpener {
	const tokens = app.foundation.tokens.map((t) => t.name);
	const pageScript = measureScript(tokens, MEASURED_PROPERTIES, app.ignore);
	const storyScript = measureScript(tokens, MEASURED_PROPERTIES, app.ignore, "#storybook-root");
	let browser: Promise<Browser> | undefined;
	return {
		async open(target, devices, schemes) {
			browser ??= loadChromium().then(launch);
			return measureInPlace(
				await browser,
				devices,
				schemes,
				target.url,
				target.rendered ? storyScript : pageScript,
				target.rendered,
			);
		},
		async close() {
			if (browser) await (await browser).close();
		},
	};
}

/**
 * Stories open this many at a time: each is a static file in the served
 * Storybook, so the app's own server does no rendering for it; in turn, a
 * run over the admin's 342 story looks took six minutes. Screens are each a
 * render by the app's server.
 */
const STORIES_AT_ONCE = 8;

/**
 * Screens that need no seed open this many at a time: the app's server
 * renders one page at a time, and three overlap the browser's work on one
 * page with the server's render of the next. A seeded screen's seed is
 * process-wide state, so those stay one at a time.
 */
const SCREENS_AT_ONCE = 3;

/**
 * Open one look once and judge it at every device and scheme. A look that
 * does not load or draw in time is unchecked at each of them, with the
 * reason, and the run goes on; a 404 likewise at once. `judge` turns what the
 * page gave back into a verdict or an unchecked, from values it is handed.
 */
async function openAndJudge(
	opener: LookOpener,
	target: OpenTarget,
	devices: Device[],
	schemes: Scheme[],
	judge: (
		device: string,
		scheme: Scheme,
		seen: Measured,
	) => { result: LookResult } | { unchecked: Unchecked },
	mockup: string,
): Promise<CheckReport> {
	const opened = await openWithinTime(() => opener.open(target, devices, schemes));
	if ("timedOut" in opened || "unchecked" in opened) {
		const reason = "timedOut" in opened ? opened.timedOut : opened.unchecked;
		return {
			results: [],
			reused: [],
			unchecked: devices.flatMap((d) =>
				schemes.map((scheme) => ({ mockup, device: lookDevice(d.name, scheme), reason })),
			),
		};
	}
	const report: CheckReport = { results: [], unchecked: [], reused: [] };
	let at = 0;
	for (const device of devices) {
		for (const scheme of schemes) {
			const judged = judge(lookDevice(device.name, scheme), scheme, opened[at++] as Measured);
			if ("result" in judged) report.results.push(judged.result);
			else report.unchecked.push(judged.unchecked);
		}
	}
	return report;
}

/** One screen state, opened once and judged at every device and scheme. */
function checkScreenState(
	opener: LookOpener,
	app: LooksApp,
	base: string,
	look: LookTarget,
): Promise<CheckReport> {
	return openAndJudge(
		opener,
		{
			look: `${look.screen}.${look.state}`,
			url: pageUrl(base, look.screen, look.path, look.state),
		},
		app.devices,
		schemesOf(app),
		(device, scheme, seen) =>
			judgeLook({
				app: app.app,
				look,
				device,
				scheme,
				approved: approvedValues(app, scheme),
				seen,
			}),
		`${look.screen}.${look.state}`,
	);
}

/** One story, opened once in the served Storybook (read from its first drawn element) and judged at every device and scheme. */
function checkStory(
	opener: LookOpener,
	app: LooksApp,
	base: string,
	story: StoryTarget,
): Promise<CheckReport> {
	return openAndJudge(
		opener,
		{ look: `story ${story.name}`, url: storyUrl(base, story.id), rendered: "#storybook-root > *" },
		app.devices,
		schemesOf(app),
		(device, scheme, seen) =>
			judgeStory({
				app: app.app,
				story,
				device,
				scheme,
				approved: approvedValues(app, scheme),
				seen,
			}),
		`story ${story.name}`,
	);
}

/** What `checkApp` is given beyond the app and its record. */
export interface CheckOptions {
	/** What opens a look; Chromium when absent. */
	opener?: LookOpener;
	/**
	 * Check just the looks of these names, a screen state (`home.empty`) or a
	 * story (`badge.ok`) or both, and report nothing else.
	 */
	only?: string[];
	/** Open every look, whatever was held (`--all`). */
	all?: boolean;
	/** The project the check runs in: held results are read and kept for it. Without it nothing is reused or kept. */
	projectRoot?: string;
	/** The InDusk home the project's held results live under; `induskHome()` when absent. */
	home?: string;
	/** When this run's held results are recorded as measured. */
	now?: Date;
	/** The HTML at a URL, read once before any look opens to refuse a development server; a plain `fetch` when absent. */
	fetchPage?: (url: string) => Promise<string>;
}

/** Every look the app declares, by the name `--only` takes: its screen states and its stories. */
function declaredLooks(app: LooksApp): Set<string> {
	return new Set([
		...app.screens.flatMap((s) => s.states.map((state) => `${s.name}.${state}`)),
		...app.stories.map((s) => s.name),
	]);
}

/** The names `--only` was given that no look of the app has: refused by name, before any page opens. */
function refuseUnknown(app: LooksApp, only: readonly string[]): void {
	const known = declaredLooks(app);
	const unknown = only.filter((name) => !known.has(name));
	if (unknown.length > 0) {
		throw new LooksCheckError(
			`${app.app} has no look named ${unknown.join(", ")} — name a screen state (home.empty) or a story (badge.ok)`,
		);
	}
}

/** The builds being served, read from one page of each kind a run opens; null where a page could not be read. */
interface Served {
	screens: string | null;
	stories: string | null;
}

/**
 * Read the served pages once before any look opens: the app's root when screens
 * are to open, and the first story's frame when stories are. A development server is refused here, naming
 * the app's `serve` command; a page that cannot be fetched leaves its build
 * unknown, so nothing of its kind is reused, and the look that opens it says
 * why it cannot be read.
 */
async function readServed(
	app: LooksApp,
	base: string,
	firstScreen: LookTarget | undefined,
	firstStory: StoryTarget | undefined,
	fetchPage: CheckOptions["fetchPage"] = (url) => fetch(url).then((r) => r.text()),
): Promise<Served> {
	const read = async (url: string | undefined): Promise<string | null> => {
		if (!url) return null;
		let html: string;
		try {
			html = await fetchPage(url);
		} catch {
			return null;
		}
		const marker = devServerMarker(html);
		if (marker !== null) {
			const serve =
				app.serve ??
				`declare the command that builds and serves the app as "serve" in .indusk/mockups/${app.app}/screens.json`;
			throw new LooksCheckError(
				`${base} is a development server (${marker}) — build and serve the app, then check again: ${serve}`,
			);
		}
		return servedBuildOf(html);
	};
	return {
		// The app's root, not a look's page: each look's page is then requested once, by its look.
		screens: await read(firstScreen && new URL("/", base).toString()),
		stories: await read(firstStory && storyUrl(base, firstStory.id)),
	};
}

/**
 * Open every checkable screen state, and every checkable story in the app's
 * served Storybook, once, and judge each at every device and scheme of `app`.
 * `baseUrl` is `--url`, else the app's own `url`; with neither the check is
 * refused rather than guessed.
 */
export async function checkApp(
	app: LooksApp,
	approvals: readonly ApprovalEntry[],
	baseUrl: string | undefined,
	storyApprovals: readonly StoryApprovalEntry[] = [],
	opts: CheckOptions = {},
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
	if (opts.only) refuseUnknown(app, opts.only);
	const named = (name: string) => !opts.only || opts.only.includes(name);
	const screens = checkable(app, approvals);
	const checked = screens.checked.filter((l) => named(`${l.screen}.${l.state}`));
	const stories = checkableStories(app, storyApprovals);
	stories.checked = stories.checked.filter((s) => named(s.name));
	const unchecked = [...screens.unchecked, ...stories.unchecked].filter((u) =>
		named(u.mockup.replace(/^story /, "")),
	);
	const results: LookResult[] = [];
	const served: Served =
		checked.length + stories.checked.length === 0
			? { screens: null, stories: null }
			: await readServed(app, base, checked[0], stories.checked[0], opts.fetchPage);
	const plan = opts.projectRoot
		? await planReuse(app, opts.projectRoot, checked, stories.checked, served, opts)
		: undefined;
	const screensToOpen = plan?.screens ?? checked;
	const storiesToOpen = plan?.stories ?? stories.checked;
	const reused = plan?.reused ?? [];
	const notice = plan?.notice ? { notice: plan.notice } : {};
	if (screensToOpen.length === 0 && storiesToOpen.length === 0) {
		if (plan && plan.rebuilt.size > 0) keepHeld(plan, app, results, [], opts);
		return { results, unchecked, reused, ...notice };
	}

	const opener = opts.opener ?? chromiumOpener(app);
	const measuredUnchecked: Unchecked[] = [];
	const take = (found: CheckReport) => {
		results.push(...found.results);
		measuredUnchecked.push(...found.unchecked);
	};
	try {
		// Unseeded screens three at a time, then seeded ones one at a time, each
		// inside its seed; the report keeps the order the screens are declared in.
		const groups = byScreen(screensToOpen);
		const reports = new Map<LookTarget[], CheckReport[]>();
		const checkGroup = async (group: LookTarget[]) => {
			await withScreenSeed(group, async (seeded) => {
				const found: CheckReport[] = [];
				for (const look of seeded) found.push(await checkScreenState(opener, app, base, look));
				reports.set(group, found);
			});
		};
		await pMap(
			groups.filter((g) => !g[0]?.seed),
			checkGroup,
			{ concurrency: SCREENS_AT_ONCE },
		);
		for (const group of groups.filter((g) => g[0]?.seed)) await checkGroup(group);
		for (const group of groups) for (const found of reports.get(group) ?? []) take(found);
		const found = await pMap(storiesToOpen, (story) => checkStory(opener, app, base, story), {
			concurrency: STORIES_AT_ONCE,
		});
		for (const f of found) take(f);
	} finally {
		await opener.close();
	}
	unchecked.push(...measuredUnchecked);
	if (plan) keepHeld(plan, app, results, measuredUnchecked, opts);
	return { results, unchecked, reused, ...notice };
}

/** What reuse decided before a run: the looks to open, the looks reused, and each opened look's key. */
interface ReusePlan {
	root: string;
	held: Record<string, Held>;
	/** Each opened look's key, by record name (`screen:home.empty`, `story:badge.ok`). */
	opened: Map<string, LookKey>;
	/** The build each kind of look is served from now; null where it could not be read. */
	builds: { screen: Build | null; story: Build | null };
	/** Reused looks whose recorded build is not the one served now: rewritten, so the next run judges against this one. */
	rebuilt: Map<string, Build>;
	screens: LookTarget[];
	stories: StoryTarget[];
	reused: Reused[];
	notice?: string;
}

/**
 * Partition the checkable looks into those reused from their last held
 * result (`reuseOf`) and those to open, from the facts read from the project
 * now: whether the stories were rendered from the current sources, the
 * page-code hash, and the held results in machine state. A look named by
 * `--only` is always opened.
 */
async function planReuse(
	app: LooksApp,
	root: string,
	screens: readonly LookTarget[],
	stories: readonly StoryTarget[],
	served: Served,
	opts: CheckOptions,
): Promise<ReusePlan> {
	const catalog = readCatalog(app);
	const sources = await sourcesHashOf(root, app);
	const current = catalog === null || catalog.renderedFrom === sources;
	const schemes = schemesOf(app);
	const facts = {
		current,
		pageSourcesHash: await pageSourcesHashOf(root, app, pageSourceFilter(catalog)),
		schemes,
		configHash: await configHashOf(root, app),
	};
	const buildOf = (served: string | null): Build | null => (served ? { sources, served } : null);
	const builds = { screen: buildOf(served.screens), story: buildOf(served.stories) };
	const held = readHeld(root, app.app, opts.home);
	const devices = app.devices.flatMap((d) => schemes.map((s) => lookDevice(d.name, s)));
	const plan: ReusePlan = {
		root,
		held,
		opened: new Map(),
		builds,
		rebuilt: new Map(),
		screens: [],
		stories: [],
		reused: [],
	};
	const opens = (record: string, key: LookKey, look: Omit<Reused, "app" | "at" | "devices">) => {
		const build = builds[key.kind];
		const reuse = opts.only ? undefined : reuseOf(held[record], key, { all: opts.all, build });
		if (reuse?.reuse) {
			plan.reused.push({ app: app.app, ...look, at: reuse.at, devices });
			const before = held[record]?.build;
			if (build && (before?.sources !== build.sources || before.served !== build.served)) {
				plan.rebuilt.set(record, build);
			}
			return false;
		}
		plan.opened.set(record, key);
		return true;
	};
	plan.screens = screens.filter((look) => {
		const name = `${look.screen}.${look.state}`;
		return opens(`screen:${name}`, lookKey(app, look, facts), {
			look: name,
			kind: "screen",
			screen: look.screen,
			state: look.state,
		});
	});
	plan.stories = stories.filter((story) =>
		opens(`story:${story.name}`, lookKey(app, story, facts), {
			look: story.name,
			kind: "story",
			screen: story.component,
			state: story.state,
		}),
	);
	const unread =
		(screens.length > 0 && served.screens === null) ||
		(stories.length > 0 && served.stories === null);
	if (unread && !opts.all && !opts.only) {
		plan.notice = `the build served at the check's URL could not be read, so no look was reused`;
	} else if (!current && !opts.all && !opts.only) {
		plan.notice = `the stories were not rendered from ${app.app}'s sources as they are now, so no look was reused — run \`indusk looks stories ${app.app}\`, then check again`;
	}
	return plan;
}

/**
 * Keep what this run proved: a look opened and held at every device and
 * scheme is recorded with its key and `now`; one broken or unchecked at any
 * of them is removed, so it is opened next time. A record that cannot be
 * written costs only reuse, so it is a note on stderr, never the end of a
 * check whose looks were measured.
 */
function keepHeld(
	plan: ReusePlan,
	app: LooksApp,
	results: readonly LookResult[],
	unchecked: readonly Unchecked[],
	opts: CheckOptions,
): void {
	const at = (opts.now ?? new Date()).toISOString();
	const everywhere = app.devices.length * schemesOf(app).length;
	const next = { ...plan.held };
	for (const [record, build] of plan.rebuilt) {
		const before = next[record];
		if (before) next[record] = { ...before, build };
	}
	for (const [record, key] of plan.opened) {
		const isStory = key.kind === "story";
		const mine = results.filter(
			(r) => (r.kind === "story") === isStory && `${r.screen}.${r.state}` === key.name,
		);
		const mockup = isStory ? `story ${key.name}` : key.name;
		const heldEverywhere =
			mine.length === everywhere &&
			mine.every((r) => r.verdict.state === "held") &&
			!unchecked.some((u) => u.mockup === mockup);
		const build = plan.builds[key.kind];
		if (heldEverywhere) next[record] = { key, at, state: "held", ...(build ? { build } : {}) };
		else delete next[record];
	}
	try {
		writeHeld(plan.root, app.app, next, opts.home);
	} catch (err) {
		console.error(`could not keep ${app.app}'s held results: ${(err as Error).message}`);
	}
}

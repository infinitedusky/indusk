import type { Browser, BrowserContext, Page } from "playwright-core";
import { LooksCheckError } from "./errors.js";
import type { Device, LooksApp } from "./mockups.js";
import { MEASURED_PROPERTIES, type MeasuredElement } from "./verdict.js";

/**
 * The browser half of the look check: launching Chromium, loading a page,
 * and measuring it at every device and scheme, in place or fresh. It only
 * measures; whether a look is held is `verdict`'s to say, and which looks
 * open is `checkApp`'s. `checkApp` reaches the browser only through a
 * `LookOpener`.
 *
 * promise: tokens-are-held-exactly
 */

/**
 * Read inside the page. A string, not a function, because the package has no
 * DOM types and the code must run in the browser as written. It returns
 * `{ runtime, elements }`: the named custom properties on `:root`, and every
 * measured property of `body` and its descendants, with a selector for each —
 * as one JSON string, because a string crosses from the page to Node in a
 * tenth of the time an object of 75,000 values does.
 */
export function measureScript(
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
export const FINISH_TRANSITIONS = `new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
	for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish();
	done();
})))`;

/**
 * Run in every page before its own scripts: notes whether the page asked for
 * a media query on what a switch in place changes (size, ratio, orientation,
 * resolution, scheme — not reduced motion, which Storybook's frame asks once)
 * without listening for its change, or read the viewport's size
 * or pixel ratio with no `resize` listener on the window — a page that draws
 * from what it read once on mount, which a switch in place never redraws.
 * Read once the page has settled, before the check's own script (which asks
 * for the scheme's media query) runs.
 */
const MOUNT_READS = `(() => {
	const w = window;
	const lists = [];
	let sized = false;
	let resized = false;
	const matchMedia = w.matchMedia.bind(w);
	// Only what a switch in place changes: the viewport's size and ratio, and the scheme.
	const switched = /width|height|aspect-ratio|orientation|resolution|pixel-ratio|prefers-color-scheme/i;
	w.matchMedia = (query) => {
		const list = matchMedia(query);
		const entry = { list, heard: false };
		if (switched.test(String(query))) lists.push(entry);
		const add = list.addEventListener.bind(list);
		list.addEventListener = (type, fn, o) => {
			if (type === "change") entry.heard = true;
			return add(type, fn, o);
		};
		if (list.addListener) {
			const addListener = list.addListener.bind(list);
			list.addListener = (fn) => {
				entry.heard = true;
				return addListener(fn);
			};
		}
		return list;
	};
	const addEventListener = w.addEventListener.bind(w);
	w.addEventListener = (type, fn, o) => {
		if (type === "resize") resized = true;
		return addEventListener(type, fn, o);
	};
	for (const name of ["innerWidth", "innerHeight", "devicePixelRatio"]) {
		const own = Object.getOwnPropertyDescriptor(w, name) || Object.getOwnPropertyDescriptor(Window.prototype, name);
		if (!own || !own.get) continue;
		try {
			Object.defineProperty(w, name, {
				configurable: true,
				enumerable: true,
				get() { sized = true; return own.get.call(w); },
				set(v) { if (own.set) own.set.call(w, v); },
			});
		} catch {}
	}
	w.__induskReadOnMount = () =>
		lists.some((e) => !e.heard && e.list.onchange === null) || (sized && !resized && w.onresize === null);
})()`;

/** Whether the page read its viewport or scheme once on mount (`MOUNT_READS`). */
const READ_ON_MOUNT = "globalThis.__induskReadOnMount ? globalThis.__induskReadOnMount() : false";

/**
 * Load `url` in `context` and wait until it can be read: the page's `load`,
 * then a quiet network for a page, or its first drawn element for a story.
 */
async function loadPage(
	context: BrowserContext,
	url: string,
	rendered: string | undefined,
): Promise<Page> {
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
	if (!rendered) await page.waitForLoadState("networkidle", { timeout: SETTLE_MS }).catch(() => {});
	if (rendered) {
		try {
			await page.waitForSelector(rendered, { timeout: 30_000 });
		} catch {
			throw new LookTimedOut(`${url} did not draw its story within 30s`);
		}
	}
	return page;
}

/** A context drawn at `device` under `scheme`, as a fresh load sees it. */
const contextAt = (browser: Browser, device: Device, scheme: Scheme): Promise<BrowserContext> =>
	browser.newContext({
		viewport: { width: device.width, height: device.height },
		deviceScaleFactor: device.pixelRatio,
		colorScheme: scheme,
	});

/**
 * Open `url` once and read it at every device and scheme, on that page: the
 * device's size and pixel ratio are set through Chromium's own device-metrics
 * override and the scheme by `emulateMedia`, so six reads cost one load. A
 * switch in place starts the page's colour transitions, which a fresh load
 * never does, so each is finished before the read — a button read half-way
 * through its transition is off its token. A page that read its viewport or
 * scheme once on mount, with nothing listening for a change, would be read at
 * the first device's drawing everywhere: it is loaded fresh at each device and
 * scheme instead (A36). Answers in device x scheme order.
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
	const context = await contextAt(browser, devices[0] as Device, schemes[0] as Scheme);
	try {
		await context.addInitScript({ content: MOUNT_READS });
		const page = await loadPage(context, url, rendered);
		if ((await page.evaluate(READ_ON_MOUNT)) !== true) {
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
		}
	} finally {
		await context.close();
	}
	return measureFresh(browser, devices, schemes, url, script, rendered);
}

/** A fresh load at each device and scheme, read once: how a page that draws from what it read on mount is measured. */
async function measureFresh(
	browser: Browser,
	devices: readonly Device[],
	schemes: readonly Scheme[],
	url: string,
	script: string,
	rendered: string | undefined,
): Promise<Measured[]> {
	const seen: Measured[] = [];
	for (const device of devices) {
		for (const scheme of schemes) {
			const context = await contextAt(browser, device, scheme);
			try {
				const page = await loadPage(context, url, rendered);
				seen.push(JSON.parse((await page.evaluate(script)) as string) as Measured);
			} finally {
				await context.close();
			}
		}
	}
	return seen;
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
export function chromiumOpener(app: LooksApp): LookOpener {
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

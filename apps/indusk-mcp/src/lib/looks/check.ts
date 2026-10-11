import type { Browser } from "playwright-core";
import { type ApprovalEntry, approvalOf, boundToNow } from "./approvals.js";
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
	const nodes = [document.body, ...document.body.querySelectorAll("*")];
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
				checked.push({ screen: screen.name, state, ...(screen.path ? { path: screen.path } : {}) });
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

async function measure(
	browser: Browser,
	device: Device,
	scheme: Scheme,
	url: string,
	script: string,
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
		return (await page.evaluate(script)) as Measured;
	} finally {
		await context.close();
	}
}

/**
 * Open every checkable screen state at every device of `app` and judge each.
 * `baseUrl` is `--url`, else the app's own `url`; with neither the check is
 * refused rather than guessed.
 */
export async function checkApp(
	app: LooksApp,
	approvals: readonly ApprovalEntry[],
	baseUrl: string | undefined,
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
	const results: LookResult[] = [];
	if (checked.length === 0) return { results, unchecked };

	const chromium = await loadChromium();
	const browser = await launch(chromium);
	const script = measureScript(
		app.foundation.tokens.map((t) => t.name),
		MEASURED_PROPERTIES,
		app.ignore,
	);
	try {
		for (const look of checked) {
			for (const device of app.devices) {
				for (const scheme of schemesOf(app)) {
					const url = pageUrl(base, look.screen, look.path, look.state);
					const seen = await measure(browser, device, scheme, url, script);
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
	} finally {
		await browser.close();
	}
	return { results, unchecked };
}

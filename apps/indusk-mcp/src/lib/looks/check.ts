import { execFileSync } from "node:child_process";
import pMap from "p-map";
import {
	type ApprovalEntry,
	approvalOf,
	boundToNow,
	type StoryApprovalEntry,
	storyApprovalOf,
} from "./approvals.js";
import {
	chromiumOpener,
	type LookOpener,
	lookDevice,
	type Measured,
	type OpenTarget,
	openWithinTime,
	type Scheme,
	schemesOf,
} from "./browser.js";
import { storybookIds } from "./components.js";
import { LooksCheckError } from "./errors.js";
import type { Device, LooksApp } from "./mockups.js";
import type { LookResult } from "./report.js";
import { keepHeld, planReuse } from "./reuse-run.js";
import { readServed, type Served, storyUrl } from "./served.js";
import { verdict } from "./verdict.js";

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

export {
	LookNotHere,
	type LookOpener,
	lookDevice,
	type Measured,
	type OpenTarget,
	openWithinTime,
	type Scheme,
	schemesOf,
} from "./browser.js";
export { LooksCheckError } from "./errors.js";
export { storyUrl } from "./served.js";

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
	/**
	 * The looks a change touched (`touchedLooks`), by record name
	 * (`screen:home.empty`, `story:badge.ok`): only these open; every other look
	 * with a held result is reported from it even when its key changed
	 * (`indusk looks check --changed`). `only` and `all` win over it.
	 */
	touched?: ReadonlySet<string>;
	/** The project the check runs in: held results are read and kept for it. Without it nothing is reused or kept. */
	projectRoot?: string;
	/** The InDusk home the project's held results live under; `induskHome()` when absent. */
	home?: string;
	/** When this run's held results are recorded as measured. */
	now?: Date;
	/** The HTML at a URL, read once before any look opens to refuse a development server; a plain `fetch` when absent. */
	fetchPage?: (url: string) => Promise<string>;
	/** How long that read may take before the build is taken as unreadable; 30 s when absent. */
	readTimeoutMs?: number;
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
			: await readServed(app, base, checked[0], stories.checked[0], opts);
	const plan = opts.projectRoot
		? await planReuse(app, opts.projectRoot, base, checked, stories.checked, served, opts)
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

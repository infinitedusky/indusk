import { FINISH_TRANSITIONS, lookDevice, measureScript, schemesOf } from "./browser.js";
import type { CheckOptions, LookTarget, Reused, StoryTarget, Unchecked } from "./check.js";
import { pageSourceFilter, readCatalog } from "./components.js";
import {
	checkerHashOf,
	configHashOf,
	type LooksApp,
	pageSourcesHashOf,
	sourcesHashOf,
} from "./mockups.js";
import type { LookResult } from "./report.js";
import { type Build, type LookKey, lookKey, readHeld, reuseOf, writeHeld } from "./reuse.js";
import { type Served, serveCommand } from "./served.js";
import { MEASURED_KINDS, MEASURED_PROPERTIES, VERDICT_VERSION } from "./verdict.js";

/**
 * Planning a run's reuse around the reuse rule (`reuse.ts`): which looks reopen
 * and which are reported from their last held result, the notices the person
 * can act on, and what a run keeps. Reads the record and the sources; opens
 * and measures nothing.
 */

/**
 * The checker's own hash, in every look's key: the measured properties and
 * their kinds, the measure script (a page's and a story's, with no tokens:
 * the foundation is its own key) and the transition finish, and the verdict's
 * version. Computed once.
 */
let checkerHash: string | undefined;
const checkerHashNow = (): string => {
	checkerHash ??= checkerHashOf({
		properties: MEASURED_KINDS,
		script: [
			measureScript([], MEASURED_PROPERTIES, []),
			measureScript([], MEASURED_PROPERTIES, [], "#storybook-root"),
			FINISH_TRANSITIONS,
		].join("\n"),
		verdictVersion: VERDICT_VERSION,
	});
	return checkerHash;
};

/** What reuse decided before a run: the looks to open, the looks reused, and each opened look's key. */
export interface ReusePlan {
	root: string;
	/** Each opened look's key, by record name (`screen:home.empty`, `story:badge.ok`). */
	opened: Map<string, LookKey>;
	/** The build each kind of look is served from now; null where it could not be read. */
	builds: { screen: Build | null; story: Build | null };
	/** Reused looks whose recorded build is not the one served now: rewritten, so the next run judges against this one. */
	rebuilt: Map<string, Build>;
	/**
	 * Each kind whose server still serves the build from before the sources
	 * changed: a held record names the build served now with other sources.
	 * What is measured there is reported and never kept.
	 */
	stale: { screen: boolean; story: boolean };
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
export async function planReuse(
	app: LooksApp,
	root: string,
	base: string,
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
		baseHash: catalog?.baseRulesHash ?? "",
		checkerHash: checkerHashNow(),
	};
	const buildOf = (served: string | null): Build | null => (served ? { sources, served } : null);
	const builds = { screen: buildOf(served.screens), story: buildOf(served.stories) };
	const held = readHeld(root, app.app, opts.home);
	const devices = app.devices.flatMap((d) => schemes.map((s) => lookDevice(d.name, s)));
	const staleFor = (kind: LookKey["kind"]): boolean => {
		const now = builds[kind];
		return (
			now !== null &&
			Object.values(held).some(
				(h) =>
					h.key.kind === kind && h.build?.served === now.served && h.build.sources !== now.sources,
			)
		);
	};
	const plan: ReusePlan = {
		root,
		opened: new Map(),
		builds,
		rebuilt: new Map(),
		stale: { screen: staleFor("screen"), story: staleFor("story") },
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
			if (
				build &&
				!plan.stale[key.kind] &&
				(before?.sources !== build.sources || before.served !== build.served)
			) {
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
	const notice = reuseNotice(app, base, {
		unread:
			(screens.length > 0 && served.screens === null) ||
			(stories.length > 0 && served.stories === null),
		current,
		stale: (screens.length > 0 && plan.stale.screen) || (stories.length > 0 && plan.stale.story),
		chosen: Boolean(opts.all || opts.only),
	});
	if (notice) plan.notice = notice;
	return plan;
}

/**
 * What the person is told about reuse, one line each, when they can act on it:
 * the served build could not be read, or the stories were not rendered from
 * the sources (neither is said when `--all` or `--only` chose what opens); and,
 * whatever was asked for, that the server serves a build from before the
 * sources changed, so nothing measured there was kept.
 */
function reuseNotice(
	app: LooksApp,
	base: string,
	facts: { unread: boolean; current: boolean; stale: boolean; chosen: boolean },
): string | undefined {
	const notices: string[] = [];
	if (facts.unread && !facts.chosen) {
		notices.push(`the build served at the check's URL could not be read, so no look was reused`);
	} else if (!facts.current && !facts.chosen) {
		notices.push(
			`the stories were not rendered from ${app.app}'s sources as they are now, so no look was reused — run \`indusk looks stories ${app.app}\`, then check again`,
		);
	}
	if (facts.stale) {
		notices.push(
			`${base} serves a build from before the sources changed — results were not kept; rebuild and serve it: ${serveCommand(app)}`,
		);
	}
	return notices.length > 0 ? notices.join("\n") : undefined;
}

/**
 * Keep what this run proved: a look opened and held at every device and
 * scheme is recorded with its key and `now`; one broken or unchecked at any
 * of them is removed, so it is opened next time. A look measured on a server
 * still serving the build from before the sources changed proved nothing about
 * the sources: it is never recorded held, and its earlier record is left as it
 * was — the evidence that this server is behind its sources. Only the looks
 * this run opened or rebuilt are written, over the record as it is now. A record that cannot be
 * written costs only reuse, so it is a note on stderr, never the end of a
 * check whose looks were measured.
 */
export function keepHeld(
	plan: ReusePlan,
	app: LooksApp,
	results: readonly LookResult[],
	unchecked: readonly Unchecked[],
	opts: CheckOptions,
): void {
	const at = (opts.now ?? new Date()).toISOString();
	const everywhere = app.devices.length * schemesOf(app).length;
	// Read again now, not at the start of the run: another check of the project
	// may have kept or removed looks meanwhile, and only this run's own looks
	// are written over what it left (A32).
	const next = readHeld(plan.root, app.app, opts.home);
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
		if (heldEverywhere && plan.stale[key.kind]) continue;
		if (heldEverywhere) next[record] = { key, at, state: "held", ...(build ? { build } : {}) };
		else delete next[record];
	}
	try {
		writeHeld(plan.root, app.app, next, opts.home);
	} catch (err) {
		console.error(`could not keep ${app.app}'s held results: ${(err as Error).message}`);
	}
}

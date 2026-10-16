import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bookkeepingRoots } from "../bookkeeping/roots.js";
import { induskHome } from "../telemetry/status.js";
import type { LookTarget, StoryTarget } from "./check.js";
import type { LooksApp } from "./mockups.js";

/**
 * Whether a look's last held result can be reported instead of opening it
 * (looks-check-speed ADR decisions 1-2). A look is reused only when every
 * input it is held to and drawn from is what it was when it last held at
 * every device and scheme: the foundation (so a token change is never hidden
 * behind a reused look — `tokens-are-held-exactly`), the declarations, the
 * devices and schemes, the checker, the styling configuration and lockfile,
 * its snapshot hashes, for a story the app's element and root rules it draws
 * under, and for a screen its page code, path and seed. The same sources must be served
 * by the same build (`Build`). Nothing is reused unless the stories were
 * rendered from the sources as they are now, and an uncomposed screen never
 * is. Pure: the caller hands every fact in, and the browser never decides.
 *
 * promise: a-look-check-costs-what-changed
 * promise: tokens-are-held-exactly
 */

interface KeyBase {
	name: string;
	foundationHash: string;
	declarationsHash: string;
	devices: string;
	schemes: string;
	current: boolean;
	/** The styling and Storybook configuration and the lockfile, hashed (`configHashOf`). */
	configHash: string;
	/** What the check measures and how it judges, hashed (`checkerHashOf`). */
	checkerHash: string;
}

export interface StoryKey extends KeyBase {
	kind: "story";
	snapshotHash: string;
	stylesheetHash: string | null;
	/** The app's element, universal and root rules every story draws under (the catalog's `baseRulesHash`); "" when unrecorded. */
	baseHash: string;
}

export interface ScreenKey extends KeyBase {
	kind: "screen";
	mockupHash: string;
	componentsHash: string;
	pageSourcesHash: string;
	path: string;
	seed: string;
	uncomposed: boolean;
}

export type LookKey = StoryKey | ScreenKey;

/**
 * What was served and what it was served for when a look last held or was
 * last reported reused: the app's sources hash and the served build's
 * identity (`servedBuildOf`). Outside the key on purpose — a rebuild after an
 * edit changes the build's scripts and stylesheets for every look, so a build
 * identity in the key would reopen all of them for one changed component.
 */
export interface Build {
	sources: string;
	served: string;
}

export interface Held {
	key: LookKey;
	at: string;
	state: "held" | "broken" | "unchecked";
	build?: Build;
}

export type Reuse = { reuse: true; at: string } | { reuse: false; changed: string };

/** The devices as a key: each one's name, size and pixel ratio, in order. */
const devicesKey = (app: LooksApp): string =>
	app.devices.map((d) => `${d.name}:${d.width}x${d.height}@${d.pixelRatio}`).join(",");

const isStoryTarget = (look: StoryTarget | LookTarget): look is StoryTarget => "id" in look;

/**
 * What `look` is held to and drawn from now. `facts` are what the caller
 * read from the project: whether the catalog was rendered from the current
 * sources, the page-code hash, and the schemes the look is opened under.
 */
export function lookKey(
	app: LooksApp,
	look: StoryTarget | LookTarget,
	facts: {
		current: boolean;
		pageSourcesHash: string;
		schemes: readonly string[];
		configHash: string;
		/** The checker's hash (`checkerHashOf`); "" when not given. */
		checkerHash?: string;
		/** The catalog's `baseRulesHash`; "" when it records none. */
		baseHash?: string;
	},
): LookKey {
	const base = {
		foundationHash: app.foundation.hash,
		declarationsHash: app.declarationsHash,
		devices: devicesKey(app),
		schemes: facts.schemes.join(","),
		current: facts.current,
		configHash: facts.configHash,
		checkerHash: facts.checkerHash ?? "",
	};
	if (isStoryTarget(look)) {
		const story = app.stories.find((s) => s.name === look.name);
		if (!story) throw new Error(`${app.app} has no story ${look.name}`);
		return {
			kind: "story",
			name: look.name,
			...base,
			snapshotHash: story.hash,
			stylesheetHash: story.stylesheetHash,
			baseHash: facts.baseHash ?? "",
		};
	}
	const name = `${look.screen}.${look.state}`;
	const mockup = app.mockups.find((m) => m.name === name);
	if (!mockup) throw new Error(`${app.app} has no mockup ${name}`);
	return {
		kind: "screen",
		name,
		...base,
		mockupHash: mockup.hash,
		componentsHash: mockup.componentsHash,
		pageSourcesHash: facts.pageSourcesHash,
		path: look.path ?? "",
		seed: look.unseed ? `${look.seed ?? ""}\n${look.unseed}` : (look.seed ?? ""),
		uncomposed: app.uncomposed.includes(name),
	};
}

/** The inputs compared, in the order the first changed one is named. */
const COMPARED: readonly [string, string][] = [
	["foundationHash", "foundation"],
	["checkerHash", "checker"],
	["declarationsHash", "declarations"],
	["devices", "devices"],
	["schemes", "schemes"],
	["configHash", "configuration"],
	["snapshotHash", "snapshot"],
	["stylesheetHash", "stylesheet"],
	["baseHash", "base rules"],
	["mockupHash", "mockup"],
	["componentsHash", "components"],
	["pageSourcesHash", "page code"],
	["path", "path"],
	["seed", "seed"],
];

/** A key as one string, its fields sorted: any field the named comparisons miss still reopens the look. */
const canonicalKey = (key: object): string =>
	JSON.stringify(Object.entries(key).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/**
 * Reuse `held` for a look whose key is now `now`, or reopen it, naming the
 * first input that changed: `--all`, the stories not rendered from the
 * current sources, an uncomposed screen, a look never held (or last broken
 * or unchecked), then each compared input in `COMPARED`'s order. A record
 * read from disk is untrusted: anything but a held entry with a key and a
 * time reopens the look.
 */
export function reuseOf(
	held: Held | undefined,
	now: LookKey,
	opts: { all?: boolean; build?: Build | null } = {},
): Reuse {
	if (opts.all) return { reuse: false, changed: "--all" };
	if (opts.build === null) return { reuse: false, changed: "served build unreadable" };
	if (!now.current)
		return { reuse: false, changed: "stories not rendered from the current sources" };
	if (now.kind === "screen" && now.uncomposed) return { reuse: false, changed: "uncomposed" };
	if (!held || typeof held.key !== "object" || held.key === null || typeof held.at !== "string") {
		return { reuse: false, changed: "never held" };
	}
	if (held.state !== "held") return { reuse: false, changed: "last broken or unchecked" };
	if (held.key.kind !== now.kind || held.key.name !== now.name) {
		return { reuse: false, changed: "look" };
	}
	const before = held.key as unknown as Record<string, unknown>;
	const after = now as unknown as Record<string, unknown>;
	for (const [field, label] of COMPARED) {
		if (before[field] !== after[field]) return { reuse: false, changed: label };
	}
	if (canonicalKey(before) !== canonicalKey(after)) return { reuse: false, changed: "key" };
	const served = servedAgainst(held.build, opts.build);
	if (served) return { reuse: false, changed: served };
	return { reuse: true, at: held.at };
}

/**
 * Whether the build now served can stand for the one this look was held on,
 * for a look whose key compared equal: the same sources must be served by the
 * same build. Edited sources served by the old build (not rebuilt) leave this
 * look's own inputs as they were, so it is reused on the build it was measured
 * on — what such a server measures is never kept (`checkApp`'s `stale`).
 * Returns the reason to reopen, else null. A record from before builds were
 * kept (no `build`) and a run that passed none (`undefined`) are not judged
 * here.
 */
function servedAgainst(before: Build | undefined, now: Build | null | undefined): string | null {
	if (now === undefined) return null;
	if (!before) return "served build";
	const sameSources = before.sources === now?.sources;
	const sameBuild = before.served === now?.served;
	if (sameSources && !sameBuild) return "served build";
	return null;
}

/**
 * Where an app's held results are kept: the project's home outside every
 * checkout (`bookkeepingRoots(projectRoot).home`, `indusk eval home`'s
 * folder), `looks/<app>.json` — machine state, true of one machine's build,
 * the same from every worktree of the project, never committed
 * (/decisions/bookkeeping-lives-where-it-is-read).
 */
export function heldPath(projectRoot: string, app: string, home = induskHome()): string {
	return join(bookkeepingRoots(projectRoot, home).home, "looks", `${app}.json`);
}

const isHeld = (v: unknown): v is Held => {
	const o = v as Partial<Held> | null;
	return (
		typeof o === "object" &&
		o !== null &&
		typeof o.key === "object" &&
		o.key !== null &&
		typeof o.at === "string" &&
		typeof o.state === "string"
	);
};

/**
 * An app's held results by look (`story:<name>`, `screen:<name>`): none when
 * the file is missing; none, with a note on stderr, when it cannot be read —
 * a lost record only reopens looks, so it never ends the check.
 */
export function readHeld(
	projectRoot: string,
	app: string,
	home = induskHome(),
): Record<string, Held> {
	const file = heldPath(projectRoot, app, home);
	if (!existsSync(file)) return {};
	try {
		const parsed = JSON.parse(readFileSync(file, "utf-8")) as {
			version?: unknown;
			looks?: unknown;
		};
		if (parsed.version !== 1 || typeof parsed.looks !== "object" || parsed.looks === null) {
			throw new Error("not a version 1 record");
		}
		return Object.fromEntries(Object.entries(parsed.looks).filter(([, v]) => isHeld(v))) as Record<
			string,
			Held
		>;
	} catch (err) {
		console.error(`${file}: ${(err as Error).message} — every look will be opened`);
		return {};
	}
}

/** Write an app's held results whole: to a temp file beside it, renamed over it, so a reader never sees half a record. */
export function writeHeld(
	projectRoot: string,
	app: string,
	looks: Record<string, Held>,
	home = induskHome(),
): void {
	const file = heldPath(projectRoot, app, home);
	mkdirSync(dirname(file), { recursive: true });
	const temp = `${file}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify({ version: 1, looks }, null, "\t")}\n`);
	renameSync(temp, file);
}

import type { LookTarget, StoryTarget } from "./check.js";
import type { LooksApp } from "./mockups.js";

/**
 * Whether a look's last held result can be reported instead of opening it
 * (looks-check-speed ADR decisions 1-2). A look is reused only when every
 * input it is held to and drawn from is what it was when it last held at
 * every device and scheme: the foundation (so a token change is never hidden
 * behind a reused look — `tokens-are-held-exactly`), the declarations, the
 * devices and schemes, its snapshot hashes, and for a screen its page code,
 * path and seed. Nothing is reused unless the stories were rendered from the
 * sources as they are now, and an uncomposed screen never is. Pure: the
 * caller hands every fact in, and the browser never decides.
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
}

export interface StoryKey extends KeyBase {
	kind: "story";
	snapshotHash: string;
	stylesheetHash: string | null;
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

export interface Held {
	key: LookKey;
	at: string;
	state: "held" | "broken" | "unchecked";
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
	facts: { current: boolean; pageSourcesHash: string; schemes: readonly string[] },
): LookKey {
	const base = {
		foundationHash: app.foundation.hash,
		declarationsHash: app.declarationsHash,
		devices: devicesKey(app),
		schemes: facts.schemes.join(","),
		current: facts.current,
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
	["declarationsHash", "declarations"],
	["devices", "devices"],
	["schemes", "schemes"],
	["snapshotHash", "snapshot"],
	["stylesheetHash", "stylesheet"],
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
export function reuseOf(held: Held | undefined, now: LookKey, opts: { all?: boolean } = {}): Reuse {
	if (opts.all) return { reuse: false, changed: "--all" };
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
	return { reuse: true, at: held.at };
}

export function heldPath(_projectRoot: string, _app: string, _home?: string): string {
	return "";
}

export function readHeld(_projectRoot: string, _app: string, _home?: string): Record<string, Held> {
	return {};
}

export function writeHeld(
	_projectRoot: string,
	_app: string,
	_looks: Record<string, Held>,
	_home?: string,
): void {}

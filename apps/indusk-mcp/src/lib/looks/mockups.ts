import { createHash } from "node:crypto";
import { type Dirent, existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { type ComponentUse, type ContentMap, compose, type SnapshotBytes } from "./compose.js";
import { type Foundation, readFoundation } from "./foundation.js";

/**
 * An app's looks, read from `.indusk/mockups/<app>/`: its foundation, the
 * reference devices, the screens and states it declares, and one mockup per
 * `screens/<screen>.<state>.html`. Every other `looks/` module takes its
 * facts from `readApp`, so the content hash an approval binds to is computed
 * in one place. A mockup is read composed (`looks/compose`): each
 * `<indusk-component>` it names replaced by that story's snapshot, read here
 * from `components/<name>.<state>.html`.
 *
 * promise: a-mockup-leaves-nothing-undefined
 */

export const MOCKUPS_DIR = ".indusk/mockups";

export interface Device {
	name: string;
	width: number;
	height: number;
	pixelRatio: number;
}

export interface DeclaredScreen {
	name: string;
	states: string[];
	/** Where the running app serves this screen; `/<name>` when not declared. */
	path?: string;
	/**
	 * A path per state, overriding `path` for those states: a state that exists
	 * only at another address (`{ "conversation": "/new/{seed}" }`).
	 */
	paths?: Record<string, string>;
	/**
	 * A command the check runs before it opens this screen's states; its trimmed
	 * stdout replaces `{seed}` in the screen's paths and in `unseed`. For a state
	 * that exists only once something does.
	 */
	seed?: string;
	/** Run after the screen's states are opened, whatever happened; `{seed}` is substituted. */
	unseed?: string;
}

export interface Mockup {
	/** `home.empty` — the file name without `.html`. */
	name: string;
	screen: string;
	/** The part after the screen; `full.next` for `home.full.next.html`, which no screen declares. */
	state: string;
	/** Relative to the project root. */
	file: string;
	/** The file as written: what the lint locates a finding in. */
	source: string;
	/**
	 * The mockup composed (`looks/compose`): each component it names replaced by
	 * its snapshot. What is shown, checked and hashed; the source itself when it
	 * names no component.
	 */
	html: string;
	/**
	 * sha256 of the composed mockup: an approval is bound to it, so a changed
	 * snapshot changes it as surely as a changed line. For a mockup that names
	 * no component it is the hash of the file's bytes.
	 */
	hash: string;
	/** The components it names, in document order, each with the snapshot hash composed in. */
	uses: ComponentUse[];
	/** `componentsHashOf` the snapshots and stylesheets it composes: what tells a changed component from a changed mockup. */
	componentsHash: string;
	/** The stylesheet of each component it names that has one, by component name: inlined after the tokens (ADR decision 10). */
	styles: ComponentStyle[];
	/** Tokens the mockup declares new with `<meta name="indusk-new-tokens">`. */
	declaresNew: string[];
	/** Components it draws and declares new with `<meta name="indusk-new-components">`. */
	declaresNewComponents: string[];
}

/**
 * A story's snapshot, `components/<name>.<state>.html`, written by the render
 * step (`looks/stories`): the artefact a person approves and a mockup is
 * composed from (storybook-components ADR decision 3).
 */
export interface Story {
	/** `badge.ok` — the file name without `.html`. */
	name: string;
	component: string;
	state: string;
	/** Relative to the project root. */
	file: string;
	html: string;
	/** sha256 of the file's bytes: a story approval is bound to it. */
	hash: string;
	/**
	 * sha256 of its component's stylesheet (`components/<component>.css`), or
	 * null when the component has none. A story's approval binds it beside the
	 * snapshot: a rule changed by name in the app's CSS changes how the
	 * component draws and leaves its markup byte-identical (Build Phase 9, A31).
	 */
	stylesheetHash: string | null;
	/** Where a mockup's content for each property lands in the snapshot (`components.json`'s `content`); absent when it records none. */
	content?: ContentMap;
}

/**
 * A component's stylesheet, `components/<name>.css`, written by the render
 * step: the app's compiled rules for the classes the component's snapshots
 * use, on the foundation's tokens only (ADR decision 10).
 */
export interface ComponentStyle {
	component: string;
	/** Relative to the project root. */
	file: string;
	css: string;
	/** sha256 of the file's bytes: it binds into the `componentsHash` of every mockup naming the component. */
	hash: string;
	/** The key an approval's `components` record holds it under: `badge.css`. */
	key: string;
}

export interface LooksApp {
	app: string;
	/** `.indusk/mockups/<app>`, absolute. */
	dir: string;
	foundation: Foundation;
	devices: Device[];
	screens: DeclaredScreen[];
	/** Source directories of the running app, relative to the project root. */
	sources: string[];
	/** The running app's base URL, when `screens.json` declares one; `indusk looks check --url` overrides it. */
	url?: string;
	/**
	 * The command that builds and serves the app, named when the check meets a
	 * development server. Not in `declarationsHash`: declaring it reopens nothing.
	 */
	serve?: string;
	/**
	 * Element tag names the check does not measure: tooling the framework puts
	 * on the page in development (`nextjs-portal`), which the app does not draw.
	 */
	ignore: string[];
	/**
	 * Components the app marks that have no story yet, so the catalog does not
	 * list them: exempt from `not in catalog` until they do. Declared in
	 * `screens.json` and only ever shortened (storybook-components Build Phase 2).
	 */
	uncatalogued: string[];
	/**
	 * Mockups drawn before composition existed, which still write their
	 * components out: exempt from `component drawn in mockup` until they are
	 * rewritten to name them. Declared in `screens.json` and only ever shortened
	 * (storybook-components Build Phase 3; Build Phase 6 empties the admin's).
	 */
	uncomposed: string[];
	/**
	 * sha256 of what the check trusts besides the foundation: the reference
	 * devices, the `ignore` tags and the `sources`. An approval binds it, so a
	 * change to any of them returns every mockup to proposed (ui-promises Build
	 * Phase 6, A35). The screens list is not in it — coverage judges that.
	 */
	declarationsHash: string;
	/** Every snapshot in `components/`, by name. */
	stories: Story[];
	/** Every `components/<name>.css`, sorted by component. */
	styles: ComponentStyle[];
	/** `components/_base.css`, the app's compiled `body` rules a story's frame draws under; "" when absent. */
	base: string;
	mockups: Mockup[];
}

export class LooksAppError extends Error {}

/** The one place a looks hash is computed: sha256 of the bytes, hex. */
export const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

/** A story's snapshot hash, written to the catalog and read from the file by this one function. */
export const snapshotHash = (bytes: Buffer | string) => sha256(bytes);

/** A component's stylesheet hash, written beside its sheet and read from the file by this one function. */
export const stylesheetHash = (css: Buffer | string) => sha256(css);

/**
 * The hash a mockup approval binds its components by: sha256 of the snapshot
 * hashes it composes, one per story, sorted and joined by newline, then each
 * named component's stylesheet hash (`css:<hash>`, sorted). A mockup that
 * composes nothing has the hash of the empty string — the value an entry
 * written before composition existed is read as — and one whose components
 * have no stylesheet binds the snapshots alone, as it did before.
 */
export function componentsHashOf(
	uses: readonly Pick<ComponentUse, "story" | "snapshotHash">[],
	styles: readonly Pick<ComponentStyle, "hash">[] = [],
): string {
	const byStory = new Map<string, string>();
	for (const u of uses) if (u.snapshotHash !== null) byStory.set(u.story, u.snapshotHash);
	const sheets = styles.map((s) => `css:${s.hash}`);
	return sha256([...[...byStory.values()].sort(), ...sheets.sort()].join("\n"));
}

/** JSON with every object's keys sorted, so a reformatted file binds the same declarations. */
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (typeof value === "object" && value !== null) {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

/** The hash an approval binds the declarations by: devices, `ignore` and `sources`, in that shape. */
export function declarationsHashOf(d: {
	devices: readonly Device[];
	ignore: readonly string[];
	sources: readonly string[];
}): string {
	return sha256(canonical({ devices: d.devices, ignore: d.ignore, sources: d.sources }));
}

const parseJson = <T>(file: string, text: string): T => {
	try {
		return JSON.parse(text) as T;
	} catch (err) {
		throw new LooksAppError(`${file} is not valid JSON: ${(err as Error).message}`);
	}
};

/** A package JSON file, or `fallback` when it is absent; a file that is not JSON is a `LooksAppError` naming it. */
export async function readJson<T>(file: string, fallback: T): Promise<T> {
	if (!existsSync(file)) return fallback;
	return parseJson<T>(file, await readFile(file, "utf-8"));
}

/** `readJson` for the readers that are synchronous (the catalog, the approvals record). */
export function readJsonSync<T>(file: string, fallback: T): T {
	if (!existsSync(file)) return fallback;
	return parseJson<T>(file, readFileSync(file, "utf-8"));
}

/** The names in the mockup's `<meta name="indusk-new-tokens" content="--a, --b">`, or `indusk-new-components`. */
function declaredNew(html: string, name: "indusk-new-tokens" | "indusk-new-components"): string[] {
	const meta = html.match(new RegExp(`<meta\\b[^>]*\\bname=["']${name}["'][^>]*>`, "i"))?.[0];
	const content = meta?.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "";
	return content
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

export async function readApp(root: string, app: string): Promise<LooksApp> {
	const dir = join(root, MOCKUPS_DIR, app);
	if (!existsSync(dir)) {
		throw new LooksAppError(`no app "${app}": ${join(MOCKUPS_DIR, app)} does not exist`);
	}
	const foundation = await readFoundation(dir);
	const { devices } = await readJson<{ devices?: Device[] }>(join(dir, "devices.json"), {});
	const declared = await readJson<{
		screens?: DeclaredScreen[];
		sources?: string[];
		url?: string;
		serve?: string;
		ignore?: string[];
		uncatalogued?: string[];
		uncomposed?: string[];
	}>(join(dir, "screens.json"), {});

	const styles = await readStyles(dir, join(MOCKUPS_DIR, app));
	const basePath = join(dir, "components", BASE_STYLESHEET);
	const base = existsSync(basePath) ? await readFile(basePath, "utf-8") : "";
	const stories = await readStories(
		dir,
		join(MOCKUPS_DIR, app),
		styles,
		await readContentMaps(join(dir, "components.json")),
	);
	const snapshots = new Map<string, SnapshotBytes>(stories.map((s) => [s.name, s]));

	const screensDir = join(dir, "screens");
	const names = existsSync(screensDir)
		? (await readdir(screensDir)).filter((f) => f.endsWith(".html")).sort()
		: [];
	const mockups: Mockup[] = [];
	for (const fileName of names) {
		const name = fileName.slice(0, -".html".length);
		const [screen = name, ...rest] = name.split(".");
		const bytes = await readFile(join(screensDir, fileName));
		const source = bytes.toString("utf-8");
		const composed = compose(source, snapshots);
		const named = new Set(composed.uses.map((u) => u.name));
		const used = styles.filter((s) => named.has(s.component));
		mockups.push({
			name,
			screen,
			state: rest.join("."),
			file: join(MOCKUPS_DIR, app, "screens", fileName),
			source,
			html: composed.html,
			hash: composed.uses.length === 0 ? sha256(bytes) : sha256(composed.html),
			uses: composed.uses,
			componentsHash: componentsHashOf(composed.uses, used),
			styles: used,
			declaresNew: declaredNew(source, "indusk-new-tokens"),
			declaresNewComponents: declaredNew(source, "indusk-new-components"),
		});
	}

	const facts = {
		devices: devices ?? [],
		sources: declared.sources ?? [],
		ignore: declared.ignore ?? [],
	};
	return {
		app,
		dir,
		foundation,
		...facts,
		declarationsHash: declarationsHashOf(facts),
		screens: declared.screens ?? [],
		uncatalogued: declared.uncatalogued ?? [],
		uncomposed: declared.uncomposed ?? [],
		...(declared.url ? { url: declared.url } : {}),
		...(typeof declared.serve === "string" && declared.serve ? { serve: declared.serve } : {}),
		stories,
		styles,
		base,
		mockups,
	};
}

/**
 * Each story's content map from the catalog, `badge.ok` → property → paths.
 * Read from the file as written and tolerant of its absence or an older
 * shape: the catalog's own reader (`looks/components`) is the one that judges
 * validity, and it imports this module.
 */
async function readContentMaps(file: string): Promise<Map<string, ContentMap>> {
	const maps = new Map<string, ContentMap>();
	const parsed = await readJson<{
		components?: Array<{
			name?: string;
			states?: Array<{ name?: string; content?: ContentMap }>;
		}>;
	} | null>(file, null);
	for (const c of parsed?.components ?? []) {
		for (const s of c.states ?? []) {
			if (s.content && c.name && s.name) maps.set(`${c.name}.${s.name}`, s.content);
		}
	}
	return maps;
}

/**
 * The one reader of a story name's component. A story is named
 * `<component>.<state>`; the component is the name before the first dot, so
 * `plan-row.open.wide` belongs to `plan-row`. A new reader of a story name
 * takes this rather than splitting the name again
 * (promise: a-component-has-one-implementation).
 */
export function componentOfStory(name: string): string {
	return name.split(".")[0] as string;
}

/** The snapshots in `<app>/components/`, sorted by name, each with its component's stylesheet hash; none when the app has no stories. */
async function readStories(
	dir: string,
	rel: string,
	styles: readonly ComponentStyle[],
	contentOf: ReadonlyMap<string, ContentMap> = new Map(),
): Promise<Story[]> {
	const sheetOf = new Map(styles.map((s) => [s.component, s.hash] as const));
	const componentsDir = join(dir, "components");
	if (!existsSync(componentsDir)) return [];
	const files = (await readdir(componentsDir)).filter((f) => f.endsWith(".html")).sort();
	const stories: Story[] = [];
	for (const fileName of files) {
		const name = fileName.slice(0, -".html".length);
		const dot = name.indexOf(".");
		if (dot <= 0) continue;
		const bytes = await readFile(join(componentsDir, fileName));
		stories.push({
			name,
			component: componentOfStory(name),
			state: name.slice(dot + 1),
			file: join(rel, "components", fileName),
			html: bytes.toString("utf-8"),
			hash: snapshotHash(bytes),
			stylesheetHash: sheetOf.get(componentOfStory(name)) ?? null,
			...(contentOf.has(name) ? { content: contentOf.get(name) } : {}),
		});
	}
	return stories;
}

/** The app's base stylesheet in `<app>/components/`, beside the components' own; not a component's. */
export const BASE_STYLESHEET = "_base.css";

/** The stylesheets in `<app>/components/`, `<name>.css`, sorted by component; none when the app has none. */
async function readStyles(dir: string, rel: string): Promise<ComponentStyle[]> {
	const componentsDir = join(dir, "components");
	if (!existsSync(componentsDir)) return [];
	const files = (await readdir(componentsDir))
		.filter((f) => f.endsWith(".css") && f !== BASE_STYLESHEET)
		.sort();
	const styles: ComponentStyle[] = [];
	for (const fileName of files) {
		const component = fileName.slice(0, -".css".length);
		const bytes = await readFile(join(componentsDir, fileName));
		styles.push({
			component,
			file: join(rel, "components", fileName),
			css: bytes.toString("utf-8"),
			hash: stylesheetHash(bytes),
			key: fileName,
		});
	}
	return styles;
}

async function filesUnder(dir: string): Promise<string[]> {
	const out: string[] = [];
	let entries: Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await filesUnder(path)));
		else out.push(path);
	}
	return out;
}

/**
 * Every file under the app's declared source directories (`screens.json`
 * `sources`), absolute and sorted, skipping `node_modules` and dot-folders —
 * the one walk the lint and the coverage both read.
 */
export async function appSourceFiles(root: string, sources: string[]): Promise<string[]> {
	return (await Promise.all(sources.map((s) => filesUnder(join(root, s))))).flat().sort();
}

/**
 * sha256 over each file's path (relative to `root`) and the hash of its
 * bytes, one line per file in path order: what a change to any of them, or a
 * file added, removed or renamed, changes.
 */
async function filesHashOf(root: string, files: readonly string[]): Promise<string> {
	const lines: string[] = [];
	for (const file of [...files].sort()) {
		lines.push(`${relative(root, file)}\0${sha256(await readFile(file))}`);
	}
	return sha256(lines.join("\n"));
}

/**
 * The hash of every file under the app's declared `sources`: what the render
 * step records as `renderedFrom`, and what the check compares it with, so a
 * look is reused only while its stories were rendered from the sources as
 * they are (looks-check-speed ADR decision 2).
 */
export async function sourcesHashOf(root: string, app: Pick<LooksApp, "sources">): Promise<string> {
	return filesHashOf(root, await appSourceFiles(root, app.sources));
}

/**
 * The hash of the app's page code: every file under `sources` that
 * `isPageSource` keeps, given its path relative to `root` — the files that
 * draw a screen and no story covers. In a screen's reuse key and not a
 * story's, so an edit to it reopens every screen and no story.
 */
export async function pageSourcesHashOf(
	root: string,
	app: Pick<LooksApp, "sources">,
	isPageSource: (file: string) => boolean,
): Promise<string> {
	const files = await appSourceFiles(root, app.sources);
	return filesHashOf(
		root,
		files.filter((f) => isPageSource(relative(root, f))),
	);
}

/**
 * The identity of the build a page is served from, read from its HTML: the
 * scripts and stylesheets it loads (a production build names each by the hash
 * of its content) and its inline styles, hashed. Null when the page loads
 * nothing and styles nothing inline, so there is nothing to tell one build
 * from another — the caller then reuses no look. Page text is left out: a
 * screen's data changes between runs and is no part of the build.
 */
export function servedBuildOf(html: string): string | null {
	const assets = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map(
		(m) => m[1] as string,
	);
	const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(
		(m) => m[1] as string,
	);
	if (assets.length === 0 && styles.length === 0) return null;
	return sha256(JSON.stringify([[...new Set(assets)].sort(), styles]));
}

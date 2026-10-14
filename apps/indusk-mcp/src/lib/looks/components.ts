import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import type { ContentMap } from "./compose.js";
import { appSourceFiles, type LooksApp, LooksAppError, readJsonSync } from "./mockups.js";

/**
 * Components as the app's source and its catalog hold them (storybook-
 * components ADR decisions 2 and 7). A component is one file whose root element
 * carries `data-component="<name>"`; the render step (`looks/stories`) writes
 * `components.json` beside the mockups, listing each component with its
 * properties and the states that have a story. This module reads both and
 * names what is wrong between them — the scan the lint, the coverage and
 * `component-reuse-audit` share.
 *
 * promise: a-component-has-one-implementation
 * promise: an-agent-can-find-every-component
 */

export { type ComponentReference, componentReferences } from "./compose.js";

/** The file the render step writes beside an app's mockups. */
export const CATALOG_FILE = "components.json";

/**
 * A literal `data-component` attribute in markup: `data-component="badge"`,
 * `'badge'` or `{"badge"}`. Group 1 is the name. One pattern, read by the scan
 * here and by the coverage's `componentsIn`.
 */
export const MARKER_PATTERN = /\bdata-component\s*=\s*\{?\s*["'`]([^"'`\s]+)["'`]/g;

/** Source extensions that can carry markup. */
export const MARKUP_EXTENSIONS = new Set([
	".jsx",
	".tsx",
	".js",
	".ts",
	".html",
	".vue",
	".svelte",
	".astro",
	".mdx",
]);

const NOT_AN_IMPLEMENTATION = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$|(?:^|\/)__tests__\//;

/** Whether a source file may implement a component: neither a test nor a story. */
export const isImplementationFile = (file: string): boolean =>
	MARKUP_EXTENSIONS.has(extname(file)) && !NOT_AN_IMPLEMENTATION.test(file.replaceAll("\\", "/"));

/** A line a comment owns outright, whose `data-component` is prose and not markup. */
const isCommentLine = (line: string): boolean => /^\s*(?:\/\/|\/\*|\*|\{\/\*)/.test(line);

export interface Marker {
	name: string;
	/** 1-based. */
	line: number;
}

/** The markers in a source's code, with their lines; a comment line names nothing. */
export function markersIn(text: string): Marker[] {
	const found: Marker[] = [];
	text.split("\n").forEach((text, i) => {
		if (isCommentLine(text)) return;
		for (const m of text.matchAll(MARKER_PATTERN))
			found.push({ name: m[1] as string, line: i + 1 });
	});
	return found;
}

export interface ComponentFile {
	/** Relative to the project root. */
	file: string;
	/** The first marker's line in that file. */
	line: number;
}

export interface ComponentFinding {
	rule: "duplicate-component" | "component-outside-file";
	name: string;
	file: string;
	line: number;
	/** The text the command prints after the rule. */
	message: string;
}

export interface ComponentScan {
	/** Each marked name with every non-test, non-story file that carries it, sorted. */
	components: Map<string, ComponentFile[]>;
	findings: ComponentFinding[];
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Whether `file` is where a component of this name lives by name:
 * `DecisionCard.tsx` and `decision-card/index.tsx` are `decision-card`'s.
 */
function isNamedFor(file: string, name: string): boolean {
	const stem = basename(file, extname(file));
	const owner = stem === "index" ? basename(join(file, "..")) : stem;
	return squash(owner) === squash(name);
}

/**
 * Every marker in the app's declared sources, and the two ways a marked name
 * can be wrong. A name in more than one file is `duplicate component <name>:
 * <file>, <file>` — two implementations of one component. When one of those
 * files is the component's own by name, every other file's marker is also
 * `component markup outside its file: <file>:<line> <name>`, located so it can
 * be fixed: a screen that writes out the component's element instead of
 * rendering the component. A name in one file is never a finding here — a
 * component not yet extracted from its screen is the catalog's gap, not the
 * scan's.
 */
export async function scanComponents(root: string, app: LooksApp): Promise<ComponentScan> {
	const components = new Map<string, ComponentFile[]>();
	const lines = new Map<string, Map<string, number[]>>();
	for (const path of await appSourceFiles(root, app.sources)) {
		const file = relative(root, path);
		if (!isImplementationFile(file)) continue;
		for (const { name, line } of markersIn(await readFile(path, "utf-8"))) {
			const perFile = lines.get(name) ?? new Map<string, number[]>();
			perFile.set(file, [...(perFile.get(file) ?? []), line]);
			lines.set(name, perFile);
		}
	}
	const findings: ComponentFinding[] = [];
	for (const [name, perFile] of [...lines].sort(([a], [b]) => a.localeCompare(b))) {
		const files = [...perFile.keys()].sort();
		components.set(
			name,
			files.map((file) => ({ file, line: perFile.get(file)?.[0] ?? 1 })),
		);
		if (files.length < 2) continue;
		findings.push({
			rule: "duplicate-component",
			name,
			file: files[0] as string,
			line: perFile.get(files[0] as string)?.[0] ?? 1,
			message: `duplicate component ${name}: ${files.join(", ")}`,
		});
		const own = files.find((f) => isNamedFor(f, name));
		if (own === undefined) continue;
		for (const file of files.filter((f) => f !== own)) {
			for (const line of perFile.get(file) ?? []) {
				findings.push({
					rule: "component-outside-file",
					name,
					file,
					line,
					message: `component markup outside its file: ${file}:${line} ${name}`,
				});
			}
		}
	}
	return { components, findings };
}

export interface CatalogProperty {
	name: string;
	type: string;
	required?: boolean;
	defaultValue?: string;
	description?: string;
}

export interface CatalogState {
	name: string;
	/** The story's Storybook id (`components-ui-badge--passing`): what the cockpit frames from `/storybook/iframe.html`. */
	id?: string;
	/** sha256 of the state's snapshot file, `components/<name>.<state>.html`. */
	snapshotHash: string;
	/**
	 * Per property a mockup may fill, where that property's words or components
	 * land in the snapshot: each place is a child-index path from its root, or
	 * an object adding how many nodes the story's words are and the static
	 * words around them (`looks/compose`'s `ContentPlace`). Absent in a catalog
	 * written before component content: nothing can be placed in it.
	 */
	content?: ContentMap;
}

export interface CatalogComponent {
	name: string;
	/** Relative to the project root. */
	file: string;
	properties: CatalogProperty[];
	states: CatalogState[];
	/**
	 * The component's stylesheet, `components/<name>.css`, relative to the
	 * app's mockups folder: the compiled rules of the classes its snapshots use,
	 * resolved to the foundation's tokens (ADR decision 10). Absent in a catalog
	 * written before stylesheets, and on a component with no rendered class.
	 */
	stylesheet?: string;
	/** sha256 of that file's bytes. */
	stylesheetHash?: string;
}

export interface Catalog {
	components: CatalogComponent[];
}

/** Each story's Storybook id (`<component>.<state>` -> id) from the catalog; empty when the app has none or a state has no id. */
export function storybookIds(app: LooksApp): Map<string, string> {
	const ids = new Map<string, string>();
	for (const c of readCatalog(app)?.components ?? []) {
		for (const s of c.states) if (s.id) ids.set(`${c.name}.${s.name}`, s.id);
	}
	return ids;
}

/** The catalog an app's render step wrote; null when it has none. A catalog that is not one is refused. */
export function readCatalog(app: LooksApp): Catalog | null {
	const file = join(app.dir, CATALOG_FILE);
	if (!existsSync(file)) return null;
	const parsed = readJsonSync<unknown>(file, null);
	const list = (parsed as { components?: unknown } | null)?.components;
	const valid =
		Array.isArray(list) &&
		list.every((c) => {
			const o = c as Record<string, unknown> | null;
			return (
				typeof o?.name === "string" &&
				typeof o.file === "string" &&
				Array.isArray(o.properties) &&
				Array.isArray(o.states) &&
				o.states.every((s) => typeof (s as { name?: unknown })?.name === "string")
			);
		});
	if (!valid) {
		throw new LooksAppError(
			`${file} is not a catalog: expected { components: [{ name, file, properties[], states[] }] } — run \`indusk looks stories ${app.app}\``,
		);
	}
	return parsed as Catalog;
}

export interface CatalogGaps {
	scan: ComponentScan;
	/** Implemented and marked in the app, with no entry in the catalog. */
	notInCatalog: Array<{ name: string; file: string; line: number }>;
	/** A state a mockup places by name that the catalog lists no story for. */
	noStory: Array<{ name: string; state: string; file: string; line: number }>;
}

/**
 * What the catalog lacks. An app with no catalog has not adopted stories yet
 * and has no gaps to name; one with a catalog names every implemented
 * component it omits (less the names `screens.json` lists as `uncatalogued`,
 * which only shrinks) and every state a mockup places that no story covers.
 */
export async function catalogGaps(root: string, app: LooksApp): Promise<CatalogGaps> {
	const scan = await scanComponents(root, app);
	const catalog = readCatalog(app);
	if (catalog === null) return { scan, notInCatalog: [], noStory: [] };

	const listed = new Set(catalog.components.map((c) => c.name));
	const pending = new Set(app.uncatalogued);
	const notInCatalog = [...scan.components]
		.filter(([name]) => !listed.has(name) && !pending.has(name))
		.map(([name, files]) => ({ name, file: files[0]?.file as string, line: files[0]?.line ?? 1 }));

	const states = new Set(
		catalog.components.flatMap((c) => c.states.map((s) => `${c.name}.${s.name}`)),
	);
	const noStory = app.mockups.flatMap((m) =>
		m.uses
			.filter((r) => !states.has(r.story))
			.map((r) => ({ name: r.name, state: r.state, file: m.file, line: r.line })),
	);
	return { scan, notInCatalog, noStory };
}

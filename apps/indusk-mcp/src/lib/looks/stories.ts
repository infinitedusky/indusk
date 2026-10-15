import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { baseStylesheet, classesOf, componentStylesheet } from "./component-styles.js";
import {
	CATALOG_FILE,
	type Catalog,
	type CatalogComponent,
	isImplementationFile,
	scanComponents,
} from "./components.js";
import type { ContentMap } from "./compose.js";
import { markedComponentsOf } from "./markup.js";
import {
	appSourceFiles,
	BASE_STYLESHEET,
	type LooksApp,
	LooksAppError,
	readApp,
	stylesheetHash,
} from "./mockups.js";
import { buildCatalog, manifestIndex, snapshotBytes } from "./stories-catalog.js";

/**
 * The render step (storybook-components ADR decision 3): every story of an
 * app, rendered once by Storybook's own runner in Chromium, written as a
 * snapshot — `.indusk/mockups/<app>/components/<name>.<state>.html`, the
 * component's markup as the browser drew it — and listed, with the component's
 * file, properties and each state's snapshot hash, in `components.json`.
 *
 * Storybook is the app's, never this package's: the app's Vitest runs its
 * stories through the addon-vitest plugin (the runner the app's `storybook`
 * project already uses) over a generated config directory that adds one
 * `afterEach` — write what the story rendered. The component's properties are
 * Storybook's components manifest, which the app's `build:storybook` writes;
 * a manifest older than a story or a component is rebuilt first.
 *
 * Each story renders a second time with its words replaced by markers
 * (`contentPaths` in the generated preview), and the child-index paths of the
 * text nodes that carry them are written per state as `content` — where a
 * mockup's words for each property land (`looks/compose` fills them).
 *
 * promise: every-component-state-has-a-story
 * promise: an-agent-can-find-every-component
 * promise: a-placed-component-shows-its-content
 */

const run = promisify(execFile);

export const SNAPSHOTS_DIR = "components";
/** The app's compiled CSS, written beside the stories' markup while they render. */
const APP_CSS = "_app.css";
/** What the second, marker render writes beside a story's markup: where each fillable property lands. */
const CONTENT_SUFFIX = ".content.json";
const CACHE = join("node_modules", ".cache", "indusk-looks");
const SB_MANIFEST = join("manifests", "components.json");
const MAIN_FILES = ["main.ts", "main.mts", "main.js", "main.mjs"];
const PREVIEW_FILES = ["preview.ts", "preview.tsx", "preview.mts", "preview.js", "preview.jsx"];

export interface StoriesResult {
	components: CatalogComponent[];
	/** Snapshot files written, relative to the project root. */
	snapshots: string[];
	/** Snapshot files that no story renders any more, removed. */
	removed: string[];
}

/** The environment of a child that must not believe it is inside the test run that started it. */
function childEnv(): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...process.env };
	for (const key of Object.keys(env)) if (key.startsWith("VITEST")) delete env[key];
	return env;
}

/** The package that holds the app's Storybook: the nearest ancestor of a declared source with a `.storybook`. */
function storybookDir(root: string, app: LooksApp): string {
	for (const source of app.sources) {
		let dir = resolve(root, source);
		while (dir.startsWith(resolve(root)) && dir !== dirname(dir)) {
			if (existsSync(join(dir, ".storybook"))) return dir;
			dir = dirname(dir);
		}
	}
	throw new LooksAppError(
		`${app.app} has no Storybook: none of its sources (${app.sources.join(", ") || "none declared"}) sits in a package with a .storybook directory`,
	);
}

const firstExisting = (dir: string, names: string[]): string | undefined =>
	names.map((n) => join(dir, n)).find((f) => existsSync(f));

/** `{ "@": "<appDir>/src" }` from the app's tsconfig `paths`, so a story's `@/` imports resolve. */
function pathAliases(appDir: string): Record<string, string> {
	try {
		const tsconfig = JSON.parse(readFileSync(join(appDir, "tsconfig.json"), "utf-8")) as {
			compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
		};
		const base = resolve(appDir, tsconfig.compilerOptions?.baseUrl ?? ".");
		const aliases: Record<string, string> = {};
		for (const [key, [target]] of Object.entries(tsconfig.compilerOptions?.paths ?? {})) {
			if (!key.endsWith("/*") || !target?.endsWith("/*")) continue;
			aliases[key.slice(0, -2)] = resolve(base, target.slice(0, -2));
		}
		return aliases;
	} catch {
		// No readable tsconfig: the plugin's own resolution is all there is.
		return {};
	}
}

/** Where `storybook build` wrote its output, read from the app's `build:storybook` script. */
function buildOutput(appDir: string): string {
	const scripts =
		(
			JSON.parse(readFileSync(join(appDir, "package.json"), "utf-8")) as {
				scripts?: Record<string, string>;
			}
		).scripts ?? {};
	const script = scripts["build:storybook"];
	if (script === undefined) {
		throw new LooksAppError(
			`${appDir}/package.json has no "build:storybook" script — the render step reads each component's properties from the Storybook build`,
		);
	}
	return join(appDir, script.match(/--output-dir[= ](\S+)/)?.[1] ?? "storybook-static");
}

/** The newest modification time among files, or 0. */
const newest = (files: string[]): number =>
	files.reduce((t, f) => Math.max(t, statSync(f).mtimeMs), 0);

/** A source file the Storybook build reads: a story, a component's implementation, or a stylesheet. */
const isBuildInput = (root: string, file: string): boolean =>
	/\.stories\.[cm]?[jt]sx?$/.test(file) ||
	/\.css$/.test(file) ||
	isImplementationFile(relative(root, file));

/**
 * Whether the app's Storybook build at `manifest` is older than what it is
 * built from: missing, or older than any story, component or stylesheet under
 * the app's sources, or any file in its `.storybook/`. A stylesheet counts as
 * surely as a component: `/storybook` and `indusk looks check` draw from the
 * build, and a rule changed in `globals.css` changes how every story draws
 * (Build Phase 9, A36).
 */
export async function storybookBuildIsStale(
	root: string,
	app: Pick<LooksApp, "sources">,
	appDir: string,
	manifest: string,
): Promise<boolean> {
	if (!existsSync(manifest)) return true;
	const sources = (await appSourceFiles(root, app.sources)).filter((f) => isBuildInput(root, f));
	const config = await appSourceFiles(appDir, [".storybook"]);
	return statSync(manifest).mtimeMs < newest([...sources, ...config]);
}

/** The components manifest, built first when the build is older than what it is built from (`storybookBuildIsStale`). */
async function manifestOf(root: string, app: LooksApp, appDir: string): Promise<unknown> {
	const manifest = join(buildOutput(appDir), SB_MANIFEST);
	if (await storybookBuildIsStale(root, app, appDir, manifest)) {
		try {
			await run("pnpm", ["run", "build:storybook"], {
				cwd: appDir,
				env: childEnv(),
				maxBuffer: 64 * 1024 * 1024,
				timeout: 280_000,
			});
		} catch (err) {
			const e = err as { stdout?: string; stderr?: string; message: string };
			throw new LooksAppError(
				`storybook build failed in ${appDir}:\n${`${e.stdout ?? ""}${e.stderr ?? ""}`.slice(-1500) || e.message}`,
			);
		}
	}
	if (!existsSync(manifest)) {
		throw new LooksAppError(
			`${manifest} was not written — turn on \`features.componentsManifest\` in ${appDir}/.storybook/main`,
		);
	}
	return JSON.parse(readFileSync(manifest, "utf-8"));
}

/** The generated Vitest config: the app's stories through the addon-vitest plugin, in Chromium. */
function vitestConfig(appDir: string, cacheDir: string, mainFile: string): string {
	return `import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import main from ${JSON.stringify(mainFile)};

const addons = ((main as { addons?: unknown[] }).addons ?? []).filter(
	(a): a is string => typeof a === "string",
);

export default defineConfig({
	root: ${JSON.stringify(appDir)},
	resolve: { alias: ${JSON.stringify(pathAliases(appDir))} },
	optimizeDeps: { include: addons },
	plugins: [storybookTest({ configDir: ${JSON.stringify(join(cacheDir, ".storybook"))} })],
	test: {
		name: "indusk-stories",
		browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }] },
	},
});
`;
}

/** The generated Storybook `main`: the app's own, its story globs made relative to this directory. */
function storybookMain(appDir: string, cacheDir: string, mainFile: string): string {
	return `import path from "node:path";
import base from ${JSON.stringify(mainFile)};

const config = base as { stories: string[] };
const here = ${JSON.stringify(join(cacheDir, ".storybook"))};
export default {
	...config,
	stories: config.stories.map((s) => path.relative(here, path.resolve(${JSON.stringify(join(appDir, ".storybook"))}, s))),
};
`;
}

/** The generated `preview`: the app's own, plus one `afterEach` that writes what the story rendered. */
function storybookPreview(outDir: string, previewFile: string | undefined): string {
	return `import { server } from "vitest/browser";
${previewFile ? `import app from ${JSON.stringify(previewFile)};` : "const app = {};"}

const own = app as { afterEach?: unknown };

const MARK = "\\u2063";
const WORDS = new RegExp(MARK + "slot:([^" + MARK + "]+)" + MARK, "g");

/**
 * Where each marker sits: its name to its places. Each text node carrying a
 * marker is aligned with the first render's node (\`canvas\`, normalized as the
 * snapshot's serialization merges adjacent text), parent by parent. Where the
 * two parents differ in child count the marker stood for several nodes: the
 * place spans the difference, and later siblings shift by it. Two markers in
 * one parent whose counts differ cannot be told apart, and record neither.
 * A text node that carries other words records them as \`before\` / \`after\`.
 */
function markerPlaces(root: Node, canvas: Node): Record<string, unknown[]> {
	const found: Record<string, unknown[]> = {};
	const first = canvas.cloneNode(true);
	first.normalize();
	const walk = (marked: Node, shown: Node, path: number[]) => {
		const mine = Array.from(marked.childNodes);
		const theirs = Array.from(shown.childNodes);
		const carriers: number[] = [];
		mine.forEach((n, i) => {
			if (n.nodeType === 3 && (n as Text).data.includes(MARK)) carriers.push(i);
		});
		const grown = theirs.length - mine.length;
		if (grown !== 0 && (carriers.length !== 1 || grown < 0)) return;
		const at = (i: number) => (grown !== 0 && i > (carriers[0] as number) ? i + grown : i);
		mine.forEach((n, i) => {
			if (carriers.includes(i)) {
				const data = (n as Text).data;
				const all = data.match(WORDS) ?? [];
				for (const m of all) {
					const name = new RegExp(WORDS.source).exec(m)?.[1] as string;
					const place: { at: number[]; nodes?: number; before?: string; after?: string } = {
						at: [...path, at(i)],
					};
					if (grown !== 0) place.nodes = grown + 1;
					if (all.length === 1) {
						const from = data.indexOf(m);
						if (from > 0) place.before = data.slice(0, from);
						if (from + m.length < data.length) place.after = data.slice(from + m.length);
					}
					const list = (found[name] ??= []);
					const plain = place.nodes === undefined && place.before === undefined && place.after === undefined;
					const entry = plain ? place.at : place;
					if (!list.some((p) => JSON.stringify(p) === JSON.stringify(entry))) list.push(entry);
				}
			} else if (n.nodeType === 1 && theirs[at(i)]?.nodeType === 1) {
				walk(n, theirs[at(i)] as Node, [...path, at(i)]);
			}
		});
	};
	walk(root, first, []);
	return found;
}

/** The text a canvas shows, by text node, once adjacent nodes are merged as the serialized markup is read. */
function texts(root: Node): string[] {
	const out: string[] = [];
	const walk = (node: Node) =>
		node.childNodes.forEach((child) => {
			if (child.nodeType === 3) out.push((child as Text).data.trim());
			else walk(child);
		});
	walk(root);
	return out;
}

/**
 * Where a mockup's words land in this story. The story is rendered a second
 * time with each argument that is words (a string the first render shows as a
 * text node, and \`children\`) replaced by a marker no story's own words can
 * equal; the child-index paths of the text nodes carrying a marker are the
 * property's places. A story that cannot render again by itself records none:
 * a component that takes no content is a fact, not a failure.
 */
async function contentPaths(context: {
	args: Record<string, unknown>;
	canvasElement: HTMLElement;
	originalStoryFn: (args: unknown, context: unknown) => unknown;
}): Promise<Record<string, unknown[]>> {
	const shown = new Set(texts(context.canvasElement));
	const marked: Record<string, unknown> = { ...context.args };
	const names: string[] = [];
	for (const [name, value] of Object.entries(context.args)) {
		const words = typeof value === "string" && value.trim() !== "" && shown.has(value.trim());
		if (words || (name === "children" && value !== undefined && value !== null)) {
			marked[name] = MARK + "slot:" + name + MARK;
			names.push(name);
		}
	}
	if (names.length === 0) return {};
	const [{ createRoot }, { flushSync }] = await Promise.all([
		import("react-dom/client"),
		import("react-dom"),
	]);
	const host = document.createElement("div");
	document.body.appendChild(host);
	const root = createRoot(host);
	try {
		flushSync(() => root.render(context.originalStoryFn(marked, context) as never));
		host.normalize();
		return markerPlaces(host, context.canvasElement);
	} finally {
		root.unmount();
		host.remove();
	}
}

export default {
	...app,
	afterEach: [
		...(own.afterEach ? ([] as unknown[]).concat(own.afterEach) : []),
		async (context: { id: string; canvasElement: HTMLElement }) => {
			await server.commands.writeFile(
				${JSON.stringify(`${outDir}/`)} + context.id + ".html",
				context.canvasElement.innerHTML,
			);
			let content: Record<string, unknown> = {};
			try {
				content = await contentPaths(context as never);
			} catch {
				// A story that will not render by itself takes no content.
			}
			await server.commands.writeFile(
				${JSON.stringify(`${outDir}/`)} + context.id + "${CONTENT_SUFFIX}",
				JSON.stringify(content),
			);
			// The app's compiled CSS as the build wrote it: a <style> element's own text
			// when it has one (the dev server's), else the rules the browser parsed.
			const css = [...document.styleSheets]
				.flatMap((sheet) => {
					const owner = sheet.ownerNode as HTMLElement | null;
					if (owner instanceof HTMLStyleElement && owner.textContent) return [owner.textContent];
					try {
						return [[...sheet.cssRules].map((rule) => rule.cssText).join("\\n")];
					} catch {
						return [];
					}
				})
				.join("\\n");
			await server.commands.writeFile(${JSON.stringify(`${outDir}/`)} + "${APP_CSS}", css);
		},
	],
};
`;
}

/**
 * Write the generated runner into the app's cache directory — a Vitest config,
 * and a Storybook `main` and `preview` that wrap the app's own — and return
 * the directory the stories' markup lands in.
 */
function writeRunConfig(appDir: string): { cacheDir: string; outDir: string } {
	const cacheDir = join(appDir, CACHE);
	const outDir = join(cacheDir, "out");
	const mainFile = firstExisting(join(appDir, ".storybook"), MAIN_FILES);
	if (mainFile === undefined) {
		throw new LooksAppError(`${appDir}/.storybook has no main file (${MAIN_FILES.join(", ")})`);
	}
	rmSync(outDir, { recursive: true, force: true });
	mkdirSync(join(cacheDir, ".storybook"), { recursive: true });
	writeFileSync(join(cacheDir, "vitest.config.mts"), vitestConfig(appDir, cacheDir, mainFile));
	writeFileSync(join(cacheDir, ".storybook", "main.ts"), storybookMain(appDir, cacheDir, mainFile));
	writeFileSync(
		join(cacheDir, ".storybook", "preview.ts"),
		storybookPreview(outDir, firstExisting(join(appDir, ".storybook"), PREVIEW_FILES)),
	);
	return { cacheDir, outDir };
}

/** Run every story through the app's Vitest; the markup each rendered, by story id, and the app's compiled CSS. */
async function renderAll(appDir: string): Promise<{
	rendered: Map<string, string>;
	content: Map<string, ContentMap>;
	css: string;
}> {
	const { cacheDir, outDir } = writeRunConfig(appDir);

	const vitest = join(
		dirname(createRequire(join(appDir, "package.json")).resolve("vitest/package.json")),
		"vitest.mjs",
	);
	let failure = "";
	// Vite re-optimises a dependency the first time it meets it and a run that
	// began before that is told it was reloaded; the second run starts warm.
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			await run(
				process.execPath,
				[vitest, "run", "--config", join(cacheDir, "vitest.config.mts")],
				{ cwd: appDir, env: childEnv(), maxBuffer: 64 * 1024 * 1024, timeout: 280_000 },
			);
			failure = "";
			break;
		} catch (err) {
			const e = err as { stdout?: string; stderr?: string; message: string };
			failure = `${e.stdout ?? ""}${e.stderr ?? ""}`.slice(-2000) || e.message;
			if (!/unexpectedly reloaded/.test(failure)) break;
		}
	}
	if (failure) throw new LooksAppError(`a story did not render in ${appDir}:\n${failure}`);

	const rendered = new Map<string, string>();
	const content = new Map<string, ContentMap>();
	let css = "";
	if (existsSync(outDir)) {
		for (const file of await readdir(outDir)) {
			if (file === APP_CSS) css = readFileSync(join(outDir, file), "utf-8");
			else if (file.endsWith(CONTENT_SUFFIX)) {
				content.set(
					file.slice(0, -CONTENT_SUFFIX.length),
					JSON.parse(readFileSync(join(outDir, file), "utf-8")),
				);
			} else if (file.endsWith(".html")) {
				rendered.set(
					file.slice(0, -".html".length),
					readFileSync(join(outDir, file), "utf-8").trim(),
				);
			}
		}
	}
	return { rendered, content, css };
}

/**
 * Each component's stylesheet, `components/<name>.css`: the app's compiled
 * rules for the classes its snapshots use and for its own markers, resolved to
 * the foundation's tokens (ADR decision 10); and the app's base, `_base.css`,
 * its `body` rules, which every story's frame draws under. Names each file on its component
 * in the catalog (`stylesheet`, `stylesheetHash`) and returns the paths written,
 * relative to `root`.
 */
function writeStylesheets(args: {
	root: string;
	app: LooksApp;
	css: string;
	components: CatalogComponent[];
	writes: ReadonlyMap<string, string>;
	snapshotsDir: string;
}): string[] {
	const { root, app, css, components, writes, snapshotsDir } = args;
	const classesByComponent = new Map<string, Set<string>>();
	const marksByComponent = new Map<string, Set<string>>();
	for (const [key, html] of writes) {
		const name = key.slice(0, key.indexOf("."));
		const classes = classesByComponent.get(name) ?? new Set<string>();
		for (const c of classesOf(html)) classes.add(c);
		classesByComponent.set(name, classes);
		const marks = marksByComponent.get(name) ?? new Set<string>();
		for (const m of markedComponentsOf(html)) marks.add(m);
		marksByComponent.set(name, marks);
	}
	const written: string[] = [];
	for (const c of components) {
		const sheet = componentStylesheet(
			css,
			classesByComponent.get(c.name) ?? new Set(),
			app.foundation,
			marksByComponent.get(c.name) ?? new Set(),
		);
		const file = join(snapshotsDir, `${c.name}.css`);
		writeFileSync(file, sheet);
		written.push(relative(root, file));
		c.stylesheet = `${SNAPSHOTS_DIR}/${c.name}.css`;
		c.stylesheetHash = stylesheetHash(sheet);
	}
	const base = join(snapshotsDir, BASE_STYLESHEET);
	writeFileSync(base, baseStylesheet(css, app.foundation));
	written.push(relative(root, base));
	return written;
}

/**
 * Render every story of `appName`, write each state's snapshot under
 * `.indusk/mockups/<app>/components/` and the catalog beside the mockups.
 * Refuses by name: a marked name in two files (the scan's finding), a story
 * that rendered nothing, one whose markup carries no `data-component`, one
 * of a component no source marks, and two stories of one component state.
 */
export async function renderStories(root: string, appName: string): Promise<StoriesResult> {
	const app = await readApp(root, appName);
	const appDir = storybookDir(root, app);

	const scan = await scanComponents(root, app);
	if (scan.findings.length > 0) {
		throw new LooksAppError(
			`${appName}'s components are not one file each — fix before rendering:\n${scan.findings.map((f) => `  ${f.message}`).join("\n")}`,
		);
	}

	const { properties, order } = manifestIndex(await manifestOf(root, app, appDir));
	const { rendered, content, css } = await renderAll(appDir);
	const missing = [...order.keys()].filter((id) => !rendered.has(id));
	if (missing.length > 0) {
		throw new LooksAppError(`story did not render to a snapshot: ${missing.join(", ")}`);
	}
	if (rendered.size === 0) throw new LooksAppError(`${appName} has no stories to render`);

	const snapshotsDir = join(app.dir, SNAPSHOTS_DIR);
	const { components, writes } = buildCatalog({
		rendered,
		files: new Map([...scan.components].map(([name, files]) => [name, files[0]?.file ?? ""])),
		sources: app.sources,
		properties,
		order,
		content,
	});

	mkdirSync(snapshotsDir, { recursive: true });
	const keep = new Set<string>();
	const snapshots: string[] = [];
	for (const [key, html] of writes) {
		const file = join(snapshotsDir, `${key}.html`);
		writeFileSync(file, snapshotBytes(html));
		keep.add(`${key}.html`);
		snapshots.push(relative(root, file));
	}
	for (const file of writeStylesheets({ root, app, css, components, writes, snapshotsDir })) {
		keep.add(basename(file));
		snapshots.push(file);
	}
	const removed: string[] = [];
	for (const file of await readdir(snapshotsDir)) {
		if (/\.(html|css)$/.test(file) && !keep.has(file)) {
			rmSync(join(snapshotsDir, file));
			removed.push(relative(root, join(snapshotsDir, file)));
		}
	}

	const catalog: Catalog = { components };
	writeFileSync(join(app.dir, CATALOG_FILE), `${JSON.stringify(catalog, null, "\t")}\n`);
	return { components, snapshots, removed };
}

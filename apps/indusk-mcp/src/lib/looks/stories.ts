import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import {
	CATALOG_FILE,
	type Catalog,
	type CatalogComponent,
	type CatalogProperty,
	isImplementationFile,
	scanComponents,
} from "./components.js";
import { elementsOf } from "./markup.js";
import { appSourceFiles, type LooksApp, LooksAppError, readApp } from "./mockups.js";

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
 * promise: every-component-state-has-a-story
 * promise: an-agent-can-find-every-component
 */

const run = promisify(execFile);

export const SNAPSHOTS_DIR = "components";
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

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

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

/** The components manifest, built first when it is missing or older than a story or a component. */
async function manifestOf(root: string, app: LooksApp, appDir: string): Promise<unknown> {
	const manifest = join(buildOutput(appDir), SB_MANIFEST);
	const sources = (await appSourceFiles(root, app.sources)).filter(
		(f) => /\.stories\.[cm]?[jt]sx?$/.test(f) || isImplementationFile(relative(root, f)),
	);
	const config = [...MAIN_FILES, ...PREVIEW_FILES]
		.map((n) => join(appDir, ".storybook", n))
		.filter((f) => existsSync(f));
	if (!existsSync(manifest) || statSync(manifest).mtimeMs < newest([...sources, ...config])) {
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

interface ManifestComponent {
	reactDocgen?: {
		props?: Record<
			string,
			{
				required?: boolean;
				tsType?: { name?: string; raw?: string };
				description?: string;
				defaultValue?: { value?: string };
			}
		>;
	};
	stories?: Array<{ id: string }>;
}

/** Each story id's component properties and its place among the component's stories. */
function manifestIndex(manifest: unknown): {
	properties: Map<string, CatalogProperty[]>;
	order: Map<string, number>;
} {
	const properties = new Map<string, CatalogProperty[]>();
	const order = new Map<string, number>();
	const components = (manifest as { components?: Record<string, ManifestComponent> }).components;
	for (const component of Object.values(components ?? {})) {
		const props: CatalogProperty[] = Object.entries(component.reactDocgen?.props ?? {}).map(
			([name, p]) => ({
				name,
				type: p.tsType?.raw ?? p.tsType?.name ?? "unknown",
				...(p.required === undefined ? {} : { required: p.required }),
				...(p.defaultValue?.value === undefined ? {} : { defaultValue: p.defaultValue.value }),
				...(p.description ? { description: p.description } : {}),
			}),
		);
		(component.stories ?? []).forEach((story, i) => {
			properties.set(story.id, props);
			order.set(story.id, i);
		});
	}
	return { properties, order };
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
export default {
	...app,
	afterEach: [
		...(own.afterEach ? ([] as unknown[]).concat(own.afterEach) : []),
		async (context: { id: string; canvasElement: HTMLElement }) => {
			await server.commands.writeFile(
				${JSON.stringify(`${outDir}/`)} + context.id + ".html",
				context.canvasElement.innerHTML,
			);
		},
	],
};
`;
}

/** Run every story through the app's Vitest; the markup each rendered, by story id. */
async function renderAll(appDir: string): Promise<Map<string, string>> {
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
	if (existsSync(outDir)) {
		for (const file of await readdir(outDir)) {
			if (file.endsWith(".html")) {
				rendered.set(
					file.slice(0, -".html".length),
					readFileSync(join(outDir, file), "utf-8").trim(),
				);
			}
		}
	}
	return rendered;
}

/** The first `data-component` a rendered story's markup carries: the component it is a story of. */
const componentOf = (html: string): string | undefined =>
	elementsOf(html).find((el) => el.attrs["data-component"])?.attrs["data-component"];

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
	const rendered = await renderAll(appDir);
	const missing = [...order.keys()].filter((id) => !rendered.has(id));
	if (missing.length > 0) {
		throw new LooksAppError(`story did not render to a snapshot: ${missing.join(", ")}`);
	}
	if (rendered.size === 0) throw new LooksAppError(`${appName} has no stories to render`);

	const snapshotsDir = join(app.dir, SNAPSHOTS_DIR);
	const byComponent = new Map<string, CatalogComponent>();
	const writes = new Map<string, { story: string; html: string }>();
	for (const [id, html] of [...rendered].sort(([a], [b]) => a.localeCompare(b))) {
		const name = componentOf(html);
		if (name === undefined) {
			throw new LooksAppError(
				`story ${id} renders no data-component element — mark the component's root element, so its snapshot names it`,
			);
		}
		const file = scan.components.get(name)?.[0]?.file;
		if (file === undefined) {
			throw new LooksAppError(
				`story ${id} renders component "${name}", which no file under ${app.sources.join(", ")} marks`,
			);
		}
		const state = id.includes("--") ? id.slice(id.indexOf("--") + 2) : id;
		const key = `${name}.${state}`;
		const clash = writes.get(key);
		if (clash) {
			throw new LooksAppError(
				`stories ${clash.story} and ${id} both render ${key} — one story per state`,
			);
		}
		writes.set(key, { story: id, html });
		const component = byComponent.get(name) ?? {
			name,
			file,
			properties: properties.get(id) ?? [],
			states: [],
		};
		const snapshot = `${html}\n`;
		component.states.push({ name: state, snapshotHash: sha256(snapshot) });
		byComponent.set(name, component);
	}

	mkdirSync(snapshotsDir, { recursive: true });
	const keep = new Set<string>();
	const snapshots: string[] = [];
	for (const [key, { html }] of writes) {
		const file = join(snapshotsDir, `${key}.html`);
		writeFileSync(file, `${html}\n`);
		keep.add(`${key}.html`);
		snapshots.push(relative(root, file));
	}
	const removed: string[] = [];
	for (const file of await readdir(snapshotsDir)) {
		if (file.endsWith(".html") && !keep.has(file)) {
			rmSync(join(snapshotsDir, file));
			removed.push(relative(root, join(snapshotsDir, file)));
		}
	}

	const components = [...byComponent.values()].sort((a, b) => a.name.localeCompare(b.name));
	// A component's states in the order its stories are written.
	for (const c of components) {
		const place = (state: string) =>
			order.get(writes.get(`${c.name}.${state}`)?.story ?? "") ?? Number.MAX_SAFE_INTEGER;
		c.states.sort((a, b) => place(a.name) - place(b.name) || a.name.localeCompare(b.name));
	}
	const catalog: Catalog = { components };
	writeFileSync(join(app.dir, CATALOG_FILE), `${JSON.stringify(catalog, null, "\t")}\n`);
	return { components, snapshots, removed };
}

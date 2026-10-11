import { createHash } from "node:crypto";
import { type Dirent, existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Foundation, readFoundation } from "./foundation.js";

/**
 * An app's looks, read from `.indusk/mockups/<app>/`: its foundation, the
 * reference devices, the screens and states it declares, and one mockup per
 * `screens/<screen>.<state>.html`. Every other `looks/` module takes its
 * facts from `readApp`, so the content hash an approval binds to is computed
 * in one place.
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
}

export interface Mockup {
	/** `home.empty` — the file name without `.html`. */
	name: string;
	screen: string;
	/** The part after the screen; `full.next` for `home.full.next.html`, which no screen declares. */
	state: string;
	/** Relative to the project root. */
	file: string;
	html: string;
	/** sha256 of the file's bytes: an approval is bound to it. */
	hash: string;
	/** Tokens the mockup declares new with `<meta name="indusk-new-tokens">`. */
	declaresNew: string[];
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
	 * Element tag names the check does not measure: tooling the framework puts
	 * on the page in development (`nextjs-portal`), which the app does not draw.
	 */
	ignore: string[];
	mockups: Mockup[];
}

export class LooksAppError extends Error {}

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

async function readJson<T>(file: string, fallback: T): Promise<T> {
	if (!existsSync(file)) return fallback;
	try {
		return JSON.parse(await readFile(file, "utf-8")) as T;
	} catch (err) {
		throw new LooksAppError(`${file} is not valid JSON: ${(err as Error).message}`);
	}
}

/** The tokens named by the mockup's `<meta name="indusk-new-tokens" content="--a, --b">`. */
function declaredNew(html: string): string[] {
	const meta = html.match(/<meta\b[^>]*\bname=["']indusk-new-tokens["'][^>]*>/i)?.[0];
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
		ignore?: string[];
	}>(join(dir, "screens.json"), {});

	const screensDir = join(dir, "screens");
	const names = existsSync(screensDir)
		? (await readdir(screensDir)).filter((f) => f.endsWith(".html")).sort()
		: [];
	const mockups: Mockup[] = [];
	for (const fileName of names) {
		const name = fileName.slice(0, -".html".length);
		const [screen = name, ...rest] = name.split(".");
		const bytes = await readFile(join(screensDir, fileName));
		const html = bytes.toString("utf-8");
		mockups.push({
			name,
			screen,
			state: rest.join("."),
			file: join(MOCKUPS_DIR, app, "screens", fileName),
			html,
			hash: sha256(bytes),
			declaresNew: declaredNew(html),
		});
	}

	return {
		app,
		dir,
		foundation,
		devices: devices ?? [],
		screens: declared.screens ?? [],
		sources: declared.sources ?? [],
		ignore: declared.ignore ?? [],
		...(declared.url ? { url: declared.url } : {}),
		mockups,
	};
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

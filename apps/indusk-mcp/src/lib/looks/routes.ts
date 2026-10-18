import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The page and layout files a Next.js app-router URL is drawn from, found by
 * matching its segments against the `app/` folders (`indusk looks check
 * --changed`, tests-never-make-us-wait ADR decision 5): a folder named for the
 * segment first, then a `[param]` folder (which matches any one segment; a
 * `[...rest]` folder matches the remainder), with `(group)` folders passed
 * through without taking a segment. Reads folder names only.
 */

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

export interface Route {
	/** Absolute path of the `page` file. */
	page: string;
	/** Absolute paths of the `layout` files from the app root down to the page. */
	layouts: string[];
}

/** The URL's path segments: its query and fragment dropped, empty segments skipped. */
export function segmentsOf(path: string): string[] {
	const bare = path.split(/[?#]/)[0] ?? "";
	return bare.split("/").filter((s) => s !== "");
}

const fileIn = (dir: string, stem: string): string | undefined =>
	EXTENSIONS.map((ext) => join(dir, `${stem}${ext}`)).find((f) => existsSync(f));

const foldersIn = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && e.name !== "node_modules")
		.map((e) => e.name)
		.sort();

const isGroup = (name: string) => /^\(.+\)$/.test(name);
const isCatchAll = (name: string) => /^\[\[?\.\.\..+\]\]?$/.test(name);
const isDynamic = (name: string) => /^\[[^\]]+\]$/.test(name) && !isCatchAll(name);

function walk(dir: string, segments: string[], layouts: string[]): Route | null {
	const layout = fileIn(dir, "layout");
	const above = layout ? [...layouts, layout] : layouts;
	const page = segments.length === 0 ? fileIn(dir, "page") : undefined;
	if (page) return { page, layouts: above };
	const folders = foldersIn(dir);
	const [head, ...rest] = segments;
	const tries: [string, string[]][] = [
		...folders.filter(isGroup).map((f): [string, string[]] => [f, segments]),
		...(head !== undefined && folders.includes(head) ? [[head, rest] as [string, string[]]] : []),
		...(head !== undefined
			? folders.filter(isDynamic).map((f): [string, string[]] => [f, rest])
			: []),
		...(head !== undefined
			? folders.filter(isCatchAll).map((f): [string, string[]] => [f, []])
			: []),
	];
	for (const [folder, left] of tries) {
		const found = walk(join(dir, folder), left, above);
		if (found) return found;
	}
	return null;
}

/** The route a URL path draws from, under the app folder `appDir`; null when no page matches. */
export function routeOf(appDir: string, path: string): Route | null {
	return existsSync(appDir) ? walk(appDir, segmentsOf(path), []) : null;
}

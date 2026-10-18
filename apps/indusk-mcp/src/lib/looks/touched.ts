import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { readCatalog } from "./components.js";
import { closureOf, importReader, loadTypeScript, type TypeScript } from "./import-closure.js";
import {
	appFolderOf,
	appSourceFiles,
	configFilesOf,
	type DeclaredScreen,
	type LooksApp,
	MOCKUPS_DIR,
	servedFilesOf,
} from "./mockups.js";
import { routeOf } from "./routes.js";

/**
 * Which looks a set of changed files touches (tests-never-make-us-wait ADR
 * decision 5). A look is touched when a changed file is one it is drawn from:
 * for a screen, its page, the layouts above it and everything they import; for
 * a story, its component and everything that imports; and, for both, the
 * mockup or snapshot it is held to. Anything that restyles every look touches
 * every look: the app's foundation, declarations, stylesheets, styling
 * configuration, the app's public files and its Next.js config, and any look whose files cannot be read. Looks are named as
 * the held record names them (`screen:home.full`, `story:badge.ok`), since a
 * screen and a story can share a name.
 *
 * promise: a-look-check-runs-what-changed
 */

/** Each look's files by look; null where they could not be worked out. */
export type Closures = Record<string, readonly string[] | null>;

/**
 * The looks `changed` touches. `closures` is every look the app has;
 * `foundation` the files that touch all of them; `changed` the project-relative
 * paths. Pure. Nothing changed touches nothing; an unreadable closure means
 * what the change reaches cannot be told, so a change touches everything.
 */
export function touchedLooks(reads: {
	closures: Closures;
	foundation: readonly string[];
	changed: readonly string[];
}): string[] {
	const names = Object.keys(reads.closures);
	if (reads.changed.length === 0) return [];
	const changed = new Set(reads.changed);
	const everything =
		reads.foundation.some((f) => changed.has(f)) ||
		Object.values(reads.closures).some((files) => files === null);
	if (everything) return names;
	return names.filter((name) => reads.closures[name]?.some((f) => changed.has(f)));
}

const posix = (path: string) => path.split(sep).join("/");

/** The project-relative files that touch every look of the app. */
export async function foundationFiles(root: string, app: LooksApp): Promise<string[]> {
	const dir = join(MOCKUPS_DIR, app.app);
	const own = [
		"foundation.tokens.json",
		"devices.json",
		"screens.json",
		"components/_base.css",
		"components/_reset.css",
	].map((f) => posix(join(dir, f)));
	const styles = (await appSourceFiles(root, app.sources)).filter((f) => f.endsWith(".css"));
	const config = await configFilesOf(root, app);
	const served = await servedFilesOf(root, app);
	return [...own, ...[...styles, ...config, ...served].map((f) => posix(relative(root, f)))];
}

/** The `app/` folder of the app's sources: `<source>/app` or `<source>/src/app`. */
function appRouterDir(root: string, app: LooksApp): string | undefined {
	return app.sources
		.flatMap((s) => [join(root, s, "app"), join(root, s, "src", "app")])
		.find((d) => existsSync(d));
}

/** The entry files a screen state is drawn from: its declared `page`, else its route's page and layouts. */
function entriesOf(
	root: string,
	appDir: string | undefined,
	screen: DeclaredScreen,
	state: string,
): string[] | null {
	if (screen.page) {
		const page = resolve(root, screen.page);
		return existsSync(page) ? [page] : null;
	}
	if (!appDir) return null;
	const route = routeOf(appDir, screen.paths?.[state] ?? screen.path ?? `/${screen.name}`);
	return route ? [...route.layouts, route.page] : null;
}

/** What a look is drawn from: its entry files (null when unknown) and the project-relative files it is held to. */
type LookSources = [name: string, entries: string[] | null, held: string[]];

/** Each declared screen state: its route's page and layouts (or declared page), and its mockup. */
function screenSources(root: string, app: LooksApp): LookSources[] {
	const appDir = appRouterDir(root, app);
	const mockupDir = join(MOCKUPS_DIR, app.app);
	return app.screens.flatMap((screen) =>
		screen.states.map((state): LookSources => {
			const name = `${screen.name}.${state}`;
			return [
				`screen:${name}`,
				entriesOf(root, appDir, screen, state),
				[posix(join(mockupDir, "screens", `${name}.html`))],
			];
		}),
	);
}

/** Each story: its catalogued component file, and its snapshot and the component's stylesheet. */
function storySources(root: string, app: LooksApp): LookSources[] {
	const catalog = readCatalog(app);
	const mockupDir = join(MOCKUPS_DIR, app.app);
	return app.stories.map((story): LookSources => {
		const file = catalog?.components.find((c) => c.name === story.component)?.file;
		return [
			`story:${story.name}`,
			file ? [resolve(root, file)] : null,
			[
				posix(join(mockupDir, "components", `${story.name}.html`)),
				posix(join(mockupDir, "components", `${story.component}.css`)),
			],
		];
	});
}

/**
 * The files every look of `app` is drawn from, by look. `ts` is the app's own
 * TypeScript, loaded from its folder when not handed in; without one every
 * closure is null. A screen whose page cannot be found, and a story whose
 * component the catalog does not name, are null.
 */
export function lookClosures(app: LooksApp, root: string, ts?: TypeScript | null): Closures {
	const first = app.sources[0];
	const folder = first === undefined ? undefined : appFolderOf(root, first);
	const compiler = ts === undefined && folder ? loadTypeScript(folder) : ts;
	const looks = [...screenSources(root, app), ...storySources(root, app)];
	if (!compiler || !folder) return Object.fromEntries(looks.map(([name]) => [name, null]));
	const importsOf = importReader(compiler, folder, resolve(root));
	return Object.fromEntries(
		looks.map(([name, entries, held]) => [
			name,
			entries
				? [...new Set([...closureOf(entries, importsOf, resolve(root)), ...held])].sort()
				: null,
		]),
	);
}

/** The looks of `app` that `changed` (project-relative paths) touches. */
export async function touchedBy(
	root: string,
	app: LooksApp,
	changed: readonly string[],
): Promise<{ touched: Set<string>; total: number }> {
	const closures = lookClosures(app, root);
	const touched = touchedLooks({
		closures,
		foundation: await foundationFiles(root, app),
		changed,
	});
	return { touched: new Set(touched), total: Object.keys(closures).length };
}

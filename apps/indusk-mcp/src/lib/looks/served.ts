import type { LookTarget, StoryTarget } from "./check.js";
import { devServerMarker } from "./dev-server.js";
import { LooksCheckError } from "./errors.js";
import { type LooksApp, servedBuildOf } from "./mockups.js";

/**
 * Reading what the server serves, before any look opens: the app's root and
 * the first story's frame, within a time, refused when it is a development
 * server, reduced to the build identity (`servedBuildOf`). Reads pages and
 * measures nothing.
 */

/**
 * Where a story is served: the app's Storybook build under `/storybook` and
 * the story's id. No theme global: the preview's decorator then leaves
 * `data-theme` off and the story follows `prefers-color-scheme`, which the
 * check switches on the page, as it does for a screen.
 */
export function storyUrl(base: string, id: string): string {
	const url = new URL("/storybook/iframe.html", base);
	url.searchParams.set("id", id);
	url.searchParams.set("viewMode", "story");
	return url.toString();
}

/** How long the served page is waited for before its build is taken as unreadable. */
const READ_TIMEOUT_MS = 30_000;

/** `work` within `ms`, else null: a page that never answers costs only reuse, never the run. */
async function within<T>(work: Promise<T>, ms: number): Promise<T | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const expired = new Promise<null>((done) => {
		timer = setTimeout(() => done(null), ms);
	});
	try {
		return await Promise.race([work, expired]);
	} finally {
		clearTimeout(timer);
	}
}

/** The command that builds and serves the app, or how to declare one. */
export const serveCommand = (app: LooksApp): string =>
	app.serve ??
	`declare the command that builds and serves the app as "serve" in .indusk/mockups/${app.app}/screens.json`;

/** The builds being served, read from one page of each kind a run opens; null where a page could not be read. */
export interface Served {
	screens: string | null;
	stories: string | null;
}

/**
 * Read the served pages once before any look opens: the app's root when screens
 * are to open, and the first story's frame when stories are. A development server is refused here, naming
 * the app's `serve` command; a page that cannot be fetched leaves its build
 * unknown, so nothing of its kind is reused, and the look that opens it says
 * why it cannot be read.
 */
export async function readServed(
	app: LooksApp,
	base: string,
	firstScreen: LookTarget | undefined,
	firstStory: StoryTarget | undefined,
	opts: {
		fetchPage?: (url: string) => Promise<string>;
		readTimeoutMs?: number;
	} = {},
): Promise<Served> {
	const limit = opts.readTimeoutMs ?? READ_TIMEOUT_MS;
	const fetchPage =
		opts.fetchPage ??
		((url: string) => fetch(url, { signal: AbortSignal.timeout(limit) }).then((r) => r.text()));
	const read = async (url: string | undefined): Promise<string | null> => {
		if (!url) return null;
		let html: string | null;
		try {
			html = await within(fetchPage(url), limit);
		} catch {
			return null;
		}
		if (html === null) return null;
		const marker = devServerMarker(html);
		if (marker !== null) {
			throw new LooksCheckError(
				`${base} is a development server (${marker}) — build and serve the app, then check again: ${serveCommand(app)}`,
			);
		}
		return servedBuildOf(html);
	};
	return {
		// The app's root at the base URL's own path, not a look's page: each look's
		// page is then requested once, by its look.
		screens: await read(
			firstScreen && new URL(".", base.endsWith("/") ? base : `${base}/`).toString(),
		),
		stories: await read(firstStory && storyUrl(base, firstStory.id)),
	};
}

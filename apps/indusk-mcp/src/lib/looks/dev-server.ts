import { assetUrlsOf } from "./mockups.js";

/**
 * Whether a page was served by a development server, which a look check must
 * never crawl: it compiles each route on first request, so one check spent
 * half an hour in it (looks-check-speed ADR). Pure: the caller fetches the
 * HTML. Markers are looked for in the scripts and stylesheets the page loads,
 * never in its text: a production Next page carries its rendered data in
 * inline scripts, and a page that mentions a marker is not a development
 * server (A34). A framework's marker is added here, not worked around with
 * `--url`.
 *
 * promise: a-look-check-costs-what-changed
 */

/** What a development server loads on every page, in the order they are looked for. */
const DEV_MARKERS = [
	"hmr-client", // Next (Turbopack)
	"react-refresh", // webpack
	"/@vite/client", // Vite
] as const;

/** The first development marker in an asset `html` loads, else null. */
export function devServerMarker(html: string): string | null {
	const assets = assetUrlsOf(html);
	return DEV_MARKERS.find((marker) => assets.some((url) => url.includes(marker))) ?? null;
}

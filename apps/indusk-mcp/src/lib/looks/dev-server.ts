/**
 * Whether a page was served by a development server, which a look check must
 * never crawl: it compiles each route on first request, so one check spent
 * half an hour in it (looks-check-speed ADR). Pure: the caller fetches the
 * HTML. A framework's marker is added here, not worked around with `--url`.
 *
 * promise: a-look-check-costs-what-changed
 */

/** What a development server adds to every page, in the order they are looked for. */
const DEV_MARKERS = [
	"hmr-client", // Next (Turbopack)
	"react-refresh", // webpack
	"/_next/webpack-hmr", // Next (webpack)
	"/@vite/client", // Vite
] as const;

/** The first development marker found in `html`, else null. */
export function devServerMarker(html: string): string | null {
	return DEV_MARKERS.find((marker) => html.includes(marker)) ?? null;
}

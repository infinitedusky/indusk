import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { type ApprovalEntry, approvalOf } from "./approvals.js";
import { appSourceFiles, type LooksApp, type Mockup } from "./mockups.js";

/**
 * Coverage (ui-promises ADR decision 5): every declared screen × state needs a
 * mockup approved as it is now, and every `data-component` name the app
 * renders must appear in one. What is missing is listed *uncovered* — never
 * passed, never left out. A screen with no approved state at all is one
 * uncovered screen, not a list of its states.
 *
 * A mockup changed since its approval reads proposed (`approvalOf`), so it
 * covers nothing until a person approves the change.
 *
 * promise: every-part-of-the-ui-is-covered
 */

export interface Coverage {
	/** Declared screens none of whose states has an approved mockup. */
	screens: string[];
	/** `<screen>.<state>` with no approved mockup, for screens that have at least one. */
	states: string[];
	/** `data-component` names the app's sources render that no approved mockup shows. */
	components: string[];
}

const MARKUP_EXTENSIONS = new Set([
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

/** The `data-component` names in markup: `data-component="badge"`, `'badge'` or `{"badge"}`. */
export function componentsIn(text: string): Set<string> {
	const names = new Set<string>();
	for (const m of text.matchAll(/\bdata-component\s*=\s*\{?\s*["'`]([^"'`\s]+)["'`]/g)) {
		names.add(m[1]);
	}
	return names;
}

/** Declared screens with no approved state, and the missing states of the rest. */
function uncoveredScreens(
	app: LooksApp,
	approved: readonly Mockup[],
): Pick<Coverage, "screens" | "states"> {
	const approvedNames = new Set(approved.map((m) => m.name));
	const screens: string[] = [];
	const states: string[] = [];
	for (const screen of app.screens) {
		const missing = screen.states.filter((s) => !approvedNames.has(`${screen.name}.${s}`));
		if (missing.length === screen.states.length) screens.push(screen.name);
		else states.push(...missing.map((s) => `${screen.name}.${s}`));
	}
	return { screens, states };
}

/** `data-component` names in the app's declared sources that no approved mockup shows, sorted. */
async function uncoveredComponents(
	root: string,
	app: LooksApp,
	approved: readonly Mockup[],
): Promise<string[]> {
	const shown = new Set(approved.flatMap((m) => [...componentsIn(m.html)]));
	const rendered = new Set<string>();
	for (const file of await appSourceFiles(root, app.sources)) {
		if (!MARKUP_EXTENSIONS.has(extname(file))) continue;
		for (const name of componentsIn(await readFile(file, "utf-8"))) rendered.add(name);
	}
	return [...rendered].filter((n) => !shown.has(n)).sort();
}

/** What the app declares or renders that no approved mockup covers. */
export async function coverageOf(
	root: string,
	app: LooksApp,
	approvals: readonly ApprovalEntry[],
): Promise<Coverage> {
	const approved = app.mockups.filter((m) => approvalOf(app, m, approvals).state === "approved");
	return {
		...uncoveredScreens(app, approved),
		components: await uncoveredComponents(root, app, approved),
	};
}

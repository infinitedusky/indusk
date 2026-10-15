import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import {
	type ApprovalEntry,
	approvalOf,
	readStoryApprovals,
	storyApprovalOf,
} from "./approvals.js";
import { catalogGaps, MARKER_PATTERN, MARKUP_EXTENSIONS } from "./components.js";
import { heldComponentNames } from "./landed.js";
import { markedComponentsOf } from "./markup.js";
import { appSourceFiles, type LooksApp, type Mockup } from "./mockups.js";

/**
 * Coverage (ui-promises ADR decision 5): every declared screen × state needs a
 * mockup approved as it is now, and every `data-component` name the app
 * renders must appear on an element of one. What is missing is listed
 * *uncovered* — never passed, never left out. A screen with no approved state
 * at all is one uncovered screen, not a list of its states. A mockup is read
 * as the browser reads it (`looks/markup`): a name in its comment, script or
 * style is text and covers nothing. A source whose `data-component` is not a
 * literal names no component the coverage can judge, so it is listed
 * *unresolved* at its file and line, and fails like an uncovered one.
 *
 * A mockup changed since its approval reads proposed (`approvalOf`), so it
 * covers nothing until a person approves the change.
 *
 * A component is covered when an approved mockup shows it or every one of its
 * stories is approved (`componentsOfApprovedStories`).
 *
 * Components are covered by their stories (storybook-components ADR decision
 * 8): each story the app has — every state a mockup shows that has a story,
 * and every other state its component's stories render — is *uncovered* until
 * a person approves it as its snapshot is now; a state a mockup shows with no
 * story at all is `noStory`.
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
	/** `<file>:<line>` of each source `data-component` whose name is not a literal. */
	unresolved: string[];
	/** Marked in the app's sources and missing from `components.json`; none when the app has no catalog. */
	notInCatalog: string[];
	/** Named by a mockup (composed references and declared-new names) and marked by no non-test file in the app's sources, sorted. */
	unimplemented: string[];
	/** `<component>.<state>` a mockup places by name that the catalog lists no story for, sorted. */
	noStory: string[];
	/** `<component>.<state>` of each story not approved as its snapshot is now, sorted. */
	stories: string[];
}

/** The `data-component` names in a source's markup: `data-component="badge"`, `'badge'` or `{"badge"}`. */
export function componentsIn(text: string): Set<string> {
	const names = new Set<string>();
	for (const m of text.matchAll(MARKER_PATTERN)) names.add(m[1] as string);
	return names;
}

/**
 * The 1-based lines of a source where `data-component` is given an expression
 * that is not a string literal (`{name}`, `{\`${kind}-row\`}`): the name is
 * decided at run time, so no mockup can be said to cover it.
 */
export function unresolvedIn(text: string): number[] {
	const lines: number[] = [];
	text.split("\n").forEach((line, i) => {
		for (const m of line.matchAll(/\bdata-component\s*=\s*\{\s*([^}]*)\}/g)) {
			const expr = (m[1] ?? "").trim();
			if (!/^(["'])[^"'\s]+\1$|^`[^`$\s]+`$/.test(expr)) lines.push(i + 1);
		}
	});
	return lines;
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

/**
 * Components covered by their stories alone (ADR decision 8): each has at
 * least one story and every one of its stories is approved as it is now. One
 * story not approved leaves it to the mockups, so it stays uncovered unless an
 * approved mockup shows it.
 */
function componentsOfApprovedStories(app: LooksApp): Set<string> {
	const approvals = readStoryApprovals(app);
	const standing = new Map<string, boolean>();
	for (const story of app.stories) {
		const name = story.component;
		const ok = storyApprovalOf(app, story, approvals).state === "approved";
		standing.set(name, (standing.get(name) ?? true) && ok);
	}
	return new Set([...standing].filter(([, ok]) => ok).map(([name]) => name));
}

/**
 * `data-component` names in the app's declared sources that no approved
 * mockup shows and no approved story covers, sorted, and the places a source names one at run time.
 */
async function uncoveredComponents(
	root: string,
	app: LooksApp,
	approved: readonly Mockup[],
): Promise<Pick<Coverage, "components" | "unresolved">> {
	const shown = new Set([
		...approved.flatMap((m) => [...markedComponentsOf(m.html)]),
		...componentsOfApprovedStories(app),
	]);
	const rendered = new Set<string>();
	const unresolved: string[] = [];
	for (const file of await appSourceFiles(root, app.sources)) {
		if (!MARKUP_EXTENSIONS.has(extname(file))) continue;
		const text = await readFile(file, "utf-8");
		for (const name of componentsIn(text)) rendered.add(name);
		for (const line of unresolvedIn(text)) unresolved.push(`${relative(root, file)}:${line}`);
	}
	return { components: [...rendered].filter((n) => !shown.has(n)).sort(), unresolved };
}

/**
 * Component names the app's mockups (read composed) place that no
 * implementation file marks — a mockup asking for what the app does not have.
 * Only components of landed plans are held to it (`looks/landed`): approval
 * merges a plan's looks before its code, and a re-approval in flight exempts
 * only what it adds.
 */
function unimplementedComponents(
	root: string,
	app: LooksApp,
	approvals: readonly ApprovalEntry[],
	implemented: ReadonlyMap<string, unknown>,
): string[] {
	const named = heldComponentNames(root, app.mockups, approvals);
	return [...named].filter((n) => !implemented.has(n)).sort();
}

/** What the app declares or renders that no approved mockup covers. */
export async function coverageOf(
	root: string,
	app: LooksApp,
	approvals: readonly ApprovalEntry[],
): Promise<Coverage> {
	const approved = app.mockups.filter((m) => approvalOf(app, m, approvals).state === "approved");
	const gaps = await catalogGaps(root, app);
	return {
		...uncoveredScreens(app, approved),
		...(await uncoveredComponents(root, app, approved)),
		unimplemented: unimplementedComponents(root, app, approvals, gaps.scan.components),
		notInCatalog: gaps.notInCatalog.map((c) => c.name).sort(),
		noStory: [...new Set(gaps.noStory.map((r) => `${r.name}.${r.state}`))].sort(),
		stories: uncoveredStories(app),
	};
}

/** The stories no person has approved as their snapshots are now. */
function uncoveredStories(app: LooksApp): string[] {
	if (app.stories.length === 0) return [];
	const approvals = readStoryApprovals(app);
	return app.stories
		.filter((s) => storyApprovalOf(app, s, approvals).state !== "approved")
		.map((s) => s.name)
		.sort();
}

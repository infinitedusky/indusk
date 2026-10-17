import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gitCommonDirOf } from "../worktree/layout.js";
import { readRecord } from "../worktree/plan-worktree-record.js";
import {
	type ApprovalEntry,
	approvalOf,
	readApprovals,
	readStoryApprovals,
	type StoryApprovalEntry,
	storyApprovalOf,
} from "./approvals.js";
import { pageOnly } from "./component-styles.js";
import { storybookIds } from "./components.js";
import { type Coverage, coverageOf } from "./coverage.js";
import { generateCss } from "./foundation.js";
import {
	type ComponentStyle,
	type Device,
	type LooksApp,
	MOCKUPS_DIR,
	type Mockup,
	readApp,
	type Story,
} from "./mockups.js";

/**
 * What the cockpit's Looks page shows (ui-promises ADR decisions 2, 3, 5):
 * each app's mockups with whether a person has approved them as they are, the
 * reference devices to open them at, the document each is drawn from, and
 * what no approved mockup covers. Every fact is read here, from the other
 * `looks/` modules, so the admin renders it and decides none of it.
 *
 * promise: mockups-render-in-the-cockpit
 */

export interface MockupView {
	name: string;
	screen: string;
	state: string;
	/** `approved` only while the record binds its current hash and the foundation's. */
	approval: "approved" | "proposed";
	/** The entry in force when approved; the last one (the reference held to meanwhile) when proposed; null when never approved. */
	entry: ApprovalEntry | null;
	/**
	 * The plan that owns the look: the one the entry was approved in. Null when
	 * never approved or approved outside a plan. The plan page reads its looks
	 * by this (brief-as-the-contract ADR decision 7).
	 */
	plan: string | null;
	/** sha256 of the mockup's bytes as they are now. */
	hash: string;
	/** `componentsHashOf` the snapshots it composes: what a mockup's Approve sends back with `hash`. */
	componentsHash: string;
	/** The components whose snapshots changed since the mockup was approved; empty unless it reads proposed for that reason. */
	componentsChanged: string[];
	/** The mockup as a standalone page, its tokens stylesheet replaced by the foundation's CSS inline. */
	document: string;
}

/**
 * One story of the app's components (storybook-components ADR decisions 3, 5,
 * 6): its snapshot's hash, whether a person has approved it as it is, and the
 * Storybook id the cockpit frames it from. A story `proposed` with an `entry`
 * is a changed one: approved once, its snapshot differs now.
 */
export interface StoryView {
	/** `badge.ok` — the snapshot's name. */
	name: string;
	component: string;
	state: string;
	/** The Storybook story id; null when the catalog lists none (render it again). */
	id: string | null;
	approval: "approved" | "proposed";
	/** The entry in force when approved; the last one when proposed; null when never approved. */
	entry: StoryApprovalEntry | null;
	/** The plan that owns the story: the one its entry was approved in, or null. */
	plan: string | null;
	/** sha256 of the snapshot as it is now; a story's Approve sends back the one the person saw. */
	hash: string;
	/** sha256 of its component's stylesheet as it is now, or null when it has none; sent back with `hash`. */
	stylesheetHash: string | null;
	/**
	 * The snapshot as a page the cockpit frames (`storyDocument`): the story a
	 * person approves is the one drawn from these bytes, in the checkout the
	 * page reads — never the admin's own Storybook build (Build Phase 9, A35).
	 */
	document: string;
}

export interface AppLooks {
	app: string;
	devices: Device[];
	/** sha256 of the foundation as it is now; Approve sends back the one the person saw. */
	foundationHash: string;
	mockups: MockupView[];
	/** Every story with a snapshot, by name. */
	stories: StoryView[];
	uncovered: Coverage;
}

export type AppLooksRead = AppLooks | { app: string; problem: string };

/** The apps that have looks: every folder under `.indusk/mockups/`, sorted. */
export function listApps(root: string): string[] {
	const dir = join(root, MOCKUPS_DIR);
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true })
		.filter((d) => d.isDirectory() && !d.name.startsWith("."))
		.map((d) => d.name)
		.sort();
}

const TOKENS_LINK = /<link\b[^>]*\bhref=["'][^"']*tokens\.css["'][^>]*>/i;

/**
 * A mockup as a page the cockpit can draw on its own: it loads the app's
 * generated `tokens.css` by a relative link, which a frame has no folder to
 * resolve, so the link is replaced by the same CSS inline — generated from
 * the foundation as it is now, so a changed value shows on the next read.
 * A mockup without the link gets the CSS first in its head. The stylesheet of
 * each component the mockup names follows the tokens (ADR decision 10): a
 * snapshot is markup, and its look is the app's compiled classes. `reset`, the
 * app's element rules scoped to components (`_reset.css`), goes between the
 * tokens and the component sheets, so a component draws as its story does.
 */
export function mockupDocument(
	ownHtml: string,
	tokensCss: string,
	styles: readonly Pick<ComponentStyle, "component" | "css">[] = [],
	reset = "",
): string {
	// The mockup's own rules reach its page and no component it places (`pageOnly`);
	// the sheets added below are the foundation's and the components' own.
	const html = ownHtml.replace(
		/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
		(_all, open: string, css: string, close: string) => `${open}${pageOnly(css)}${close}`,
	);
	const style = [
		`<style data-foundation>\n${tokensCss}</style>`,
		...(reset ? [`<style data-component-style="_reset">\n${reset}</style>`] : []),
		...styles.map((s) => `<style data-component-style="${s.component}">\n${s.css}</style>`),
	].join("\n");
	if (TOKENS_LINK.test(html)) return html.replace(TOKENS_LINK, () => style);
	if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (head) => head + style);
	return style + html;
}

function viewOf(
	app: Awaited<ReturnType<typeof readApp>>,
	mockup: Mockup,
	approvals: ApprovalEntry[],
	css: string,
): MockupView {
	const approval = approvalOf(app, mockup, approvals);
	const entry = approval.state === "approved" ? approval.entry : approval.reference;
	return {
		name: mockup.name,
		screen: mockup.screen,
		state: mockup.state,
		approval: approval.state,
		entry,
		plan: entry?.plan ?? null,
		hash: mockup.hash,
		componentsHash: mockup.componentsHash,
		componentsChanged: approval.state === "proposed" ? (approval.componentsChanged ?? []) : [],
		document: mockupDocument(mockup.html, css, mockup.styles, app.reset),
	};
}

/**
 * A story's snapshot as a page the cockpit can draw on its own, built as
 * `mockupDocument` builds a composed mockup: the foundation's tokens, the app's
 * element resets (`_reset.css`), the app's
 * base (`_base.css`, so the story is drawn in the app's type), then its
 * component's stylesheet, then the snapshot's markup inside a
 * `#storybook-root`, where the frame measures the component it holds. What is
 * drawn is exactly what the hashes an Approve sends were read from.
 */
export function storyDocument(
	story: Pick<Story, "component" | "html">,
	tokensCss: string,
	sheets: Pick<LooksApp, "styles" | "base" | "reset">,
): string {
	const page = `<!doctype html>\n<html>\n<head><meta charset="utf-8"></head>\n<body><div id="storybook-root">${story.html}</div></body>\n</html>\n`;
	return mockupDocument(
		page,
		tokensCss,
		[
			...(sheets.base ? [{ component: "_base", css: sheets.base }] : []),
			...sheets.styles.filter((s) => s.component === story.component),
		],
		sheets.reset,
	);
}

function storiesOf(
	app: Awaited<ReturnType<typeof readApp>>,
	approvals: StoryApprovalEntry[],
	css: string,
): StoryView[] {
	const ids = storybookIds(app);
	return app.stories.map((story) => {
		const approval = storyApprovalOf(app, story, approvals);
		const entry = approval.state === "approved" ? approval.entry : approval.reference;
		return {
			name: story.name,
			component: story.component,
			state: story.state,
			id: ids.get(story.name) ?? null,
			approval: approval.state,
			entry,
			plan: entry?.plan ?? null,
			hash: story.hash,
			stylesheetHash: story.stylesheetHash,
			document: storyDocument(story, css, app),
		};
	});
}

/** One app's looks; an app that cannot be read is its problem, named, never left out. */
export async function readAppLooks(root: string, appName: string): Promise<AppLooksRead> {
	try {
		const app = await readApp(root, appName);
		const approvals = readApprovals(app);
		const css = generateCss(app.foundation);
		return {
			app: appName,
			devices: app.devices,
			foundationHash: app.foundation.hash,
			mockups: app.mockups.map((m) => viewOf(app, m, approvals, css)),
			stories: storiesOf(app, readStoryApprovals(app), css),
			uncovered: await coverageOf(root, app, approvals),
		};
	} catch (err) {
		return { app: appName, problem: (err as Error).message };
	}
}

/** Every app's looks in the project. */
export async function readLooks(root: string): Promise<AppLooksRead[]> {
	return Promise.all(listApps(root).map((app) => readAppLooks(root, app)));
}

/** How many looks await a person in `apps`: each mockup and story reading proposed, withdrawn ones included. */
export function proposedCount(apps: AppLooksRead[]): number {
	let count = 0;
	for (const app of apps) {
		if ("problem" in app) continue;
		count += app.mockups.filter((m) => m.approval === "proposed").length;
		count += app.stories.filter((s) => s.approval === "proposed").length;
	}
	return count;
}

/** A checkout whose looks the cockpit can show and approve in. */
export interface LooksCheckout {
	/** The plan whose worktree it is; null for the project's own checkout. */
	plan: string | null;
	root: string;
	branch: string | null;
}

/**
 * The checkouts of `projectRoot` the Looks page can read: the project's own,
 * and each plan worktree assigned to it that holds mockups. A look is drawn,
 * approved and merged where its plan is worked, so approval is read and
 * written in one of these, never only on `main` (ui-promises, Build Phase 5).
 */
export async function looksCheckouts(projectRoot: string): Promise<LooksCheckout[]> {
	const out: LooksCheckout[] = [{ plan: null, root: projectRoot, branch: null }];
	// A project that is not a git checkout has no plan worktrees: its own
	// checkout is the only one, never a refusal of the whole page.
	if (!gitCommonDirOf(projectRoot)) return out;
	const record = await readRecord(projectRoot);
	if (!record.ok) return out;
	for (const a of record.assignments) {
		if (existsSync(join(a.path, MOCKUPS_DIR)) && listApps(a.path).length > 0) {
			out.push({ plan: a.plan, root: a.path, branch: a.branch });
		}
	}
	return out;
}

/** A checkout and how many looks wait for a person in it. */
export interface CountedCheckout extends LooksCheckout {
	proposed: number;
}

/**
 * `looksCheckouts`, each with its count of proposed looks: a person approves
 * where the proposals are, and the default checkout is not always it.
 */
export async function countedCheckouts(projectRoot: string): Promise<CountedCheckout[]> {
	const all = await looksCheckouts(projectRoot);
	return Promise.all(
		all.map(async (c) => ({ ...c, proposed: proposedCount(await readLooks(c.root)) })),
	);
}

/**
 * The checkout to read: the plan named, when it is one of `looksCheckouts`;
 * with none named, the project's own if it has looks, else the one worktree
 * that does. A plan that has no such checkout is a problem, named, never a
 * silent read of another tree.
 */
export async function resolveLooksCheckout(
	projectRoot: string,
	plan?: string | null,
): Promise<LooksCheckout | { problem: string }> {
	const all = await looksCheckouts(projectRoot);
	if (plan) {
		return (
			all.find((c) => c.plan === plan) ?? {
				problem: `plan ${JSON.stringify(plan)} has no worktree here that holds mockups`,
			}
		);
	}
	const own = all[0] as LooksCheckout;
	if (listApps(own.root).length > 0) return own;
	const others = all.slice(1);
	return others.length === 1 ? (others[0] as LooksCheckout) : own;
}

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
import { readCatalog } from "./components.js";
import { type Coverage, coverageOf } from "./coverage.js";
import { generateCss } from "./foundation.js";
import { type ComponentStyle, type Device, MOCKUPS_DIR, type Mockup, readApp } from "./mockups.js";

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
	/** sha256 of the snapshot as it is now; a story's Approve sends back the one the person saw. */
	hash: string;
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
 * snapshot is markup, and its look is the app's compiled classes.
 */
export function mockupDocument(
	html: string,
	tokensCss: string,
	styles: readonly Pick<ComponentStyle, "component" | "css">[] = [],
): string {
	const style = [
		`<style data-foundation>\n${tokensCss}</style>`,
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
	return {
		name: mockup.name,
		screen: mockup.screen,
		state: mockup.state,
		approval: approval.state,
		entry: approval.state === "approved" ? approval.entry : approval.reference,
		hash: mockup.hash,
		componentsHash: mockup.componentsHash,
		componentsChanged: approval.state === "proposed" ? (approval.componentsChanged ?? []) : [],
		document: mockupDocument(mockup.html, css, mockup.styles),
	};
}

function storiesOf(
	app: Awaited<ReturnType<typeof readApp>>,
	approvals: StoryApprovalEntry[],
): StoryView[] {
	const ids = new Map<string, string>();
	for (const c of readCatalog(app)?.components ?? []) {
		for (const s of c.states) if (s.id) ids.set(`${c.name}.${s.name}`, s.id);
	}
	return app.stories.map((story) => {
		const approval = storyApprovalOf(app, story, approvals);
		return {
			name: story.name,
			component: story.component,
			state: story.state,
			id: ids.get(story.name) ?? null,
			approval: approval.state,
			entry: approval.state === "approved" ? approval.entry : approval.reference,
			hash: story.hash,
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
			stories: storiesOf(app, readStoryApprovals(app)),
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

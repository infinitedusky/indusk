import { mkdirSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { withLock } from "../agents/lock.js";
import { commitNote, currentMdPath, type NoteCommit, oneLine } from "../bookkeeping/notes.js";
import { planningStepRefusal } from "../build/step-env.js";
import { git } from "../git.js";
import { isUsableSegment } from "../path-segment.js";
import {
	type ApprovalEntry,
	approvalOf,
	approvalsPath,
	bindingOf,
	readRecord,
	type StoryApprovalEntry,
	standingOf,
	storyApprovalOf,
	unapprovedUses,
	type WithdrawnEntry,
} from "./approvals.js";
import { type LooksApp, type Mockup, readApp, type Story } from "./mockups.js";

/**
 * The write side of approval (ui-promises ADR decision 3, storybook-components
 * ADR decisions 5 and 11): `approve` and `withdraw` append to the record that
 * `approvals.ts` defines and reads. `approve` is the cockpit's: the admin's
 * Approve route calls it with the person who pressed it. The command line
 * refuses (`indusk looks approve` exits 2) and the guard hook refuses an
 * agent's Write or Edit to the record. `withdraw` is the cockpit's Unapprove.
 * Every reader of the record stays in `approvals.ts`; the admin's two routes
 * are the only importers of this module.
 *
 * promise: a-mockup-is-approved-by-a-person
 */

export type ApproveResult =
	| { approved: true; entry: ApprovalEntry | StoryApprovalEntry; commit: NoteCommit }
	| { approved: false; reason: string };

/**
 * What the person was shown, sent back with Approve. For a mockup: the
 * foundation, the composed mockup's hash and its `componentsHash`. For a story
 * (`kind: "story"`): the foundation, the snapshot's hash, which a story's
 * approval cannot go without, and its component's stylesheet hash, which it
 * cannot go without when the component has a stylesheet.
 */
export type Seen =
	| { kind?: "mockup"; foundationHash?: string; mockupHash?: string; componentsHash?: string }
	| { kind: "story"; snapshotHash: string; stylesheetHash?: string; foundationHash?: string };

/**
 * The plan a checkout belongs to: `x` for a checkout on `plan/x`, null for any
 * other (the project's own, a detached head). The approval records it, so a
 * look is owned by the plan it was approved in without a registry of its own.
 */
async function planOf(checkout: string): Promise<string | null> {
	const branch = await git(checkout, "branch", "--show-current").catch(() => "");
	return branch.startsWith("plan/") && branch.length > "plan/".length
		? branch.slice("plan/".length)
		: null;
}

const short = (hash: string) => hash.slice(0, 8);

/**
 * What `approve` and `withdraw` both settle before judging a subject: the app
 * name is one folder, someone did it, the checkout reads, and the foundation
 * the person was shown is the one the checkout holds. A reason when not.
 */
async function openApp(
	checkout: string,
	appName: string,
	by: string,
	{ noOne, act, foundationHash }: { noOne: string; act: string; foundationHash?: string },
): Promise<{ app: LooksApp } | { reason: string }> {
	if (!isUsableSegment(appName)) return { reason: `${JSON.stringify(appName)} is not an app name` };
	if (by.trim() === "") return { reason: noOne };
	let app: LooksApp;
	try {
		app = await readApp(checkout, appName);
	} catch (err) {
		return { reason: `${(err as Error).message} (read in ${checkout})` };
	}
	if (foundationHash !== undefined && foundationHash !== app.foundation.hash) {
		return {
			reason: `the foundation in ${checkout} is not the one shown (${short(foundationHash)}, it has ${short(app.foundation.hash)}) — open it again and ${act} what it holds`,
		};
	}
	return { app };
}

/**
 * Approve a mockup, or a story, as it is in `checkout` now: append an entry
 * bound to its hash and the foundation's, and commit the record on the branch
 * that checkout is on, through the notes writer (`commitNote`) — only that
 * file. An approval belongs to the work it judges: a plan's worktree approves
 * on the plan's branch and the record merges with the mockups, never through
 * `main`. One already approved as it is gets no second entry. Called by the
 * cockpit's Approve with the person who pressed it, and the checkout the page
 * showed them; nothing else in the package calls it.
 *
 * The foundation has no approval of its own: an entry binds the foundation's
 * hash with the mockup's, so approving a mockup approves the foundation it is
 * drawn on. `seen.foundationHash` is the foundation the person was shown; an
 * approval of any other — one changed in the checkout since — is refused, so
 * a foundation is never approved unseen. `seen.mockupHash` is the mockup the
 * person was shown, refused the same way when the checkout now holds another:
 * an approval binds what was looked at, not what happens to be on disk when
 * the request lands (ui-promises Build Phase 6, A30). `seen.componentsHash` is
 * refused the same way, and a mockup composing a component whose story is not
 * approved as it is now is refused naming it — approving the mockup must not
 * approve a component nobody looked at on its own. A story is refused unless
 * `seen.snapshotHash` is the snapshot the checkout holds.
 */
export async function approve(
	checkout: string,
	appName: string,
	name: string,
	by: string,
	seen: Seen = {},
): Promise<ApproveResult> {
	const refused = planningStepRefusal(`approving ${appName}'s ${name}`);
	if (refused) return { approved: false, reason: refused };
	const opened = await openApp(checkout, appName, by, {
		noOne: "an approval needs who gave it",
		act: "approve",
		foundationHash: seen.foundationHash,
	});
	if ("reason" in opened) return { approved: false, reason: opened.reason };
	const { app } = opened;
	const plan = await planOf(checkout);
	return seen.kind === "story"
		? approveStory(checkout, app, name, by, seen, plan)
		: approveMockup(checkout, app, name, by, seen, plan);
}

/**
 * Approving a mockup appends to its app's record and never rewrites it: the
 * version approved before stays beside the new one, with the plan each was
 * approved in, and stays the one the app is held to until this approval.
 *
 * promise: a-changed-look-keeps-its-history
 */
async function approveMockup(
	checkout: string,
	app: LooksApp,
	mockupName: string,
	by: string,
	seen: Exclude<Seen, { kind: "story" }>,
	plan: string | null,
): Promise<ApproveResult> {
	const mockup = app.mockups.find((m) => m.name === mockupName);
	if (!mockup) {
		return {
			approved: false,
			reason: `${app.app} has no mockup ${JSON.stringify(mockupName)} in ${checkout} — a mockup is approved as its checkout holds it`,
		};
	}
	const missing = componentsHashMissing(mockup, seen);
	if (missing) return { approved: false, reason: missing };
	const stale = mockupNotShown(checkout, mockup, seen);
	if (stale) return { approved: false, reason: stale };
	return appended(checkout, app, `${mockup.name} approved by ${by}`, (record) => {
		// Decided on the record as the lock holds it: a story taken back between
		// the page's read and this write is seen here.
		const standing = standingOf(record);
		const unapproved = unapprovedUses(app, mockup, standing.stories);
		if (unapproved.length > 0) {
			const stories = [...new Set(unapproved.map((u) => u.story))].join(", ");
			return {
				refuse: `${mockupName} composes ${stories}, with no approved story — approve each story first, then the mockup`,
			};
		}
		const now = approvalOf(app, mockup, standing.mockups, [], standing.stories);
		if (now.state === "approved") return { held: now.entry };
		const components: Record<string, string> = {};
		for (const u of mockup.uses) if (u.snapshotHash !== null) components[u.story] = u.snapshotHash;
		for (const s of mockup.styles) components[s.key] = s.hash;
		return {
			add: {
				mockup: mockup.name,
				mockupHash: mockup.hash,
				...(mockup.uses.length > 0 ? { componentsHash: mockup.componentsHash, components } : {}),
				...bindingOf(app),
				by,
				at: new Date().toISOString(),
				...(plan === null ? {} : { plan }),
			},
		};
	});
}

async function approveStory(
	checkout: string,
	app: LooksApp,
	storyName: string,
	by: string,
	seen: Extract<Seen, { kind: "story" }>,
	plan: string | null,
): Promise<ApproveResult> {
	const story = app.stories.find((s) => s.name === storyName);
	if (!story) {
		return {
			approved: false,
			reason: `${app.app} has no story ${JSON.stringify(storyName)} in ${checkout} — run \`indusk looks stories ${app.app}\` and approve the snapshot it writes`,
		};
	}
	if (typeof seen.snapshotHash !== "string" || seen.snapshotHash === "") {
		return {
			approved: false,
			reason: `a story is approved with the snapshot hash it was shown at`,
		};
	}
	const stale = storyNotShown(checkout, story, seen.snapshotHash);
	if (stale) return { approved: false, reason: stale };
	const sheet = sheetNotShown(checkout, story, seen.stylesheetHash);
	if (sheet) return { approved: false, reason: sheet };
	return appended(checkout, app, `story ${story.name} approved by ${by}`, (record) => {
		const now = storyApprovalOf(app, story, standingOf(record).stories);
		if (now.state === "approved") return { held: now.entry };
		return {
			add: {
				kind: "story",
				story: story.name,
				snapshotHash: story.hash,
				...(story.stylesheetHash === null ? {} : { stylesheetHash: story.stylesheetHash }),
				...bindingOf(app),
				by,
				at: new Date().toISOString(),
				...(plan === null ? {} : { plan }),
			},
		};
	});
}

/**
 * Why an Approve of a mockup cannot bind what the person saw, or null when it
 * can: a mockup that composes components is approved only with the
 * `componentsHash` the page showed. Its components' stylesheets are inlined
 * into the document the person sees but are outside `mockupHash`, so without
 * it a stylesheet changed since the page was drawn would be approved unseen
 * (Build Phase 9, A34). A mockup that composes none approves on `mockupHash`
 * alone. The route asks this before it approves anything, so a group with one
 * such mockup is refused whole.
 */
export function componentsHashMissing(
	mockup: Pick<Mockup, "name" | "uses">,
	seen: Seen,
): string | null {
	if (seen.kind === "story" || mockup.uses.length === 0) return null;
	if (typeof seen.componentsHash === "string" && seen.componentsHash !== "") return null;
	return `${mockup.name} composes components and was sent without the componentsHash it was shown at — their stylesheets are outside mockupHash; open the mockup again and approve what it shows`;
}

/**
 * `componentsHashMissing` for every request of one Approve, read in
 * `checkout` before anything is approved: the first reason, or null. The
 * cockpit's route asks it so a group carrying one such mockup is refused whole
 * rather than half-recorded. An app name that is not one folder, or an app the
 * checkout cannot read, is null here: `approve` refuses it, naming why.
 */
export async function componentsHashesMissing(
	checkout: string,
	appName: string,
	requests: ReadonlyArray<{ name: string; seen: Seen }>,
): Promise<string | null> {
	if (!isUsableSegment(appName)) return null;
	const app = await readApp(checkout, appName).catch(() => null);
	if (!app) return null;
	for (const { name, seen } of requests) {
		const mockup = app.mockups.find((m) => m.name === name);
		const missing = mockup ? componentsHashMissing(mockup, seen) : null;
		if (missing) return missing;
	}
	return null;
}

/** Why a mockup is not what the person was shown, or null when it is. */
function mockupNotShown(
	checkout: string,
	mockup: Pick<Mockup, "name" | "hash" | "componentsHash">,
	seen: { mockupHash?: string; componentsHash?: string },
	act = "approve",
): string | null {
	const changed: Array<[string, string | undefined, string]> = [
		["", seen.mockupHash, mockup.hash],
		["'s components", seen.componentsHash, mockup.componentsHash],
	];
	for (const [what, shown, held] of changed) {
		if (shown !== undefined && shown !== held) {
			return `${mockup.name}${what} in ${checkout} is not what was shown (${short(shown)}, it has ${short(held)}) — open the mockup again and ${act} what it holds`;
		}
	}
	return null;
}

/** Why a story's snapshot is not the one the person was shown, or null when it is. */
function storyNotShown(
	checkout: string,
	story: Pick<Story, "name" | "hash">,
	shown: string,
	act = "approve",
): string | null {
	return shown === story.hash
		? null
		: `${story.name} in ${checkout} is not the snapshot shown (${short(shown)}, it has ${short(story.hash)}) — open the story again and ${act} what it holds`;
}

/**
 * Why a story's stylesheet is not the one the person was shown, or null when
 * it is: a component with a stylesheet is approved only with the sheet's hash
 * sent back, refused when absent or different, so a sheet is never approved
 * unseen; a component with none is approved with none sent.
 */
function sheetNotShown(
	checkout: string,
	story: Pick<Story, "name" | "component" | "stylesheetHash">,
	shown: string | undefined,
): string | null {
	const sent = shown === undefined || shown === "" ? null : shown;
	if (sent === story.stylesheetHash) return null;
	if (story.stylesheetHash === null) {
		return `${story.component} has no stylesheet in ${checkout}, but one was shown — open the story again and approve what it holds`;
	}
	if (sent === null) {
		return `a story is approved with the stylesheetHash it was shown at — ${story.component}.css is part of how ${story.name} draws`;
	}
	return `${story.component}.css in ${checkout} is not the stylesheet shown (${short(sent)}, it has ${short(story.stylesheetHash)}) — open the story again and approve what it holds`;
}

/** What the person was shown, sent back with Unapprove: the same hashes Approve binds. */
export interface SeenWithdrawal {
	foundationHash?: string;
	mockupHash?: string;
	componentsHash?: string;
	snapshotHash?: string;
}

export type WithdrawResult =
	| { withdrawn: true; entry: WithdrawnEntry; commit: NoteCommit }
	| { withdrawn: false; reason: string };

/**
 * Take an approval back (ADR decision 11): append a `withdrawn` entry for a
 * mockup or a story that is approved as `checkout` holds it now, and commit
 * only the record through the notes writer, as `approve` does. The record
 * keeps every entry it had; the subject reads proposed, with no reference,
 * until a person approves it again. Called by the cockpit's Unapprove with the
 * person who pressed it and the hashes the page showed, refused the way
 * Approve refuses them when the checkout now holds something else. A subject
 * that is not approved as it is — proposed, never approved, withdrawn already
 * — is refused: there is no approval in force to take back.
 */
export async function withdraw(
	checkout: string,
	appName: string,
	name: string,
	by: string,
	kind: "mockup" | "story",
	seen: SeenWithdrawal = {},
): Promise<WithdrawResult> {
	const refuse = (reason: string): WithdrawResult => ({ withdrawn: false, reason });
	const opened = await openApp(checkout, appName, by, {
		noOne: "taking an approval back needs who did it",
		act: "act on",
		foundationHash: seen.foundationHash,
	});
	if ("reason" in opened) return refuse(opened.reason);
	const { app } = opened;
	if (kind === "story") {
		const story = app.stories.find((s) => s.name === name);
		if (!story) return refuse(`${app.app} has no story ${JSON.stringify(name)} in ${checkout}`);
		if (typeof seen.snapshotHash !== "string" || seen.snapshotHash === "") {
			return refuse("a story is taken back with the snapshot hash it was shown at");
		}
		const stale = storyNotShown(checkout, story, seen.snapshotHash, "take back");
		if (stale) return refuse(stale);
		return takeBack({
			checkout,
			app,
			label: `story ${name}`,
			subject: "story",
			name,
			by,
			approved: (record) =>
				storyApprovalOf(app, story, standingOf(record).stories).state === "approved",
		});
	}
	const mockup = app.mockups.find((m) => m.name === name);
	if (!mockup) return refuse(`${app.app} has no mockup ${JSON.stringify(name)} in ${checkout}`);
	const stale = mockupNotShown(checkout, mockup, seen, "take back");
	if (stale) return refuse(stale);
	return takeBack({
		checkout,
		app,
		label: name,
		subject: "mockup",
		name,
		by,
		approved: (record) => {
			const standing = standingOf(record);
			return approvalOf(app, mockup, standing.mockups, [], standing.stories).state === "approved";
		},
	});
}

/** Append the Unapprove when `approved` says the record holds an approval in force; refuse when it does not. */
async function takeBack({
	checkout,
	app,
	label,
	subject,
	name,
	by,
	approved,
}: {
	checkout: string;
	app: LooksApp;
	label: string;
	subject: "mockup" | "story";
	name: string;
	by: string;
	approved: (record: unknown[]) => boolean;
}): Promise<WithdrawResult> {
	const done = await appendEntry<WithdrawnEntry>(
		checkout,
		app,
		`${label} withdrawn by ${by}`,
		(record) =>
			approved(record)
				? { add: { kind: "withdrawn", subject, name, by, at: new Date().toISOString() } }
				: { refuse: `${label} is not approved as it is, so there is no approval to take back` },
	);
	return "refused" in done
		? { withdrawn: false, reason: done.refused }
		: { withdrawn: true, entry: done.entry, commit: done.commit };
}

/** `appendEntry` for an approval: an entry already `held` is a success with nothing written; a refusal writes nothing. */
async function appended(
	checkout: string,
	app: LooksApp,
	subject: string,
	next: (
		record: unknown[],
	) =>
		| { held: ApprovalEntry | StoryApprovalEntry }
		| { add: ApprovalEntry | StoryApprovalEntry }
		| { refuse: string },
): Promise<ApproveResult> {
	const done = await appendEntry(checkout, app, subject, next);
	if ("refused" in done) return { approved: false, reason: done.refused };
	return { approved: true, entry: done.entry, commit: done.commit };
}

/**
 * Under the record's lock, ask `next` what the record as it is calls for: the
 * entry that already `held` it as it is, and nothing is written; an entry to
 * `add`, appended with only the record committed; or a `refuse`.
 */
async function appendEntry<E extends ApprovalEntry | StoryApprovalEntry | WithdrawnEntry>(
	checkout: string,
	app: LooksApp,
	subject: string,
	next: (record: unknown[]) => { held: E } | { add: E } | { refuse: string },
): Promise<{ entry: E; commit: NoteCommit } | { refused: string }> {
	const lock = `${currentMdPath(checkout)}.lock`;
	mkdirSync(dirname(lock), { recursive: true });
	return withLock(lock, () => {
		const record = readRecord(app);
		const decided = next(record);
		if ("refuse" in decided) return { refused: decided.refuse };
		if ("held" in decided) return { entry: decided.held, commit: { committed: true } };
		const entry = decided.add;
		const rel = approvalsPath(app.app);
		writeFileSync(
			join(checkout, rel),
			`${JSON.stringify({ approvals: [...record, entry] }, null, "\t")}\n`,
		);
		const commit = commitNote(
			checkout,
			[rel],
			`chore(indusk): looks — ${oneLine(`${app.app}/${subject}`)}`,
			{ anyBranch: true },
		);
		return { entry, commit };
	});
}

/**
 * Who an approval is recorded as: the person the project's git knows
 * (`user.name`), else the account the admin runs as. The admin is the
 * person's own daemon on their machine, so either is them.
 */
export async function approver(root: string): Promise<string> {
	try {
		const name = await git(root, "config", "user.name");
		if (name) return name;
	} catch {
		// no git identity configured
	}
	return userInfo().username;
}

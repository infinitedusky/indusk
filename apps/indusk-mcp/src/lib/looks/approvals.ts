import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { withLock } from "../agents/lock.js";
import { commitNote, currentMdPath, type NoteCommit, oneLine } from "../bookkeeping/notes.js";
import { git } from "../git.js";
import { isUsableSegment } from "../path-segment.js";
import type { ComponentUse } from "./compose.js";
import {
	componentsHashOf,
	type LooksApp,
	LooksAppError,
	MOCKUPS_DIR,
	type Mockup,
	readApp,
	type Story,
} from "./mockups.js";

/**
 * Approval (ui-promises ADR decision 3): a mockup is the reference only while
 * `approved.json` holds an entry bound to its current content hash, the
 * foundation's, and the declarations' the check trusts (devices, `ignore`,
 * `sources` — `LooksApp.declarationsHash`). Nothing else makes it approved —
 * an entry for another hash, or one that binds no declarations (every entry
 * written before Build Phase 6), reads proposed until a person approves it
 * again. An entry for another hash,
 * copied or hand-written, reads *proposed* by construction, and so does every
 * mockup once the foundation changes. A proposed mockup keeps its last
 * approved entry as the reference the app is held to meanwhile.
 *
 * A mockup composed of components (storybook-components ADR decision 5) is
 * bound by its composed hash and by `componentsHash`, the hash of the snapshot
 * hashes it composes: a changed component reopens exactly the mockups that use
 * it, naming it. A story is approved like a mockup, in the same record.
 *
 * `approve` is the cockpit's: the admin's Approve calls it with the person who
 * pressed it. The command line refuses (`indusk looks approve` exits 2) and
 * the guard hook refuses an agent's Write or Edit to the record.
 *
 * A person can take an approval back (storybook-components ADR decision 11):
 * `withdraw`, the cockpit's Unapprove, appends a `withdrawn` entry to the same
 * append-only record. A mockup or story reads proposed, holding no reference,
 * after its latest withdrawal until a person approves it again; an approval
 * earlier than a withdrawal never counts. Every reader of the record goes
 * through that view (`readApprovals`, `readStoryApprovals`, `standingOf`).
 *
 * promise: a-mockup-is-approved-by-a-person
 */

export const APPROVALS_FILE = "approved.json";

export interface ApprovalEntry {
	/** `home.empty` — the mockup's name. */
	mockup: string;
	/** sha256 of the mockup, composed, when it was approved (`Mockup.hash`). */
	mockupHash: string;
	/**
	 * `componentsHashOf` the snapshots it composed when it was approved. Absent
	 * on an entry from before composition, which binds no component: it is read
	 * as the hash of none, so it holds only a mockup that names none.
	 */
	componentsHash?: string;
	/**
	 * Each story it composed with that snapshot's hash, `badge.ok` → hash: what
	 * the status reads to name the component that changed. Explanation only —
	 * never read to decide whether the mockup is approved; `mockupHash` and
	 * `componentsHash` bind it.
	 */
	components?: Record<string, string>;
	/** sha256 of `foundation.tokens.json`'s bytes when it was approved. */
	foundationHash: string;
	/**
	 * The declarations the check trusts when it was approved
	 * (`LooksApp.declarationsHash`). Absent on an entry from before Build Phase
	 * 6, which then binds nothing it can be held to and reads proposed.
	 */
	declarationsHash?: string;
	/** Who approved it. */
	by: string;
	/** When, as an ISO date-time. */
	at: string;
}

export type Approval =
	| { state: "approved"; entry: ApprovalEntry }
	/**
	 * `reference` is the last entry for this mockup — the version the app is
	 * held to — or null when it never had one. `componentsChanged` names the
	 * components whose snapshots differ from the ones the reference bound,
	 * sorted; absent when none did.
	 */
	| {
			state: "proposed";
			reference: ApprovalEntry | null;
			componentsChanged?: string[];
			/** The Unapprove that ended the last approval, when no approval has followed it. */
			withdrawn?: WithdrawnEntry;
	  };

const FIELDS = ["mockup", "mockupHash", "foundationHash", "by", "at"] as const;

/**
 * A story's entry (storybook-components ADR decision 5): a story is approved
 * like a mockup, in the same record, bound to its snapshot's hash and to the
 * foundation and declarations as they were. `readApprovals` returns the
 * mockups' entries and `readStoryApprovals` these.
 *
 * promise: a-mockup-is-approved-by-a-person
 */
export interface StoryApprovalEntry {
	kind: "story";
	/** `badge.ok` — the snapshot's name. */
	story: string;
	/** sha256 of the snapshot's bytes when it was approved. */
	snapshotHash: string;
	/**
	 * sha256 of its component's stylesheet when it was approved (Build Phase 9,
	 * A31). Absent on an entry from before, which binds no sheet: it holds only
	 * a story whose component has none, so a story whose component has one
	 * reads proposed until a person approves it again.
	 */
	stylesheetHash?: string;
	foundationHash: string;
	declarationsHash?: string;
	by: string;
	at: string;
}

export type StoryApproval =
	| { state: "approved"; entry: StoryApprovalEntry }
	| { state: "proposed"; reference: StoryApprovalEntry | null; withdrawn?: WithdrawnEntry };

/**
 * A person's Unapprove (ADR decision 11): the record's entry that ends every
 * approval of `name` made before it. Append-only — nothing it ends is removed.
 */
export interface WithdrawnEntry {
	kind: "withdrawn";
	subject: "mockup" | "story";
	/** The mockup's name, or the story's (`badge.ok`). */
	name: string;
	/** Who took it back. */
	by: string;
	at: string;
}

function isWithdrawn(v: unknown): v is WithdrawnEntry {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		o.kind === "withdrawn" &&
		(o.subject === "mockup" || o.subject === "story") &&
		["name", "by", "at"].every((k) => typeof o[k] === "string")
	);
}

function isStoryEntry(v: unknown): v is StoryApprovalEntry {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		o.kind === "story" &&
		["story", "snapshotHash", "foundationHash", "by", "at"].every(
			(k) => typeof o[k] === "string",
		) &&
		["declarationsHash", "stylesheetHash"].every(
			(k) => o[k] === undefined || typeof o[k] === "string",
		)
	);
}

function isEntry(v: unknown): v is ApprovalEntry {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		o.kind === undefined &&
		FIELDS.every((k) => typeof o[k] === "string") &&
		["declarationsHash", "componentsHash"].every(
			(k) => o[k] === undefined || typeof o[k] === "string",
		) &&
		(o.components === undefined ||
			(typeof o.components === "object" &&
				o.components !== null &&
				Object.values(o.components).every((h) => typeof h === "string")))
	);
}

/** The components hash of a mockup that composes none: what an entry without one binds. */
const NO_COMPONENTS = componentsHashOf([]);

/** Whether an entry, a mockup's or a story's, was made on the foundation and the declarations as they are now. */
export const boundToNow = (
	app: LooksApp,
	e: Pick<ApprovalEntry, "foundationHash" | "declarationsHash">,
): boolean =>
	e.foundationHash === app.foundation.hash && e.declarationsHash === app.declarationsHash;

/** Where an app's record is, relative to the project root. */
export const approvalsPath = (app: string) => join(MOCKUPS_DIR, app, APPROVALS_FILE);

/**
 * The entries of an app's record, oldest first; none when it has no record. A
 * record that is not `{ approvals: ApprovalEntry[] }` is refused, never read
 * as empty — an unreadable record must not look like "nothing approved yet"
 * any more than like "everything approved".
 */
export function readApprovals(app: LooksApp): ApprovalEntry[] {
	return standingOf(readRecord(app)).mockups;
}

/** The story entries of an app's record, oldest first; refused like `readApprovals` when the record is not one. */
export function readStoryApprovals(app: LooksApp): StoryApprovalEntry[] {
	return standingOf(readRecord(app)).stories;
}

/** The latest Unapprove of each mockup and story the record holds; refused like `readApprovals`. */
export function readWithdrawals(app: LooksApp): WithdrawnEntry[] {
	return standingOf(readRecord(app)).withdrawn;
}

/**
 * The record as it stands (ADR decision 11): each approval that no later
 * Unapprove of the same mockup or story ended, oldest first, and the latest
 * Unapprove of each. Order is the record's own — append-only — never a clock.
 */
export function standingOf(record: readonly unknown[]): {
	mockups: ApprovalEntry[];
	stories: StoryApprovalEntry[];
	withdrawn: WithdrawnEntry[];
} {
	const latest = new Map<string, number>();
	const key = (subject: string, name: string) => `${subject}:${name}`;
	record.forEach((e, i) => {
		if (isWithdrawn(e)) latest.set(key(e.subject, e.name), i);
	});
	const stands = (subject: string, name: string, i: number) =>
		(latest.get(key(subject, name)) ?? -1) < i;
	return {
		mockups: record.filter(
			(e, i): e is ApprovalEntry => isEntry(e) && stands("mockup", e.mockup, i),
		),
		stories: record.filter(
			(e, i): e is StoryApprovalEntry => isStoryEntry(e) && stands("story", e.story, i),
		),
		withdrawn: [...latest.values()].map((i) => record[i] as WithdrawnEntry),
	};
}

/** Every entry of the record, mockups' and stories', validated; the writer keeps them all. */
function readRecord(app: LooksApp): unknown[] {
	const file = join(app.dir, APPROVALS_FILE);
	if (!existsSync(file)) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(file, "utf-8"));
	} catch (err) {
		throw new LooksAppError(`${file} is not valid JSON: ${(err as Error).message}`);
	}
	const list = (parsed as { approvals?: unknown } | null)?.approvals;
	if (!Array.isArray(list)) {
		throw new LooksAppError(`${file} has no "approvals" list`);
	}
	list.forEach((entry, i) => {
		if (!isEntry(entry) && !isStoryEntry(entry) && !isWithdrawn(entry)) {
			throw new LooksAppError(`${file}: approvals[${i}] is not { ${FIELDS.join(", ")} }`);
		}
	});
	return list;
}

/**
 * Whether `mockup` is approved as it is now — composed as it is now, of the
 * snapshots it composes now, each of them a story approved as it is now — on
 * the foundation and the declarations as they are now. A proposed mockup whose
 * reference bound other snapshots, or that composes a story no longer approved
 * (changed, or taken back by a person), names those components. `approvals`
 * is the record as it stands (`readApprovals` / `standingOf`): an approval a
 * later Unapprove ended is not in it, so the mockup holds no reference;
 * `withdrawals` only says who took it back. `stories` is the story approvals
 * as they stand, read from the record when not given: the lint refuses a
 * mockup composing an unapproved story (`no approved story`), and every other
 * reader agrees with it through here (Build Phase 9, A32).
 */
export function approvalOf(
	app: LooksApp,
	mockup: Pick<Mockup, "name" | "hash" | "componentsHash" | "uses" | "styles">,
	approvals: readonly ApprovalEntry[],
	withdrawals: readonly WithdrawnEntry[] = [],
	stories: readonly StoryApprovalEntry[] = readStoryApprovals(app),
): Approval {
	const mine = approvals.filter((e) => e.mockup === mockup.name);
	const current = mine.filter(
		(e) =>
			e.mockupHash === mockup.hash &&
			(e.componentsHash ?? NO_COMPONENTS) === mockup.componentsHash &&
			boundToNow(app, e),
	);
	const unapproved = [...new Set(unapprovedUses(app, mockup, stories).map((u) => u.name))];
	if (current.length > 0 && unapproved.length === 0) {
		return { state: "approved", entry: current[current.length - 1] };
	}
	const reference = current[current.length - 1] ?? mine[mine.length - 1] ?? null;
	const changed = [
		...new Set([...(reference ? componentsChanged(mockup, reference) : []), ...unapproved]),
	].sort();
	const withdrawn = reference
		? undefined
		: withdrawals.find((w) => w.subject === "mockup" && w.name === mockup.name);
	return {
		state: "proposed",
		reference,
		...(changed.length > 0 ? { componentsChanged: changed } : {}),
		...(withdrawn ? { withdrawn } : {}),
	};
}

/**
 * The components whose snapshots differ from the ones `reference` bound:
 * from its `components` record when it has one; when it has none (a record
 * written by hand or by a script) every component the mockup composes, since
 * which one changed cannot be told. None when its `componentsHash` holds.
 */
function componentsChanged(
	mockup: Pick<Mockup, "componentsHash" | "uses" | "styles">,
	reference: ApprovalEntry,
): string[] {
	if ((reference.componentsHash ?? NO_COMPONENTS) === mockup.componentsHash) return [];
	const bound = reference.components;
	const names = new Set<string>();
	const now = new Map(mockup.uses.map((u) => [u.story, u] as const));
	for (const u of now.values()) {
		if (!bound || bound[u.story] !== u.snapshotHash) names.add(u.name);
	}
	// A stylesheet is held in the record under `<component>.css`, beside the snapshots.
	for (const s of mockup.styles) {
		if (!bound || bound[s.key] !== s.hash) names.add(s.component);
	}
	const sheets = new Set(mockup.styles.map((s) => s.key));
	for (const key of Object.keys(bound ?? {})) {
		if (!now.has(key) && !sheets.has(key)) names.add(key.slice(0, key.indexOf(".")));
	}
	return [...names].sort();
}

/**
 * Whether a story is approved as it draws now — its snapshot and its
 * component's stylesheet as they are — on the foundation and the declarations
 * as they are now. A snapshot re-rendered from a changed component, or a
 * stylesheet changed under unchanged markup, reads proposed until a person
 * approves it again.
 */
export function storyApprovalOf(
	app: LooksApp,
	story: Pick<Story, "name" | "hash" | "stylesheetHash">,
	approvals: readonly StoryApprovalEntry[],
	withdrawals: readonly WithdrawnEntry[] = [],
): StoryApproval {
	const mine = approvals.filter((e) => e.story === story.name);
	const current = mine.filter(
		(e) =>
			e.snapshotHash === story.hash &&
			(e.stylesheetHash ?? null) === story.stylesheetHash &&
			boundToNow(app, e),
	);
	if (current.length > 0) return { state: "approved", entry: current[current.length - 1] };
	const reference = mine[mine.length - 1] ?? null;
	const withdrawn = reference
		? undefined
		: withdrawals.find((w) => w.subject === "story" && w.name === story.name);
	return { state: "proposed", reference, ...(withdrawn ? { withdrawn } : {}) };
}

/**
 * The components a mockup names that have no approved snapshot: no snapshot
 * at all, or one no person has approved as it is now. A mockup is composed of
 * approved components only, so each of these is refused by the lint (`no
 * approved story`) and blocks the mockup's approval.
 */
export function unapprovedUses(
	app: LooksApp,
	mockup: Pick<Mockup, "uses">,
	approvals: readonly StoryApprovalEntry[],
): ComponentUse[] {
	if (mockup.uses.length === 0) return [];
	const sheetOf = new Map(app.styles.map((s) => [s.component, s.hash] as const));
	return mockup.uses.filter(
		(u) =>
			u.snapshotHash === null ||
			storyApprovalOf(
				app,
				{ name: u.story, hash: u.snapshotHash, stylesheetHash: sheetOf.get(u.name) ?? null },
				approvals,
			).state !== "approved",
	);
}

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

const short = (hash: string) => hash.slice(0, 8);

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
	if (!isUsableSegment(appName)) {
		return { approved: false, reason: `${JSON.stringify(appName)} is not an app name` };
	}
	if (by.trim() === "") return { approved: false, reason: "an approval needs who gave it" };
	let app: LooksApp;
	try {
		app = await readApp(checkout, appName);
	} catch (err) {
		return { approved: false, reason: `${(err as Error).message} (read in ${checkout})` };
	}
	if (seen.foundationHash !== undefined && seen.foundationHash !== app.foundation.hash) {
		return {
			approved: false,
			reason: `the foundation in ${checkout} is not the one shown (${short(seen.foundationHash)}, it has ${short(app.foundation.hash)}) — open it again and approve what it holds`,
		};
	}
	return seen.kind === "story"
		? approveStory(checkout, app, name, by, seen)
		: approveMockup(checkout, app, name, by, seen);
}

async function approveMockup(
	checkout: string,
	app: LooksApp,
	mockupName: string,
	by: string,
	seen: Exclude<Seen, { kind: "story" }>,
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
				foundationHash: app.foundation.hash,
				declarationsHash: app.declarationsHash,
				by,
				at: new Date().toISOString(),
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
				foundationHash: app.foundation.hash,
				declarationsHash: app.declarationsHash,
				by,
				at: new Date().toISOString(),
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
	if (!isUsableSegment(appName)) return refuse(`${JSON.stringify(appName)} is not an app name`);
	if (by.trim() === "") return refuse("taking an approval back needs who did it");
	let app: LooksApp;
	try {
		app = await readApp(checkout, appName);
	} catch (err) {
		return refuse(`${(err as Error).message} (read in ${checkout})`);
	}
	if (seen.foundationHash !== undefined && seen.foundationHash !== app.foundation.hash) {
		return refuse(
			`the foundation in ${checkout} is not the one shown (${short(seen.foundationHash)}, it has ${short(app.foundation.hash)}) — open it again and act on what it holds`,
		);
	}
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

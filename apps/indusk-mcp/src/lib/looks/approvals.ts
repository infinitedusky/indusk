import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { withLock } from "../agents/lock.js";
import { commitNote, currentMdPath, type NoteCommit, oneLine } from "../bookkeeping/notes.js";
import { git } from "../git.js";
import { isUsableSegment } from "../path-segment.js";
import type { ComponentUse } from "./compose.js";
import {
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
 * `approve` is the cockpit's: the admin's Approve calls it with the person who
 * pressed it. The command line refuses (`indusk looks approve` exits 2) and
 * the guard hook refuses an agent's Write or Edit to the record.
 *
 * promise: a-mockup-is-approved-by-a-person
 */

export const APPROVALS_FILE = "approved.json";

export interface ApprovalEntry {
	/** `home.empty` — the mockup's name. */
	mockup: string;
	/** sha256 of the mockup's bytes when it was approved. */
	mockupHash: string;
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
	/** `reference` is the last entry for this mockup — the version the app is held to — or null when it never had one. */
	| { state: "proposed"; reference: ApprovalEntry | null };

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
	foundationHash: string;
	declarationsHash?: string;
	by: string;
	at: string;
}

export type StoryApproval =
	| { state: "approved"; entry: StoryApprovalEntry }
	| { state: "proposed"; reference: StoryApprovalEntry | null };

function isStoryEntry(v: unknown): v is StoryApprovalEntry {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		o.kind === "story" &&
		["story", "snapshotHash", "foundationHash", "by", "at"].every(
			(k) => typeof o[k] === "string",
		) &&
		(o.declarationsHash === undefined || typeof o.declarationsHash === "string")
	);
}

function isEntry(v: unknown): v is ApprovalEntry {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		FIELDS.every((k) => typeof o[k] === "string") &&
		(o.declarationsHash === undefined || typeof o.declarationsHash === "string")
	);
}

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
	return readRecord(app).filter(isEntry);
}

/** The story entries of an app's record, oldest first; refused like `readApprovals` when the record is not one. */
export function readStoryApprovals(app: LooksApp): StoryApprovalEntry[] {
	return readRecord(app).filter(isStoryEntry);
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
		if (!isEntry(entry) && !isStoryEntry(entry)) {
			throw new LooksAppError(`${file}: approvals[${i}] is not { ${FIELDS.join(", ")} }`);
		}
	});
	return list;
}

/** Whether `mockup` is approved as it is now, on the foundation and the declarations as they are now. */
export function approvalOf(
	app: LooksApp,
	mockup: Mockup,
	approvals: readonly ApprovalEntry[],
): Approval {
	const mine = approvals.filter((e) => e.mockup === mockup.name);
	const current = mine.filter((e) => e.mockupHash === mockup.hash && boundToNow(app, e));
	if (current.length > 0) return { state: "approved", entry: current[current.length - 1] };
	return { state: "proposed", reference: mine[mine.length - 1] ?? null };
}

/**
 * Whether a story is approved as its snapshot is now, on the foundation and
 * the declarations as they are now. A snapshot re-rendered from a changed
 * component reads proposed until a person approves it again.
 */
export function storyApprovalOf(
	app: LooksApp,
	story: Pick<Story, "name" | "hash">,
	approvals: readonly StoryApprovalEntry[],
): StoryApproval {
	const mine = approvals.filter((e) => e.story === story.name);
	const current = mine.filter((e) => e.snapshotHash === story.hash && boundToNow(app, e));
	if (current.length > 0) return { state: "approved", entry: current[current.length - 1] };
	return { state: "proposed", reference: mine[mine.length - 1] ?? null };
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
	return mockup.uses.filter(
		(u) =>
			u.snapshotHash === null ||
			storyApprovalOf(app, { name: u.story, hash: u.snapshotHash }, approvals).state !== "approved",
	);
}

export type ApproveResult =
	| { approved: true; entry: ApprovalEntry; commit: NoteCommit }
	| { approved: false; reason: string };

/**
 * Approve `mockupName` as it is in `checkout` now: append an entry bound to
 * its hash and the foundation's, and commit the record on the branch that
 * checkout is on, through the notes writer (`commitNote`) — only that file. An
 * approval belongs to the work it judges: a plan's worktree approves on the
 * plan's branch and the record merges with the mockups, never through `main`.
 * A mockup already approved as it is gets no second entry. Called by the
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
 * the request lands (ui-promises Build Phase 6, A30).
 */
export async function approve(
	checkout: string,
	appName: string,
	mockupName: string,
	by: string,
	seen: { foundationHash?: string; mockupHash?: string } = {},
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
	const mockup = app.mockups.find((m) => m.name === mockupName);
	if (!mockup) {
		return {
			approved: false,
			reason: `${appName} has no mockup ${JSON.stringify(mockupName)} in ${checkout} — a mockup is approved as its checkout holds it`,
		};
	}
	if (seen.mockupHash !== undefined && seen.mockupHash !== mockup.hash) {
		return {
			approved: false,
			reason: `${mockupName} in ${checkout} is not the one shown (${seen.mockupHash.slice(0, 8)}, it has ${mockup.hash.slice(0, 8)}) — open the mockup again and approve what it holds`,
		};
	}
	if (seen.foundationHash !== undefined && seen.foundationHash !== app.foundation.hash) {
		return {
			approved: false,
			reason: `the foundation in ${checkout} is not the one shown (${seen.foundationHash.slice(0, 8)}, it has ${app.foundation.hash.slice(0, 8)}) — open the mockup again and approve what it holds`,
		};
	}
	const lock = `${currentMdPath(checkout)}.lock`;
	mkdirSync(dirname(lock), { recursive: true });
	return withLock(lock, () => {
		const record = readRecord(app);
		const approvals = record.filter(isEntry);
		const now = approvalOf(app, mockup, approvals);
		if (now.state === "approved") {
			return { approved: true, entry: now.entry, commit: { committed: true } };
		}
		const entry: ApprovalEntry = {
			mockup: mockup.name,
			mockupHash: mockup.hash,
			foundationHash: app.foundation.hash,
			declarationsHash: app.declarationsHash,
			by,
			at: new Date().toISOString(),
		};
		const rel = approvalsPath(appName);
		writeFileSync(
			join(checkout, rel),
			`${JSON.stringify({ approvals: [...record, entry] }, null, "\t")}\n`,
		);
		const commit = commitNote(
			checkout,
			[rel],
			`chore(indusk): looks — ${oneLine(`${appName}/${mockup.name} approved by ${by}`)}`,
			{ anyBranch: true },
		);
		return { approved: true, entry, commit };
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

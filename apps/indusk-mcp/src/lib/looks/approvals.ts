import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { withLock } from "../agents/lock.js";
import { commitNote, currentMdPath, type NoteCommit, oneLine } from "../bookkeeping/notes.js";
import { bookkeepingRoots } from "../bookkeeping/roots.js";
import { isUsableSegment } from "../path-segment.js";
import { type LooksApp, LooksAppError, MOCKUPS_DIR, type Mockup, readApp } from "./mockups.js";

/**
 * Approval (ui-promises ADR decision 3): a mockup is the reference only while
 * `approved.json` holds an entry bound to its current content hash and the
 * foundation's. Nothing else makes it approved — an entry for another hash,
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

function isEntry(v: unknown): v is ApprovalEntry {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	return FIELDS.every((k) => typeof o[k] === "string");
}

/** Where an app's record is, relative to the project root. */
export const approvalsPath = (app: string) => join(MOCKUPS_DIR, app, APPROVALS_FILE);

/**
 * The entries of an app's record, oldest first; none when it has no record. A
 * record that is not `{ approvals: ApprovalEntry[] }` is refused, never read
 * as empty — an unreadable record must not look like "nothing approved yet"
 * any more than like "everything approved".
 */
export function readApprovals(app: LooksApp): ApprovalEntry[] {
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
		if (!isEntry(entry)) {
			throw new LooksAppError(`${file}: approvals[${i}] is not { ${FIELDS.join(", ")} }`);
		}
	});
	return list;
}

/** Whether `mockup` is approved as it is now, on the foundation as it is now. */
export function approvalOf(
	app: LooksApp,
	mockup: Mockup,
	approvals: readonly ApprovalEntry[],
): Approval {
	const mine = approvals.filter((e) => e.mockup === mockup.name);
	const current = mine.filter(
		(e) => e.mockupHash === mockup.hash && e.foundationHash === app.foundation.hash,
	);
	if (current.length > 0) return { state: "approved", entry: current[current.length - 1] };
	return { state: "proposed", reference: mine[mine.length - 1] ?? null };
}

export type ApproveResult =
	| { approved: true; entry: ApprovalEntry; commit: NoteCommit }
	| { approved: false; reason: string };

/**
 * Approve `mockupName` as it is in the main checkout now: append an entry
 * bound to its hash and the foundation's, and commit the record on `main`
 * through the notes writer (`commitNote`) — only that file. A mockup already
 * approved as it is gets no second entry. Called by the cockpit's Approve
 * with the person who pressed it; nothing else in the package calls it.
 */
export async function approve(
	anyCheckout: string,
	appName: string,
	mockupName: string,
	by: string,
): Promise<ApproveResult> {
	if (!isUsableSegment(appName)) {
		return { approved: false, reason: `${JSON.stringify(appName)} is not an app name` };
	}
	if (by.trim() === "") return { approved: false, reason: "an approval needs who gave it" };
	const { trunk } = bookkeepingRoots(anyCheckout);
	const app = await readApp(trunk, appName);
	const mockup = app.mockups.find((m) => m.name === mockupName);
	if (!mockup) {
		return { approved: false, reason: `${appName} has no mockup ${JSON.stringify(mockupName)}` };
	}
	const lock = `${currentMdPath(anyCheckout)}.lock`;
	mkdirSync(dirname(lock), { recursive: true });
	return withLock(lock, () => {
		const approvals = readApprovals(app);
		const now = approvalOf(app, mockup, approvals);
		if (now.state === "approved") {
			return { approved: true, entry: now.entry, commit: { committed: true } };
		}
		const entry: ApprovalEntry = {
			mockup: mockup.name,
			mockupHash: mockup.hash,
			foundationHash: app.foundation.hash,
			by,
			at: new Date().toISOString(),
		};
		const rel = approvalsPath(appName);
		writeFileSync(
			join(trunk, rel),
			`${JSON.stringify({ approvals: [...approvals, entry] }, null, "\t")}\n`,
		);
		const commit = commitNote(
			trunk,
			[rel],
			`chore(indusk): looks — ${oneLine(`${appName}/${mockup.name} approved by ${by}`)}`,
		);
		return { approved: true, entry, commit };
	});
}

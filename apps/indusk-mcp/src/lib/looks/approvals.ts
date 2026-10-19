import { join } from "node:path";
import type { ComponentUse } from "./compose.js";
import {
	componentsHashOf,
	type LooksApp,
	LooksAppError,
	MOCKUPS_DIR,
	type Mockup,
	readJsonSync,
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
 * `approve` is the cockpit's, and lives in `approve.ts` with `withdraw`, the
 * write side; this module is the record and every reading of it. The command
 * line refuses (`indusk looks approve` exits 2) and the guard hook refuses an
 * agent's Write or Edit to the record.
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
	/**
	 * The app's element rules it was drawn under (`LooksApp.baseRulesHash`).
	 * Absent on an entry from before it was kept, which binds nothing of them
	 * and is read as before — absence is a rule, not a migration.
	 */
	baseRulesHash?: string;
	/** Who approved it. */
	by: string;
	/** When, as an ISO date-time. */
	at: string;
	/**
	 * The plan whose checkout the approval was made in (brief-as-the-contract
	 * ADR decision 3): `plan/<name>`'s `<name>`. Absent on an entry made in the
	 * project's own checkout or before ownership, which no plan owns.
	 */
	plan?: string;
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
	/** The app's element rules it was drawn under; see `ApprovalEntry.baseRulesHash`. */
	baseRulesHash?: string;
	by: string;
	at: string;
	/** The plan whose checkout the approval was made in; see `ApprovalEntry.plan`. */
	plan?: string;
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
		["declarationsHash", "stylesheetHash", "baseRulesHash", "plan"].every(
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
		["declarationsHash", "componentsHash", "baseRulesHash", "plan"].every(
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

/**
 * What an approval is bound to, as the app has it now: the foundation, the
 * declarations the check trusts and, once the catalog keeps them, the element
 * rules the look is drawn under. The writer (`approve.ts`) spreads this into an
 * entry and `boundToNow` reads it back, so a new binding is one edit on each
 * side. The cockpit sends none of it — it draws what the checkout holds — so
 * the writer reads it from the app under the record's lock.
 */
export const bindingOf = (
	app: LooksApp,
): Pick<ApprovalEntry, "foundationHash" | "declarationsHash" | "baseRulesHash"> => ({
	foundationHash: app.foundation.hash,
	declarationsHash: app.declarationsHash,
	...(app.baseRulesHash === undefined ? {} : { baseRulesHash: app.baseRulesHash }),
});

/**
 * Whether an entry, a mockup's or a story's, was made on the foundation, the
 * declarations and the element rules as they are now. An entry that recorded no
 * element rules binds none and holds, as before the field existed — absence is
 * a rule, not a migration.
 */
export const boundToNow = (
	app: LooksApp,
	e: Pick<ApprovalEntry, "foundationHash" | "declarationsHash" | "baseRulesHash">,
): boolean =>
	e.foundationHash === app.foundation.hash &&
	e.declarationsHash === app.declarationsHash &&
	(e.baseRulesHash === undefined || e.baseRulesHash === app.baseRulesHash);

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
export function readRecord(app: LooksApp): unknown[] {
	const file = join(app.dir, APPROVALS_FILE);
	const parsed = readJsonSync<unknown>(file, { approvals: [] });
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
 *
 * promise: a-changed-component-reopens-its-mockups
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

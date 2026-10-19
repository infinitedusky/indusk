import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import matter from "gray-matter";
import { fileAtRevision, git } from "../git.js";
import { type ParsedBrief, parseBriefContract, sameSentence } from "../promises/brief-contract.js";
import {
	contractDir,
	firstParagraph,
	parseFrontmatter,
	readPromises,
} from "../promises/registry.js";
import { briefStandingOf } from "./approved-brief.js";

/**
 * An amendment is the brief's difference from what was approved
 * (brief-as-the-contract ADR decision 5): an expectation, a promise or a look
 * the brief says now that it did not say at approval, or says differently, and
 * a promise the plan owns whose statement in the registry has moved from the
 * one approved to one the approved brief did not state. The test plan, the
 * ADR, the impl, notes and Shape findings are never compared: the person
 * approved the brief, and the rest is the agent's to change. The scope is the brief's
 * `### Not promised` list: moving something out of it widens what the plan promises.
 *
 * What was approved is read from git, at the approval commit — the commit
 * `plans approve` (`plan(<plan>): impl approved`, or `plan(<plan>): approved`
 * in a workbench) or `plans reapprove` (`plan(<plan>): amendment approved`)
 * made last — and held to the hash the impl records (`approved_brief`). An
 * impl with no `approved_brief` was approved before the field existed and has
 * no amendments: absence is a rule, not a migration.
 *
 * promise: a-change-to-what-was-agreed-needs-the-person
 */

export type AmendmentPart = "expectation" | "promise" | "look" | "scope";

export interface Amendment {
	part: AmendmentPart;
	/** The promise's or the look's name; an expectation's place in the brief (`expectation 1`). */
	name: string;
	/** What the brief (or the registry) said at approval; null when it said nothing of it. */
	was: string | null;
	/** What it says now; null when it no longer says it. */
	now: string | null;
}

/** What a person agreed to: the brief's text and the registry's statement of each promise the plan owns. */
export interface Agreed {
	brief: string;
	/** Statement by promise name, for each promise the plan owned. */
	statements: ReadonlyMap<string, string>;
}

/** What was approved cannot be read, so whether anything changed cannot be told: never read as "nothing". */
export class AmendmentsUnreadable extends Error {}

/** Every subject the approval commit can carry, `plans approve`'s and `plans reapprove`'s. */
export const approvalSubjects = (plan: string): string[] => [
	`plan(${plan}): impl approved`,
	`plan(${plan}): approved`,
	`plan(${plan}): amendment approved`,
];

/** The subject `plans reapprove` commits under. */
export const reapprovalSubject = (plan: string): string => `plan(${plan}): amendment approved`;

/**
 * The amendments between what was approved and what stands now. Pure: both
 * sides are handed in. Each difference is listed once, even when the brief
 * and the registry both carry it.
 */
export function amendmentsBetween(approved: Agreed, now: Agreed): Amendment[] {
	const was = parseBriefContract(approved.brief);
	const is = parseBriefContract(now.brief);
	const found = [
		...differences("expectation", expectationsOf(was), expectationsOf(is)),
		...differences("promise", promisesOf(was), promisesOf(is)),
		...differences("look", looksOf(was), looksOf(is)),
		...differences("scope", scopeOf(was), scopeOf(is)),
		...statementChanges(was, approved.statements, now.statements),
	];
	const seen = new Set<string>();
	return found.filter((a) => {
		const key = [a.part, a.name, flat(a.was), flat(a.now)].join("\0");
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * The amendments waiting in the plan folder `planDir`
 * (`<root>/.indusk/planning/<plan>`): none when its impl records no approved
 * brief; otherwise what was approved, read from the approval commit, against
 * the brief and the registry as they stand. Throws `AmendmentsUnreadable` when
 * the approval cannot be found or is not the brief the impl recorded.
 */
export async function amendmentsOf(folder: string): Promise<Amendment[]> {
	if (!existsSync(folder)) return [];
	// git names its top by the real path (/private/var on macOS): read every
	// path the same way, or relative() leaves the repository.
	const planDir = realpathSync(folder);
	const implFile = join(planDir, "impl.md");
	const briefFile = join(planDir, "brief.md");
	if (!existsSync(implFile)) return [];
	const recorded = matter(readFileSync(implFile, "utf-8")).data.approved_brief;
	if (typeof recorded !== "string" || recorded === "") return [];
	if (!existsSync(briefFile)) {
		throw new AmendmentsUnreadable(`${planDir} records an approved brief and has no brief.md`);
	}
	const plan = basename(planDir);
	const archived = basename(dirname(planDir)) === "archive";
	const root = resolve(planDir, "..", "..", "..", ...(archived ? [".."] : []));
	const top = await git(planDir, "rev-parse", "--show-toplevel").catch((err: Error) => {
		throw new AmendmentsUnreadable(`${planDir} is not in a git checkout: ${err.message.trim()}`);
	});
	const sha = await approvalCommit(top, plan);
	// promise: a-plan-is-found-in-the-archive — a plan archived after its
	// approval had its brief at `.indusk/planning/<plan>/brief.md` then.
	const unarchived = join(dirname(dirname(planDir)), plan, "brief.md");
	const approvedBrief = await fileAtRevision(top, sha, relative(top, briefFile))
		.catch((err: Error) =>
			archived ? fileAtRevision(top, sha, relative(top, unarchived)) : Promise.reject(err),
		)
		.catch((err: Error) => {
			throw new AmendmentsUnreadable(
				`the brief at ${plan}'s approval commit ${sha.slice(0, 8)} cannot be read: ${err.message.trim()}`,
			);
		});
	if (sha256(approvedBrief) !== recorded) {
		throw new AmendmentsUnreadable(
			`${plan}'s impl records approved_brief ${recorded.slice(0, 8)}, and the brief at its approval commit ${sha.slice(0, 8)} is another — what was approved cannot be told`,
		);
	}
	const briefNow = readFileSync(briefFile, "utf-8");
	const names = ownedOrNamed(root, plan, [approvedBrief, briefNow]);
	const dir = contractDir(root, plan);
	const dirRel = relative(top, dir);
	// A contract in another repository (a workbench's code repo) has no copy at
	// this commit; the brief's own sentences still carry each promise.
	const inRepo = !dirRel.startsWith("..");
	const atApproval = (file: string) =>
		fileAtRevision(top, sha, join(dirRel, file)).catch(() => null);
	const onDisk = async (file: string) =>
		existsSync(join(dir, file)) ? readFileSync(join(dir, file), "utf-8") : null;
	return amendmentsBetween(
		{
			brief: approvedBrief,
			statements: inRepo ? await statementsFrom(names, plan, atApproval) : new Map(),
		},
		{ brief: briefNow, statements: inRepo ? await statementsFrom(names, plan, onDisk) : new Map() },
	);
}

/**
 * The amendments waiting in `planDir` for the nav and the plan page to count
 * (plan-stories, ADR decision 5): none unless the brief no longer matches its
 * approval hash, so a plan that never changed costs no git read. An approval
 * that cannot be read counts as none, as the plan page reads it.
 */
export async function amendmentsWaiting(planDir: string): Promise<Amendment[]> {
	if (briefStandingOf(planDir).state !== "changed") return [];
	try {
		return await amendmentsOf(planDir);
	} catch (err) {
		if (err instanceof AmendmentsUnreadable) return [];
		throw err;
	}
}

/** How a history line names an approved amendment: `amendment to the <part> <name>: was <json>, now <json>`. */
export function amendmentDecision(a: Amendment): string {
	return `amendment to the ${a.part} ${a.name}: was ${JSON.stringify(a.was)}, now ${JSON.stringify(a.now)}`;
}

const DECISION =
	/^amendment to the (expectation|promise|look|scope) (.+?): was (null|"(?:[^"\\]|\\.)*"), now (null|"(?:[^"\\]|\\.)*")$/;

/** The amendment a history line's decision names, or null when it names none. */
export function amendmentOfDecision(decision: string): Amendment | null {
	const m = DECISION.exec(decision);
	if (!m) return null;
	try {
		return {
			part: m[1] as AmendmentPart,
			name: m[2] ?? "",
			was: JSON.parse(m[3] ?? "null"),
			now: JSON.parse(m[4] ?? "null"),
		};
	} catch {
		return null;
	}
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const flat = (s: string | null) => (s === null ? "\u0001" : s.replace(/\s+/g, " ").trim());

/** The newest commit on HEAD whose subject is one an approval writes. */
async function approvalCommit(top: string, plan: string): Promise<string> {
	const subjects = approvalSubjects(plan);
	const log = await git(
		top,
		"log",
		"--format=%H%x09%s",
		"--fixed-strings",
		...subjects.map((s) => `--grep=${s}`),
		"HEAD",
	).catch(() => "");
	for (const line of log.split("\n")) {
		const [sha, ...rest] = line.split("\t");
		const subject = rest.join("\t");
		if (sha && subjects.some((s) => subject.startsWith(s))) return sha;
	}
	throw new AmendmentsUnreadable(
		`${plan}'s impl records an approved brief, and no commit on this branch is its approval (a subject starting "plan(${plan}): impl approved" or "plan(${plan}): amendment approved")`,
	);
}

/** The promises whose statements are compared: those the plan owns now, and those either brief makes or changes. */
function ownedOrNamed(root: string, plan: string, briefs: string[]): string[] {
	const names = new Set<string>();
	for (const text of briefs) {
		const b = parseBriefContract(text);
		if (b.shape !== "contract") continue;
		for (const m of b.makes) names.add(m.name);
		for (const c of b.changes) names.add(c.name);
	}
	const read = readPromises(root);
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	for (const p of registry?.promises ?? []) if (p.owner === plan) names.add(p.name);
	return [...names].sort();
}

/** A promise file's owner and statement, or null when it is not one. */
function promiseIn(raw: string): { owner: unknown; statement: string } | null {
	const parsed = parseFrontmatter(raw);
	if ("error" in parsed) return null;
	return { owner: parsed.data.owner, statement: firstParagraph(parsed.content) };
}

/**
 * The statement of each promise in `names` the plan owns, each file's text
 * handed by `read` (null when there is none): the same reading at the
 * approval commit and on disk.
 */
async function statementsFrom(
	names: string[],
	plan: string,
	read: (file: string) => Promise<string | null>,
): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	for (const name of names) {
		const raw = await read(`${name}.md`);
		const p = raw === null ? null : promiseIn(raw);
		if (p && p.owner === plan) out.set(name, p.statement);
	}
	return out;
}

/** Keyed descriptions of what a brief says of one part; two briefs differ where a key's text does. */
type Said = Map<string, string>;

function add(said: Said, key: string, text: string): void {
	const before = said.get(key);
	said.set(key, before === undefined ? text : `${before}; ${text}`);
}

function expectationsOf(b: ParsedBrief): Said {
	const said: Said = new Map();
	if (b.shape !== "contract") return said;
	b.expectations.forEach((e, i) => {
		const parts = [e.text];
		if (e.measure) parts.push(`Measure: ${e.measure}`);
		if (e.look) parts.push(`Look: ${e.look}`);
		said.set(`expectation ${i + 1}`, parts.join(" — "));
	});
	if (b.noExpectations !== null) said.set("(none)", `None — ${b.noExpectations}`);
	return said;
}

function promisesOf(b: ParsedBrief): Said {
	const said: Said = new Map();
	if (b.shape !== "contract") return said;
	for (const m of b.makes) add(said, m.name, m.sentence);
	for (const c of b.changes) add(said, c.name, `changes it to: ${c.sentence}`);
	for (const n of b.mustNotBreak) add(said, n, "must not break");
	for (const r of b.replaces) add(said, r.old, `replaced by ${r.by}`);
	return said;
}

function looksOf(b: ParsedBrief): Said {
	const said: Said = new Map();
	if (b.shape !== "contract" || b.looks === null) return said;
	const { looks } = b;
	for (const m of looks.makes) add(said, m.name, m.sentence);
	for (const c of looks.changes) add(said, c.name, `changes it: ${c.sentence}`);
	for (const n of looks.mustNotBreak) add(said, n, "must not break");
	for (const r of looks.replaces) add(said, r.old, `replaced by ${r.by}`);
	if (looks.none !== null) said.set("(none)", `None — ${looks.none}`);
	return said;
}

/** The Not promised list, one entry per line of it: the scope the person approved by what it leaves out. */
function scopeOf(b: ParsedBrief): Said {
	const said: Said = new Map();
	if (b.shape !== "contract") return said;
	for (const entry of b.notPromised) said.set(entry, entry);
	return said;
}

function differences(part: AmendmentPart, was: Said, now: Said): Amendment[] {
	const out: Amendment[] = [];
	for (const name of new Set([...was.keys(), ...now.keys()])) {
		const a = was.get(name) ?? null;
		const b = now.get(name) ?? null;
		if (a !== null && b !== null && sameSentence(a, b)) continue;
		out.push({ part, name, was: a, now: b });
	}
	return out;
}

/**
 * A promise the plan owns whose registry statement moved since approval, to
 * a sentence the approved brief did not state for it. A statement brought to
 * what the brief already said (`promises change` doing what the brief's
 * Changes promised) is the build keeping the contract, not changing it.
 */
function statementChanges(
	approvedBrief: ParsedBrief,
	was: ReadonlyMap<string, string>,
	now: ReadonlyMap<string, string>,
): Amendment[] {
	const stated = new Map<string, string>();
	if (approvedBrief.shape === "contract") {
		for (const m of approvedBrief.makes) stated.set(m.name, m.sentence);
		for (const c of approvedBrief.changes) stated.set(c.name, c.sentence);
	}
	const out: Amendment[] = [];
	for (const name of new Set([...was.keys(), ...now.keys()])) {
		const a = was.get(name) ?? null;
		const b = now.get(name) ?? null;
		if (a !== null && b !== null && sameSentence(a, b)) continue;
		const promised = stated.get(name);
		if (b !== null && promised !== undefined && sameSentence(b, promised)) continue;
		if (b === null) continue; // no longer owned: a replacement or a hand-over, not a new sentence
		out.push({ part: "promise", name, was: a, now: b });
	}
	return out;
}

/**
 * What the brief says now that it did not say when it was accepted (`plan(<plan>): brief
 * accepted`, `acceptBrief`'s commit): the difference the person is shown before approving,
 * whatever the plan review called the change. The brief is read at the newest such commit;
 * where there is none, or no git, nothing can be compared and the answer is none.
 */
export async function briefChangesSinceAcceptance(planDir: string): Promise<Amendment[]> {
	const briefFile = join(planDir, "brief.md");
	if (!existsSync(briefFile)) return [];
	try {
		const real = realpathSync(planDir);
		const top = await git(real, "rev-parse", "--show-toplevel");
		const plan = basename(real);
		const subject = `plan(${plan}): brief accepted`;
		const log = await git(
			top,
			"log",
			"--format=%H",
			"--fixed-strings",
			`--grep=${subject}`,
			"HEAD",
		);
		const sha = log.split("\n")[0]?.trim();
		if (!sha) return [];
		const accepted = await fileAtRevision(top, sha, relative(top, join(real, "brief.md")));
		return amendmentsBetween(
			{ brief: accepted, statements: new Map() },
			{ brief: readFileSync(briefFile, "utf-8"), statements: new Map() },
		);
	} catch {
		return [];
	}
}

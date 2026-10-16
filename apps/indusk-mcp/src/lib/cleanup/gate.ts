import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import matter from "gray-matter";
import { isFalsificationComplete } from "../falsification/log.js";
import { isFalsificationSkipped } from "../falsification/skip.js";
import { parsePhaseHeading } from "../impl-headings.js";
import { foldedLineMask } from "../impl-parser-core.js";
import { RITUAL_ORDER } from "../lifecycle.js";
import { parseBriefContract } from "../promises/brief-contract.js";
import { readPromises } from "../promises/registry.js";
import { rowProofs } from "../promises/rows.js";
import { reasonFits, sentenceCount } from "../rituals/reason.js";
import { isRitualSkipped, type SkipCheck } from "../rituals/skip.js";
import { findNonTerminalRows } from "../trajectory/audit.js";
import { parseTrajectory } from "../trajectory/parser.js";

export type { SkipCheck } from "../rituals/skip.js";

/**
 * Parse an impl.md's frontmatter and return whether the author has explicitly
 * opted out of the cleanup ritual. Opt-out requires both fields:
 *
 *   cleanup: skipped
 *   cleanup_reason: "a non-empty reason"
 *
 * Near-clone of `isFalsificationSkipped` — the two-field shape avoids the
 * quoted-YAML-colon fragility that a single `skip-reason:` field would carry.
 */
export function isCleanupSkipped(implContent: string): SkipCheck {
	return isRitualSkipped(implContent, "cleanup");
}

/**
 * True iff `implContent` has a `### Phase N: <RitualWord>…` phase whose every
 * checklist item is checked. The title must **start** with the ritual word
 * (after `Phase N:`) — matching a substring would misdetect a topic-named phase
 * like "The /cleanup skill" as the ritual phase (found by the cleanup-ritual
 * falsification, H1). Returns false when no such phase exists or any item under
 * it is unchecked. Gate sub-headers (`#### Phase N Verification`, etc.) do NOT
 * reset the phase — their items belong to it.
 */
function isRitualPhaseTerminal(implContent: string, ritualWord: string): boolean {
	const startsWith = new RegExp(`^${ritualWord}\\b`, "i");
	const lines = implContent.split("\n");
	let inPhase = false;
	let found = false;
	let itemCount = 0;
	const folded = foldedLineMask(lines);
	for (const [i, line] of lines.entries()) {
		const phaseMatch = parsePhaseHeading(line);
		if (phaseMatch) {
			if (startsWith.test(phaseMatch.name)) {
				inPhase = true;
				found = true;
			} else {
				inPhase = false;
			}
			continue;
		}
		if (!inPhase) continue;
		// A box quoted inside a task's folded detail or a fence is only read.
		if (folded[i]) continue;
		// Leading whitespace allowed — nested sub-items count (round-2 F3; the
		// old column-0 anchor made an indented unchecked item invisible).
		if (/^\s*-\s+\[[ xX]\]/.test(line)) {
			itemCount++;
			if (/^\s*-\s+\[ \]/.test(line)) {
				return false; // an unchecked item inside the ritual phase
			}
		}
	}
	// An empty ritual phase is NOT terminal — a bare heading with zero items
	// must not vacuously satisfy the retrospective gate (round-2 F2).
	return found && itemCount > 0;
}

/** True iff a terminal `### Phase N: Cleanup …` phase exists in the impl body. */
export function isCleanupPhaseTerminal(implContent: string): boolean {
	return isRitualPhaseTerminal(implContent, RITUAL_ORDER[1]);
}

/** True iff a terminal `### Phase N: Falsification …` phase exists — the default
 * phase-authoring falsify flow leaves one (no legacy log, not skipped). */
export function isFalsificationPhaseTerminal(implContent: string): boolean {
	return isRitualPhaseTerminal(implContent, RITUAL_ORDER[0]);
}

/**
 * True iff the plan's impl.md has a terminal Cleanup phase. Reads
 * `<planRoot>/impl.md`; returns false when the file is absent.
 */
export function isCleanupComplete(planRoot: string): boolean {
	const implPath = join(planRoot, "impl.md");
	if (!existsSync(implPath)) return false;
	return isCleanupPhaseTerminal(readFileSync(implPath, "utf-8"));
}

/**
 * Whether the impl opts out of the audit: both `audit: skipped` and a
 * non-empty `audit_reason`, the shape of `isFalsificationSkipped` — a bare
 * `audit: skipped` is not a skip.
 *
 * promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes
 */
export function isAuditSkipped(implContent: string): SkipCheck {
	return isRitualSkipped(implContent, "audit");
}

/**
 * The one list of skippable rituals a reader uses: every ritual the impl skips
 * (falsification, cleanup, audit) with its reason, in that order. The build
 * review and the admin's plan page both read this rather than build the list.
 *
 * promise: a-skipped-step-shows-why-on-request
 */
export function skippedRitualsOf(
	implContent: string,
): Array<{ ritual: "falsification" | "cleanup" | "audit"; reason: string }> {
	return [
		{ ritual: "falsification" as const, check: isFalsificationSkipped(implContent) },
		{ ritual: "cleanup" as const, check: isCleanupSkipped(implContent) },
		{ ritual: "audit" as const, check: isAuditSkipped(implContent) },
	]
		.filter((r) => r.check.skipped)
		.map((r) => ({ ritual: r.ritual, reason: r.check.reason ?? "" }));
}

/**
 * True iff `<planRoot>/audit.md` exists. Its content is never read: an audit
 * is advisory, and what it says changes no gate.
 *
 * promise: an-audit-blocks-nothing
 */
export function isAuditComplete(planRoot: string): boolean {
	return existsSync(join(planRoot, "audit.md"));
}

type SkippableRitual = "falsification" | "cleanup" | "audit";

/**
 * A skip satisfies its ritual only when it is a skip and its reason is one
 * sentence of at most SKIP_REASON_MAX characters (`reasonFits`, rituals/reason.ts).
 *
 * promise: a-skip-reason-is-one-sentence
 */
function skipIsOneSentence(skip: SkipCheck): boolean {
	const reason = skip.reason ?? "";
	return skip.skipped && reasonFits(reason);
}

/** Records a skip as too long when it is the only thing that would have satisfied the ritual. */
function noteLongSkip(
	into: RetrospectiveReadiness["longSkipReasons"],
	ritual: SkippableRitual,
	skip: SkipCheck,
	satisfied: boolean,
): void {
	const reason = skip.reason ?? "";
	if (!satisfied && skip.skipped && !skipIsOneSentence(skip)) {
		into.push({ ritual, length: reason.length, sentences: sentenceCount(reason) });
	}
}

export interface RetrospectiveReadiness {
	falsificationOk: boolean;
	cleanupOk: boolean;
	/** audit.md exists, or the impl skips the audit with a reason. */
	auditOk: boolean;
	/** Every trajectory row whose phase exists is terminal (passing, skipped, blocked). */
	rowsOk: boolean;
	/** The rows that are not, by id — what the skill's refusal names. */
	nonTerminalRows: string[];
	/** Every promise the plan declared is named by passing rows (planner-promises ADR D5). */
	promisesOk: boolean;
	/** The promises that are not, by name — what the skill's refusal names. */
	unprovenPromises: string[];
	/**
	 * Rituals whose skip would satisfy them but whose reason is more than one sentence or over
	 * SKIP_REASON_MAX characters (skip-reason-why). Each also lands in
	 * `missing` under its own word, so a caller that refuses on `missing`
	 * refuses on this too; this names the length. A ritual satisfied some
	 * other way (a log, a terminal phase, audit.md) is not listed.
	 *
	 * promise: a-skip-reason-is-one-sentence
	 */
	longSkipReasons: Array<{ ritual: SkippableRitual; length: number; sentences: number }>;
	passes: boolean;
	/**
	 * What is not yet satisfied (subset of ["falsification", "cleanup", "audit", "rows", "promises"]).
	 * A ritual skipped with a reason over SKIP_REASON_MAX, or of more than one sentence, is named here too.
	 */
	missing: string[];
}

/**
 * The promises `planDir`'s plan declared that its rows do not yet prove.
 *
 * Reads the impl's rows only. `indusk promises confirm` also reads the test
 * files and the code, and is the full answer; this gate is asked by the admin
 * for every plan on a page and cannot know where a workbench plan's code is,
 * so it answers the half the impl settles. A plan whose brief has no Promises
 * section made none through planning and is left as it was.
 *
 * promise: a-closed-plan-kept-its-promises
 */
function unprovenPromisesOf(planDirIn: string, implContent: string): string[] {
	// Resolved first: `.indusk/planning/<plan>`, relative to a project root,
	// has no separator before `.indusk` and found no planning root (A36).
	const planDir = resolve(planDirIn);
	const marker = `${sep}.indusk${sep}planning${sep}`;
	const at = planDir.lastIndexOf(marker);
	const briefPath = join(planDir, "brief.md");
	if (at === -1 || !existsSync(briefPath)) return [];
	if (parseBriefContract(readFileSync(briefPath, "utf-8")).shape === "legacy") return [];
	const read = readPromises(planDir.slice(0, at));
	// A registry that cannot be read is `promises check`'s refusal to make.
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	if (registry === null) return [];
	const plan = basename(planDir);
	const declared = registry.promises.filter((p) => p.owner === plan && p.state === "declared");
	return rowProofs(declared, plan, implContent, registry.promises)
		.filter((p) => p.refusal !== null)
		.map((p) => p.promise.name);
}

/**
 * The composed retrospective Step 0 readiness check: a plan is ready to close
 * only when BOTH rituals are satisfied — each either complete or explicitly
 * skipped — the audit has been written or skipped with a reason, every row is terminal, and every promise it declared is named by
 * passing rows. This is the single source of truth the retrospective skill's Step 0
 * gate references for the cleanup requirement.
 *
 * Falsification is satisfied by a completed log OR the skip frontmatter; the
 * retrospective skill independently also honors the "all falsification phases
 * terminal" path from the phase-authoring falsify flow.
 */
export function checkRetrospectiveReadiness(
	planRoot: string,
	implContent: string,
): RetrospectiveReadiness {
	const longSkipReasons: RetrospectiveReadiness["longSkipReasons"] = [];
	const falsificationSkip = isFalsificationSkipped(implContent);
	const falsificationOk =
		isFalsificationComplete(planRoot) ||
		skipIsOneSentence(falsificationSkip) ||
		isFalsificationPhaseTerminal(implContent);
	noteLongSkip(longSkipReasons, "falsification", falsificationSkip, falsificationOk);
	const cleanupSkip = isCleanupSkipped(implContent);
	const cleanupOk = isCleanupComplete(planRoot) || skipIsOneSentence(cleanupSkip);
	noteLongSkip(longSkipReasons, "cleanup", cleanupSkip, cleanupOk);
	const auditSkip = isAuditSkipped(implContent);
	const auditOk = isAuditComplete(planRoot) || skipIsOneSentence(auditSkip);
	noteLongSkip(longSkipReasons, "audit", auditSkip, auditOk);
	// The check the skill's text always promised and the code never performed:
	// a row left `written` after its phase closed is invisible to the two
	// ritual walks above, which see checkboxes and not rows.
	const body = matter(implContent).content;
	const nonTerminalRows = findNonTerminalRows(parseTrajectory(body), body).map((f) => f.row.id);
	const rowsOk = nonTerminalRows.length === 0;
	const unprovenPromises = unprovenPromisesOf(planRoot, implContent);
	const promisesOk = unprovenPromises.length === 0;
	const missing: string[] = [];
	if (!falsificationOk) missing.push("falsification");
	if (!cleanupOk) missing.push("cleanup");
	if (!auditOk) missing.push("audit");
	if (!rowsOk) missing.push("rows");
	if (!promisesOk) missing.push("promises");
	return {
		falsificationOk,
		cleanupOk,
		auditOk,
		rowsOk,
		nonTerminalRows,
		promisesOk,
		unprovenPromises,
		longSkipReasons,
		passes: missing.length === 0,
		missing,
	};
}

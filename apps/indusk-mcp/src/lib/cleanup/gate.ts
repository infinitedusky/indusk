import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { isFalsificationComplete } from "../falsification/log.js";
import { isFalsificationSkipped } from "../falsification/skip.js";
import { parsePhaseHeading } from "../impl-headings.js";

export interface SkipCheck {
	skipped: boolean;
	reason: string | null;
}

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
	try {
		const { data } = matter(implContent);
		if (data.cleanup !== "skipped") return { skipped: false, reason: null };
		const reasonRaw = data.cleanup_reason;
		if (typeof reasonRaw !== "string") return { skipped: false, reason: null };
		const reason = reasonRaw.trim();
		if (!reason) return { skipped: false, reason: null };
		return { skipped: true, reason };
	} catch {
		return { skipped: false, reason: null };
	}
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
	for (const line of lines) {
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
	return isRitualPhaseTerminal(implContent, "cleanup");
}

/** True iff a terminal `### Phase N: Falsification …` phase exists — the default
 * phase-authoring falsify flow leaves one (no legacy log, not skipped). */
export function isFalsificationPhaseTerminal(implContent: string): boolean {
	return isRitualPhaseTerminal(implContent, "falsification");
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

export interface RetrospectiveReadiness {
	falsificationOk: boolean;
	cleanupOk: boolean;
	passes: boolean;
	/** Names of the rituals not yet satisfied (subset of ["falsification", "cleanup"]). */
	missing: string[];
}

/**
 * The composed retrospective Step 0 readiness check: a plan is ready to close
 * only when BOTH rituals are satisfied — each either complete or explicitly
 * skipped. This is the single source of truth the retrospective skill's Step 0
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
	const falsificationOk =
		isFalsificationComplete(planRoot) ||
		isFalsificationSkipped(implContent).skipped ||
		isFalsificationPhaseTerminal(implContent);
	const cleanupOk = isCleanupComplete(planRoot) || isCleanupSkipped(implContent).skipped;
	const missing: string[] = [];
	if (!falsificationOk) missing.push("falsification");
	if (!cleanupOk) missing.push("cleanup");
	return { falsificationOk, cleanupOk, passes: missing.length === 0, missing };
}

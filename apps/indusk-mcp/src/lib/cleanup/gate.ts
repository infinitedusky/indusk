import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { isFalsificationComplete } from "../falsification/log.js";
import { isFalsificationSkipped } from "../falsification/skip.js";

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
 * True iff the impl body contains a `### Phase N: …Cleanup…` phase whose every
 * checklist item (implementation + gates) is checked. A phase title is treated
 * as the Cleanup phase when it contains "cleanup" (case-insensitive), mirroring
 * the admin-UI's falsification-phase detection. Returns false when no Cleanup
 * phase exists (the ritual hasn't run) or any item under it is unchecked.
 *
 * Gate sub-headers (`#### Phase N Verification`, etc.) do NOT reset the phase —
 * their items belong to the phase, so an unchecked gate item keeps it non-terminal.
 */
export function isCleanupPhaseTerminal(implContent: string): boolean {
	const lines = implContent.split("\n");
	let inCleanup = false;
	let found = false;
	for (const line of lines) {
		const phaseMatch = /^###\s+Phase\s+\d+\s*:\s*(.*)$/i.exec(line);
		if (phaseMatch) {
			if (/cleanup/i.test(phaseMatch[1])) {
				inCleanup = true;
				found = true;
			} else {
				inCleanup = false;
			}
			continue;
		}
		if (inCleanup && /^-\s+\[ \]/.test(line)) {
			return false; // an unchecked item inside the Cleanup phase
		}
	}
	return found;
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
		isFalsificationComplete(planRoot) || isFalsificationSkipped(implContent).skipped;
	const cleanupOk = isCleanupComplete(planRoot) || isCleanupSkipped(implContent).skipped;
	const missing: string[] = [];
	if (!falsificationOk) missing.push("falsification");
	if (!cleanupOk) missing.push("cleanup");
	return { falsificationOk, cleanupOk, passes: missing.length === 0, missing };
}

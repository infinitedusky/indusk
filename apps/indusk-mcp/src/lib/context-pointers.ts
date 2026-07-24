/**
 * CLAUDE.md pointer-integrity walker (indusk-makeover Phase 2).
 *
 * The 60 KB budget works by compressing every entry to a rule sentence plus a
 * pointer (docs page, decision page, archived plan doc). A dead pointer under
 * that regime means a lost rule body — so pointer integrity is a first-class
 * check (`indusk context check-pointers`, trajectory row A3).
 *
 * Path-shaped references are extracted from CLAUDE.md and verified against
 * disk. Globs and `{placeholder}` paths are documentation, not pointers, and
 * are skipped.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Directory prefixes that count as pointers when they appear in CLAUDE.md. */
const POINTER_PREFIXES = ["\\.indusk", "apps", "docker", "packages", "\\.claude"];

const POINTER_RE = new RegExp(
	`(?:^|[\\s(\`\\[])((?:${POINTER_PREFIXES.join("|")})/[A-Za-z0-9_\\-./]+)`,
	"gm",
);

export interface PointerReport {
	/** Every distinct path-shaped reference found. */
	scanned: string[];
	/** The subset that does not resolve on disk. */
	dead: string[];
}

/** Scan a CLAUDE.md content string for path pointers and verify them against `projectRoot`. */
export function checkPointers(content: string, projectRoot: string): PointerReport {
	const seen = new Set<string>();
	for (const m of content.matchAll(POINTER_RE)) {
		// strip trailing punctuation the greedy char class can capture
		const p = m[1].replace(/[.,;:)\]`]+$/, "");
		seen.add(p);
	}
	const scanned = [...seen].sort();
	const dead: string[] = [];
	for (const p of scanned) {
		if (p.includes("*") || p.includes("{")) continue; // glob/placeholder — documentation, not a pointer
		if (!existsSync(join(projectRoot, p))) dead.push(p);
	}
	return { scanned, dead };
}

/** Walk `<projectRoot>/CLAUDE.md`. Returns null when the file doesn't exist. */
export function checkClaudeMdPointers(projectRoot: string): PointerReport | null {
	const claudeMdPath = join(projectRoot, "CLAUDE.md");
	if (!existsSync(claudeMdPath)) return null;
	return checkPointers(readFileSync(claudeMdPath, "utf-8"), projectRoot);
}

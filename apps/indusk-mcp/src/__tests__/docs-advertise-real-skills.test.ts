import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A7 (jj-residue-rip-out, falsification) — the guide may not advertise a skill
 * that does not exist.
 *
 * `getting-started.md` listed `/jj` among the available skills. `skills/jj.md`
 * was deleted in 1.31.0, so the first page a new user reads named a slash
 * command that does nothing — and the jj rip-out shipped without noticing,
 * because the audit scans `.ts`/`.tsx` and this is prose.
 *
 * The check is deliberately about *resolution*, not about jj: a guide that
 * advertises any dead command is wrong the same way, and this catches the next
 * one too.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const SKILLS_DIR = resolve(REPO_ROOT, "apps/indusk-mcp/skills");

/** Guide pages that advertise slash commands to users. */
const GUIDES = ["apps/docs/src/guide/getting-started.md"];

/** Backticked `/name` tokens only — markdown links like (/reference/x) are paths, not commands. */
const SLASH_COMMAND = /`\/([a-z][a-z-]*)`/g;

function advertisedIn(file: string): string[] {
	const content = readFileSync(resolve(REPO_ROOT, file), "utf-8");
	return [...new Set([...content.matchAll(SLASH_COMMAND)].map((m) => m[1]))];
}

describe("guides advertise only skills that exist", () => {
	for (const guide of GUIDES) {
		it(`A7 — every slash command in ${guide} resolves to a skill file`, () => {
			const missing = advertisedIn(guide).filter(
				(name) => !existsSync(resolve(SKILLS_DIR, `${name}.md`)),
			);
			expect(
				missing,
				`${guide} advertises commands with no skill file: ${missing.map((m) => `/${m}`).join(", ")}`,
			).toEqual([]);
		});
	}
});

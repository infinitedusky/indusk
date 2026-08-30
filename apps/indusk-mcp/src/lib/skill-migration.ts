/**
 * Migration surface for skills renamed or retired in the package — the third
 * twin, after `mcp-migration.ts` and `hook-migration.ts`.
 *
 * Skill discovery is `globSync` on both install sides, so a renamed skill
 * arrives under its new name and the old directory stays in every consumer's
 * `.claude/skills/` forever: still listed by `get_skill_summaries`, still
 * answering to its old slash command. `context` is the live instance — renamed
 * to `claude-md` because Claude Code ships a built-in `/context` (the
 * context-window usage view), and a built-in shadows any skill of that name.
 *
 * A hook file name is InDusk's by construction; a skill directory name is not.
 * `context` is exactly the kind of name a user might pick for a skill of their
 * own, so each entry carries a fingerprint the installed `SKILL.md` must match.
 * A directory that does not match is reported as foreign and left alone —
 * look at the target before deleting it.
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export interface LegacySkill {
	/** Directory name under `.claude/skills/`. */
	name: string;
	/** The skill's current name, for the console line. */
	replacedBy: string;
	/**
	 * Must match the installed `SKILL.md` for the directory to be treated as
	 * InDusk's. The `description:` line is the fingerprint — it has been
	 * byte-stable since the skill first shipped, so every consumer has it.
	 */
	fingerprint: RegExp;
}

/** Skills renamed or retired from the package. Extend on future renames. */
export const LEGACY_SKILLS: readonly LegacySkill[] = [
	{
		name: "context",
		replacedBy: "claude-md",
		fingerprint: /^description:\s*Maintain CLAUDE\.md as living project memory/m,
	},
];

export interface RemoveLegacySkillsResult {
	/** Directories deleted from `.claude/skills/`. */
	removed: LegacySkill[];
	/** Present under a legacy name but not matching the fingerprint — left in place. */
	foreign: LegacySkill[];
}

export interface RemoveLegacySkillsOptions {
	/** Override the legacy list (tests). */
	skills?: readonly LegacySkill[];
}

/**
 * Remove every legacy skill directory whose `SKILL.md` matches its fingerprint.
 *
 * Absent state is not an error — no skills dir, no directory, no `SKILL.md`,
 * unreadable file — because this runs inside `init`/`update` where a
 * migration must not be able to fail the command. A directory with no
 * `SKILL.md` cannot be identified and is treated as foreign.
 */
export function removeLegacySkills(
	projectRoot: string,
	opts: RemoveLegacySkillsOptions = {},
): RemoveLegacySkillsResult {
	const legacy = opts.skills ?? LEGACY_SKILLS;
	const result: RemoveLegacySkillsResult = { removed: [], foreign: [] };

	for (const skill of legacy) {
		const dir = join(projectRoot, ".claude/skills", skill.name);
		if (!existsSync(dir)) continue;

		let body: string;
		try {
			body = readFileSync(join(dir, "SKILL.md"), "utf-8");
		} catch {
			result.foreign.push(skill);
			continue;
		}
		if (!skill.fingerprint.test(body)) {
			result.foreign.push(skill);
			continue;
		}

		try {
			rmSync(dir, { recursive: true, force: true });
			result.removed.push(skill);
		} catch {
			// Leave it rather than fail the migration; the next update retries.
		}
	}

	return result;
}

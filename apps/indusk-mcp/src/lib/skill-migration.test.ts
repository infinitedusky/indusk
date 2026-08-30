import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LEGACY_SKILLS, removeLegacySkills } from "./skill-migration.js";

/**
 * A renamed skill leaves its old directory in every consumer, and that
 * directory is not inert: it is listed, and it answers to its old slash
 * command. But `context` is a name a user could have chosen for their own
 * skill, so removal has to look at the target first — deleting a user's skill
 * because InDusk once used the same name would be worse than leaving the
 * stale one.
 */

const INDUSK_CONTEXT_SKILL = `---
name: context
description: Maintain CLAUDE.md as living project memory. Update on triggers (post-retro, post-ADR, corrections). Shape impl documents to include per-phase context updates.
argument-hint: "learn \\"lesson to remember\\""
---

You know how to maintain project context in this project.
`;

const USER_CONTEXT_SKILL = `---
name: context
description: Dump the current request context for debugging.
---

Print the request context.
`;

describe("legacy skill removal", () => {
	let root: string;
	const skillDir = (name: string) => join(root, ".claude/skills", name);

	function installSkill(name: string, body: string): void {
		mkdirSync(skillDir(name), { recursive: true });
		writeFileSync(join(skillDir(name), "SKILL.md"), body);
	}

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "skill-migration-"));
		mkdirSync(join(root, ".claude/skills"), { recursive: true });
	});

	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it("removes the stale InDusk directory, leaving its siblings intact", () => {
		installSkill("context", INDUSK_CONTEXT_SKILL);
		installSkill("claude-md", INDUSK_CONTEXT_SKILL.replace("name: context", "name: claude-md"));
		installSkill("work", "---\nname: work\ndescription: Execute a plan.\n---\n");

		const r = removeLegacySkills(root);
		expect(r.removed.map((s) => s.name)).toEqual(["context"]);
		expect(r.foreign).toEqual([]);
		expect(existsSync(skillDir("context"))).toBe(false);
		expect(existsSync(join(skillDir("claude-md"), "SKILL.md"))).toBe(true);
		expect(existsSync(join(skillDir("work"), "SKILL.md"))).toBe(true);
	});

	it("leaves a user's own skill under the legacy name in place, and says so", () => {
		installSkill("context", USER_CONTEXT_SKILL);

		const r = removeLegacySkills(root);
		expect(r.removed).toEqual([]);
		expect(r.foreign.map((s) => s.name)).toEqual(["context"]);
		expect(existsSync(join(skillDir("context"), "SKILL.md"))).toBe(true);
	});

	it("treats a directory with no SKILL.md as foreign — it cannot be identified", () => {
		mkdirSync(skillDir("context"), { recursive: true });
		writeFileSync(join(skillDir("context"), "notes.md"), "mine\n");

		const r = removeLegacySkills(root);
		expect(r.removed).toEqual([]);
		expect(r.foreign.map((s) => s.name)).toEqual(["context"]);
		expect(existsSync(join(skillDir("context"), "notes.md"))).toBe(true);
	});

	it("leaves a project with no legacy skills completely untouched", () => {
		installSkill("claude-md", INDUSK_CONTEXT_SKILL.replace("name: context", "name: claude-md"));

		const r = removeLegacySkills(root);
		expect(r.removed).toEqual([]);
		expect(r.foreign).toEqual([]);
		expect(existsSync(join(skillDir("claude-md"), "SKILL.md"))).toBe(true);
	});

	it("absent state is not an error — no skills dir at all", () => {
		rmSync(join(root, ".claude"), { recursive: true, force: true });
		expect(() => removeLegacySkills(root)).not.toThrow();
	});

	it("context → claude-md is on the list — the rename this closes", () => {
		const entry = LEGACY_SKILLS.find((s) => s.name === "context");
		expect(entry?.replacedBy).toBe("claude-md");
		// The fingerprint must match what actually shipped, or the migration is
		// a no-op that looks handled. This is the exact frontmatter every
		// consumer has on disk.
		expect(entry?.fingerprint.test(INDUSK_CONTEXT_SKILL)).toBe(true);
		expect(entry?.fingerprint.test(USER_CONTEXT_SKILL)).toBe(false);
	});

	it("every legacy entry's replacement actually ships in the package", () => {
		// A migration pointing at a name that does not exist removes the old
		// skill and installs nothing — the consumer ends up with neither.
		const skillsDir = new URL("../../skills/", import.meta.url).pathname;
		for (const s of LEGACY_SKILLS) {
			expect(existsSync(join(skillsDir, `${s.replacedBy}.md`)), `${s.replacedBy}.md`).toBe(true);
		}
	});
});

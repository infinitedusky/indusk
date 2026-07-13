import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";

/**
 * Cleanup-ritual T25 — installed-skill sync parity.
 *
 * Skills in `.claude/skills/` are package-owned: the source of truth is
 * `apps/indusk-mcp/skills/{name}.md`, synced to `.claude/skills/{name}/SKILL.md`
 * by `indusk init`/`update`. In the dusk monorepo there is no global `indusk`
 * binary, so edits to sources silently leave the installed copies stale — the
 * round-2 falsification found 4 of 5 ritual skills stale, including
 * `retrospective`, whose stale copy still carried the falsification-only Step 0
 * (the cleanup gate would silently not have been enforced).
 *
 * This test pins the invariant structurally: every package skill source must
 * have a byte-identical installed copy. A forgotten sync fails here, at test
 * time, instead of when a stale skill loads.
 */

const REPO_ROOT = new URL("../../../..", import.meta.url).pathname;
const SKILLS_SOURCE = join(REPO_ROOT, "apps/indusk-mcp/skills");
const SKILLS_INSTALLED = join(REPO_ROOT, ".claude/skills");

describe("cleanup-ritual T25: installed skills match package sources", () => {
	const sources = globSync("*.md", { cwd: SKILLS_SOURCE }).sort();

	it("finds package skill sources (sanity)", () => {
		expect(sources.length).toBeGreaterThan(5);
	});

	it("every package skill source has a byte-identical installed copy", () => {
		const problems: string[] = [];
		for (const file of sources) {
			const name = file.replace(/\.md$/, "");
			const sourcePath = join(SKILLS_SOURCE, file);
			const installedPath = join(SKILLS_INSTALLED, name, "SKILL.md");
			if (!existsSync(installedPath)) {
				problems.push(`${name}: not installed (.claude/skills/${name}/SKILL.md missing)`);
				continue;
			}
			if (readFileSync(sourcePath, "utf-8") !== readFileSync(installedPath, "utf-8")) {
				problems.push(
					`${name}: STALE — resync with: cp apps/indusk-mcp/skills/${file} .claude/skills/${name}/SKILL.md`,
				);
			}
		}
		expect(problems).toEqual([]);
	});
});

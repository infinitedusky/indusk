import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Write a plan folder into a planning directory, for tests about what a
 * plan's documents declare.
 *
 * Each document is given as the frontmatter lines that follow its title —
 * `{ "brief.md": ["status: accepted", "workflow: bugfix"] }` — so a test
 * states exactly the declaration under test and nothing else. The lines are
 * written verbatim: a malformed value stays malformed, which is the point of
 * the tests that use it. Returns the plan folder.
 *
 * For a plan that needs whole document bodies, modification times or a
 * worktree, use the fixture that owns that (`plan-worktree-fixture`,
 * `papers-fixture`, `versioned-workbench`).
 */
export function writePlanFolder(
	planningDir: string,
	name: string,
	documents: Record<string, string[]>,
): string {
	const dir = join(planningDir, name);
	mkdirSync(dir, { recursive: true });
	for (const [file, frontmatter] of Object.entries(documents)) {
		writeFileSync(
			join(dir, file),
			["---", `title: "${name}"`, ...frontmatter, "---", "", `# ${name}`, ""].join("\n"),
		);
	}
	return dir;
}

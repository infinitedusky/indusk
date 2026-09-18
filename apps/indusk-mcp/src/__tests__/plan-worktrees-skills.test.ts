import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * admin-plan-worktrees — A18: the lifecycle makes and ends the assignment.
 *
 * A plan's assignment is only as reliable as the steps that write it. The
 * work skill's kickoff is where a plan's worktree is created, and the
 * retrospective's landing step is where it is merged and removed; if either
 * spells the old commands, every plan after this one goes back to being
 * invisible. These read the package-owned skills (the installed copies are
 * pinned byte-equal by skill-sync-parity).
 */

const SKILLS = join(__dirname, "..", "..", "skills");

function section(file: string, start: RegExp, end: RegExp): string {
	const text = readFileSync(join(SKILLS, file), "utf-8");
	const from = text.search(start);
	if (from < 0) throw new Error(`${file}: no section matching ${start}`);
	const rest = text.slice(from + 1);
	const to = rest.search(end);
	return to < 0 ? text.slice(from) : text.slice(from, from + 1 + to);
}

describe("A18 — the kickoff creates the assignment and the landing releases it", () => {
	it("the work skill's Worktree Kickoff creates the worktree with `indusk worktree create <plan>`", () => {
		const kickoff = section("work.md", /^## Worktree Kickoff/m, /^## /m);
		expect(kickoff).toContain("indusk worktree create <plan>");
		expect(kickoff).toContain("indusk worktree assign <plan>");
	});

	it("the retrospective's landing step releases between the merge and the worktree removal", () => {
		const landing = section("retrospective.md", /^### Step 10/m, /^### |^## /m);
		const merge = landing.indexOf("merge --no-ff");
		const release = landing.indexOf("indusk worktree release");
		const remove = landing.indexOf("git worktree remove");
		expect(merge, "merge step").toBeGreaterThanOrEqual(0);
		expect(release, "release step").toBeGreaterThan(merge);
		expect(remove, "removal step").toBeGreaterThan(release);
	});
});

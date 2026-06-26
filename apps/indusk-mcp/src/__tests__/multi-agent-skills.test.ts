import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test Trajectory for the handoff-multi-agent plan — skill content + commit-flow rows.
 *
 * All three rows are `.skip()` scaffolds at Phase 1; each names the phase that
 * unblocks it. Un-skipped together in Phase 3 when the skill rewrites land:
 *   T6 → Phase 3 (catchup reads current.md after commit)
 *   T7 → Phase 3 (catchup pure-read invariant)
 *   T8 → Phase 3 (handoff deprecation message)
 *
 * Today the skill files contain the old checkbox/mutation flow, so reading them
 * and grepping for the new convention shows "not present" — red signal is real.
 *
 * See `.indusk/planning/handoff-multi-agent/impl.md` for the full trajectory.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CATCHUP_SKILL = join(REPO_ROOT, "apps/indusk-mcp/skills/catchup.md");
const HANDOFF_SKILL = join(REPO_ROOT, "apps/indusk-mcp/skills/handoff.md");
const _SKILLS_PRESENT = existsSync(CATCHUP_SKILL) && existsSync(HANDOFF_SKILL);

describe("multi-agent skills — handoff-multi-agent trajectory", () => {
	// T6 — Phase 3 unlock: catchup output reflects a current.md edit committed on main
	it.skip("T6: after a commit to current.md on main, next agent's catchup sees it", () => {
		// Intended shape (un-skip in Phase 3):
		//   const before = catchupOutput(projectDir);
		//   writeFileSync(join(projectDir, ".indusk/current.md"), "## In Flight\n\nNEW THING\n");
		//   spawnSync("git", ["add", ".indusk/current.md"], { cwd: projectDir });
		//   spawnSync("git", ["commit", "-m", "current"], { cwd: projectDir });
		//   const after = catchupOutput(projectDir);
		//   expect(after).toContain("NEW THING");
		//   expect(before).not.toContain("NEW THING");
		expect.fail("Phase 3 unlock — current.md surface + catchup-reads-it skill behavior");
	});

	// T7 — Phase 3 unlock: catchup mutates only the agent's own presence file
	it.skip("T7: running catchup does not modify any file other agents would observe", () => {
		// Intended shape (un-skip in Phase 3):
		//   const before = snapshotFsMtimes(projectDir, { exclude: [".indusk/agents/<self>.md"] });
		//   runCatchupFlow(projectDir);
		//   const after = snapshotFsMtimes(projectDir, { exclude: [".indusk/agents/<self>.md"] });
		//   expect(after).toEqual(before);
		expect.fail("Phase 3 unlock — pure-read catchup is the Phase 3 deliverable");
	});

	// T8 — Phase 3 unlock: handoff skill content is a deprecation pointer
	it.skip("T8: deprecated handoff command tells the user what to do instead", () => {
		// Intended shape (un-skip in Phase 3):
		//   const content = readFileSync(HANDOFF_SKILL, "utf-8");
		//   expect(content.toLowerCase()).toMatch(/deprecated/);
		//   expect(content).toMatch(/indusk agent done|multi-agent\.md|current\.md/);
		const content = existsSync(HANDOFF_SKILL) ? readFileSync(HANDOFF_SKILL, "utf-8") : "";
		// Today's handoff skill is NOT a deprecation page — this assertion intentionally
		// describes the post-Phase-3 invariant. Phase 3 makes it pass.
		expect(content.toLowerCase()).toMatch(/deprecated/);
	});
});

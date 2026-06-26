import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test Trajectory for the handoff-multi-agent plan — init/update scaffolding.
 *
 * T11 is a `.skip()` scaffold at Phase 1; un-skipped in Phase 4 when init/update
 * grow the `.indusk/current.md` template, the `.indusk/agents/` gitignore line,
 * and the `agents.stale_ttl_minutes` config default.
 *
 * Today the gitignore output from `indusk init` does NOT mention `.indusk/agents/`
 * — that's real-red. Phase 4 lands the missing line.
 *
 * See `.indusk/planning/handoff-multi-agent/impl.md` for the full trajectory.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const _SHOULD_SKIP = !existsSync(CLI_BIN);

describe("multi-agent init — handoff-multi-agent trajectory", () => {
	// T11 — Phase 4 unlock: fresh init gitignores .indusk/agents/ so clones inherit no presence files
	it.skip("T11: fresh teammate clone sees no leftover presence files", () => {
		// Intended shape (un-skip in Phase 4):
		//   const projectDir = mkdtempSync(join(tmpdir(), "ma-init-"));
		//   spawnSync("git", ["init"], { cwd: projectDir });
		//   spawnSync("node", [CLI_BIN, "init"], { cwd: projectDir });
		//   // Simulate "developer A" creating a presence file on their machine
		//   mkdirSync(join(projectDir, ".indusk/agents"), { recursive: true });
		//   writeFileSync(join(projectDir, ".indusk/agents/A-session.md"), "presence");
		//   // Developer B clones — fresh checkout sees no agents/ contents
		//   const status = spawnSync("git", ["status", "--porcelain"], { cwd: projectDir });
		//   expect(status.stdout.toString()).not.toMatch(/\.indusk\/agents/);
		//   // gitignore explicitly mentions the path
		//   const gi = readFileSync(join(projectDir, ".gitignore"), "utf-8");
		//   expect(gi).toMatch(/^\.indusk\/agents\/?$/m);
		expect.fail("Phase 4 unlock — init.ts does not gitignore .indusk/agents/ yet");
	});
});

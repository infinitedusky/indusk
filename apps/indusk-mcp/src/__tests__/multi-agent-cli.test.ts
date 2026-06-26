import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test Trajectory for the handoff-multi-agent plan — CLI surface rows.
 *
 * All five rows are `.skip()` scaffolds at Phase 1; each names the phase that
 * unblocks it. The work skill un-skips them as their phases land:
 *   T3 / T4 / T5 → Phase 2 (CLI subcommands land in `src/bin/commands/agent.ts`)
 *   T1 / T2     → Phase 3 (skills updated to register + read bulletin)
 *
 * Today these all fail red against the absent `indusk agent` subcommand
 * (`spawnSync` returns non-zero with "unknown command"). The scaffold pins the
 * intended assertion shape so Phase 2 / Phase 3 implementations have a target.
 *
 * See `.indusk/planning/handoff-multi-agent/impl.md` for the full trajectory.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const _SHOULD_SKIP = !existsSync(CLI_BIN);

describe("multi-agent CLI — handoff-multi-agent trajectory", () => {
	// T3 — Phase 2 unlock: register-then-list shows the registered task within 5s
	it.skip("T3: registering as an agent makes you visible within 5 seconds", () => {
		// Intended shape (un-skip in Phase 2):
		//   spawnSync(CLI_BIN, ["agent", "register", "--task", "auth refactor"], { cwd: projectDir });
		//   const list = spawnSync(CLI_BIN, ["agent", "list"], { cwd: projectDir });
		//   expect(list.stdout.toString()).toMatch(/auth refactor/);
		expect.fail("Phase 2 unlock — agent register/list subcommands don't exist yet");
	});

	// T4 — Phase 2 unlock: `agent done` removes the current session's presence file
	it.skip("T4: an agent that ends cleanly disappears from the bulletin", () => {
		// Intended shape (un-skip in Phase 2):
		//   spawnSync(CLI_BIN, ["agent", "register", "--task", "x"], { cwd, env: stableSessionEnv });
		//   spawnSync(CLI_BIN, ["agent", "done"], { cwd, env: stableSessionEnv });
		//   const list = spawnSync(CLI_BIN, ["agent", "list"], { cwd });
		//   expect(list.stdout.toString()).not.toMatch(/x/);
		expect.fail("Phase 2 unlock — agent done subcommand doesn't exist yet");
	});

	// T5 — Phase 2 unlock: mtime older than stale_ttl_minutes filtered from `agent list`
	it.skip("T5: a stale presence file stops appearing after the TTL elapses", () => {
		// Intended shape (un-skip in Phase 2):
		//   spawnSync(CLI_BIN, ["agent", "register", "--task", "ghost"], { cwd });
		//   utimesSync(presenceFile, twoHoursAgo, twoHoursAgo);  // simulate stale mtime
		//   // config: agents.stale_ttl_minutes: 60
		//   const list = spawnSync(CLI_BIN, ["agent", "list"], { cwd });
		//   expect(list.stdout.toString()).not.toMatch(/ghost/);
		expect.fail("Phase 2 unlock — agent list TTL filter doesn't exist yet");
	});

	// T1 — Phase 3 unlock: two concurrent catchup flows both complete cleanly
	it.skip("T1: two agents starting catchup at the same time both complete", async () => {
		// Intended shape (un-skip in Phase 3):
		//   const [a, b] = await Promise.all([
		//     runCatchupFlow(workbenchRoot, "agent-A"),
		//     runCatchupFlow(workbenchRoot, "agent-B"),
		//   ]);
		//   expect(a.exitCode).toBe(0);
		//   expect(b.exitCode).toBe(0);
		expect.fail("Phase 3 unlock — concurrent catchup flow requires register + skill rewrite");
	});

	// T2 — Phase 3 unlock: catchup output lists other agents' tasks
	it.skip("T2: a new agent's catchup sees other working agents' tasks", () => {
		// Intended shape (un-skip in Phase 3):
		//   spawnSync(CLI_BIN, ["agent", "register", "--task", "auth"], { cwd, env: sessionAEnv });
		//   spawnSync(CLI_BIN, ["agent", "register", "--task", "telemetry"], { cwd, env: sessionBEnv });
		//   const list = spawnSync(CLI_BIN, ["agent", "list"], { cwd });
		//   expect(list.stdout.toString()).toMatch(/auth/);
		//   expect(list.stdout.toString()).toMatch(/telemetry/);
		expect.fail("Phase 3 unlock — bulletin visibility surface lands with skill rewrite");
	});
});

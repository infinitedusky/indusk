import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test Trajectory for the handoff-multi-agent plan — skill content rows.
 *
 * T6, T7, T8 — live (Phase 3). Assert the rewritten skill source files at
 * apps/indusk-mcp/skills/ carry the new convention (current.md read, no
 * checkbox mutation, handoff deprecation message). These are content tests on
 * the canonical skill source — the auto-sync globSync("*.md") in init.ts /
 * update.ts ensures consumers get the same content.
 *
 * T1, T2 — content tests on the catchup skill demonstrating the new
 * concurrent-safe shape: the skill no longer mutates shared state, the skill
 * surfaces other agents via `indusk agent list`. The behavioral "two agents
 * concurrently invoke /catchup" check requires running Claude Code itself,
 * which is out of scope for unit tests — verified instead by the Phase 5
 * manual smoke (T10) and structurally by T7 (catchup is pure-read).
 *
 * See `.indusk/planning/handoff-multi-agent/impl.md` for the full trajectory.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CATCHUP_SKILL = join(REPO_ROOT, "apps/indusk-mcp/skills/catchup.md");
const HANDOFF_SKILL = join(REPO_ROOT, "apps/indusk-mcp/skills/handoff.md");

describe("multi-agent skills — handoff-multi-agent trajectory", () => {
	// T1 — Phase 3: catchup skill no longer mutates shared state (pure-read invariant)
	it("T1: catchup skill is structurally race-free (no checkbox mutation, no shared file writes)", () => {
		const content = readFileSync(CATCHUP_SKILL, "utf-8");

		// The old checkbox state machine is gone — no instructions to mutate handoff.md
		expect(content).not.toMatch(/edit the handoff to check off/i);
		expect(content).not.toMatch(/\.claude\/handoff\.md/);
		expect(content).not.toMatch(/check off `- \[x\] /); // legacy phrasing

		// The new convention is explicitly stated: pure-read for shared files
		expect(content.toLowerCase()).toMatch(/pure[- ]read/);

		// Catchup's only mutation is the agent's own presence file
		expect(content).toMatch(/indusk agent register/);
	});

	// T2 — Phase 3: catchup skill surfaces other working agents via bulletin
	it("T2: catchup skill instructs the agent to surface other working agents", () => {
		const content = readFileSync(CATCHUP_SKILL, "utf-8");
		expect(content).toMatch(/indusk agent list/);
		// And calls out concurrent-agent awareness in the summary template
		expect(content.toLowerCase()).toMatch(/other agents/);
	});

	// T6 — Phase 3: catchup skill instructs reading .indusk/current.md
	it("T6: catchup skill reads .indusk/current.md as the operational state surface", () => {
		const content = readFileSync(CATCHUP_SKILL, "utf-8");
		expect(content).toMatch(/\.indusk\/current\.md/);
		// And documents the read-only contract for current.md during catchup
		expect(content.toLowerCase()).toMatch(/do not edit.*current\.md/);
	});

	// T7 — Phase 3: catchup skill explicitly states the pure-read invariant
	it("T7: catchup skill names the pure-read invariant against shared files", () => {
		const content = readFileSync(CATCHUP_SKILL, "utf-8");
		// Skill body is explicit that the only side effect is the agent's own presence file
		expect(content.toLowerCase()).toMatch(/only side effect|only mutation|only write/);
		expect(content).toMatch(/\.indusk\/agents\//);
		// And the "Important" section reinforces the rule
		expect(content.toLowerCase()).toMatch(/do not mutate shared files/);
	});

	// T8 — Phase 3: handoff skill is now a deprecation pointer
	it("T8: deprecated handoff skill tells the user what to do instead", () => {
		expect(existsSync(HANDOFF_SKILL)).toBe(true);
		const content = readFileSync(HANDOFF_SKILL, "utf-8");

		// Marked as deprecated
		expect(content.toLowerCase()).toMatch(/deprecated/);

		// Points at the new flow — current.md + agent done + eval trigger
		expect(content).toMatch(/\.indusk\/current\.md/);
		expect(content).toMatch(/indusk agent done/);
		expect(content).toMatch(/eval-trigger/);

		// Does NOT instruct writing the old .claude/handoff.md file
		expect(content).not.toMatch(/Create or overwrite `\.claude\/handoff\.md`/);
	});
});

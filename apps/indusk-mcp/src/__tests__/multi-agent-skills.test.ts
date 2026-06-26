import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test Trajectory for the handoff-multi-agent-section-shape plan — skill rows.
 *
 * Live tests against the rewritten skill source files:
 *   T3 — catchup skill instructs reading .indusk/current.md sections and
 *     surfacing other agents from them
 *   T8-skills-regression — catchup skill is structurally pure-read for shared
 *     files; only writes are register + self-heartbeat (both touching only the
 *     current session's own section)
 *   T11 — catchup is pure-read invariant
 *   handoff-ritual — /handoff is a real ritual that calls the MCP write tool
 *     (not a deprecation pointer)
 *
 * See `.indusk/planning/handoff-multi-agent-section-shape/impl.md` for the
 * full trajectory.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CATCHUP_SKILL = join(REPO_ROOT, "apps/indusk-mcp/skills/catchup.md");
const HANDOFF_SKILL = join(REPO_ROOT, "apps/indusk-mcp/skills/handoff.md");

describe("multi-agent skills — section-shape trajectory", () => {
	// T3 — catchup surfaces other working agents from current.md sections
	it("T3: catchup skill instructs reading current.md sections and surfacing other agents", () => {
		const content = readFileSync(CATCHUP_SKILL, "utf-8");

		// Reads .indusk/current.md
		expect(content).toMatch(/\.indusk\/current\.md/);

		// Mentions per-agent sections
		expect(content.toLowerCase()).toMatch(/per-agent section|## session/i);

		// References the Project (shared) anchor
		expect(content).toMatch(/Project \(shared\)/);

		// Surfaces other agents from sections
		expect(content.toLowerCase()).toMatch(/other agents|other working agents/);

		// Drops references to the old .indusk/agents/ directory as a read surface
		// (the gitignore line stays for precaution but the skill body should not glob
		// agents/ anymore)
		expect(content).not.toMatch(/glob.*\.indusk\/agents/);
	});

	// T11 — catchup is pure-read
	it("T11: catchup skill names the pure-read invariant against shared files", () => {
		const content = readFileSync(CATCHUP_SKILL, "utf-8");

		// Explicit pure-read invariant
		expect(content.toLowerCase()).toMatch(/pure[- ]read/);

		// Names what the only writes are (register + self-heartbeat)
		expect(content).toMatch(/indusk agent register/);
		expect(content.toLowerCase()).toMatch(/self[- ]heartbeat|implicit heartbeat/);

		// Explicit "do NOT edit current.md during catchup"
		expect(content.toLowerCase()).toMatch(/do not edit.*current\.md|never modify.*current\.md/);

		// Important block reinforces the rule
		expect(content.toLowerCase()).toMatch(/do not mutate.*shared|do not modify.*shared/);
	});

	// handoff is a real ritual, not a deprecation pointer
	it("handoff skill is a real ritual that calls the MCP write tool", () => {
		expect(existsSync(HANDOFF_SKILL)).toBe(true);
		const content = readFileSync(HANDOFF_SKILL, "utf-8");

		// References the MCP write tool by name
		expect(content).toMatch(/mcp__indusk__update_current_section/);

		// Instructs filling in the three subsection bodies
		expect(content).toMatch(/in_flight/);
		expect(content).toMatch(/open_questions/);
		expect(content).toMatch(/cursor/);

		// Describes the four-step ritual: update → commit → done → eval-trigger
		expect(content.toLowerCase()).toMatch(/commit/);
		expect(content).toMatch(/indusk agent done/);
		expect(content).toMatch(/eval-trigger/);

		// Is NOT just a deprecation pointer — should NOT primarily say "is deprecated"
		// at the top level. The skill describes itself as a ritual.
		expect(content.toLowerCase()).toMatch(/ritual|session-end/);
	});

	it("handoff skill explicitly disclaims touching other agents' sections", () => {
		const content = readFileSync(HANDOFF_SKILL, "utf-8");

		// Names the "only your own section" invariant
		expect(content.toLowerCase()).toMatch(/only your.*section|only.*own section|byte-untouched/);

		// Calls out NOT to touch Project (shared) as part of handoff
		expect(content).toMatch(/Project \(shared\)/);
	});

	// T2 supporting — the section shape lets a new agent see other working agents
	it("T2: catchup skill names the section heading shape so the agent knows what to surface", () => {
		const content = readFileSync(CATCHUP_SKILL, "utf-8");
		expect(content).toMatch(/Session.*task/i);
		// References In Flight / Open Questions / Cursor subsections
		expect(content).toMatch(/In Flight/);
		expect(content).toMatch(/Open Questions/);
		expect(content).toMatch(/Cursor/);
	});
});

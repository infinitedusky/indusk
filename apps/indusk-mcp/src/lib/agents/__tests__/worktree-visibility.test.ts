import { describe, expect, it } from "vitest";
import type { AgentSection } from "../current-md.js";
import { parseCurrentMd, sanitizeSectionBody, serializeCurrentMd, upsertSection } from "../current-md.js";

/**
 * Test Trajectory for the worktree-visibility plan — Phase 1 lib rows.
 *
 *   T1 (lib) — branch/worktree round-trip: a section carrying branch + worktree
 *     serializes with `**Branch**:` / `**Worktree**:` markers and parses back
 *     to the same values.
 *   T4      — sanitizeSectionBody rejects `**Branch**:` and `**Worktree**:`
 *     marker lines injected into a section body.
 *
 * T2/T3 (recompute, collision flag) are CLI-integration rows in
 * src/__tests__/worktree-visibility-cli.test.ts.
 *
 * See .indusk/planning/worktree-visibility/impl.md.
 */

function makeSection(over: Partial<AgentSection> = {}): AgentSection {
	return {
		sessionId: "11111111-2222-3333-4444-555555555555",
		sessionShort: "11111111",
		task: "test task",
		lastUpdated: "2026-07-12T00:00:00.000Z",
		inFlight: "",
		openQuestions: "",
		cursor: "",
		branch: "",
		worktree: "",
		...over,
	};
}

describe("worktree-visibility Phase 1 lib", () => {
	it("T1(lib): round-trips branch + worktree through serialize/parse", () => {
		const doc = {
			preamble: "",
			sharedSection: "",
			sections: [makeSection({ branch: "plan/foo-phase-1", worktree: "/wt/foo" })],
		};
		const serialized = serializeCurrentMd(doc);
		expect(serialized).toContain("**Branch**: plan/foo-phase-1");
		expect(serialized).toContain("**Worktree**: /wt/foo");

		const parsed = parseCurrentMd(serialized);
		expect(parsed.sections).toHaveLength(1);
		expect(parsed.sections[0].branch).toBe("plan/foo-phase-1");
		expect(parsed.sections[0].worktree).toBe("/wt/foo");
	});

	it("T1(lib): empty branch/worktree round-trip to empty strings", () => {
		const doc = {
			preamble: "",
			sharedSection: "",
			sections: [makeSection({ branch: "", worktree: "" })],
		};
		const parsed = parseCurrentMd(serializeCurrentMd(doc));
		expect(parsed.sections[0].branch).toBe("");
		expect(parsed.sections[0].worktree).toBe("");
	});

	it("T4: sanitizeSectionBody rejects an injected **Branch**: marker", () => {
		expect(() => sanitizeSectionBody("normal text\n**Branch**: evil/branch", "inFlight")).toThrow(
			TypeError,
		);
	});

	it("T4: sanitizeSectionBody rejects an injected **Worktree**: marker", () => {
		expect(() => sanitizeSectionBody("**Worktree**: /evil/path", "cursor")).toThrow(TypeError);
	});

	it("T4: upsertSection rejects a body carrying a **Branch**: line (injection via notes)", () => {
		const base = serializeCurrentMd({ preamble: "", sharedSection: "", sections: [] });
		expect(() =>
			upsertSection(base, makeSection({ inFlight: "working\n**Branch**: spoofed" })),
		).toThrow(TypeError);
	});
});

import { describe, expect, it } from "vitest";
import type { AgentSection } from "../current-md.js";
import {
	editSharedSection,
	listSections,
	parseCurrentMd,
	pruneStaleSections,
	removeSection,
	serializeCurrentMd,
	upsertSection,
} from "../current-md.js";

/**
 * Test Trajectory for the handoff-multi-agent-section-shape plan — Phase 1 lib.
 *
 * Live tests:
 *   T1 — upsertSection only touches the calling agent's section
 *   T2 — upsertSection appends a new section when no match
 *   T4 — editSharedSection edits Project (shared) only
 *   T7-lib — removeSection removes the named session; others survive
 *   T8-lib — pruneStaleSections filters by Last updated timestamp
 *
 * T5 (MCP tool wrapper) lives in its own test file alongside the tool wiring.
 *
 * See `.indusk/planning/handoff-multi-agent-section-shape/impl.md` for the
 * full trajectory.
 */

function makeSection(
	sessionId: string,
	task: string,
	lastUpdated: string,
	parts: Partial<Pick<AgentSection, "inFlight" | "openQuestions" | "cursor">> = {},
): AgentSection {
	return {
		sessionId,
		sessionShort: sessionId.slice(0, 8),
		task,
		lastUpdated,
		inFlight: parts.inFlight ?? "",
		openQuestions: parts.openQuestions ?? "",
		cursor: parts.cursor ?? "",
	};
}

function emptyDoc(): string {
	return serializeCurrentMd({
		preamble: "",
		sharedSection: "",
		sections: [],
	});
}

describe("current-md.ts lib — handoff-multi-agent-section-shape trajectory", () => {
	describe("parseCurrentMd / serializeCurrentMd roundtrip", () => {
		it("round-trips an empty document", () => {
			const initial = emptyDoc();
			const parsed = parseCurrentMd(initial);
			const reserialized = serializeCurrentMd(parsed);
			expect(parsed.sections).toEqual([]);
			expect(parsed.sharedSection).toBe("");
			expect(reserialized).toBe(initial);
		});

		it("round-trips a document with one session section", () => {
			const section = makeSection(
				"2c87e7b6-702a-4dcd-876f-a31820e0df3e",
				"auth refactor",
				"2026-06-26T10:00:00Z",
				{
					inFlight: "working on middleware",
					openQuestions: "jwt vs cookies?",
					cursor: "auth.ts:42",
				},
			);
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "",
				sections: [section],
			});
			const parsed = parseCurrentMd(initial);
			expect(parsed.sections).toHaveLength(1);
			expect(parsed.sections[0]).toEqual(section);
			expect(serializeCurrentMd(parsed)).toBe(initial);
		});

		it("preserves preamble text between # heading and ## Project (shared)", () => {
			const doc = {
				preamble: "This is the explanatory preamble paragraph.",
				sharedSection: "shared body",
				sections: [],
			};
			const serialized = serializeCurrentMd(doc);
			const parsed = parseCurrentMd(serialized);
			expect(parsed.preamble).toBe("This is the explanatory preamble paragraph.");
			expect(parsed.sharedSection).toBe("shared body");
		});
	});

	describe("T1 — upsertSection only touches the calling agent's section", () => {
		it("modifies only the matching section; others byte-identical via roundtrip", () => {
			const sectionA = makeSection(
				"uuid-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				"auth refactor",
				"2026-06-26T10:00:00Z",
				{ inFlight: "original A in-flight", openQuestions: "A questions", cursor: "A cursor" },
			);
			const sectionB = makeSection(
				"uuid-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				"telemetry spike",
				"2026-06-26T11:00:00Z",
				{ inFlight: "original B in-flight", openQuestions: "B questions", cursor: "B cursor" },
			);
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "shared",
				sections: [sectionA, sectionB],
			});

			const updatedSectionA: AgentSection = { ...sectionA, inFlight: "MODIFIED A" };
			const result = upsertSection(initial, updatedSectionA);
			const parsed = parseCurrentMd(result);

			expect(parsed.sections).toHaveLength(2);
			const newA = parsed.sections.find((s) => s.sessionId === sectionA.sessionId);
			const newB = parsed.sections.find((s) => s.sessionId === sectionB.sessionId);
			expect(newA?.inFlight).toBe("MODIFIED A");
			expect(newB).toEqual(sectionB);
		});

		it("preserves Project (shared) when modifying a session section", () => {
			const sectionA = makeSection(
				"uuid-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				"task",
				"2026-06-26T10:00:00Z",
			);
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "important shared state",
				sections: [sectionA],
			});

			const result = upsertSection(initial, { ...sectionA, inFlight: "updated" });
			const parsed = parseCurrentMd(result);
			expect(parsed.sharedSection).toBe("important shared state");
		});
	});

	describe("T2 — upsertSection appends a new section when no match", () => {
		it("appends a new section to an empty document", () => {
			const initial = emptyDoc();
			const newSection = makeSection(
				"uuid-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
				"first task",
				"2026-06-26T12:00:00Z",
				{ inFlight: "first in flight" },
			);
			const result = upsertSection(initial, newSection);
			const parsed = parseCurrentMd(result);

			expect(parsed.sections).toHaveLength(1);
			expect(parsed.sections[0].sessionId).toBe(newSection.sessionId);
			expect(parsed.sections[0].task).toBe("first task");
			expect(parsed.sections[0].inFlight).toBe("first in flight");
		});

		it("appends a new session alongside existing ones (no overwrite)", () => {
			const existing = makeSection(
				"uuid-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				"existing",
				"2026-06-26T10:00:00Z",
			);
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "",
				sections: [existing],
			});

			const newSection = makeSection(
				"uuid-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				"new arrival",
				"2026-06-26T11:00:00Z",
			);
			const result = upsertSection(initial, newSection);
			const parsed = parseCurrentMd(result);

			expect(parsed.sections).toHaveLength(2);
			expect(parsed.sections.map((s) => s.sessionId).sort()).toEqual(
				[existing.sessionId, newSection.sessionId].sort(),
			);
		});

		it("rejects path-traversal session IDs at the lib boundary (T12 regression)", () => {
			const initial = emptyDoc();
			const evil = makeSection("../escaped", "evil", "2026-06-26T10:00:00Z");
			expect(() => upsertSection(initial, evil)).toThrow(/session id/i);
		});
	});

	describe("T4 — editSharedSection edits Project (shared) only", () => {
		it("updates the shared section body; session-owned sections unchanged", () => {
			const sectionA = makeSection(
				"uuid-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				"A task",
				"2026-06-26T10:00:00Z",
				{ inFlight: "A body" },
			);
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "old shared",
				sections: [sectionA],
			});

			const result = editSharedSection(initial, "new shared body");
			const parsed = parseCurrentMd(result);

			expect(parsed.sharedSection).toBe("new shared body");
			expect(parsed.sections).toHaveLength(1);
			expect(parsed.sections[0]).toEqual(sectionA);
		});

		it("accepts an empty shared section body", () => {
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "old shared",
				sections: [],
			});

			const result = editSharedSection(initial, "");
			const parsed = parseCurrentMd(result);
			// Empty body serializes back as "(empty)" in the file, but parses back to ""
			expect(parsed.sharedSection).toBe("");
		});
	});

	describe("T7-lib — removeSection removes named session; others survive", () => {
		it("removes only the named session", () => {
			const a = makeSection("uuid-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "A", "2026-06-26T10:00:00Z");
			const b = makeSection("uuid-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "B", "2026-06-26T11:00:00Z");
			const c = makeSection("uuid-cccc-cccc-cccc-cccccccccccc", "C", "2026-06-26T12:00:00Z");
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "",
				sections: [a, b, c],
			});

			const result = removeSection(initial, b.sessionId);
			const parsed = parseCurrentMd(result);

			expect(parsed.sections).toHaveLength(2);
			expect(parsed.sections.map((s) => s.sessionId)).toEqual([a.sessionId, c.sessionId]);
		});

		it("is a no-op when no section matches", () => {
			const a = makeSection("uuid-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "A", "2026-06-26T10:00:00Z");
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "",
				sections: [a],
			});

			const result = removeSection(initial, "uuid-not-present-not-present-not-present");
			const parsed = parseCurrentMd(result);
			expect(parsed.sections).toEqual([a]);
		});

		it("rejects path-traversal session IDs (T12 regression)", () => {
			const initial = emptyDoc();
			expect(() => removeSection(initial, "../sentinel")).toThrow(/session id/i);
		});
	});

	describe("T8-lib — pruneStaleSections filters by Last updated", () => {
		it("removes sections whose lastUpdated is older than ttlMinutes from now", () => {
			const now = new Date("2026-06-26T12:00:00Z");
			const fresh = makeSection(
				"uuid-ffff-ffff-ffff-ffffffffffff",
				"fresh",
				"2026-06-26T11:30:00Z", // 30 min ago — well under 60min TTL
			);
			const stale = makeSection(
				"uuid-ssss-ssss-ssss-ssssssssssss",
				"stale",
				"2026-06-26T10:00:00Z", // 2h ago — exceeds 60min TTL
			);
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "",
				sections: [fresh, stale],
			});

			const result = pruneStaleSections(initial, 60, now);
			const parsed = parseCurrentMd(result);

			expect(parsed.sections).toHaveLength(1);
			expect(parsed.sections[0].sessionId).toBe(fresh.sessionId);
		});

		it("preserves a section exactly at the boundary (lastUpdated equal to cutoff)", () => {
			const now = new Date("2026-06-26T12:00:00Z");
			const boundary = makeSection(
				"uuid-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				"boundary",
				"2026-06-26T11:00:00Z", // exactly 60 min ago
			);
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "",
				sections: [boundary],
			});

			const result = pruneStaleSections(initial, 60, now);
			const parsed = parseCurrentMd(result);
			expect(parsed.sections).toHaveLength(1);
		});

		it("keeps sections with malformed timestamps (does not silently drop)", () => {
			const now = new Date("2026-06-26T12:00:00Z");
			const malformed = makeSection(
				"uuid-mmmm-mmmm-mmmm-mmmmmmmmmmmm",
				"malformed",
				"this is not a timestamp",
			);
			const initial = serializeCurrentMd({
				preamble: "",
				sharedSection: "",
				sections: [malformed],
			});

			const result = pruneStaleSections(initial, 60, now);
			const parsed = parseCurrentMd(result);
			expect(parsed.sections).toHaveLength(1);
		});
	});

	describe("listSections", () => {
		it("partitions sections into fresh and stale by ttlMinutes", () => {
			const now = new Date("2026-06-26T12:00:00Z");
			const fresh = makeSection(
				"uuid-ffff-ffff-ffff-ffffffffffff",
				"fresh",
				"2026-06-26T11:30:00Z",
			);
			const stale = makeSection(
				"uuid-ssss-ssss-ssss-ssssssssssss",
				"stale",
				"2026-06-26T10:00:00Z",
			);
			const content = serializeCurrentMd({
				preamble: "",
				sharedSection: "",
				sections: [fresh, stale],
			});

			const { fresh: f, stale: s } = listSections(content, 60, now);
			expect(f).toHaveLength(1);
			expect(s).toHaveLength(1);
			expect(f[0].sessionId).toBe(fresh.sessionId);
			expect(s[0].sessionId).toBe(stale.sessionId);
		});

		it("returns empty arrays when the file has no sessions", () => {
			const content = emptyDoc();
			const { fresh, stale } = listSections(content, 60, new Date());
			expect(fresh).toEqual([]);
			expect(stale).toEqual([]);
		});
	});
});

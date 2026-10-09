import { describe, expect, it } from "vitest";
import { nextSession } from "./next-session.js";

/** promise: a-plan-boundary-names-the-next-session — model-per-phase A11. */

const impl = (box1: string, box2: string) =>
	[
		"---",
		'title: "demo"',
		"status: in-progress",
		"---",
		"",
		"### Build Phase 1: One",
		"",
		`- [${box1}] build one`,
		"",
		"### Build Phase 2: Two",
		"",
		"**Tier**: strong — security work",
		"",
		`- [${box2}] build two`,
		"",
	].join("\n");

const config = {
	tiers: { strong: "opus", med: "sonnet" },
	steps: { work: "med" },
} as const;

describe("model-per-phase A11 — a closed phase names what to run next", () => {
	it("with Build Phase 1 closed and Build Phase 2 open, names /work and Build Phase 2's tier", () => {
		const line = nextSession("demo", impl("x", " "), { config });
		expect(line).toContain("/work demo");
		expect(line).toContain("Build Phase 2");
		expect(line).toContain("strong (opus)");
		expect(line).toMatch(/new session/);
	});

	it("names no model when the project configures none", () => {
		expect(nextSession("demo", impl("x", " "))).toBe(
			"In a new session, run: /work demo — next is Build Phase 2",
		);
	});

	it("with every phase closed, names /falsify, then /cleanup, then /retrospective", () => {
		expect(nextSession("demo", impl("x", "x"))).toContain("/falsify demo");
		expect(nextSession("demo", impl("x", "x"), { missing: ["cleanup"] })).toContain(
			"/cleanup demo",
		);
		expect(nextSession("demo", impl("x", "x"), { missing: [] })).toContain("/retrospective demo");
	});
});

import { describe, expect, it } from "vitest";
import { nextSession } from "./next-session.js";

/**
 * promise: a-plan-boundary-names-the-next-session — model-per-phase A11.
 * promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes — plan-review-subagent A3.
 */

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
		expect(nextSession("demo", impl("x", "x"), { readiness: { missing: ["cleanup"] } })).toContain(
			"/cleanup demo",
		);
		expect(nextSession("demo", impl("x", "x"), { readiness: { missing: [] } })).toContain(
			"/retrospective demo",
		);
	});
});

describe("model-per-phase A18 — a boundary agrees with what the build decides next", () => {
	it("a phase with a blocker names the blocker, not /work", () => {
		const body = impl("x", " ").replace(
			"### Build Phase 2: Two\n",
			"### Build Phase 2: Two\n\nblocker: the upstream API has no batch call\n",
		);
		const line = nextSession("demo", body);
		expect(line).toContain("the upstream API has no batch call");
		expect(line).not.toContain("/work demo");
	});

	it("a phase waiting on a person names the item, not /work", () => {
		const body = impl("x", " ").replace(
			"- [ ] build two",
			"- [ ] manual smoke: does the page look right",
		);
		const line = nextSession("demo", body);
		expect(line).toContain("manual smoke");
		expect(line).not.toContain("/work demo");
	});

	it("every phase closed with rows still open names the rows, not /retrospective", () => {
		const line = nextSession("demo", impl("x", "x"), {
			readiness: { missing: ["rows"], nonTerminalRows: ["T3"] },
		});
		expect(line).toContain("T3");
		expect(line).not.toContain("/retrospective");
	});
});

describe("plan-review-subagent A3 — the cleanup's close names the audit, then the retrospective", () => {
	it("with every phase closed and only the audit missing, names /audit", () => {
		const line = nextSession("demo", impl("x", "x"), { readiness: { missing: ["audit"] } });
		expect(line).toContain("/audit demo");
		expect(line).not.toContain("/retrospective");
	});

	it("once audit.md exists (nothing missing), names /retrospective", () => {
		const line = nextSession("demo", impl("x", "x"), { readiness: { missing: [] } });
		expect(line).toContain("/retrospective demo");
		expect(line).not.toContain("/audit");
	});
});

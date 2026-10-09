import { describe, expect, it } from "vitest";
import { nextTier, phaseTier, phaseTierLines, tierForPhase, tierRuleProblems } from "./tiers.js";

/**
 * promise: each-phase-runs-on-its-model — model-per-phase A1–A4.
 * promise: a-struggling-phase-asks-for-a-stronger-model — model-per-phase A8, A9.
 */

const config = {
	tiers: { strong: "opus", med: "sonnet", weak: "haiku", baby: "haiku" },
	steps: { work: "med" },
} as const;

describe("model-per-phase A1–A4 — the model a phase is built on", () => {
	it("A1 — a phase naming no tier takes the work step's default tier", () => {
		expect(tierForPhase(config, "work", undefined)).toEqual({ tier: "med", model: "sonnet" });
	});

	it("A2 — a phase naming a tier takes that tier's model", () => {
		expect(tierForPhase(config, "work", { tier: "strong" })).toEqual({
			tier: "strong",
			model: "opus",
		});
	});

	it("A3 — changing a tier's model in the config changes the answer, with no plan edited", () => {
		const changed = { ...config, tiers: { ...config.tiers, med: "fable" } };
		expect(tierForPhase(changed, "work", undefined)?.model).toBe("fable");
	});

	it("A4 — a config naming no tiers answers null: the session's own model", () => {
		expect(tierForPhase({ tiers: {}, steps: {} }, "work", undefined)).toBeNull();
		expect(tierForPhase({ tiers: {}, steps: { work: "med" } }, "work", undefined)).toBeNull();
	});
});

describe("model-per-phase A8, A9 — three misses move a phase up", () => {
	it("A8 — med after three misses names strong; fewer keep going", () => {
		expect(nextTier("med", 3)).toBe("strong");
		expect(nextTier("med", 2)).toBeNull();
		expect(nextTier("weak", 3)).toBe("med");
	});

	it("A9 — strong after three misses is a blocker, naming no higher tier", () => {
		expect(nextTier("strong", 3)).toBe("blocker");
	});
});

describe("the tier line", () => {
	const body = [
		"### Build Phase 1: A",
		"",
		"**Tier**: strong — rewrites how commands run",
		"",
		"### Build Phase 2: B",
		"",
		"```",
		"**Tier**: baby",
		"```",
		"**Tier**: weak",
	].join("\n");

	it("reads the tier and reason under each phase, skipping fenced blocks", () => {
		expect(phaseTierLines(body)).toEqual([
			{ ref: { kind: "build", number: 1 }, tier: "strong", reason: "rewrites how commands run" },
			{ ref: { kind: "build", number: 2 }, tier: "weak", reason: null },
		]);
		expect(phaseTier(body, { kind: "build", number: 2 })?.tier).toBe("weak");
		expect(phaseTier(body, { kind: "test", number: 1 })).toBeUndefined();
	});

	it("names the phase for a missing reason and for an unknown tier", () => {
		expect(tierRuleProblems(body, "weak")).toEqual([]);
		expect(tierRuleProblems(body, "med")).toEqual([expect.stringContaining("Build Phase 2")]);
		expect(tierRuleProblems("### Build Phase 1: A\n\n**Tier**: huge — x\n", "weak")[0]).toContain(
			"huge",
		);
	});
});

describe("model-per-phase A14, A15 — one tier line; a tier needs a model", () => {
	it("A14 — a phase with two tier lines is a problem naming the phase", () => {
		const body = "### Build Phase 1: A\n\n**Tier**: weak\n**Tier**: strong — failed three times\n";
		expect(tierRuleProblems(body, "weak", config.tiers)).toEqual([
			expect.stringContaining("Build Phase 1"),
		]);
		expect(tierRuleProblems(body, "weak", config.tiers)[0]).toMatch(/more than one/);
	});

	it("A15 — a tier with no model is a problem naming it; tierForPhase throws for it", () => {
		const body = "### Build Phase 1: A\n\n**Tier**: strong — security\n";
		const tiers = { med: "sonnet" };
		expect(tierRuleProblems(body, "med", tiers)[0]).toMatch(/strong.*no model/);
		expect(() =>
			tierForPhase({ tiers, steps: { work: "med" } }, "work", { tier: "strong" }),
		).toThrow(/strong/);
		expect(tierRuleProblems(body, "med", {})).toEqual([]);
		expect(tierForPhase({ tiers: {}, steps: {} }, "work", { tier: "strong" })).toBeNull();
	});
});

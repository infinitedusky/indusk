import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { tierRuleProblems as hookRule, tierConfigProblems } from "../../hooks/_phase-tier.js";
import { TIER_STEPS } from "../lib/models/tier-names.js";
import { readTierConfig, tierRuleProblems } from "../lib/models/tiers.js";

/**
 * promise: a-model-override-says-why — model-per-phase A17.
 *
 * The hook cannot import TypeScript, so `_phase-tier.js` carries a copy of the
 * tier rule and of the config check. A copy that falls behind does not
 * announce itself: the validator would wave through what `plans model`
 * refuses, or refuse what the package accepts. Both read the same inputs here
 * and must say the same thing.
 */

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const body = (...lines: string[]) => ["### Build Phase 1: A", "", ...lines, ""].join("\n");
const TIERS = { strong: "opus", med: "sonnet" };

describe("A17 — the hook's tier rule and the package's agree", () => {
	const cases: Array<[string, string, "strong" | "med" | "weak" | undefined, object]> = [
		["no tier line", body(), "med", TIERS],
		["a reason-less override", body("**Tier**: strong"), "med", TIERS],
		["an override with a reason", body("**Tier**: strong — security"), "med", TIERS],
		["an unknown tier", body("**Tier**: huge — x"), "med", TIERS],
		["two lines", body("**Tier**: med", "**Tier**: strong — failed"), "med", TIERS],
		["a tier with no model", body("**Tier**: weak — cheap"), "med", TIERS],
		["a tier with no tiers configured", body("**Tier**: strong"), "med", {}],
		["no default tier", body("**Tier**: strong"), undefined, TIERS],
		["a test phase", "### Test Phase 1: T\n\n**Tier**: strong\n", "med", TIERS],
	];
	for (const [name, text, def, tiers] of cases) {
		it(name, () => {
			expect(hookRule(text, def, tiers)).toEqual(tierRuleProblems(text, def, tiers));
		});
	}
});

describe("A17 — the hook's config check and the package's reader agree", () => {
	function readerSays(workflow: unknown): string | null {
		const root = mkdtempSync(join(tmpdir(), "phase-tier-parity-"));
		roots.push(root);
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ mode: "full", workflow }));
		try {
			readTierConfig(root);
			return null;
		} catch (err) {
			return (err as Error).message;
		}
	}

	const configs: Array<[string, unknown]> = [
		["a good config", { tiers: TIERS, steps: { work: { tier: "med" } } }],
		["no workflow tiers", { steps: {} }],
		["a key that is not a tier", { tiers: { huge: "opus" } }],
		["a model that is empty", { tiers: { med: "" } }],
		["an unknown default tier", { steps: { work: { tier: "huge" } } }],
		["a step InDusk does not read", { steps: { wrok: { tier: "med" } } }],
	];
	for (const [name, workflow] of configs) {
		it(name, () => {
			const hook = tierConfigProblems({ workflow });
			const reader = readerSays(workflow);
			expect(hook[0] ?? null).toBe(reader);
		});
	}
});

/**
 * promise: the-auditor-runs-on-its-tier — plan-review-subagent A21.
 *
 * Every step `TIER_STEPS` names must be a step the hook reads too: a step added
 * to the TS and not to the hook would make the impl validator refuse any impl
 * write once that step's tier is configured.
 */
describe("A21 — the hook reads every step TIER_STEPS names", () => {
	const steps = Object.fromEntries(TIER_STEPS.map((s) => [s, { tier: "med" }]));
	const workflow = { tiers: TIERS, steps };

	it("the hook reports no problem for a tier set on every step", () => {
		expect(tierConfigProblems({ workflow })).toEqual([]);
	});

	it("the package reader accepts the same config", () => {
		const root = mkdtempSync(join(tmpdir(), "phase-tier-parity-"));
		roots.push(root);
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ mode: "full", workflow }));
		expect(() => readTierConfig(root)).not.toThrow();
	});

	for (const step of TIER_STEPS) {
		it(`step ${step} agrees`, () => {
			expect(tierConfigProblems({ workflow: { tiers: TIERS, steps: { [step]: { tier: "med" } } } })).toEqual([]);
		});
	}
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readTierConfig } from "./tiers.js";

/** promise: each-phase-runs-on-its-model — the config keys model-per-phase reads. */

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function project(workflow: unknown): string {
	const root = mkdtempSync(join(tmpdir(), "tier-config-"));
	roots.push(root);
	mkdirSync(join(root, ".indusk"), { recursive: true });
	writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ mode: "full", workflow }));
	return root;
}

describe("workflow.tiers and workflow.steps.<step>.tier", () => {
	it("reads the tiers and each step's default", () => {
		const root = project({
			tiers: { strong: "opus", med: "sonnet" },
			steps: { work: { tier: "med" }, falsify: { tier: "strong" } },
		});
		expect(readTierConfig(root)).toEqual({
			tiers: { strong: "opus", med: "sonnet" },
			steps: { work: "med", falsify: "strong" },
		});
	});

	it("reads an empty config as no tiers", () => {
		expect(readTierConfig(project({ steps: {} }))).toEqual({ tiers: {}, steps: {} });
	});

	it("refuses a key that is not a tier, a step's unknown tier, and a step it does not read, naming each", () => {
		expect(() => readTierConfig(project({ tiers: { huge: "opus" } }))).toThrow(
			"workflow.tiers.huge",
		);
		expect(() => readTierConfig(project({ steps: { work: { tier: "huge" } } }))).toThrow(
			"workflow.steps.work.tier",
		);
		expect(() => readTierConfig(project({ steps: { wrok: { tier: "med" } } }))).toThrow(
			"workflow.steps.wrok",
		);
		expect(() => readTierConfig(project({ tiers: { med: "" } }))).toThrow("workflow.tiers.med");
	});
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { implText } from "../../__tests__/helpers/plan-fixture.js";
import { TierConfigError } from "../models/tier-names.js";
import { buildStepModel } from "./step-model.js";

/**
 * promise: each-phase-runs-on-its-model — plan-review-subagent A14. An admin
 * build runs each step's session on the model its tier names: a `work` step on
 * its phase's model (the phase's `**Tier**:` line, or the work step's
 * default), the rituals on their step's default tier; a project with no tiers
 * passes no model.
 */

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const tiers = { strong: "opus", med: "sonnet", weak: "haiku" };

function project(workflow: unknown, tierLine?: string): string {
	const root = mkdtempSync(join(tmpdir(), "step-model-"));
	roots.push(root);
	mkdirSync(join(root, ".indusk", "planning", "seats"), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ mode: "full", otel: { role: "library" }, workflow }),
	);
	const impl = implText("seats", { status: "draft", rows: [{ state: "planned" }] }).replace(
		"### Build Phase 1: Build\n",
		`### Build Phase 1: Build\n\n${tierLine ?? ""}\n`,
	);
	writeFileSync(join(root, ".indusk", "planning", "seats", "impl.md"), impl);
	return root;
}

const PHASE = "Build Phase 1: Build";

describe("buildStepModel — the model each build step runs on", () => {
	it("A14 — a work step runs on its phase's own tier", async () => {
		const root = project({ tiers, steps: { work: { tier: "med" } } }, "**Tier**: strong — risky");
		expect(await buildStepModel(root, "seats", "work", PHASE)).toEqual({
			tier: "strong",
			model: "opus",
		});
	});

	it("A14 — a work step with no tier line runs on the work step's default", async () => {
		const root = project({ tiers, steps: { work: { tier: "med" } } });
		expect(await buildStepModel(root, "seats", "work", PHASE)).toEqual({
			tier: "med",
			model: "sonnet",
		});
	});

	it("A14 — falsify, cleanup, audit and retrospective run on their step's default tier", async () => {
		const root = project({
			tiers,
			steps: {
				work: { tier: "med" },
				falsify: { tier: "strong" },
				cleanup: { tier: "weak" },
				audit: { tier: "strong" },
				retrospective: { tier: "med" },
			},
		});
		expect(await buildStepModel(root, "seats", "falsify")).toEqual({
			tier: "strong",
			model: "opus",
		});
		expect(await buildStepModel(root, "seats", "cleanup")).toEqual({
			tier: "weak",
			model: "haiku",
		});
		expect(await buildStepModel(root, "seats", "audit")).toEqual({ tier: "strong", model: "opus" });
		expect(await buildStepModel(root, "seats", "retrospective")).toEqual({
			tier: "med",
			model: "sonnet",
		});
	});

	it("A14 — a project with no tiers passes no model, for every step", async () => {
		const root = project({});
		expect(await buildStepModel(root, "seats", "work", PHASE)).toBeNull();
		expect(await buildStepModel(root, "seats", "falsify")).toBeNull();
		expect(await buildStepModel(root, "seats", "audit")).toBeNull();
	});

	it("A14 — a tier with no model is a TierConfigError, not the session's model", async () => {
		const root = project({ tiers: { med: "sonnet" }, steps: { audit: { tier: "strong" } } });
		await expect(buildStepModel(root, "seats", "audit")).rejects.toBeInstanceOf(TierConfigError);
	});
});

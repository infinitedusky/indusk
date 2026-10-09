import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { implText } from "./helpers/plan-fixture.js";

/**
 * promise: each-phase-runs-on-its-model — model-per-phase A15, A16; plan-review-subagent A12; through
 * `indusk plans model`. A config the command cannot read, or a tier it has no
 * model for, is a refusal that names the cause — never a stack trace, and
 * never the answer `session`, which would build the phase on the wrong model.
 */

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function project(workflow: unknown, tierLine?: string): string {
	const root = mkdtempSync(join(tmpdir(), "plans-model-"));
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

const run = (root: string) => runCli(root, ["plans", "model", "seats", "--phase", "Build Phase 1"]);

describe.skipIf(SHOULD_SKIP)("indusk plans model — refusals", () => {
	it("A15 — a phase naming a tier the config has no model for is refused, naming the tier", () => {
		const root = project({ tiers: { med: "sonnet" } }, "**Tier**: strong — security work");
		const r = run(root);
		expect(r.code).toBe(1);
		expect(r.stdout.trim()).not.toBe("session");
		expect(r.stderr).toMatch(/strong/);
		expect(r.stderr).not.toMatch(/\n\s+at /);
	});

	it("A16 — a tier key that is not a tier is a refusal naming the key, not a stack trace", () => {
		const r = run(project({ tiers: { huge: "opus" } }));
		expect(r.code).toBe(1);
		expect(r.stderr).toContain("workflow.tiers.huge");
		expect(r.stderr).not.toMatch(/\n\s+at /);
	});

	it("A16 — an unknown default tier on a step is a refusal naming the key", () => {
		const r = run(project({ tiers: { med: "sonnet" }, steps: { work: { tier: "huge" } } }));
		expect(r.code).toBe(1);
		expect(r.stderr).toContain("workflow.steps.work.tier");
		expect(r.stderr).not.toMatch(/\n\s+at /);
	});
});

const runStep = (root: string, step: string) =>
	runCli(root, ["plans", "model", "seats", "--step", step]);

describe.skipIf(SHOULD_SKIP)("indusk plans model --step — the audit's tier", () => {
	it("A8 — with workflow.steps.audit.tier set, answers that tier's model", () => {
		const root = project({
			tiers: { strong: "opus", med: "sonnet" },
			steps: { audit: { tier: "strong" } },
		});
		const r = runStep(root, "audit");
		expect(r.code, r.stderr).toBe(0);
		expect(r.stdout.trim()).toBe("strong opus");
	});

	it("A8 — with no tiers configured, answers `session`", () => {
		const r = runStep(project({}), "audit");
		expect(r.code, r.stderr).toBe(0);
		expect(r.stdout.trim()).toBe("session");
	});

	it("A8 — an unknown step is refused, naming it", () => {
		const r = runStep(project({ tiers: { med: "sonnet" } }), "huge");
		expect(r.code).toBe(1);
		expect(r.stderr).toContain("huge");
		expect(r.stderr).not.toMatch(/\n\s+at /);
	});

	it("A8 — `steps.audit` with a tier the config has no model for is refused, naming the key", () => {
		const r = runStep(
			project({ tiers: { med: "sonnet" }, steps: { audit: { tier: "huge" } } }),
			"audit",
		);
		expect(r.code).toBe(1);
		expect(r.stderr).toContain("workflow.steps.audit.tier");
	});
});

describe.skipIf(SHOULD_SKIP)("indusk plans model --phase — unchanged by steps.audit", () => {
	const tiers = { strong: "opus", med: "sonnet" };
	const phase = (workflow: unknown, tierLine?: string) => {
		const r = run(project(workflow, tierLine));
		expect(r.code, r.stderr).toBe(0);
		return r.stdout.trim();
	};
	const own = "**Tier**: strong — security work";

	it("A12 — the baseline: a phase's default, and a phase naming its own tier, without steps.audit", () => {
		expect(phase({ tiers, steps: { work: { tier: "med" } } })).toBe("med sonnet");
		expect(phase({ tiers, steps: { work: { tier: "med" } } }, own)).toBe("strong opus");
	});

	// RED until Build Phase 2: the config reader refuses `steps.audit` today
	// ("workflow.steps.audit is not a step InDusk reads"), so the with-audit half
	// of the row cannot hold before `audit` joins TIER_STEPS.
	it("A12 — a phase's default answers the same with steps.audit as without", () => {
		const withAudit = { tiers, steps: { work: { tier: "med" }, audit: { tier: "strong" } } };
		expect(phase(withAudit)).toBe("med sonnet");
	});

	it("A12 — a phase naming its own tier answers the same with steps.audit as without", () => {
		const withAudit = { tiers, steps: { work: { tier: "med" }, audit: { tier: "med" } } };
		expect(phase(withAudit, own)).toBe("strong opus");
	});
});

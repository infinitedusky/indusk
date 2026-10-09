import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { implText } from "./helpers/plan-fixture.js";

/**
 * promise: each-phase-runs-on-its-model — model-per-phase A15, A16, through
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

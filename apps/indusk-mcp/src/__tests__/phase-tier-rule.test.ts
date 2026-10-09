import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import { implText } from "./helpers/plan-fixture.js";

/**
 * promise: a-model-override-says-why — model-per-phase A6, A7.
 *
 * A phase that names a tier other than its step's default says why, and the
 * tier is one of strong, med, weak or baby; otherwise the impl is refused when
 * written, naming the phase. Driven through the real hook, in a project whose
 * config gives the work step the tier `weak`.
 */

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

async function validate(tierLine: string) {
	const root = mkdtempSync(join(tmpdir(), "phase-tier-"));
	roots.push(root);
	const dir = join(root, ".indusk", "planning", "seats");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({
			otel: { role: "library" },
			workflow: {
				tiers: { strong: "opus", med: "sonnet", weak: "haiku", baby: "haiku" },
				steps: { work: { tier: "weak" } },
			},
		}),
	);
	const impl = implText("seats", { status: "draft", rows: [{ state: "planned" }] }).replace(
		"### Build Phase 1: Build\n",
		`### Build Phase 1: Build\n\n${tierLine}\n`,
	);
	const path = join(dir, "impl.md");
	writeFileSync(path, impl);
	return runHook("validate-impl-structure.js", {
		tool_name: "Write",
		tool_input: { file_path: path, content: impl },
		cwd: root,
	});
}

describe("model-per-phase A6 — a tier other than the step's default carries its reason", () => {
	it("refuses a different tier with no reason, naming the phase", async () => {
		const r = await validate("**Tier**: strong");
		expect(r.exitCode, "a tier override that says nothing about why").not.toBe(0);
		expect(r.stderr).toMatch(/Build Phase 1/);
		expect(r.stderr).toMatch(/reason/i);
	});
});

describe("model-per-phase A7 — a reason is enough; an unknown tier is not", () => {
	it("accepts a different tier with a reason", async () => {
		const r = await validate("**Tier**: strong — rewrites how commands run");
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("refuses a tier that is not strong, med, weak or baby, naming it", async () => {
		const r = await validate("**Tier**: huge — x");
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toContain("huge");
	});
});

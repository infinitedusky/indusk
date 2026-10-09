import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import { implText } from "./helpers/plan-fixture.js";

/**
 * promise: a-model-override-says-why — model-per-phase A6, A7, A13.
 * promise: each-phase-runs-on-its-model — A15, A16 (a tier needs a model; a bad config refuses).
 * promise: a-struggling-phase-asks-for-a-stronger-model — A14 (one tier line, so the escalated one is read).
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

const TIERS = { strong: "opus", med: "sonnet", weak: "haiku", baby: "haiku" };

async function validate(
	tierLine: string,
	opts: { workflow?: unknown; edit?: { from: string } } = {},
) {
	const root = mkdtempSync(join(tmpdir(), "phase-tier-"));
	roots.push(root);
	const dir = join(root, ".indusk", "planning", "seats");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({
			otel: { role: "library" },
			workflow: opts.workflow ?? { tiers: TIERS, steps: { work: { tier: "weak" } } },
		}),
	);
	const impl = implText("seats", { status: "draft", rows: [{ state: "planned" }] }).replace(
		"### Build Phase 1: Build\n",
		`### Build Phase 1: Build\n\n${tierLine}\n`,
	);
	const path = join(dir, "impl.md");
	if (opts.edit) {
		// The file on disk holds the line as it was; the hook is handed only the Edit.
		writeFileSync(path, impl.replace(tierLine, opts.edit.from));
		return runHook("validate-impl-structure.js", {
			tool_name: "Edit",
			tool_input: { file_path: path, old_string: opts.edit.from, new_string: tierLine },
			cwd: root,
		});
	}
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

describe("model-per-phase A13 — an Edit of only the tier line is held to the rule", () => {
	const from = "**Tier**: strong — rewrites how commands run";

	it("refuses an Edit that drops the reason, naming the phase", async () => {
		const r = await validate("**Tier**: strong", { edit: { from } });
		expect(r.exitCode, "an Edit of the tier line alone").not.toBe(0);
		expect(r.stderr).toMatch(/Build Phase 1/);
	});

	it("refuses an Edit that names an unknown tier", async () => {
		const r = await validate("**Tier**: huge — x", { edit: { from } });
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toContain("huge");
	});

	it("accepts an Edit that keeps its reason", async () => {
		const r = await validate("**Tier**: med — simple after all", { edit: { from } });
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("model-per-phase A14 — one tier line per phase", () => {
	it("refuses a phase with two tier lines, naming it", async () => {
		const r = await validate("**Tier**: weak\n**Tier**: strong — failed three times on weak");
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toMatch(/Build Phase 1/);
		expect(r.stderr).toMatch(/more than one/);
	});
});

describe("model-per-phase A15 — a tier needs a model", () => {
	it("refuses a tier the config has no model for, naming the tier", async () => {
		const r = await validate("**Tier**: strong — security work", {
			workflow: { tiers: { med: "sonnet" }, steps: { work: { tier: "med" } } },
		});
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toContain("strong");
		expect(r.stderr).toMatch(/no model/);
	});

	it("leaves a project that names no tiers alone, as before tiers existed", async () => {
		const r = await validate("**Tier**: strong — security work", { workflow: { steps: {} } });
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("model-per-phase A16 — the validator reads the config as plans model does", () => {
	it("refuses an unknown default tier on the work step, naming the key", async () => {
		const r = await validate("**Tier**: strong", {
			workflow: { tiers: TIERS, steps: { work: { tier: "huge" } } },
		});
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toContain("workflow.steps.work.tier");
	});
});

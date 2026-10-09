import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { briefText, implText } from "./helpers/plan-fixture.js";
import {
	DOMAIN,
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";
import { writePromise } from "./helpers/promises-fixture.js";

/**
 * promise: the-auditor-sees-the-plan-not-the-session — plan-review-subagent A5, A6, A7.
 *
 * `indusk plans audit-inputs <plan>` hands the auditor the plan's brief, test
 * plan and ADR, the impl as it was merged at approval, the trajectory table as
 * it stands, the branch's diff against the trunk and a `--stat` of the whole
 * tree — and nothing of the session: no research, no current.md. Through the
 * CLI, over a plan approved with `indusk plans approve` and built on after.
 */

const PLAN = "seat-holds";
const NAME = "seat-released-on-timeout";
const SENTENCE = "A held seat is released when its hold runs out.";
const planDir = `.indusk/planning/${PLAN}`;

const FALSIFICATION = "Falsification — holds that never expire";

let p: PlanLifecycleProject;
let wt: string;

/** An approved plan, then a build that falsified, wrote code, and left bookkeeping behind. */
function approvedAndBuilt(): void {
	writePromise(join(wt, ".indusk", "promises"), {
		name: NAME,
		kind: "state",
		state: "declared",
		domain: DOMAIN,
		owner: PLAN,
		statement: SENTENCE,
	});
	p.commit(
		wt,
		{
			[`${planDir}/brief.md`]: `${briefText(PLAN, { makes: [{ name: NAME, sentence: SENTENCE }] })}\nMARK-BRIEF\n`,
			[`${planDir}/test-plan.md`]: "# Test Plan\n\nMARK-TESTPLAN\n",
			[`${planDir}/adr.md`]: "# ADR\n\nMARK-ADR\n",
			[`${planDir}/research.md`]: "# Research\n\nMARK-RESEARCH\n",
			[`${planDir}/impl.md`]: implText(PLAN, { status: "draft", rows: [{ state: "planned" }] }),
		},
		"plan documents",
	);
	const approve = runCli(p.trunk, ["plans", "approve", PLAN]);
	expect(approve.code, `${approve.stdout}\n${approve.stderr}`).toBe(0);

	const built = `${implText(PLAN, { rows: [{ state: "passing" }] })}\n### Build Phase 2: ${FALSIFICATION}\n\n- [x] read the expiry from a monotonic clock\n`;
	p.commit(
		wt,
		{
			[`${planDir}/impl.md`]: built,
			"src/seat-release.ts": "export const MARK_CODE = 1;\n",
			".indusk/current.md": "# eval notes\n\nMARK-CURRENT\n",
			".indusk/planning/other-plan/notes.md": "MARK-OTHER-PLAN\n",
		},
		"the build",
	);
}

beforeEach(() => {
	p = planLifecycleProject("plans-audit-inputs");
	wt = p.makeWorktree(PLAN);
});
afterEach(() => p.cleanup());

/** A field's text, whether the command gives the text itself or `{ path, text }`. */
function textOf(v: unknown): string {
	if (typeof v === "string") return v;
	if (v && typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
	return JSON.stringify(v ?? "");
}

function inputs(): Record<string, unknown> {
	const r = runCli(p.trunk, ["plans", "audit-inputs", PLAN]);
	expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
	return JSON.parse(r.stdout);
}

describe.skipIf(SHOULD_SKIP)("indusk plans audit-inputs", () => {
	it("A5 — the plan's documents, the diff and the whole-tree stat, and nothing of the session", () => {
		approvedAndBuilt();
		const got = inputs();
		const all = JSON.stringify(got);
		expect(all).toContain("MARK-BRIEF");
		expect(all).toContain("MARK-TESTPLAN");
		expect(all).toContain("MARK-ADR");
		expect(textOf(got.diff)).toContain("MARK_CODE");
		expect(textOf(got.stat)).toContain("src/seat-release.ts");
		expect(all).not.toContain("MARK-RESEARCH");
		expect(all).not.toContain("MARK-CURRENT");
	});

	it("A6 — the impl is the one merged at approval, with none of the later phases; the table is as it stands", () => {
		approvedAndBuilt();
		const got = inputs();
		const approved = textOf(got.implAsApproved);
		expect(approved).toContain("### Build Phase 1");
		expect(approved).not.toContain(FALSIFICATION);
		expect(approved).toMatch(/\|\s*planned\s*\|/);
		const now = textOf(got.trajectoryNow);
		expect(now).toMatch(/\|\s*passing\s*\|/);
		expect(now).not.toMatch(/\|\s*planned\s*\|/);
	});

	it("A6 — a plan with no approval merge is refused, naming the plan", () => {
		p.commit(wt, { [`${planDir}/impl.md`]: implText(PLAN, { rows: [{ state: "planned" }] }) }, "x");
		const r = runCli(p.trunk, ["plans", "audit-inputs", PLAN]);
		expect(r.code).not.toBe(0);
		expect(`${r.stdout}\n${r.stderr}`).toContain(PLAN);
		expect(`${r.stdout}\n${r.stderr}`).toMatch(/approv/i);
	});

	it("A7 — the diff holds the plan's code and leaves out InDusk's bookkeeping", () => {
		approvedAndBuilt();
		const diff = textOf(inputs().diff);
		expect(diff).toContain("src/seat-release.ts");
		expect(diff).toContain(FALSIFICATION);
		expect(diff).not.toContain("MARK-CURRENT");
		expect(diff).not.toContain("MARK-OTHER-PLAN");
		expect(diff).not.toContain(".indusk/promises");
	});
});

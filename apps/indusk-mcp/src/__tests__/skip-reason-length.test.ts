// promise: a-skip-reason-is-one-sentence
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkRetrospectiveReadiness, skippedRitualsOf } from "../lib/cleanup/gate.js";
import { derivePlanPosition } from "../lib/lifecycle.js";
import type { PlanSummary } from "../lib/plan-parser.js";

/**
 * skip-reason-why, Test Phase 1: a skipped falsification, cleanup or audit is
 * refused at the retrospective unless its reason is one short sentence
 * (at most 120 characters), and the skills that write a skip show one.
 *
 * A4 cleanup, A5 falsification and audit, A6 the plan's status wording,
 * A7 the three skills, A9 (regression guard) a short skip still passes.
 */

const LIMIT = 120;
const SHORT = "nothing to do here";
const LONG = "x".repeat(LIMIT + 1);

type Ritual = "falsification" | "cleanup" | "audit";
const RITUALS: Ritual[] = ["falsification", "cleanup", "audit"];

function planWith(reasons: Record<Ritual, string>) {
	const dir = mkdtempSync(join(tmpdir(), "skip-reason-length-"));
	const frontmatter = RITUALS.map((r) => `${r}: skipped\n${r}_reason: "${reasons[r]}"`).join("\n");
	const content = `---\n${frontmatter}\n---\n\n## Checklist\n\n### Phase 1: Config\n\n- [x] do the thing\n`;
	writeFileSync(join(dir, "impl.md"), content);
	return { planRoot: dir, content };
}

const allShort = (): Record<Ritual, string> => ({
	falsification: SHORT,
	cleanup: SHORT,
	audit: SHORT,
});

describe("A4 — a cleanup skipped with a long reason is not ready for the retrospective", () => {
	it("A4 names cleanup as not satisfied when its skip reason is over 120 characters", () => {
		const { planRoot, content } = planWith({ ...allShort(), cleanup: LONG });
		const r = checkRetrospectiveReadiness(planRoot, content);
		expect(r.passes).toBe(false);
		expect(r.missing).toContain("cleanup");
	});
});

describe("A5 — the same for a skipped falsification and a skipped audit", () => {
	it("A5 names falsification as not satisfied when its skip reason is over 120 characters", () => {
		const { planRoot, content } = planWith({ ...allShort(), falsification: LONG });
		const r = checkRetrospectiveReadiness(planRoot, content);
		expect(r.passes).toBe(false);
		expect(r.missing).toContain("falsification");
	});

	it("A5 names audit as not satisfied when its skip reason is over 120 characters", () => {
		const { planRoot, content } = planWith({ ...allShort(), audit: LONG });
		const r = checkRetrospectiveReadiness(planRoot, content);
		expect(r.passes).toBe(false);
		expect(r.missing).toContain("audit");
	});
});

describe("A6 — the plan's status says the skip reason is too long", () => {
	it("A6 reads 'too long' rather than 'awaiting /cleanup' for a completed impl with a long cleanup skip", () => {
		const { planRoot, content } = planWith({ ...allShort(), cleanup: LONG });
		const readiness = checkRetrospectiveReadiness(planRoot, content);
		const summary = {
			stage: "impl",
			stageStatus: "completed",
			documents: ["brief", "test-plan", "impl"],
			workflow: "feature",
		} as unknown as PlanSummary;
		const { awaiting } = derivePlanPosition({
			summary,
			impl: null,
			readiness,
			archived: false,
		});
		expect(awaiting).toMatch(/too long/);
		expect(awaiting).not.toMatch(/awaiting \/cleanup/);
	});
});

describe("A7 — the cleanup, falsify and audit skills state the limit beside a short skip example", () => {
	const skills = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");
	for (const ritual of RITUALS) {
		it(`A7 ${ritual}.md: the ${ritual}_reason example is at most 120 characters and the limit is named`, () => {
			const text = readFileSync(
				join(skills, `${ritual === "falsification" ? "falsify" : ritual}.md`),
				"utf-8",
			);
			const example = text.match(new RegExp(`${ritual}_reason:\\s*"([^"]*)"`));
			expect(example, `no ${ritual}_reason example`).not.toBeNull();
			expect((example?.[1] ?? "").length).toBeLessThanOrEqual(LIMIT);
			expect(text).toContain("120 characters");
		});
	}
});

describe("A9 — a short skip is still ready for the retrospective (regression guard)", () => {
	it("A9 passes readiness when every skip reason is 120 characters or fewer", () => {
		const exactly = "y".repeat(LIMIT);
		const { planRoot, content } = planWith({
			falsification: SHORT,
			cleanup: exactly,
			audit: SHORT,
		});
		const r = checkRetrospectiveReadiness(planRoot, content);
		expect(r.passes).toBe(true);
		expect(r.missing).toEqual([]);
	});
});

describe("A11 — a reason of several short sentences is not one sentence", () => {
	it("A11 names cleanup as not satisfied for three short sentences under 120 characters", () => {
		const three = "Done. Nothing here. Fine.";
		expect(three.length).toBeLessThan(LIMIT);
		const { planRoot, content } = planWith({ ...allShort(), cleanup: three });
		const r = checkRetrospectiveReadiness(planRoot, content);
		expect(r.passes).toBe(false);
		expect(r.missing).toContain("cleanup");
	});
});

describe("A12 — a dot inside one sentence is not a sentence end (regression guard)", () => {
	it('A12 passes readiness for one sentence containing "e.g." and a file name', () => {
		const one = "Nothing to clean, e.g. no duplicated code in gate.ts or steps.ts.";
		expect(one.length).toBeLessThanOrEqual(LIMIT);
		const { planRoot, content } = planWith({ ...allShort(), cleanup: one });
		const r = checkRetrospectiveReadiness(planRoot, content);
		expect(r.passes).toBe(true);
		expect(r.missing).toEqual([]);
	});
});

// promise: a-skipped-step-shows-why-on-request
describe("A13 — one list of a plan's skipped rituals, with their reasons", () => {
	it("A13 lists falsification, cleanup and audit skips with their reasons", () => {
		const { content } = planWith({
			falsification: "no new surface",
			cleanup: "a few lines in place",
			audit: "a small fix",
		});
		expect(skippedRitualsOf(content)).toEqual([
			{ ritual: "falsification", reason: "no new surface" },
			{ ritual: "cleanup", reason: "a few lines in place" },
			{ ritual: "audit", reason: "a small fix" },
		]);
	});

	it("A13 lists none for a plan that skips none", () => {
		const content = "---\ntitle: x\n---\n\n## Checklist\n\n### Phase 1: Config\n\n- [x] do the thing\n";
		expect(skippedRitualsOf(content)).toEqual([]);
	});
});

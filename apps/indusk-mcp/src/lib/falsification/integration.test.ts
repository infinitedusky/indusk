import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isFalsificationComplete } from "./log.js";
import { isFalsificationSkipped } from "./skip.js";

const packageRoot = join(import.meta.dirname, "../../..");
const repoRoot = join(packageRoot, "../..");
const retrospectiveSkill = readFileSync(
	join(packageRoot, "skills/retrospective.md"),
	"utf-8",
);
const workSkill = readFileSync(join(packageRoot, "skills/work.md"), "utf-8");

describe("T7: retrospective.md skill references the falsification gate and the skip escape hatch", () => {
	it("has a Step 0 Falsification Gate section", () => {
		expect(retrospectiveSkill).toMatch(/###\s+Step 0:\s+Falsification Gate/);
	});

	it("describes checking both the completion log and the skip frontmatter", () => {
		expect(retrospectiveSkill).toContain("isFalsificationComplete");
		expect(retrospectiveSkill).toContain("isFalsificationSkipped");
	});

	it("names both required skip-reason fields", () => {
		expect(retrospectiveSkill).toContain("falsification: skipped");
		expect(retrospectiveSkill).toContain("falsification_reason");
	});

	it("refuses to proceed to Step 1 without the gate passing", () => {
		expect(retrospectiveSkill).toMatch(/blocking.*gate|not proceed.*Step 1|refuse to run/i);
	});
});

describe("T8: work.md directs the user to run /falsify before /retrospective at completion", () => {
	it("has a Completion step (Step 15)", () => {
		expect(workSkill).toMatch(/15\.\s+\*\*Completion\.\*\*/);
	});

	it("mentions /falsify in the completion step", () => {
		const completionSection = workSkill.slice(workSkill.indexOf("15. **Completion.**"));
		expect(completionSection).toContain("/falsify");
	});

	it("explicitly directs /falsify BEFORE /retrospective", () => {
		const completionSection = workSkill.slice(workSkill.indexOf("15. **Completion.**"));
		// The text should establish ordering: /falsify first, then /retrospective
		const falsifyIdx = completionSection.indexOf("/falsify");
		const retroIdx = completionSection.indexOf("/retrospective");
		expect(falsifyIdx).toBeGreaterThan(-1);
		expect(retroIdx).toBeGreaterThan(-1);
		expect(falsifyIdx).toBeLessThan(retroIdx);
	});

	it("references the skip-reason opt-out", () => {
		const completionSection = workSkill.slice(workSkill.indexOf("15. **Completion.**"));
		expect(completionSection).toContain("falsification: skipped");
		expect(completionSection).toContain("falsification_reason");
	});
});

describe("T9: end-to-end gate check — given a completed plan with no falsification record, the gate refuses", () => {
	it("a plan with no falsification.md and no skip frontmatter fails both gate conditions", () => {
		// Simulate: the retrospective skill's Step 0 logic, applied to a
		// hypothetical plan whose impl is completed but no falsification has run.
		const fakePlanRoot = "/tmp/nonexistent-plan-for-gate-test";
		const implContent = `---
title: "Fake Plan"
status: completed
---

# Fake Plan

## Goal

Do a thing.

## Checklist

### Phase 1: Setup
- [x] done
`;
		const complete = isFalsificationComplete(fakePlanRoot);
		const skipped = isFalsificationSkipped(implContent).skipped;
		const gatePasses = complete || skipped;
		expect(gatePasses).toBe(false);
	});

	it("a plan with valid skip frontmatter passes the gate", () => {
		const fakePlanRoot = "/tmp/nonexistent-plan-for-gate-test-2";
		const implContent = `---
title: "Typo Fix"
status: completed
falsification: skipped
falsification_reason: "two-line typo fix in a docs page; ritual cost > discipline value"
---

# Typo Fix
`;
		const complete = isFalsificationComplete(fakePlanRoot);
		const skipped = isFalsificationSkipped(implContent).skipped;
		const gatePasses = complete || skipped;
		expect(gatePasses).toBe(true);
	});
});

describe("T10: user-facing guide exists and contains required sections", () => {
	const guidePath = join(repoRoot, "apps/indusk-docs/src/guide/falsification-ritual.md");

	it("guide file exists on disk", () => {
		expect(existsSync(guidePath)).toBe(true);
	});

	it("contains all required section headings", () => {
		const guide = readFileSync(guidePath, "utf-8");
		expect(guide).toMatch(/##\s+Why this exists/);
		expect(guide).toMatch(/##\s+The principle/);
		expect(guide).toMatch(/##\s+The ritual/);
		expect(guide).toMatch(/##\s+Three outcomes/);
		expect(guide).toMatch(/##\s+Worked example/);
		expect(guide).toMatch(/Bounty hunting, not candidate generation/);
	});

	it("names the three outcomes by slug", () => {
		const guide = readFileSync(guidePath, "utf-8");
		expect(guide).toContain("Fix in scope");
		expect(guide).toContain("Spawn a new plan");
		expect(guide).toContain("Accept as finding");
	});

	it("documents the two-field skip frontmatter", () => {
		const guide = readFileSync(guidePath, "utf-8");
		expect(guide).toContain("falsification: skipped");
		expect(guide).toContain("falsification_reason:");
	});

	it("establishes the bookend symmetry with Test Trajectory", () => {
		const guide = readFileSync(guidePath, "utf-8");
		expect(guide.toLowerCase()).toContain("bookend");
		expect(guide).toContain("Test Trajectory");
	});
});

describe("T11: VitePress sidebar has an entry linking to /guide/falsification-ritual", () => {
	const configPath = join(repoRoot, "apps/indusk-docs/src/.vitepress/config.ts");

	it("sidebar config includes the guide link", () => {
		const config = readFileSync(configPath, "utf-8");
		expect(config).toContain("/guide/falsification-ritual");
	});

	it("sidebar entry has a human-readable label", () => {
		const config = readFileSync(configPath, "utf-8");
		// Loose match — any text label is fine as long as it points at the guide
		expect(config).toMatch(/text:\s*"Falsification Ritual"\s*,\s*link:\s*"\/guide\/falsification-ritual"/);
	});
});

describe("T12: community lesson cross-links the user-facing guide", () => {
	const lessonPath = join(repoRoot, ".claude/lessons/verification-gates-need-adversarial-framing.md");

	it("lesson file exists", () => {
		expect(existsSync(lessonPath)).toBe(true);
	});

	it("lesson references the guide path", () => {
		const lesson = readFileSync(lessonPath, "utf-8");
		expect(lesson).toContain("guide/falsification-ritual");
	});

	it("lesson has a See Also section", () => {
		const lesson = readFileSync(lessonPath, "utf-8");
		expect(lesson).toMatch(/##\s+See Also/);
	});
});

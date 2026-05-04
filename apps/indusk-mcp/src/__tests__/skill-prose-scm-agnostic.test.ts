import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T9 + T10 — skill prose is SCM-aware.
 *
 * - T9: `apps/indusk-mcp/skills/git.md` exists with `git commit -m` content;
 *   `apps/indusk-mcp/skills/jj.md` is byte-equal to its pre-Phase-4 snapshot
 *   (the file MUST NOT be edited during Phase 4 — it's the regression target).
 * - T10: `apps/indusk-mcp/skills/work.md` commit-cadence section contains
 *   both `jj describe` and `git commit` so the agent doesn't pick one SCM
 *   as the only path.
 *
 * RED AT PHASE 4 START — git.md doesn't exist yet, work.md mentions only
 * `jj describe`.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const SKILLS_DIR = join(REPO_ROOT, "apps/indusk-mcp/skills");
const FIXTURE = join(__dirname, "fixtures/jj-skill-pre-phase-4.md");

describe("skill prose SCM agnostic (T9, T10)", () => {
	it("T9: git.md exists and contains git commit -m guidance", () => {
		const path = join(SKILLS_DIR, "git.md");
		const content = readFileSync(path, "utf-8");
		expect(content).toContain("git commit -m");
		expect(content.length).toBeGreaterThan(500);
	});

	it("T9: jj.md is byte-equal to its pre-Phase-4 snapshot", () => {
		const current = readFileSync(join(SKILLS_DIR, "jj.md"), "utf-8");
		const snapshot = readFileSync(FIXTURE, "utf-8");
		expect(current).toBe(snapshot);
	});

	it("T10: work.md commit-cadence section mentions both jj describe and git commit", () => {
		const work = readFileSync(join(SKILLS_DIR, "work.md"), "utf-8");
		expect(work).toContain("jj describe");
		expect(work).toContain("git commit");
	});
});

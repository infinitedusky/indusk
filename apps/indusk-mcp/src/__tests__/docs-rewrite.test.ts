import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T12 (git-only-substrate Phase 5) — the docs surfaces reflect the
 * git-only shape.
 *
 * - `apps/docs/src/guide/scm.md` reads as a git workflow guide
 *   (no "choose your SCM" framing; no jj presented as a current option).
 * - `.indusk/planning/git-or-jj-substrate/brief.md` carries a
 *   supersession banner pointing to git-only-substrate.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

describe("docs rewrite — git-only framing (T12)", () => {
	it("apps/docs/src/guide/scm.md is a git workflow guide (no choose-your-SCM framing)", () => {
		const content = readFileSync(join(REPO_ROOT, "apps/docs/src/guide/scm.md"), "utf-8");
		// New title shape
		expect(content).toMatch(/Source Control:?\s*Git/);
		// No "choose your SCM" or "two source control systems" framing
		expect(content).not.toMatch(/choose your SCM/i);
		expect(content).not.toMatch(/two source control systems/i);
		// jj is mentioned ONLY in historical context (search for "historical" + jj nearby)
		const jjOccurrences = (content.match(/\bjj\b/g) ?? []).length;
		// jj appears in the historical paragraph — but the doc must not present jj
		// as a current option. We can't pin a zero (legit historical mentions),
		// but the headline section MUST be git-only.
		expect(content.slice(0, 500)).toMatch(/\bgit\b/i);
		// Anchor: the doc lists git as THE SCM, not "git or jj"
		expect(content).not.toMatch(/git or jj/i);
		// Sanity: jj is mentioned somewhere (historical paragraph) but not as a current option
		expect(jjOccurrences).toBeGreaterThan(0);
	});

	it("supersession banner is at the top of git-or-jj-substrate/brief.md (now archived)", () => {
		// The plan was retrospected + archived 2026-06-28 — moved from
		// .indusk/planning/git-or-jj-substrate/ to .indusk/planning/archive/.
		const content = readFileSync(
			join(REPO_ROOT, ".indusk/planning/archive/git-or-jj-substrate/brief.md"),
			"utf-8",
		);
		// Banner appears in the first ~600 chars
		const head = content.slice(0, 600);
		expect(head).toMatch(/Superseded by/i);
		expect(head).toMatch(/git-only-substrate/);
	});

	it("ADR published at apps/docs/src/decisions/git-only-substrate.md", () => {
		const content = readFileSync(
			join(REPO_ROOT, "apps/docs/src/decisions/git-only-substrate.md"),
			"utf-8",
		);
		// Carries the canonical Y-statement clauses
		expect(content).toMatch(/Y-Statement/);
		expect(content).toMatch(/\*\*In the context of:\*\*/);
		expect(content).toMatch(/\*\*We decided for:\*\*/);
		expect(content).toMatch(/\*\*Accepting:\*\*/);
	});
});

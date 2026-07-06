import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * stale-indusk-docs-path (hotfix): regression test for the fix shipped on
 * hotfix/stale-indusk-docs-path (PR #11).
 *
 * The apps/indusk-docs -> apps/docs rename (indusk-worktree-extension Phase 1,
 * 2026-05-28) left these live, agent-facing skill/extension files pointing at
 * a directory that no longer exists. Two files are explicitly out of scope
 * (separate, pre-existing, unrelated bugs — see impl.md) and excluded here.
 */

const REPO_ROOT = new URL("../../../..", import.meta.url).pathname;

const FIXED_FILES = [
	"apps/indusk-mcp/skills/document.md",
	"apps/indusk-mcp/skills/work.md",
	"apps/indusk-mcp/skills/falsify.md",
	"apps/indusk-mcp/skills/highlight.md",
	"apps/indusk-mcp/skills/git.md",
	"apps/indusk-mcp/skills/planner.md",
	"apps/indusk-mcp/skills/retrospective.md",
	"apps/indusk-mcp/extensions/README.md",
	"apps/indusk-mcp/extensions/vitepress/skill.md",
	"apps/indusk-mcp/extensions/otel/skill.md",
	"apps/indusk-mcp/extensions/local-telemetry/skill.md",
	".claude/skills/highlight/SKILL.md",
	".claude/skills/planner/SKILL.md",
	".claude/skills/retrospective/SKILL.md",
	".claude/skills/document/SKILL.md",
	".claude/skills/local-telemetry/SKILL.md",
	".claude/skills/work/SKILL.md",
	".claude/skills/falsify/SKILL.md",
	".claude/skills/git/SKILL.md",
	".claude/skills/otel/SKILL.md",
];

// Explicitly out of scope — separate, pre-existing, unrelated bugs (see impl.md Notes).
// document.md / .claude/skills/document/SKILL.md still carry `--filter=indusk-docs`
// turbo command examples (a wider turbo-filter-syntax bug affecting other packages too,
// not caused by this rename). Filtered out of the literal-path assertion below via a
// pattern that only matches path forms, not the turbo --filter flag.

describe("stale-indusk-docs-path: no dead apps/indusk-docs path references remain", () => {
	for (const relPath of FIXED_FILES) {
		it(`${relPath} has no apps/indusk-docs or ../../indusk-docs path reference`, () => {
			const content = readFileSync(join(REPO_ROOT, relPath), "utf-8");
			expect(content).not.toContain("apps/indusk-docs");
			expect(content).not.toContain("../../indusk-docs");
		});
	}
});

/**
 * T3 (falsification finding): the published VitePress docs site's live
 * reference pages carried the same staleness the Ship phase fixed in the
 * skill-instruction surface. Excludes dated historical records (changelog,
 * decisions/*, dawn/decisions.md) by design — those accurately describe
 * what was true at the time and should NOT be rewritten.
 */
const DOCS_SITE_FILES = [
	"apps/docs/src/reference/skills/document.md",
	"apps/docs/src/reference/skills/retrospective.md",
	"apps/docs/src/reference/skills/work.md",
	"apps/docs/src/reference/skills/plan.md",
	"apps/docs/src/reference/skills/context.md",
	"apps/docs/src/reference/tools/indusk-mcp.md",
	"apps/docs/src/reference/tools/composable-env.md",
	"apps/docs/src/reference/admin-ui/overview.md",
	"apps/docs/src/reference/admin-ui/cli.md",
	"apps/docs/src/guide/scm.md",
];

describe("stale-indusk-docs-path T3: published docs-site reference pages", () => {
	for (const relPath of DOCS_SITE_FILES) {
		it(`${relPath} has no apps/indusk-docs or ../../indusk-docs path reference`, () => {
			const content = readFileSync(join(REPO_ROOT, relPath), "utf-8");
			expect(content).not.toContain("apps/indusk-docs");
			expect(content).not.toContain("../../indusk-docs");
		});
	}
});

/**
 * T4 (falsification finding): CLAUDE.md's own live Architecture section,
 * Apps bullet, and Key Decisions links — not its dated Current-State
 * narrative, which legitimately still says "apps/indusk-docs" when
 * describing what was true at a past point in time.
 */
describe("stale-indusk-docs-path T4: CLAUDE.md's live architecture description", () => {
	const claudeMd = readFileSync(join(REPO_ROOT, "CLAUDE.md"), "utf-8");

	it("Architecture directory tree names the current docs/ directory", () => {
		expect(claudeMd).toContain("└── docs/");
		expect(claudeMd).not.toContain("└── indusk-docs/");
	});

	it("Apps bullet names the current docs app, not indusk-docs", () => {
		expect(claudeMd).toContain("- **docs**: VitePress 1.x documentation site");
	});

	it("Falsification Ritual guide link points at the current docs path", () => {
		expect(claudeMd).toContain("(apps/docs/src/guide/falsification-ritual.md)");
	});

	it("rationale-baseline-frontmatter lessons page link points at the current docs path", () => {
		expect(claudeMd).toContain("`apps/docs/src/lessons/rationale-baseline-frontmatter.md`");
	});
});

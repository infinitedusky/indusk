---
title: "Stale apps/indusk-docs Path References in Skill Files"
date: 2026-07-06
status: in-progress
workflow: hotfix
gate_policy: auto
trajectory: required
---

# Stale apps/indusk-docs Path References in Skill Files

## Goal

The `apps/indusk-docs` → `apps/docs` rename (`indusk-worktree-extension` Phase 1, 2026-05-28) left 20 live, agent-facing skill/extension files pointing at a directory that no longer exists — any working agent following one of those links hits a dead path. Fixed directly on a `hotfix/{slug}` branch; this plan documents it retroactively and backfills the regression test + docs. First real dogfood of the `planner-hotfix-mode` workflow.

PR: https://github.com/infinitedusky/indusk/pull/11

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | No live agent-facing skill/extension file references the nonexistent `apps/indusk-docs` path (literal or `../../indusk-docs` relative form), except the two explicitly-scoped-out pre-existing bugs (`document.md`'s turbo `--filter` examples, the orphaned `.claude/skills/jj/SKILL.md`). | Phase 0 | Phase 2 | passing |

## Checklist

### Phase 1: Ship
- [x] Fixed 20 files (`apps/indusk-mcp/skills/*.md`, `apps/indusk-mcp/extensions/{README,vitepress/skill,otel/skill,local-telemetry/skill}.md`, and their 8 installed `.claude/skills/*/SKILL.md` counterparts): `apps/indusk-docs` → `apps/docs`, `../../indusk-docs` → `../../docs`, and two prose references (git.md's commit-prefix example, otel/skill.md's "the indusk-docs site"). Shipped on `hotfix/stale-indusk-docs-path`, PR #11.

#### Phase 1 Verification
- [x] (no tests flip at this phase — reason: infra)

#### Phase 1 Document
- [x] (none needed — skip-reason: hotfix — deferred to Phase 2 backfill)

### Phase 2: Backfill
- [x] Author T1 (regression test — a grep-based vitest case asserting no stale `apps/indusk-docs` / `../../indusk-docs` references remain in the fixed file set). `apps/indusk-mcp/src/__tests__/stale-indusk-docs-path.test.ts`, 20 assertions (one per fixed file). Confirmed it would have failed pre-fix (`git show 0724fc68:apps/indusk-mcp/skills/highlight.md` contains the stale string).
- [x] Confirm T1 passes against the shipped fix — 20/20 passing.

#### Phase 2 Verification
- [x] T1 passes (`npx vitest run src/__tests__/stale-indusk-docs-path.test.ts` from `apps/indusk-mcp` — 20/20)

#### Phase 2 Document
- [x] (none needed — skip-reason: this is a mechanical path-reference fix with no new user-facing behavior; the fixed files' own content is the documentation)

### Phase 3: Close
- [ ] Confirm T1 (the only Phase 2 trajectory row) is terminal (passing/skipped/blocked)

#### Phase 3 Verification
- [ ] (no tests flip at this phase — reason: infra)

#### Phase 3 Document
- [ ] (none needed — skip-reason: n/a)

## Notes
- This is the Phase 3 (Dogfood) exercise for `.indusk/planning/planner-hotfix-mode/` — proves the ship-first/backfill-mandatory flow end-to-end, including a real PR.
- **Finding to carry back to `planner-hotfix-mode`:** the embedded hotfix template in `planner.md` used a generic `(none needed — skip-reason: ...)` for Ship/Close Verification sections, but the trajectory validator's cross-reference-integrity rule requires the exact phrase `(no tests flip at this phase — reason: {schema-only|delete|refactor|infra})` when a phase's Verification has no test-ID references — this rule is workflow-agnostic, so it applies regardless of whether `hotfix` is recognized. `infra` is the best-fit existing value. Needs a template correction back in `planner-hotfix-mode`.
- This worktree is based on `origin/main`, which doesn't yet include `planner-hotfix-mode`'s hook changes (unmerged). To dogfood the real end-state behavior, `.claude/hooks/{check-gates,validate-impl-structure}.js` were locally patched (copied from the `planner-hotfix-mode-phase-1` worktree) — **uncommitted, local-only**, never staged into this branch. The actual hook changes ship via the separate `planner-hotfix-mode` PR.

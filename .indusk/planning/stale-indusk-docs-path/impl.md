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
| T2 | The currently-published npm package (`@infinitedusky/indusk-mcp`, latest version at investigation time) does NOT ship the same stale `apps/indusk-docs` references in its `skills/` and `extensions/*/skill.md` files — i.e., a fresh `npx indusk-mcp init` or `indusk update` no longer reintroduces the dead links this hotfix fixed. | Phase 0 | Phase 4 | blocked |
| T3 | The published VitePress docs site's live reference pages (`reference/skills/{document,retrospective,work,plan,context}.md`, `reference/tools/{indusk-mcp,composable-env}.md`, `reference/admin-ui/{overview,cli}.md`, `guide/scm.md`) contain no stale `apps/indusk-docs` artifacts — excluding dated historical records (`changelog.md`, `decisions/*.md`, `dawn/decisions.md`). | Phase 0 | Phase 4 | passing |
| T4 | `CLAUDE.md`'s live Architecture section (directory tree) and Apps bullet — not its historical Current-State narrative — name the current `apps/docs/` directory, not the pre-rename `apps/indusk-docs/`. | Phase 0 | Phase 4 | passing |

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
- [x] Confirm T1 (the only Phase 2 trajectory row) is terminal (passing/skipped/blocked) — T1 is `passing`.

#### Phase 3 Verification
- [x] (no tests flip at this phase — reason: infra)

#### Phase 3 Document
- [x] (none needed — skip-reason: n/a)

### Phase 4: Falsification — the fix didn't reach the channels consumers actually use

**Goal**: verify whether the attested state (T1: no live agent-facing file references the stale path) holds once you stop scoping "live" to "this git repo" and instead ask "what does an actual consumer of InDusk see today." Investigation confirmed the hotfix's Ship phase only touched dusk's own working tree — three distinct, verified gaps in propagation: the published npm package, the published docs site, and this very repo's own CLAUDE.md architecture section.

- [x] Bump `apps/indusk-mcp/package.json` version to `1.31.13` + add a changelog entry. Note: `origin/main`'s `package.json`/`changelog.md` only reflect `1.31.3` — versions 1.31.4–1.31.12 were published from other branches never merged back to main (confirmed: commit `55237531`, which bumps to 1.31.11, is not an ancestor of `origin/main`'s tip). A separate, pre-existing process gap, out of scope here — `1.31.13` is still the correct next version regardless, since it's past the actual latest published version (confirmed via `npm view @infinitedusky/indusk-mcp version` → `1.31.12`).
- [ ] **Blocked**: actually run `npm publish` for `@infinitedusky/indusk-mcp@1.31.13`. `npm whoami` returns 401 Unauthorized in this environment — no publish credentials available. Sandy needs to run this (or grant credentials). (Confirmed via `npm pack @infinitedusky/indusk-mcp@1.31.12` — the current latest — still contains all 7 skill files + 4 extension files with the unfixed `apps/indusk-docs` references, i.e., T2 is genuinely red until this publish happens.)
- [x] Fix the same `apps/indusk-docs` → `apps/docs` staleness across the docs site's live reference pages: `reference/skills/{document,retrospective,work,plan,context}.md`, `reference/tools/{indusk-mcp,composable-env}.md`, `reference/admin-ui/{overview,cli}.md`, `guide/scm.md`. Same exclusion principle as the original hotfix — `changelog.md`, `decisions/*.md`, and `dawn/decisions.md` untouched (dated historical records). `composable-env.md` needed additional care — several occurrences were real ce component/contract filenames (`indusk-docs.env` → `docs.env`, etc.), verified against what's actually on disk (`env/components/docs.env`) before renaming, not just prose.
- [x] Fix `CLAUDE.md`'s own Architecture section (directory tree) and Apps bullet — both fixed. Also found and fixed 2 more live (non-historical) broken links in the Key Decisions section (Falsification Ritual guide, rationale-baseline-frontmatter lessons page) that weren't part of the original T4 hypothesis wording but fit its "live reference, not Current-State narrative" test exactly. Left the 4 genuinely historical Current-State narrative mentions (and 1 pre-existing turbo-filter-example mention) untouched.

#### Phase 4 Verification
- [x] T2 (see blocked item above — cannot verify passing without the actual publish; state is `blocked`, not `passing`)
- [x] T3 passes (`npx vitest run src/__tests__/stale-indusk-docs-path.test.ts` — 10 new assertions, all passing)
- [x] T4 passes (4 new assertions, all passing)

#### Phase 4 Context
- [x] (none needed — skip-reason: this phase corrects existing stale references across additional channels; it doesn't introduce a new convention beyond what Phase 1 already established)

#### Phase 4 Document
- [x] (none needed — skip-reason: this phase IS the fix to documentation; no separate meta-doc needed)

## Notes
- **T2 is `blocked`, not `passing`, and stays that way until Sandy runs `npm publish` for `@infinitedusky/indusk-mcp@1.31.13`** (this environment has no publish credentials — `npm whoami` → 401). Phase 4 is this plan's terminal phase (no trailing Close phase), so `check-gates.js`'s Gate B never inspects its rows regardless — same pre-existing limitation as the CLAUDE.md Known Gotcha from `planner-hotfix-mode`. Closure here relies on `/retrospective` review, not a hard gate; documenting the blocked state honestly rather than marking it passing prematurely.
- **Separate discovery, out of scope:** `origin/main`'s `package.json`/`changelog.md` only reflect `1.31.3`, but the actual latest published npm version is `1.31.12` — nine versions' worth of releases were published from branches never merged back into `main` (confirmed: commit `55237531`, which bumps to `1.31.11`, is not an ancestor of `origin/main`'s tip). Flagged to Sandy; not investigated or fixed further here.
- This is the Phase 3 (Dogfood) exercise for `.indusk/planning/planner-hotfix-mode/` — proves the ship-first/backfill-mandatory flow end-to-end, including a real PR.
- **Falsification (Phase 4) found a real, generalizable gap in the hotfix flow itself, worth carrying back to `planner-hotfix-mode`:** a hotfix's Ship phase fixes the *working tree*, but for a documentation/skill-content bug, "fixed" implicitly means "fixed everywhere a consumer would encounter it" — the published npm package and the published docs site are separate distribution channels that a single git-repo commit does not reach. `planner-hotfix-mode`'s Hotfix Workflow section should note this: for fixes to *distributed* artifacts (published packages, published docs sites), the Backfill phase should explicitly ask "does this fix need to be published/deployed to actually take effect for consumers, not just merged?"
- **Finding to carry back to `planner-hotfix-mode`:** the embedded hotfix template in `planner.md` used a generic `(none needed — skip-reason: ...)` for Ship/Close Verification sections, but the trajectory validator's cross-reference-integrity rule requires the exact phrase `(no tests flip at this phase — reason: {schema-only|delete|refactor|infra})` when a phase's Verification has no test-ID references — this rule is workflow-agnostic, so it applies regardless of whether `hotfix` is recognized. `infra` is the best-fit existing value. Needs a template correction back in `planner-hotfix-mode`.
- This worktree is based on `origin/main`, which doesn't yet include `planner-hotfix-mode`'s hook changes (unmerged). To dogfood the real end-state behavior, `.claude/hooks/{check-gates,validate-impl-structure}.js` were locally patched (copied from the `planner-hotfix-mode-phase-1` worktree) — **uncommitted, local-only**, never staged into this branch. The actual hook changes ship via the separate `planner-hotfix-mode` PR.

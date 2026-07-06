---
title: "Workbench Setup Command — `indusk setup` — Retrospective"
date: 2026-07-06
---

# Workbench Setup Command — `indusk setup` — Retrospective

## What We Set Out to Do

Collapse the four-step manual "Flow A" for turning a cloned git repo into an InDusk workbench (`mkdir <repo>-workbench` → hand-write `package.json` → symlink/place the repo → `init --workbench --wrapped-repo X --sibling-parent Y`) into a single verb: `indusk setup <cloned-repo-path>`. The chief motivation was eliminating the `--sibling-parent` footgun — an argument whose meaning (parent dir of the canonical clone, not the workbench root) is non-obvious and silently produces divergent topologies. Surfaced live while wrapping `~/code/sandbox/ursa` as `ursa-workbench`.

Scope was deliberately small: zero-flag v1, error-on-collision, non-destructive symlink-in-place default. No ADR — the only real fork (symlink-vs-move) was settled in the brief.

## What Actually Happened

Shipped as designed, in two phases:

- **Phase 1** — `setup.ts` (validate path is a git repo → derive `<repo>-workbench` name/parent → guard collision → scaffold `package.json` → delegate to `init --workbench`) + one `cli.ts` registration + 7 subprocess integration tests (T1–T7). All green, dogfooded live.
- **Phase 2 (Falsification)** — the ritual surfaced **two real gaps** that all seven happy-path tests missed, both fixed in scope (T8–T9).

**The key design call held up:** `setup` *delegates* to `init(workbenchDir, { workbench: true, ... })` rather than extracting a shared helper. `init` already IS the encapsulated workbench-init flow, so delegation gave a single code path with zero drift and made the T7 regression guard a near-tautology. The brief proposed extraction; the impl chose delegation and flagged the deviation — it was strictly simpler and preserved all behavior.

**Structural footprint** (CGC was disconnected this session, so this is a manual read, not a graph query): one new command module (`setup.ts`, ~75 lines) with exactly **one importer** (`cli.ts`, via dynamic import). No shared code was modified beyond the single CLI registration line — blast radius is minimal, which is why the 9-test suite was sufficient verification (nothing else imports `setup`). Files touched: `setup.ts` (new), `cli.ts`, `setup-command.test.ts` (new), `worktree-setup.md`, `reference/cli/setup.md` (new), `.vitepress/config.ts`, `changelog.md`, `CLAUDE.md`.

## Getting to Done

Two categories of unplanned work:

1. **Falsification found genuine bugs, not rubber stamps.** Reading `setup.ts` against its own claims exposed:
   - **Workbench-blind collision guard (T8):** the guard advised "run `indusk update`" for *any* existing `<repo>-workbench` — even an empty, foreign, or half-built dir where that advice is wrong.
   - **Non-atomic setup (T9):** the scaffold+`init` block had no `try/catch`, so an `init` failure after `mkdirSync` left a partial workbench behind — which then tripped the (misleading) collision path on retry, locking the user out of both completing and cleanly retrying.

   Both fixes were small and complementary. Crucially, I *verified the T9 induction empirically before authoring the test* — `INDUSK_HOME` pointing at a regular file makes `init` throw `ENOTDIR` on its registry write (`addProject` is a sync call in init's async body, so the throw is a catchable rejected promise). That confirmed the test would be red-for-the-right-reason rather than a hopeful guess.

2. **Environmental turbulence, not plan turbulence.** The plan spanned several real-world days with conversation gaps. During one gap a *different* plan (`planner-hotfix-mode`) was branched off my feature branch tip, so my commits ended up on `plan/planner-hotfix-mode-phase-1`; I fast-forwarded the correctly-named branch and continued there. The working tree also intermingled three uncommitted contexts (my work, the planner-hotfix plan, the in-flight 1.31.12 eval-trigger release), which forced careful per-file siloing — including a save→revert→reapply→restore dance on `changelog.md` to commit only my `[Unreleased]` entry without sweeping up the 1.31.12 block.

## What We Learned

- **Delegation beats extraction when the callee already encapsulates the whole flow.** The brief's instinct ("extract a shared function") would have duplicated a seam. Because `init --workbench` *is* the workbench-init flow, wrapping it made the regression guard trivially true and eliminated drift by construction. Reach for extraction only when the shared logic isn't already a callable unit.
- **Falsification earns its keep on "creates nothing on failure"-style claims.** The brief and Phase 1 asserted "all guards run before any `mkdir`, so a failed setup creates nothing" — true for *guard* failures, silently false for *init-stage* failures. Happy-path tests can't catch a claim that's scoped more narrowly than its prose implies; the ritual is exactly the tool for that gap.
- **Verify a fault-injection induction empirically before writing the test around it.** `INDUSK_HOME`-as-a-file was only *moderate*-confidence as an init-failure trigger until I ran it. Confirming the throw (and that it's catchable, not an uncatchable `process.exit`) is what separated a real red test from a hopeful one.
- **`rmSync` on a dir containing a symlink is symlink-safe** — it unlinks the symlink as a link and does not recurse into the target. That property is what makes atomic cleanup of a workbench (which contains a trunk symlink to the wrapped repo) safe; without it, cleanup would have risked deleting the user's repo.

## What We'd Do Differently

- **Scope the `old_string` to the checklist item, never the gate header.** Twice I checked off a gate item with an Edit whose `old_string` included the `#### Phase N Context` header and whose `new_string` dropped it — silently deleting the section header. The first slip was caught by `validate-impl-structure` (its regex matches `#### Phase`); the second slid through because the checkoff `new_string` contained no `###`, so full-file validation never fired. The fix is a habit: when checking a box, match only the `- [ ] …` line.
- **Expect and plan for multi-context working trees on a shared repo.** The branch tangle and per-file siloing cost real effort. A cleaner discipline would have been to stash unrelated in-flight changes onto their own branch before starting, rather than branching off a dirty tree and siloing per-commit afterward.

## Insights Worth Carrying Forward

- One-line-with-symlink-in-place is functionally identical to the "real clone inside the workbench" layout numero uses; the latter is an artifact, not a requirement. Future workbench tooling should default to the non-destructive symlink.
- A CLI command that delegates to `init` inherits init's full behavior (including its benign "not a git repository" warning on the non-git workbench root) — that's a feature, not a bug, and should be documented as expected rather than suppressed.

## Quality Ratchet

No new Biome rule. The one recurring mistake (dropping a `#### Phase N Context` header on checkoff) is a markdown/impl-structure concern, already partially caught by the `validate-impl-structure` hook — not a lint-able code pattern. The gap (checkoff edits with no `###` in the `new_string` bypass full-file re-validation) is a hook-coverage note, not a Biome candidate; recorded here for a possible future hook tightening rather than actioned now.

## Metrics

- Phases: 2 (Phase 1 build; Phase 2 falsification fixes)
- Trajectory rows: 9, all `passing` (0 deferred, 0 blocked)
- Commits: 16 on `plan/workbench-setup-command-phase-1`
- Files touched: 8 (`setup.ts` new, `cli.ts`, `setup-command.test.ts` new, `worktree-setup.md`, `reference/cli/setup.md` new, `.vitepress/config.ts`, `changelog.md`, `CLAUDE.md`)
- New production code: `setup.ts` ~75 lines; sole importer `cli.ts`
- Tests: 9 subprocess integration cases, 9/9 green
- Version bump: deferred to publish (next version after the in-flight 1.31.12)

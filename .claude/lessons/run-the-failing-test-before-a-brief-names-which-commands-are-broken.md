# Reproduce each command's failure in a test before a bugfix brief names it as broken

A bugfix brief that lists the commands that fail is an inference until a test fails for each. Run (or write) the failing test per command before the brief is accepted.

**Why:** archived-plans-are-found's brief said `plans accept`, `plans reapprove` and `plans tests --landing` could not find an archived plan. This was inferred from `land` refusing "not accepted" after accept had been run. Test Phase 1 showed accept and land already work for a plan with a live worktree, because `worktreeCopy` in `lib/worktree/plan-worktrees.ts` falls back to `archive/<plan>`. The real failures were `resolveImplPath` (the landing test set) and re-approval reading the brief at its archive path. T3 and T4 had to become regression guards and the brief's account of the cause was wrong after acceptance.

**How to apply:** in a bugfix brief, name a command as broken only with a red test or a recorded repro. Otherwise say "reported, not yet reproduced". A test that passes first try is a regression guard; record it as one. Related: [[community-brief-author-bias-ground-truth-verification]], [[red-test-that-passes-first-try-is-suspect]]. See `.indusk/planning/archived-plans-are-found/impl.md` (Regression Guards).

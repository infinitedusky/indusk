---
title: "Git-or-jj Substrate (Superseded)"
date: 2026-05-07
status: superseded
superseded_by: git-only-substrate
---

# Git-or-jj Substrate

> **Superseded by [Git-Only Substrate](./git-only-substrate) on 2026-06-27 (indusk-mcp 1.31.0).** The dual-SCM model this plan shipped — `scm: "jj" | "git"` config field, branching `lib/scm/` helper, jj-only semantic graph with git-mode graceful-degrade — was reversed. Git is now the only SCM InDusk supports.

## What Was Decided (and Then Reversed)

Shipped in `@infinitedusky/indusk-mcp@1.28.9` on 2026-05-07.

The plan committed to a **dual-SCM with graceful-degrade** model:

1. **Config field** — `scm: "jj" | "git"` in `.indusk/config.json`, set at init time by `detectScm()` (try jj first, fall back to git, defer if neither initialized).
2. **SCM helper module** — `apps/indusk-mcp/src/lib/scm/` exposing `getScm()`, `getCurrentChangeId()`, `getReachableChangeIds()` that branch on the config field.
3. **Three coupled surfaces fixed**:
   - **Semantic graph** — `sync-engine.ts`, `graphiti-log-wrapper.ts`, `replay` re-exports routed through `lib/scm`. On git mode, `runSync()` and `captureWithLog()` graceful-degrade with a "git mode — semantic graph unavailable" message.
   - **Eval prompts and CLI** — `PromptBuilderOptions.scm` field; `buildEvaluatorPrompt` branched on `jj diff -r ${id}` vs `git show ${id}`; baseline command branched on `jj new`/`jj describe` vs `git commit --allow-empty`.
   - **Skills** — new `apps/indusk-mcp/skills/git.md`; dual-form prose in `work.md`/`highlight.md`/`eval-review.md`; `jj.md` byte-equal-pinned as regression target; user-facing guide at `apps/docs/src/guide/scm.md`.

The plan unblocked git-only teams from adopting InDusk. The Avoca engagement (`dawn-fde-toolkit`) verified end-to-end on 2026-05-06.

## Why It Was Reversed

The dual-SCM model was **incomplete commitment** dressed as architectural neutrality. Six weeks of dual-substrate maintenance later, the [Git-Only Substrate ADR](./git-only-substrate) named the failure mode explicitly: *"compounding debt, dusk's own file-linkage layer stays off."* The plan's graceful-degrade was a one-way ratchet that deferred the harder commitment question without paying for it.

The `git-only-substrate` ADR explicitly rejected "keep graceful-degrade dual-SCM" as an alternative, citing:

- Every new feature had to reason about two SCMs (~14 `getScm()` call sites, dual-form prose in 4 skills)
- The semantic graph was off on dusk's own codebase (which used git for some operations) — InDusk wasn't using its own substrate features
- jj had near-zero adoption beyond Sandy

Git-only-substrate ripped out the `lib/scm/detect.ts`, `lib/semantic-graph/jj.ts`, `getScm()`, `jj.md` skill, and dual-form prose entirely.

## What Survived the Archive

- **`lib/scm/index.ts`** — the abstraction layer remained (now git-only). Provides `getCurrentChangeId()` + `getReachableChangeIds()` as the canonical SCM-facing API.
- **The falsification ritual discipline** — Phase 6 + 7 ran two rounds and found 5 real bugs (H1 load-bearing brief claim wrong, H2 graph CLI UX gaps, H3 substring false-positive on `git committer`, H4 missing exit_code check on PostToolUse hooks, H5 init-before-SCM footgun). The pattern of "two compounding falsification rounds for plans touching hook event handling" is the inherited discipline.
- **The end-to-end test harness pattern** — `git-mode-e2e.test.ts` shape (still in `apps/indusk-mcp/src/__tests__/` post-rip-out).
- **The `git.md` skill** — content mostly intact through git-only-substrate's Phase 3 ("dual-form sections collapsed to single-SCM prose").

## References

- Plan archive: `.indusk/planning/archive/git-or-jj-substrate/`
- Retrospective: `.indusk/planning/archive/git-or-jj-substrate/retrospective.md`
- Supersession: [Git-Only Substrate](./git-only-substrate)
- Specific lessons: [Lessons from git-or-jj-substrate](../lessons/git-or-jj-substrate)

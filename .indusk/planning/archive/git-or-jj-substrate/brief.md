---
title: "git-or-jj-substrate"
date: 2026-05-03
status: superseded
---

> **Superseded by [`git-only-substrate`](../git-only-substrate/) — 2026-06-27.**
> Decision: rip out jj; git is the only SCM. The dual-SCM model this plan
> shipped (1.28.9) was reversed; `lib/scm/detect.ts`, `lib/semantic-graph/jj.ts`,
> `getScm()`, and the `jj.md` skill are all deleted. Historical content below
> preserved as time-stamped record.

# git-or-jj-substrate — Brief

## Problem

InDusk hard-fails on projects that use plain git instead of jj. The semantic graph throws `NotAJjRepoError`, the eval baseline command runs `jj new`/`jj describe` directly, the eval prompt instructs Claude to run `jj diff`, and the user-facing skills (work, jj, highlight, eval-review) describe a jj-only workflow. Adoption is blocked for any team that doesn't already run jj.

This needs to be fixed before code freeze on dusk. Dawn will inherit the abstraction; shipping git support now means InDusk is adoptable on real-world repos today, not when Dawn lands.

## Proposed Direction

Treat SCM as a configurable substrate, set once at init, read everywhere via a single helper. Three pieces:

1. **Config field.** Add `scm: "jj" | "git"` to `.indusk/config.json` (alongside the existing `otel.role`, `graphiti.groupId`, `eval.*` shape). `indusk init` detects at scaffold time — try `jj log -r @`, fall back to `git rev-parse HEAD`, write whichever wins. `indusk update` re-detects and migrates if the field is missing or stale.
2. **SCM helper.** New module `apps/indusk-mcp/src/lib/scm/index.ts` exporting:
   - `getScm(projectRoot): "jj" | "git"` — reads config.json, throws if neither is detected.
   - `getCurrentChangeId(projectRoot): Promise<string>` — branches by SCM. jj path stays as-is; git path returns short SHA from `git rev-parse --short HEAD`.
   - `getReachableChangeIds(projectRoot): Promise<Set<string>>` — branches by SCM. jj path stays as-is; git path walks `git log --format=%h HEAD`. Used only by semantic-graph replay; on git we wire it but the calling site graceful-degrades anyway (see #3).
   - The existing `lib/semantic-graph/jj.ts` file remains as the jj-mode implementation; the new module wraps it and adds the git path.
3. **Boundary fixes at the three coupled surfaces:**
   - **Semantic graph** (`sync-engine`, `graphiti-log-wrapper`, `replay`): switch imports from `lib/semantic-graph/jj` to `lib/scm`. On git mode, `indusk graph sync` and the graphiti log wrapper no-op with a clear message ("semantic graph requires jj as the SCM substrate; running on git, no events captured"). v1 ships this as a known limitation; full git parity is future work (research.md option (b) — stable event_id).
   - **Eval prompts and CLI**: replace hardcoded `jj diff -r ${changeId}` with SCM-aware text (`jj diff -r ${id}` on jj, `git show ${id}` on git). Replace `jj new` + `jj describe` in `eval baseline --task` with `git commit --allow-empty -m "baseline: ${name}"` on git mode.
   - **Skills**: rewrite work, jj (renamed conceptually — see Scope), highlight, eval-review prose to be SCM-agnostic. Show both forms where commands appear ("`jj describe ...` (jj) or `git commit -m ...` (git)"). Document the describe-then-do asymmetry — git users get post-hoc eval rather than pre-stated-intent eval. This matches the precedent in `eval-trigger.js`.

## Context

The eval hook (`eval-trigger.js`) already works on git — it tries jj first and falls back to `git rev-parse HEAD` for the change ID, and matches both `jj describe` and `git commit` as trigger commands. That's the precedent for how dual-mode SCM works in InDusk. This plan extends that pattern to the rest of the system.

The deepest coupling is the semantic graph event log, which uses jj change IDs because they survive rebase/amend/split. Git SHAs don't have this property. Three options were considered (research.md "Three viable degrade modes"); v1 picks **graceful degrade** — `indusk graph sync` is a no-op on git repos with a clear message. Full git parity (using a stable `event_id` UUID independent of SCM) is the right end-state but requires invasive changes to the event log format and replay engine; deferring to a follow-up plan.

Everything else (plans, lessons, highlights, scorecards, eval results) already works on git with no SCM-specific behavior — it just needs the prompt text and CLI commands to stop hardcoding jj.

## Scope

### In Scope

- `scm` field in `.indusk/config.json`, populated by `indusk init` and `indusk update`
- `lib/scm/` module with the three functions above
- Semantic graph callers switched to `lib/scm`, with graceful-degrade behavior on git (no-op + log message)
- Eval prompts (`prompt-builder.ts`, `persistent-evaluator.ts`) updated to SCM-aware diff command text
- `indusk eval baseline --task` updated to use `git commit --allow-empty` on git mode
- Skills updated to be SCM-agnostic (work, highlight, eval-review prose; jj.md renamed/split — see below)
- Tests covering the scm helper and the dual-mode eval baseline path
- `git-flavored-substrate` smoke: drop `.indusk/` into a fresh git-only repo (no jj available), run `indusk init`, verify config has `scm: "git"`, run `/work` against a tiny plan, verify eval scorecard appears

### Out of Scope

- Full semantic-graph parity on git (stable event_id, rebase-tolerant replay) — follow-up plan if/when it bites
- Migration of existing dusk/numero (jj-using) projects — they keep `scm: "jj"` and behave identically
- jj-on-git native support (jj overlaid on a git repo) — already works since `jj log -r @` succeeds; SCM detection picks "jj" in that case
- The jj skill itself — keep it as the "if you're using jj, here's the rich workflow" reference. Add a sibling `git.md` skill for the git-mode equivalent. Don't merge them — they're meaningfully different rituals.

## Success Criteria

- A user with no jj installed can run `npx @infinitedusky/indusk-mcp init` in a git repo and the resulting project's `/work`, `/handoff`, `/catchup`, eval, and plan workflows all function end-to-end without errors.
- All existing dusk and numero behavior is unchanged — `scm: "jj"` is the default for any project where jj is detected, and every code path takes the jj branch identically to today.
- `indusk graph sync` on a git repo prints a clear "git mode — semantic graph unavailable" message and exits 0, not throws.
- The `eval-trigger.js` hook, which is already dual-mode, doesn't regress.

## Depends On

- None.

## Blocks

- Code freeze on dusk (item #6 of the path-to-freeze list — "Mark code freeze in CLAUDE.md Current State"). Don't freeze until this ships, because it's the last user-visible adoption blocker.

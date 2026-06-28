---
title: "git-only-substrate"
date: 2026-06-27
status: accepted
---

# git-only-substrate — Brief

## Problem

InDusk runs on two SCMs today (jj and git), with git as a graceful-degraded second-class citizen. On git-mode projects, two early-returns silently disable the semantic graph and Graphiti file-linkage edges — `runSync()` no-ops with a stderr message, and `captureWithLog()` warns once per session and skips the event-log mirror. The functional result: highlight episodes that land in Graphiti on git projects (when the highlights pipeline eventually drains) carry **no file connections**, breaking the "files → episodes → entities" traversal the agent loop now depends on.

This matters more in 1.30 than it did in 1.28.9 when the prior `git-or-jj-substrate` plan accepted graceful degrade. The handoff-multi-agent + section-shape plans made Graphiti the canonical long-term memory layer, and the eval agent the sole structured writer. The semantic graph is no longer "a power feature" — it's load-bearing for context derivation. Dusk itself is now affected: `scm: git`, so the file-linkage layer is structurally off for the project that's *building* the system.

Beyond functionality, the dual-SCM model is design debt. Every new feature now has to ask "does this work on jj? does this work on git?" — the asymmetry is documented in 5 skill files, ~25 prose locations across docs + planning, and 14 call sites of `getScm()` branching. Sandy has decided to make git the only SCM: *if it doesn't work with git, it doesn't work, period.*

## Proposed Direction

Two phases, sequenced:

**Phase A — Bring git to full semantic-graph parity** (~1 day): delete the two defensive early-returns (`sync-engine.ts:80-86`, `graphiti-log-wrapper.ts:93-103`). The underlying code already does content-keyed dedup via `(path, blob_hash)` lookups — not change-ID-keyed — so rebases produce noisy-replay-then-converge rather than orphaned events. `getReachableChangeIds()` already has a working git implementation. Replay's ancestry filter is optional. The "stable event_id" reasoning the prior research scoped (option b) turns out to be unnecessary because the sync engine's existing identity-matching catches duplicates on the next sync.

**Phase B — Rip jj out entirely** (~1-2 days): once git works end-to-end, remove the SCM abstraction layer. `apps/indusk-mcp/src/lib/scm/detect.ts` deletes. `getScm()` deletes. `apps/indusk-mcp/src/lib/semantic-graph/jj.ts` deletes. `apps/indusk-mcp/skills/jj.md` deletes. SCM-conditional sections in `work.md`, `highlight.md`, and `eval-review.md` collapse to git-only. Eval prompts collapse to `git show ${id}` everywhere. The eval-trigger hook's regex narrows to `git commit` only. `apps/docs/src/guide/scm.md` rewrites as "git workflow conventions." The prior `git-or-jj-substrate` plan archives with a supersession banner. Sweep ~25 prose references across docs + planning.

Both phases land as concrete impl phases in this single plan. The first three impl phases produce **functional parity** (Phase A); the next 3-4 produce **the rip-out** (Phase B); a final phase produces docs + retrospective.

## Context

The prior research at `.indusk/planning/git-or-jj-substrate/research.md` scoped "three viable degrade modes" and shipped option (c) graceful degrade in 1.28.9. Today's spot-check (research.md "Today's spot-check" section) found that the gap to full parity is much smaller than the prior research assumed — content-keyed dedup is already in place. The strategic shift is recorded in research.md's "Strategic context (2026-06-27)" section.

This plan does NOT solve the highlights-drain bug (eval-agent-mcp-access plan covers that). The two failures are independent: the drain is about MCP subprocess access to the indusk MCP tools; this plan is about whether file-linkage edges get written when episodes flow. After both ship, the pipeline lands episodes WITH file connections on git projects.

## Scope

### In Scope

- Delete early-returns in `sync-engine.ts` and `graphiti-log-wrapper.ts` to enable git-mode semantic graph
- Verify content-keyed dedup tolerates noisy-replay-on-rebase (regression test: full sync → rebase → sync → assert convergence)
- Update outdated in-code documentation (the "jj-only feature in v1" comments)
- Delete `apps/indusk-mcp/src/lib/semantic-graph/jj.ts`
- Delete `apps/indusk-mcp/src/lib/scm/detect.ts` (and inline the git-only `getCurrentChangeId` into a smaller `lib/scm/index.ts`)
- Drop `getScm()` branching from all 14 call sites
- Delete `apps/indusk-mcp/skills/jj.md`
- Collapse SCM-conditional sections in `work.md`, `highlight.md`, `eval-review.md`
- Collapse SCM branching in `prompt-builder.ts`, `persistent-evaluator.ts`, `evaluator-runner.ts`
- Collapse SCM branching in `bin/commands/eval.ts` (baseline command)
- Narrow `eval-trigger.js` trigger regex to `/\bgit commit\b/`
- Drop `scm` field handling from `init.ts` (silently ignore the field if present in existing configs)
- Rewrite `apps/docs/src/guide/scm.md` as "Git workflow"
- Add supersession banner to `.indusk/planning/git-or-jj-substrate/` (still archived)
- Add supersession banner to `apps/docs/src/decisions/git-or-jj-substrate.md`
- Sweep ~25 prose references across `apps/docs/src/` + `.indusk/planning/`
- Migration: existing `scm: "jj"` config field becomes a no-op. `indusk update` emits a one-line stderr nudge (`scm field no longer used; safe to remove from .indusk/config.json`) when it encounters one. No active migration step; no removal of the field by InDusk.

### Out of Scope

- The highlights-drain bug (separate plan: `eval-agent-mcp-access`)
- Migration tooling, deprecation cycle, version-gated removal (Sandy is the only jj user; trivial rip)
- Edits to historical changelog entries documenting the 1.28.x dual-SCM era (preserve as time-stamped record)
- Edits to retrospectives or archive lessons that reference jj (preserve as time-stamped record; add one cross-cutting lessons note pointing at this plan)
- Backwards-compat shims for code that imports `getScm` from anywhere (the abstraction goes; consumers update in this plan)
- jj-as-overlay-on-git support (jj projects keep working at the SCM level; InDusk just uses `git rev-parse HEAD` for the change ID instead of `jj log -r @`)
- Re-running `indusk update` on every existing project to migrate `scm` field (it's a no-op once the field is silently ignored)

## Success Criteria

- On a fresh git-mode project, `indusk graph sync` produces an `.indusk/graph/semantic-graph.log` with `anchor.created` events for changed files (not the "git mode — semantic graph unavailable" stderr no-op)
- On dusk specifically, after running this plan, the semantic graph populates and `mcp__indusk__graph_status` reports anchors > 0
- When the highlights-drain bug is later fixed and episodes flow through `mcp__indusk__graph_capture`, the corresponding `edge.attached` events land in the semantic graph log with `relation: "highlight"` and target file UUIDs
- A `git rebase` operation followed by `indusk graph sync` produces (a) noisy log entries that are content-deduplicated against the runtime and (b) a runtime that converges to current file state
- `grep -r "getScm\|jj.ts\|NotAJjRepoError" apps/indusk-mcp/src/` returns zero matches
- `grep -r "jj describe\|jj log\|jj diff" apps/indusk-mcp/src/` returns zero matches outside historical changelog/lesson entries
- `apps/indusk-mcp/skills/jj.md` is deleted; `apps/indusk-mcp/skills/git.md` remains and is the only SCM skill
- `pnpm test` from the repo root passes (every existing test that previously tested dual-SCM either updates to git-only or is deleted if it was specifically testing the jj path)
- `apps/docs/src/guide/scm.md` reads as a git workflow guide with no mention of jj as a current option (historical mention OK if framed as past-tense)

## Depends On

- None blocking. Builds on the SCM abstraction landed in `.indusk/planning/git-or-jj-substrate/` (now being superseded).

## Blocks

- `.indusk/planning/eval-agent-mcp-access/` — the highlights-drain fix. Sequenced AFTER this plan so when episodes flow through, they land with file-linkage edges. Sandy chose this sequence in discovery.
- Future plans that want to navigate "files → episodes → entities" traversal in their context queries (any plan using the context beam or building UI on top of Graphiti's structured store)

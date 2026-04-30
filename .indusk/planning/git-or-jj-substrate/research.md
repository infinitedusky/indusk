---
title: "git-or-jj-substrate"
date: 2026-05-03
status: complete
---

# git-or-jj-substrate — Research

## Question

InDusk currently hard-fails on projects that use plain git instead of jj. What are the actual coupling points, and what shape does a dual-SCM substrate take?

## Findings

### Coupling map (current state)

Three places in the codebase call `jj` directly. One has already been ported to dual-mode (the eval hook); two have not.

| Surface | File(s) | Status | What jj does here |
|---|---|---|---|
| Eval hook | `apps/indusk-mcp/hooks/eval-trigger.js` | ✅ dual-mode | Detects trigger command (`jj describe` OR `git commit`), reads change/commit ID via `jj log -r @ --no-graph -T change_id` with `git rev-parse HEAD` fallback |
| Semantic graph | `apps/indusk-mcp/src/lib/semantic-graph/jj.ts` | ❌ jj-only, throws `NotAJjRepoError` | `getCurrentChangeId(cwd)` tags every event in `.indusk/graph/semantic-graph.log`; `getReachableChangeIds(cwd)` is the replay ancestry filter |
| Eval prompts + CLI | `apps/indusk-mcp/src/lib/eval/prompt-builder.ts:103`, `persistent-evaluator.ts:224`, `bin/commands/eval.ts:276-288` | ❌ jj-only | Prompt text says `jj diff -r ${changeId}`; `eval baseline --task` runs `jj new` + `jj describe` to create a baseline change |

Plus jj-flavored prose in user-facing skills:
- `apps/indusk-mcp/skills/work.md` — describe-then-do workflow, per-item `jj new`/`jj describe`/`jj split` cadence
- `apps/indusk-mcp/skills/jj.md` — entire skill is jj-specific
- `apps/indusk-mcp/skills/highlight.md` — "eval agent picks this up on the next `jj describe` or at session end"
- `apps/indusk-mcp/skills/eval-review.md` — uses `jj diff` for current working-copy diff
- `apps/indusk-mcp/src/lib/eval/findings.ts:5` (doc comment) — "surfaces unresolved findings on every jj describe"

The semantic graph's three callers of `jj.ts`:
- `lib/semantic-graph/sync-engine.ts:64` — `getCurrentChangeId` to tag the sync event
- `lib/semantic-graph/graphiti-log-wrapper.ts:90,153` — `getCurrentChangeId` to tag every Graphiti write
- `lib/semantic-graph/replay.ts:21` (doc comment) — points at `getReachableChangeIds`

### Why jj change IDs were the original choice

From `lib/semantic-graph/jj.ts:7-8`:

> Every event in the log is tagged with the jj change ID active when it was written. Replay filters by jj ancestry of the current HEAD — this is how branch/rebase/amend safety works without per-branch anchor forking.

The structural property load-bearing for the semantic graph: jj change IDs **survive rebase, amend, and split**. A change abandoned and replayed elsewhere keeps the same change ID. Git commit SHAs do not — they're content-addressed and rewriting any commit produces a new SHA, orphaning the event from the new history.

This is why `NotAJjRepoError` exists at all. The author of the semantic graph bridge (`.indusk/planning/archive/cgc-graphiti-bridge/adr.md` Decision #2) deliberately deferred git fallback as future work rather than ship a substrate that loses events on rebase.

### What works on git without jj-equivalence

Most of InDusk does not depend on rewrite-survivability. Specifically:

- The **eval hook** already works on git (`eval-trigger.js` falls back to `git rev-parse HEAD` for the change ID; the eval agent doesn't care whether the SHA survives rebase, since each invocation scores a single commit at a single point in time).
- **Plans, lessons, context, extensions, skills** — none of these are tagged with SCM IDs. They're plain markdown.
- **Highlights queue** (`.indusk/highlights.jsonl`) — entries have a timestamp, not a change ID.
- **Eval scorecards** — written to `.indusk/eval/results.log` with their own timestamp; the change ID is logged but not used as a join key.

Only the **semantic graph event log replay path** treats the change ID as a stable identity that must survive history rewrites. Everything else just needs "what's the current commit/change so I can stamp it on this row" — which both `jj log -r @` and `git rev-parse HEAD` answer adequately.

### Three viable degrade modes for the semantic graph

Since the semantic graph is the only surface where jj's structural property is genuinely load-bearing, the question is just: what do we do for git users?

| Mode | Behavior | Cost |
|---|---|---|
| (a) Full parity | Tag events with git SHAs, walk git ancestry on replay. Events orphan on rebase/amend/squash. | Works for most users (no rebase) but bites the moment someone amends a commit — events from that commit silently drop from the projection on next replay. Surprise loss. |
| (b) Stable event_id | Generate a UUID at event-write time, independent of SCM. Use SCM ID as a hint for replay filtering. Tolerate orphans. | New design; probably the right end-state but invasive. |
| (c) Graceful degrade | On git repos, `indusk graph sync` no-ops with a clear message. Semantic graph features unavailable. Everything else works. | Cheapest ship. Loses graph features for git users until (b) lands. |

For v1: (c). The semantic graph is not load-bearing for the agent loop (no skill or hook depends on it). It's a power feature for users who want CGC/Graphiti correlation. Git users live without it until we have time to do (b) properly.

### eval baseline command on git

`indusk eval baseline --task <path>` runs:

```
jj new
jj describe -m "baseline: ${taskName}"
```

This creates a fresh empty commit to provide a clean diff target for the baseline scorecard. On git the equivalent is roughly `git commit --allow-empty -m "baseline: ${taskName}"`. Behavior is identical for the eval agent's purposes — both produce a trivial diff that the agent can score against.

### prompt text on git

The eval agent's prompt says `jj diff -r ${changeId}` to tell Claude how to inspect the change. On git the equivalent is `git show ${changeId}` (full diff with metadata) or `git diff ${changeId}^..${changeId}` (diff only). Either works. `git show` is slightly closer in spirit to `jj diff -r`.

### work skill: describe-then-do is jj-specific

The work skill currently mandates: `jj new` → `jj describe` → do work → check off item. This works because in jj, the working copy IS the current commit, and the description is set BEFORE work begins, so the eval agent scores work in the context of stated intent.

On git, the equivalent ordering is impossible: you can't `git commit -m` before doing the work (no changes to commit). Three options:

1. **Accept the asymmetry.** On git, eval fires post-hoc — agent scores work after it's committed, without the pre-stated intent context. This is what `eval-trigger.js` already does today.
2. **Use `git commit --allow-empty -m "intent"` as a describe-equivalent.** Adds a no-op commit before work, then a real commit after. Doubles commit count; messy history.
3. **Write intent to a separate file** (`.indusk/intent.md` or similar) before work. Eval hook reads it. Adds a moving part for git users only.

For v1: option 1. Document the difference; accept that git users get less context-rich eval. This is consistent with the precedent in `eval-trigger.js`.

## Open Questions

- Should `indusk update` on a project where the SCM has changed (rare — adopting jj on top of git, or vice versa) re-detect and migrate the config field? Or require explicit `indusk init --force`? Probably yes-on-update, no-on-init-existing.
- Is there value in supporting both jj and git in the same project (jj overlaid on a git repo, which is jj's normal mode of operation)? Yes — but for SCM detection purposes we treat that as "jj" since `jj log -r @` works.

## Sources

- `apps/indusk-mcp/src/lib/semantic-graph/jj.ts` — current jj-only implementation
- `apps/indusk-mcp/hooks/eval-trigger.js` — dual-mode precedent
- `.indusk/planning/archive/cgc-graphiti-bridge/adr.md` Decision #2 — why jj change IDs were chosen
- `apps/indusk-mcp/src/lib/eval/prompt-builder.ts:103`, `persistent-evaluator.ts:224` — eval prompt jj refs
- `apps/indusk-mcp/src/bin/commands/eval.ts:276-288` — baseline command jj refs
- `apps/indusk-mcp/skills/{work,jj,highlight,eval-review}.md` — skill prose

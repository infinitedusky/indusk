---
title: "Git-Only Substrate"
date: 2026-06-27
status: accepted
---

# Git-Only Substrate

## Goal

**After this ADR ships (1.31.0), git is the only SCM InDusk supports — and the semantic graph + Graphiti file-linkage layer works on every git project, including the project building InDusk itself.**

Prior to 1.31.0, InDusk shipped with dual-SCM support — projects could pick `scm: "jj"` or `scm: "git"` in their config and InDusk would branch on the field at every SCM-coupled surface (eval prompts, baseline CLI, semantic graph sync, eval-trigger regex, per-phase commit cadence). Git users were second-class citizens: `runSync()` and `captureWithLog()` early-returned with a "git mode — semantic graph unavailable" stderr message; the file-linkage edges that connect Graphiti episodes to specific files in the codebase were never written on git projects. After this ADR, that traversal works. And the dual-SCM mental model goes away: no more "does this work on jj? does this work on git?" — every feature works on git or it doesn't ship.

## Y-Statement

**In the context of:**
InDusk's 1.30 agent loop now treats Graphiti as canonical long-term memory and the semantic graph as the file-linkage layer connecting episodes back to specific code locations. Today, git-mode projects gracefully-degrade both layers — `runSync()` early-returns and `captureWithLog()` skips the event-log mirror — a model shipped under the prior [`git-or-jj-substrate`](https://github.com/infinitedusky/indusk/tree/main/.indusk/planning/git-or-jj-substrate) plan (1.28.9) when the semantic graph was "a power feature, not load-bearing." Dusk's own project state (`scm: git`) means the system building InDusk has both layers silently off.

**Facing:**
Two coupled problems. (1) The functional problem: git users — including dusk — can't navigate from a code file to the episodes that touched it. The traversal the agent loop now depends on is structurally broken. (2) The structural problem: every new feature must reason about two SCMs. Five skill files carry dual-form "if jj... else git..." prose; 14 call sites of `getScm()` branch on SCM in the codebase; ~25 prose references span docs + planning. The asymmetry is design debt that compounds with every new feature.

**We decided for:**
Make git the only SCM. Phase A: bring git to full semantic-graph parity by deleting the two defensive early-returns at `sync-engine.ts:80-86` and `graphiti-log-wrapper.ts:93-103`. The sync engine's dedup is already content-keyed via `(path, blob_hash)` — not change-ID-keyed — so rebases produce noisy-replay-then-converge: extra events get written, the runtime's identity-matching tombstones duplicates on the next sync, the system converges to current file state after one cycle. `getReachableChangeIds()` already has a working git implementation; replay's ancestry filter is optional. Phase B: rip out the SCM abstraction entirely. `apps/indusk-mcp/src/lib/scm/detect.ts` deletes. `getScm()` deletes. `apps/indusk-mcp/src/lib/semantic-graph/jj.ts` deletes. `apps/indusk-mcp/skills/jj.md` deletes. Dual-form sections in `work.md`, `highlight.md`, and `eval-review.md` collapse to git-only. Eval prompts say `git show ${id}` everywhere. The eval-trigger hook narrows its regex to `/\bgit commit\b/`. The `apps/docs/src/guide/scm.md` guide rewrites as a git workflow guide.

**And against:**
Three alternatives rejected. (1) Keep the graceful-degrade dual-SCM model unchanged — accepts that dusk's own file-linkage layer stays off and the dual-SCM debt continues to compound. (2) Build the "stable event_id" design where every event gets a UUID independent of SCM identity and ancestry filtering uses content-derived IDs — solves the rebase-orphan problem cleanly but requires a substantial schema migration and is more invasive than the underlying gap requires. (3) Keep the dual-SCM model but expand jj to first-class status — flips the asymmetry but doesn't address the design-debt problem, and jj has near-zero adoption beyond the single user driving the original direction.

**To achieve:**
A single-SCM mental model for everyone touching the codebase. A working semantic graph + file-linkage layer on every InDusk-managed project. A meaningfully smaller codebase — `lib/scm/`, `lib/semantic-graph/jj.ts`, the `jj.md` skill, and dual-form prose all collapse, removing several hundred lines of branching logic. A functional context-derivation pipeline on dusk itself, unblocking the value the 1.30 agent loop was designed for.

**Accepting:**
Three known trade-offs. (1) Semantic graph logs gain noise after a `git rebase` — extra `anchor.moved` or `anchor.created` events for files whose content didn't change. The runtime de-dups on the next sync; the log itself accumulates noise. Log compaction is out of scope (future plan). (2) Provenance traceability is fuzzy on git — "this edge was discovered at commit X" can be wrong after X is rewritten. Agents don't query provenance to make decisions, so this is cosmetic, but it's real. (3) jj is gone entirely. No migration tooling, no deprecation cycle. If someone wants jj they keep using it at the SCM level (InDusk just calls `git rev-parse HEAD` against the underlying git layer that jj overlays), but the InDusk-jj integration is not coming back.

**Because:**
The prior research's "graceful degrade" recommendation rested on the assumption that bringing git to parity required stable, rebase-surviving event IDs — a substantial design problem. Today's spot-check found the sync engine's dedup is already content-keyed, `getReachableChangeIds()` already has a git impl, and replay's ancestry filter is already optional. The actual gap is two defensive early-returns. The smallest correct change is therefore just *deletion* — not an event-id redesign. And once parity lands, keeping jj-mode as a second supported path is pure debt: the only user is the original driver, and the only place jj's properties were ever load-bearing was the very gap the parity fix closes. *If it doesn't work with git, it doesn't work, period.*

## Decision

1. **Parity via deletion, not redesign.** Delete the two defensive early-returns in `sync-engine.ts` and `graphiti-log-wrapper.ts`. Accept noisy-replay-then-converge on rebase as a known trade-off.
2. **Rip out the SCM abstraction entirely.** Delete `apps/indusk-mcp/src/lib/scm/detect.ts`, `apps/indusk-mcp/src/lib/semantic-graph/jj.ts`, `apps/indusk-mcp/skills/jj.md`. Drop `getScm()` branching from all 14 call sites. Eval prompts collapse to `git show ${id}`. The eval-trigger hook narrows its regex to `/\bgit commit\b/`.
3. **Trivial migration story.** Existing `scm: "jj"` config field becomes a no-op. `indusk update` emits exactly one stderr nudge (`scm field no longer used; safe to remove from .indusk/config.json`) on the first encounter and leaves the file unchanged.
4. **Single plan covers both phases.** Phase A (parity, 3 impl phases) and Phase B (rip-out, 3-4 impl phases) ship in this single `git-only-substrate` plan.
5. **Historical content preserved as time-stamped record.** Edits to historical changelog entries documenting the 1.28.x dual-SCM era are out of scope.
6. **Supersession of the prior plan.** The `.indusk/planning/git-or-jj-substrate/` brief carries a supersession banner pointing to this ADR.

## References

- `.indusk/planning/git-only-substrate/` — full plan: research, brief, test-plan, ADR, impl
- `.indusk/planning/git-or-jj-substrate/` — superseded prior plan (shipped 1.28.9)
- [Git workflow guide](/guide/scm) — the convention that ships under git-only-substrate
- `apps/indusk-mcp/skills/git.md` — the canonical SCM skill

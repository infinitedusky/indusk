---
title: "git-only-substrate"
date: 2026-06-27
status: accepted
---

# git-only-substrate

## Goal

**After this ADR ships, git is the only SCM InDusk supports — and the semantic graph + Graphiti file-linkage layer works on every git project, including dusk itself.**

Today, dusk is `scm: git`, which means its own semantic graph is silently disabled and Graphiti episodes (when the highlights pipeline drains) will land without file-linkage edges. The agent loop's "files → episodes → entities" traversal — which the handoff and section-shape plans treat as canonical long-term memory — is structurally broken on the project that's building the system. After this ADR, that traversal works. And the dual-SCM mental model goes away: no more "does this work on jj? does this work on git?" — every feature works on git or it doesn't ship.

## Y-Statement

**In the context of:**
InDusk's 1.30 agent loop now treats Graphiti as canonical long-term memory and the semantic graph as the file-linkage layer that connects episodes to specific code locations. Today, git-mode projects gracefully-degrade both layers — `runSync()` early-returns with a "git mode — semantic graph unavailable" stderr message, and `captureWithLog()` skips the event-log mirror — a model that shipped under the prior `git-or-jj-substrate` plan (1.28.9) when the semantic graph was "a power feature, not load-bearing." Dusk's own project state (`scm: git`) means the system building InDusk has both layers silently off.

**Facing:**
Two coupled problems. (1) The functional problem: git users — including dusk — can't navigate from a code file to the episodes that touched it. The traversal the agent loop now depends on is structurally broken. (2) The structural problem: every new feature must reason about two SCMs. Five skill files carry dual-form "if jj... else git..." prose; 14 call sites of `getScm()` branch on SCM in the codebase; ~25 prose references span docs + planning. The asymmetry is design debt that compounds with every new feature.

**We decided for:**
Make git the only SCM. Phase A: bring git to full semantic-graph parity by deleting the two defensive early-returns at `sync-engine.ts:80-86` and `graphiti-log-wrapper.ts:93-103`. The sync engine's dedup is already content-keyed via `(path, blob_hash)` — not change-ID-keyed — so rebases produce noisy-replay-then-converge: extra events get written, the runtime's identity-matching tombstones duplicates on the next sync, the system converges to current file state after one cycle. `getReachableChangeIds()` already has a working git implementation; replay's ancestry filter is optional. Phase B: rip out the SCM abstraction entirely. `apps/indusk-mcp/src/lib/scm/detect.ts` deletes. `getScm()` deletes. `apps/indusk-mcp/src/lib/semantic-graph/jj.ts` deletes. `apps/indusk-mcp/skills/jj.md` deletes. Dual-form sections in `work.md`, `highlight.md`, `eval-review.md` collapse to git-only. Eval prompts say `git show ${id}` everywhere. The eval-trigger hook narrows its regex to `/\bgit commit\b/`. `apps/docs/src/guide/scm.md` rewrites as a git workflow guide.

**And against:**
We rejected three alternatives. (1) Keep the graceful-degrade dual-SCM model unchanged — accepts that dusk's own file-linkage layer stays off and the dual-SCM debt continues to compound. (2) Build the "stable event_id" design (option b from the prior research) where every event gets a UUID independent of SCM identity and ancestry filtering uses content-derived IDs — solves the rebase-orphan problem cleanly but requires a substantial schema migration and is more invasive than the underlying gap requires. (3) Keep the dual-SCM model but expand jj to first-class status — flips the asymmetry but doesn't address the design-debt problem, and jj has near-zero adoption beyond Sandy.

**To achieve:**
A single-SCM mental model for everyone touching the codebase. A working semantic graph + file-linkage layer on every InDusk-managed project (which, post-rip-out, is every project). A meaningfully smaller codebase — `lib/scm/`, `lib/semantic-graph/jj.ts`, the `jj.md` skill, and dual-form prose all collapse, removing several hundred lines of branching logic. A functional context-derivation pipeline on dusk itself, unblocking the value the 1.30 agent loop was designed for.

**Accepting:**
Three known trade-offs. (1) Semantic graph logs gain noise after a `git rebase` — extra `anchor.moved` or `anchor.created` events for files whose content didn't change. The runtime de-dups on the next sync; the log itself accumulates noise. Log compaction is out of scope (future plan). (2) Provenance traceability is fuzzy on git — "this edge was discovered at commit X" can be wrong after X is rewritten. Agents don't query provenance to make decisions, so this is cosmetic, but it's real. (3) jj is gone entirely. No migration tooling, no deprecation cycle. If someone wants jj they keep using it at the SCM level (InDusk just calls `git rev-parse HEAD` against the underlying git layer that jj overlays), but the InDusk-jj integration is not coming back.

**Because:**
The prior research's "graceful degrade" recommendation rested on the assumption that bringing git to parity required stable, rebase-surviving event IDs — a substantial design problem. Today's spot-check (research.md "Today's spot-check" section) found the sync engine's dedup is already content-keyed, `getReachableChangeIds()` already has a git impl, and replay's ancestry filter is already optional. The actual gap is two defensive early-returns. The smallest correct change is therefore just *deletion* — not an event-id redesign. And once parity lands, keeping jj-mode as a second supported path is pure debt: the only user is Sandy, and the only place jj's properties were ever load-bearing was the very gap the parity fix closes. *If it doesn't work with git, it doesn't work, period.*

## Context

The prior `git-or-jj-substrate` plan (shipped 1.28.9) added dual-SCM support with git as a graceful-degraded second-class citizen. That plan's research scoped "three viable degrade modes": (a) full parity with rebase-loss, (b) stable event_id design, (c) graceful degrade. Option (c) shipped because the semantic graph was framed as "not load-bearing for the agent loop."

The agent loop's design has moved on. The handoff-multi-agent + section-shape plans (shipped 1.30.0 and 1.30.1) made Graphiti the canonical long-term memory store and the eval agent the sole structured writer. The semantic graph is the file-linkage layer that connects Graphiti episodes back to specific files — without it, "files → episodes → entities" traversal doesn't work. The semantic graph is now load-bearing for context derivation in 1.30+.

Today's spot-check of `sync-engine.ts` and `replay.ts` revealed that the gap to full git parity is much smaller than the prior research assumed:

- The sync engine's dedup is **content-keyed** via two lookup maps (`existingByIdentity` on path, `existingByFingerprint` on blob hash), not change-ID-keyed. Change ID is only a tag on emitted events.
- `getReachableChangeIds()` already has a working git implementation in `lib/scm/index.ts` — walks `git log --format=%h HEAD`.
- Replay's `ancestryFilter` is `Set<string> | undefined` — when absent, every event applies; when present, filters by `change_id ∈ set`.

The only thing blocking git mode is two defensive early-returns at `sync-engine.ts:80-86` and `graphiti-log-wrapper.ts:93-103`. Deleting them + accepting "noisy-replay-then-converge" on rebase brings git to full functional parity.

This ADR formalizes the strategic shift and the rip-out scope. See `research.md` for the full coupling inventory and `brief.md` for the success criteria.

## Decision

1. **Parity via deletion, not redesign.** Delete the two defensive early-returns in `sync-engine.ts` and `graphiti-log-wrapper.ts`. Accept noisy-replay-then-converge on rebase as a known trade-off. Do NOT build stable event IDs (option b); the content-keyed dedup already in place is sufficient.

2. **Rip out the SCM abstraction entirely.** After parity lands, delete `apps/indusk-mcp/src/lib/scm/detect.ts`, `apps/indusk-mcp/src/lib/semantic-graph/jj.ts`, `apps/indusk-mcp/skills/jj.md`. Drop `getScm()` branching from all 14 call sites. Collapse dual-form sections in `work.md`, `highlight.md`, `eval-review.md` to git-only. Eval prompts collapse to `git show ${id}` everywhere. The eval-trigger hook narrows its regex to `/\bgit commit\b/`.

3. **Trivial migration story.** Existing `scm: "jj"` config field becomes a no-op. `indusk update` emits exactly one stderr nudge (`scm field no longer used; safe to remove from .indusk/config.json`) on the first encounter and leaves the file unchanged. No active migration step; no field removal by InDusk. No deprecation cycle; no version-gated removal. Sandy is the only jj user; trivial rip is appropriate.

4. **Single plan covers both phases.** Phase A (parity, ~3 impl phases) and Phase B (rip-out, ~3-4 impl phases) ship in this single `git-only-substrate` plan. Splitting into two plans would require a stable intermediate state where parity has landed but the abstraction remains — needless ceremony.

5. **Historical content preserved as time-stamped record.** Edits to historical changelog entries documenting the 1.28.x dual-SCM era are out of scope. Retrospectives and archive lessons that reference jj are preserved (one cross-cutting lessons note points at this plan's ADR for the strategic shift).

6. **Supersession of the prior plan.** Add a supersession banner at the top of `.indusk/planning/git-or-jj-substrate/adr.md` and `apps/docs/src/decisions/git-or-jj-substrate.md` pointing to this ADR. The prior plan's archive folder stays intact as historical record.

## Alternatives Considered

### Keep graceful-degrade dual-SCM

Status quo. Git users live without semantic graph + file-linkage. Dusk's own context-derivation pipeline stays off. Every new feature continues to ask "does this work on both?"

**Rejected because**: the agent loop's design moved past treating semantic graph as a power feature. File-linkage is load-bearing in 1.30+. Continuing graceful-degrade compounds the debt with every new feature.

### Build stable event_id design (option b from prior research)

Generate a UUID at event-write time independent of SCM identity. Use SCM ID as a hint for replay filtering. Tolerate orphans cleanly.

**Rejected because**: today's spot-check revealed the content-keyed dedup already handles duplicates correctly. Stable event_id solves a problem the existing code doesn't have. The substantial schema migration cost is not justified when the simpler fix works.

### Expand jj to first-class, deprecate git

Flip the asymmetry: make jj the only SCM. This was never seriously considered, but worth naming explicitly to close the option space.

**Rejected because**: git is the universal default for software development. jj has near-zero adoption outside experimental tooling. InDusk needs to be usable by anyone who can `git init`; making it require jj would be a hard adoption blocker.

## Consequences

### Positive

- **Semantic graph works on every InDusk project.** No more silently-disabled file-linkage layer. Dusk's own context-derivation pipeline becomes functional.
- **Single-SCM mental model.** No more dual-form skill prose, no more `getScm()` branching, no more "does this work on jj?" Every feature reasons about one SCM.
- **Codebase shrinks materially.** `lib/scm/detect.ts` deletes. `lib/semantic-graph/jj.ts` deletes. `skills/jj.md` deletes. Dual-form sections collapse. Probably 500+ lines of branching logic removed.
- **Unblocks downstream plans.** The `eval-agent-mcp-access` plan (highlights drain) ships into a working pipeline — episodes land WITH file-linkage edges, not orphaned text.

### Negative

- **jj integration disappears completely.** Sandy's prior jj-mode work in dusk is preserved at the git level (jj overlays git), but InDusk's hooks, prompts, and CLI no longer integrate with jj's change-ID model. Re-onboarding to jj-as-first-class would require a new plan.
- **Provenance traceability is fuzzy on git.** "This edge was discovered at commit X" can be wrong after X is rewritten. Agents don't query provenance to make decisions, so this is cosmetic, but it's worth naming.
- **Historical record is split.** The prior `git-or-jj-substrate` plan's archive and ADR stay intact with supersession banners. Readers of the historical record need to follow the banner to find the current state.

### Risks

- **Noisy semantic-graph log entries after rebase.** Mitigation: the content-keyed dedup at sync time ensures runtime convergence. Log compaction is a future plan if noise becomes painful in practice.
- **Pre-rip-out jj-tagged events in existing dusk logs.** Mitigation: replay's ancestry filter is optional. With no filter, all events apply. Cross-format collisions between jj change IDs (`[a-z]{8,}`) and git short SHAs (`[0-9a-f]{7,}`) are impossible at the format level. Worth a unit test, but no expected data loss.
- **Hidden coupling I haven't seen.** Mitigation: the test plan's 13 behavioral assertions exercise the full surface. If there's a hidden coupling, it surfaces during impl or falsification, not in production.

## Documentation Plan

### Pages

- **New**: `apps/docs/src/decisions/git-only-substrate.md` — copy of this ADR with InDusk frontmatter for the docs site.
- **Rewrite**: `apps/docs/src/guide/scm.md` — collapse from "Choose your SCM (jj or git)" to "Git workflow conventions." Remove jj as a current option; retain a brief historical paragraph noting the strategic shift.
- **Update with supersession banner**: `apps/docs/src/decisions/git-or-jj-substrate.md` — banner at top: "**Superseded by [git-only-substrate](git-only-substrate.md) — 2026-06-27.** Decision: rip out jj; git is the only SCM. Historical content below preserved as time-stamped record."
- **Update**: `apps/docs/src/changelog.md` — new entry under `[Unreleased]` for the next version (probably 1.31.0 given the structural shift).

### Diagrams

- No new diagrams strictly required. Optional: a Mermaid sequence diagram in the rewritten `scm.md` showing the semantic-graph sync flow on git (snapshot → diff against runtime → emit events tagged with git short SHA → write to log + apply to runtime). Only add if it helps the rewrite read more clearly.

### Changelog

- `### Changed` — "**SCM substrate is now git-only (1.31.0)** — rip-out of dual-SCM support. The semantic graph and Graphiti file-linkage layer now work on every git project (including dusk itself). Two-line summary of the parity fix + rip-out. Migration: `scm: "jj"` in `.indusk/config.json` becomes a no-op; `indusk update` nudges via stderr once. See [decisions/git-only-substrate](decisions/git-only-substrate.md)."

### ADR in Docs

Yes — published at `apps/docs/src/decisions/git-only-substrate.md`. Convention matches the rest of the InDusk decisions section.

## References

- `.indusk/planning/git-only-substrate/research.md` — coupling inventory, today's spot-check findings
- `.indusk/planning/git-only-substrate/brief.md` — problem framing, scope, success criteria
- `.indusk/planning/git-only-substrate/test-plan.md` — 13 behavioral assertions
- `.indusk/planning/git-or-jj-substrate/` — superseded prior plan (shipped 1.28.9)
- `.indusk/planning/archive/cgc-graphiti-bridge/adr.md` Decision #2 — original "jj-only because change IDs are stable" justification
- `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts:60-220` — content-keyed dedup; early-return at line 80 to delete
- `apps/indusk-mcp/src/lib/semantic-graph/graphiti-log-wrapper.ts:93` — second early-return to delete
- `apps/indusk-mcp/src/lib/semantic-graph/replay.ts:15-80` — optional ancestry filter
- `apps/indusk-mcp/src/lib/scm/index.ts` — git impl of `getReachableChangeIds` (already lands in prior plan's Phase 1)

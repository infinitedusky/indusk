---
title: "git-only-substrate"
date: 2026-06-27
status: complete
---

# git-only-substrate — Research

## Question

The prior `git-or-jj-substrate` plan landed dual-SCM support with git as a graceful-degraded second-class citizen — semantic graph + Graphiti file-linkage silently disabled on git projects. Sandy's new direction (2026-06-27): jj goes away entirely. git is the only SCM. *If it doesn't work with git, it doesn't work, period.*

This research asks: (1) what's actually needed to bring git to full semantic-graph parity, (2) what's the inventory of jj-coupled code, prose, and skills that need to come down, (3) is there a migration story for any existing jj users.

## Strategic context (2026-06-27)

The prior research ([Findings: Three viable degrade modes](#three-viable-degrade-modes-for-the-semantic-graph) below) recommended option **(c) graceful degrade** because it shipped fastest and the semantic graph was "not load-bearing for the agent loop." That recommendation is now obsolete for two reasons:

1. **The agent loop's design has moved on.** The handoff-multi-agent + section-shape plans now ship Graphiti as the canonical long-term memory store, with the eval agent as the sole structured writer. File-linkage edges (semantic graph) are how Graphiti episodes connect back to specific files in the codebase — without them, "files → episodes → entities" traversal doesn't work. The semantic graph IS load-bearing for context derivation in 1.30+.

2. **Today's spot-check (below) found the gap is much smaller than the prior research assumed.** The sync engine already does content-keyed dedup. The early-returns are defensive, not load-bearing.

## Today's spot-check (2026-06-27)

A 5-minute reading of `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts` and `replay.ts` reveals:

### Finding 1: The sync engine's dedup is already content-keyed, not change-ID-keyed

`runSync()` builds two lookup maps from existing runtime anchors:

```typescript
existingByIdentity.set(identity, anchor);          // path-keyed
existingByFingerprint.set(anchor.blob_hash, anchor); // blob-hash-keyed
```

For each current record, it checks identity (path), then fingerprint (rename detection). Change ID is **only used as a tag on emitted events** (`change_id: changeId` field), never as a lookup key for "have I already processed this?" decisions.

This is exactly the discipline Sandy proposed in conversation: process-once-and-mark, where the lookup key for "already processed" is `(path, content_hash)`.

### Finding 2: `getReachableChangeIds()` already has a working git implementation

`apps/indusk-mcp/src/lib/scm/index.ts`:

```typescript
export async function getReachableChangeIds(projectRoot: string): Promise<Set<string>> {
    const scm = getScm(projectRoot);
    if (scm === "jj") return getJjReachable(projectRoot);
    // git impl — walks `git log --format=%h HEAD`
    const result = await execFileAsync("git", ["log", "--format=%h", "HEAD"], { cwd: projectRoot });
    // ... returns Set<string> of reachable short SHAs
}
```

So the in-code comment at `sync-engine.ts:75-79` claiming "git mode doesn't have stable ancestry" is **outdated documentation** — git ancestry works via the SCM abstraction landed in the prior plan's Phase 1.

### Finding 3: Replay's ancestry filter is optional

`replay.ts`:

```typescript
export interface ReplayOptions {
    ancestryFilter?: Set<string>;  // optional; absent = apply all events
    // ...
}
```

When absent, every event applies. When present, events whose `change_id` is not in the set are skipped. So the "git rebase orphans events" concern only matters at replay time — and the worst case is that a stale (abandoned-commit-tagged) event applies to the runtime, which the next `runSync` corrects via content-keyed dedup and tombstone events.

### What's actually blocking git mode

Two defensive early-returns, both added in the prior plan's Phase 2:

1. `sync-engine.ts:80-86` — `if (getScm(projectRoot) === "git") return { ...EMPTY_RESULT, ... }`
2. `graphiti-log-wrapper.ts:93-103` — same shape, skips the event-log mirror for Graphiti writes

That's it. Deleting these two blocks + accepting "noisy-replay-then-converge" on rebase brings git to full functional parity. **The clever event_id reasoning the prior research scoped (option b) is unnecessary** because the sync engine's content-keyed dedup catches duplicates on the next sync, and replay tolerates extra events because identity-matching at sync time will tombstone whatever's orphaned.

## Coupling inventory (rip-out sweep)

After parity lands, the next sweep removes the SCM abstraction layer. Here's the full inventory of jj-coupled code as of 1.30.2:

### Code call sites of `getScm()` / `getCurrentChangeId()` — 14 total

```bash
$ grep -rn "getScm\|getCurrentChangeId" apps/indusk-mcp/src/
```

| Surface | File | Pattern |
|---|---|---|
| Sync engine | `lib/semantic-graph/sync-engine.ts` | early-return + tag emission |
| Graphiti wrapper | `lib/semantic-graph/graphiti-log-wrapper.ts` | early-return + tag emission |
| Eval prompts | `lib/eval/prompt-builder.ts` | `git show ${id}` vs `jj diff -r ${id}` branch |
| Eval runner | `lib/eval/persistent-evaluator.ts`, `evaluator-runner.ts` | `scm` passed to prompt builder |
| Eval CLI baseline | `bin/commands/eval.ts` | `git commit --allow-empty` vs `jj new`/`jj describe` |
| Eval hook | `hooks/eval-trigger.js` | dual-trigger regex `/\b(jj describe\|git commit)\b/`, change-ID resolution fallback |
| Highlight tool | `lib/highlights/*` | (verify — likely tags with current change ID) |
| SCM module itself | `lib/scm/{detect,index}.ts` | the abstraction + jj-flavored helpers |
| Replay (doc only) | `lib/semantic-graph/replay.ts` | comment references `getReachableChangeIds` |

After rip-out:
- `lib/scm/` collapses to a single `getCurrentChangeId(projectRoot)` calling `git rev-parse --short HEAD`. The `detect.ts` SCM-detection module deletes. `getScm()` deletes (no consumers). The `scm` field in `.indusk/config.json` becomes a no-op (silently ignored by `update.ts`).
- `lib/semantic-graph/jj.ts` deletes — no more `getReachableChangeIds(jj)`, `getJjReachable`, `NotAJjRepoError`.
- All eval prompts/CLI collapse to git-only paths (no branching).
- `eval-trigger.js`'s regex narrows to `/\bgit commit\b/`. The jj fallback in change-ID extraction goes away.

### Skills and docs — prose sweep

| Path | Current state | After |
|---|---|---|
| `apps/indusk-mcp/skills/jj.md` | Standalone jj reference skill | **Delete** |
| `apps/indusk-mcp/skills/git.md` | Standalone git reference skill | **Stays** — becomes the only SCM skill, lightly edited to remove "if your project is git" framing (it just IS git) |
| `apps/indusk-mcp/skills/work.md` | Has SCM-conditional describe-then-do vs commit-after sections | Collapse to git-only commit-after cadence |
| `apps/indusk-mcp/skills/highlight.md` | "On next `jj describe` or `git commit`" prose | Collapse to "on next `git commit`" |
| `apps/indusk-mcp/skills/eval-review.md` | jj-flavored `jj diff` examples | Replace with `git show` / `git diff` |
| `apps/docs/src/guide/scm.md` | "Choose your SCM (jj or git)" guide | Rewrite as "Git workflow conventions" |
| `apps/docs/src/decisions/git-or-jj-substrate.md` | ADR record | **Keep with supersession banner** — points at this plan's ADR |
| `apps/docs/src/changelog.md` | Historical 1.28.9 entries | Untouched (historical record) |
| `.indusk/planning/git-or-jj-substrate/` | The just-shipped plan | **Archive with supersession banner** in retrospective |
| `apps/docs/src/lessons/*.md` | (verify — likely 1-2 lesson pages reference jj) | Update or note as historical |

Prose sweep estimate: 20-40 callsites across `apps/docs/` + `.indusk/planning/`, mostly find-and-replace.

## Migration story

Sandy is the only user with active jj-mode projects (confirmed in discovery). The migration is trivial:

1. On `indusk update` for a project where `.indusk/config.json` has `scm: "jj"`: silently drop the field. No warning, no migration step. The user has already committed to git or jj at the SCM layer; InDusk just stops asking.
2. The codepath `getScm(projectRoot) === "jj"` returns `false` everywhere because `getScm` deletes — call sites collapsing to git-only behavior is the migration.
3. Projects currently using jj at the SCM level (not InDusk) keep working — InDusk just stops integrating with jj's change-ID model and uses git's HEAD instead.
4. `.indusk/graph/semantic-graph.log` files written under jj-mode are still replayable — events are tagged with jj change IDs, but replay's ancestry filter is optional; with no filter, all events apply. The sync engine's content-keyed dedup catches duplicates. No data loss; some log noise on first post-rip-out sync.

No deprecation cycle. No conversion CLI. No version-gated removal. Just a rip.

## Three viable degrade modes for the semantic graph
*(retained from prior research as historical context — see "Strategic context" above for why these are now obsolete)*

| Mode | Behavior | Cost |
|---|---|---|
| (a) Full parity | Tag events with git SHAs, walk git ancestry on replay. Events orphan on rebase/amend/squash. | Works for most users (no rebase) but bites the moment someone amends a commit — events from that commit silently drop from the projection on next replay. Surprise loss. |
| (b) Stable event_id | Generate a UUID at event-write time, independent of SCM. Use SCM ID as a hint for replay filtering. Tolerate orphans. | New design; probably the right end-state but invasive. |
| (c) Graceful degrade | On git repos, `indusk graph sync` no-ops with a clear message. Semantic graph features unavailable. Everything else works. | Cheapest ship. Loses graph features for git users until (b) lands. |

**Current recommendation (2026-06-27): a hybrid of (a) and the spot-check insight.** Take (a)'s "tag with git SHA, walk git ancestry" approach but **drop the requirement that events survive rebase**. The content-keyed dedup at sync time means a rebase produces noisy-replay-then-converge: a few extra `anchor.created` or `anchor.moved` events get written; replay applies them; next sync catches the duplicates and tombstones the orphans. The runtime converges to "current file state" after one cycle. Provenance traceability is fuzzy (can't truthfully say "this was discovered at commit X" after X was rewritten), but functional correctness holds.

## Open Questions

- **Replay behavior on jj-tagged events after rip-out**: when the sync engine later re-emits events tagged with git short SHAs against a runtime that was previously populated by jj change IDs, are there any cross-format collisions? Probably not (change IDs and short SHAs are different formats: jj is `[a-z]{8,}`, git short SHA is `[0-9a-f]{7,}`), but worth a unit test.
- **`gateway_policy` and other CLI flags**: spot-check the rest of the CLI for any jj-specific flags (e.g., `eval baseline`'s implicit empty-commit behavior). Confirm no user-facing flag breaks.
- **Lessons + retros published to docs site**: 1-2 lessons reference jj specifically. Decision needed: edit the historical content or leave as time-stamped record. Leaning toward "leave historical, add a lessons note that the substrate moved."

## Sources

- `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts:60-220` — content-keyed dedup; early-return at line 80
- `apps/indusk-mcp/src/lib/semantic-graph/graphiti-log-wrapper.ts:93` — second early-return
- `apps/indusk-mcp/src/lib/semantic-graph/replay.ts:15-80` — optional ancestry filter, swallow-and-continue error handling
- `apps/indusk-mcp/src/lib/scm/index.ts` — git impl of `getReachableChangeIds` (already lands in prior plan's Phase 1)
- `.indusk/planning/git-or-jj-substrate/` — prior plan (shipped 1.28.9, soon-to-be-superseded by this plan)
- `.indusk/planning/archive/cgc-graphiti-bridge/adr.md` Decision #2 — original "jj-only because change IDs are stable" justification

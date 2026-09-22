# Operational State

This file represents the operational state for the project — what's happening RIGHT NOW. The architectural layer ("what this project is") lives in [`CLAUDE.md`](../CLAUDE.md). The historical layer ("how we got here") lives in `.indusk/planning/` plans + the docs site.

Two regions:

- **`## Project (shared)`** — cross-cutting state any agent can edit. Pre-launch crunch mode, merge freezes, telemetry endpoint changes, anything project-wide.
- **`## Session <short> — <task>`** blocks — per-agent operational state. Each block holds the agent's `### In Flight`, `### Open Questions`, `### Cursor`. Written via `mcp__indusk__update_current_section` at `/handoff` (or any moment something solidifies). Other agents' sections are byte-untouched by your writes.

`/catchup` reads this file pure-read. `/retrospective` distills sections of it into CLAUDE.md on plan close.

## Project (shared)

_Any agent can edit this section. Cross-cutting state that's true for the whole project right now._

- 2026-09-15: composable.env removed from dusk (ce.json, env/, scripts, dev dep); Doppler is the env layer. indusk-mcp reads its secrets from `~/.indusk/config.env`, not Doppler — do not map it. **Direction**: indusk-admin will be hosted on a server eventually; keep its Doppler mapping, and create the missing `admin` config in the Doppler `indusk` project when that plan starts (it needs a data source before it needs secrets).
- 2026-09-16: the admin plan page polls itself every `admin.refresh_ms` (default 5000, floor 1000; `.indusk/config.json`, never written by `update`). **Revisit the default on 2026-09-30** after two weeks of use — too slow to feel live, or loading the daemon? (admin-ui-phase-progress U2.)
- 2026-08-30: the 2026-08-16 publish blockers are all resolved — `LEGACY_HOOKS` removal shipped (`lib/hook-migration.ts`; `check-plan-order.js` gone from disk and settings), the changelog was split per release in 1.36.2, and the batch published through 1.40.x. CLAUDE.md no longer carries version/plan-table copies; operational blockers belong here.
- 2026-09-17: **1.51.0 published** to npm at 2026-09-18T00:03:18Z from release commit 7f4297bc — by the SECOND `pnpm release` run (browser 2FA confirmed). The first run's `record-release.js` mark was written on pnpm's exit code alone and nothing reached the registry; the mark now says only what `npm view` confirms.
- 2026-09-18: **1.52.0 published** to npm from release commit 52749a95 (`pnpm release`, recorded by `scripts/record-release.js`).
- 2026-09-18: **1.53.0 published** to npm from release commit e0caf32f (`pnpm release`, recorded by `scripts/record-release.js`).
- 2026-09-22: **1.54.0 published** to npm from release commit d7e0061a (`pnpm release`, recorded by `scripts/record-release.js`).

---

## Session 780da059 — user-zero side research: Aeon case study + master.md fate line

**Session ID**: 780da059-f69c-43fc-9940-32075e05833a
**Last updated**: 2026-09-16T18:27:26.766Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 5d66ec7c — eval: scoring commit e63bd7fc (admin-ui-phase-progress test plan acceptance)

**Session ID**: 5d66ec7c-4e53-49c2-ac94-1d5c602cfc29
**Last updated**: 2026-09-16T19:30:26.756Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 6b521fcd — generation-ship-story: writing — outline drilldown, a short story

**Session ID**: 6b521fcd-36de-4dc1-a62d-3064563b9edc
**Last updated**: 2026-09-17T15:21:06.840Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 4b63ba20 — eval: reviewing commit 16e01f51 (A21/A22 RED tests)

**Session ID**: 4b63ba20-9d33-457a-9842-60828f78e863
**Last updated**: 2026-09-16T21:29:50.535Z
**Branch**: plan/admin-ui-phase-progress
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/admin-ui-phase-progress

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 6d2745f7 — eval: score commit 9cc32112 (Test Phase 1 rows for admin-ui-phase-progress)

**Session ID**: 6d2745f7-dbd2-4af8-8eb8-76f53b9fc38d
**Last updated**: 2026-09-16T21:30:11.594Z
**Branch**: plan/admin-ui-phase-progress
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/admin-ui-phase-progress

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 90c83200 — eval: reviewing commit dbd87861 (admin-ui-phase-progress plan doc)

**Session ID**: 90c83200-0bbc-4614-922b-d859496f36b9
**Last updated**: 2026-09-16T21:31:39.320Z
**Branch**: plan/admin-ui-phase-progress
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/admin-ui-phase-progress

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 94a3bdd1 — eval: score commit 74a3faca

**Session ID**: 94a3bdd1-4997-44c9-8daf-079d1c1275bb
**Last updated**: 2026-09-16T22:54:28.818Z
**Branch**: plan/admin-ui-phase-progress
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/admin-ui-phase-progress

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session e44e786a — eval agent: scoring commit b32c5222 (trunk-guard A1-A7 RED)

**Session ID**: e44e786a-5646-4094-946f-8ec9647782ad
**Last updated**: 2026-09-17T21:14:46.320Z
**Branch**: plan/trunk-guard
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/trunk-guard

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session f774fe34 — eval: score commit 0dec004f

**Session ID**: f774fe34-94bd-4317-bc21-add1c09a14c4
**Last updated**: 2026-09-19T20:41:17.768Z
**Branch**: plan/day-monitor
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/day-monitor

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 25c802bd — day-always-on landed + published 1.54.0; release-ritual in flight

**Session ID**: 25c802bd-7505-46cc-a1a7-72186418629a
**Last updated**: 2026-09-22T06:30:09.288Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

**release-ritual** — all three fixes implemented and green, on `plan/release-ritual` (pushed):

1. trunk-guard reads `-F`/`--file` messages, and treats a `-m` from a heredoc/substitution as *unreadable* rather than tokenizing the message into paths. The real bug was sharper than expected: a literal `"` inside a heredoc body closes the tokenizer's quote, so the rest of that line became pathspecs — a message containing the phrase `"exactly once"` was refused with a fragment of itself printed as a filename.
2. `scripts/check-install.js` verifies every declared dependency resolves before npm is touched. Publishing 1.54.0 failed *after* `npm whoami` because a dependency merged from a plan branch was never installed on trunk.
3. `/retrospective` gained **Step 11: Bump** — the landed merge decides whether packaged paths changed, the plan decides minor vs patch, the changelog rolls, the `chore(release):` commit is written. Skipping is recorded, not silent.

T1–T9 pass. **Remaining**: Build Phase 3's Context + Document gates, then `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective`. Its own close runs Step 11 for real — that is the deferred verification.

### Open Questions

- Should `indusk plans` **refuse an unrecognised document status** instead of treating it as inactive? `context-tiers` carried `status: complete` (vocabulary is `completed`) and vanished from every active listing — one letter, silently. `jev-decision-model/research.md` still has it and is not mine to change.
- Build Phase 3 carries a discovered item: trunk-guard's allowlist omits `.claude/skills/` and `.claude/hooks/`, which `indusk update` writes — and update is meant to run on trunk. Landing 1.54.0's update needed `INDUSK_TRUNK_GUARD=off` to commit the testing extension's refreshed skill.

### Cursor

Worktree `/Users/the_dusky/code/sandbox/dusk-worktrees/release-ritual` (exists on THIS Mac only; on another machine `git worktree add ../dusk-worktrees/release-ritual plan/release-ritual` then `indusk worktree assign`).

Next concrete step: the two unchecked gates under `#### Build Phase 3 Context` / `Document` in `.indusk/planning/release-ritual/impl.md`, plus the discovered allowlist item above it.

Suite notes, none caused by this plan: the admin bundle is gitignored so a fresh checkout fails 7 tests until `pnpm --filter indusk-admin build && node apps/indusk-mcp/scripts/bundle-admin.js`; `daemon-identity`'s two PID-reuse tests fail identically on `main`; `http-promise-health` A16 times out at 5s under full-suite load and passes alone.

---

## Session d0f10e5e — eval agent: scoring commit 106cf6de (day-monitor impl draft)

**Session ID**: d0f10e5e-9a6f-499d-8732-7f0376e2ae58
**Last updated**: 2026-09-18T23:34:23.352Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 0ae5d939 — eval agent: scoring commit 82538e15

**Session ID**: 0ae5d939-fa22-4e79-b022-a1eefff361e9
**Last updated**: 2026-09-20T04:09:33.802Z
**Branch**: plan/day-always-on
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/day-always-on

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

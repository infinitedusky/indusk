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

---

## Session da8327e4 — eval: reviewing commit 3dbe9a1a (master.md queue entry)

**Session ID**: da8327e4-4ba2-4939-a094-9055c134a4a6
**Last updated**: 2026-09-14T14:42:01.483Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 30e64e93 — eval: reviewing commit 00bf46bd (worktree-config-schema-pointer Phase 2 red tests)

**Session ID**: 30e64e93-bd7f-4969-a4c4-2a24454f7335
**Last updated**: 2026-09-14T15:37:41.098Z
**Branch**: plan/worktree-config-schema-pointer-phase-2
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/worktree-config-schema-pointer

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

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

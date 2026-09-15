# Operational State

This file represents the operational state for the project — what's happening RIGHT NOW. The architectural layer ("what this project is") lives in [`CLAUDE.md`](../CLAUDE.md). The historical layer ("how we got here") lives in `.indusk/planning/` plans + the docs site.

Two regions:

- **`## Project (shared)`** — cross-cutting state any agent can edit. Pre-launch crunch mode, merge freezes, telemetry endpoint changes, anything project-wide.
- **`## Session <short> — <task>`** blocks — per-agent operational state. Each block holds the agent's `### In Flight`, `### Open Questions`, `### Cursor`. Written via `mcp__indusk__update_current_section` at `/handoff` (or any moment something solidifies). Other agents' sections are byte-untouched by your writes.

`/catchup` reads this file pure-read. `/retrospective` distills sections of it into CLAUDE.md on plan close.

## Project (shared)

_Any agent can edit this section. Cross-cutting state that's true for the whole project right now._

- 2026-09-15: composable.env removed from dusk (ce.json, env/, scripts, dev dep); Doppler is the env layer. indusk-mcp reads its secrets from `~/.indusk/config.env`, not Doppler — do not map it. **Direction**: indusk-admin will be hosted on a server eventually; keep its Doppler mapping, and create the missing `admin` config in the Doppler `indusk` project when that plan starts (it needs a data source before it needs secrets).
- 2026-08-30: the 2026-08-16 publish blockers are all resolved — `LEGACY_HOOKS` removal shipped (`lib/hook-migration.ts`; `check-plan-order.js` gone from disk and settings), the changelog was split per release in 1.36.2, and the batch published through 1.40.x. CLAUDE.md no longer carries version/plan-table copies; operational blockers belong here.

---

## Session dd0c95d9 — eval: reviewing writing-skill commit 49042d49

**Session ID**: dd0c95d9-cb48-4fd8-91c4-ec31ad7e2bfd
**Last updated**: 2026-09-10T00:32:44.427Z
**Branch**: plan/writing-skill
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/writing-skill

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 2dfae2ea — indusk-v4-day: writing — read-as-reader + falsify passes on papers 1-3

**Session ID**: 2dfae2ea-94f9-46f5-a54c-cf61eb7548f3
**Last updated**: 2026-09-10T01:08:38.346Z
**Branch**: plan/writing-skill
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/writing-skill

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 2dfae2ea — writing-skill: /work Test Phase 1 (author every assertion RED)

**Session ID**: 2dfae2ea-94f9-46f5-a54c-cf61eb7548f3
**Last updated**: 2026-09-10T00:24:06.349Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session f9c6df62 — eval agent scoring commit 171d14df

**Session ID**: f9c6df62-8ee7-4317-b88c-c7a17cfa0848
**Last updated**: 2026-09-08T19:06:54.253Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

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

## Session 5292bc04 — starting catchup

**Session ID**: 5292bc04-3949-4669-b4d2-4dedbebfa11b
**Last updated**: 2026-09-15T18:18:49.891Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

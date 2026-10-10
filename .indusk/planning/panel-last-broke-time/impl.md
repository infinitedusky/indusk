---
title: "panel-last-broke-time"
date: 2026-10-10
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
falsification: skipped
falsification_reason: "A display fix of one field read from the wrong source (Sandy, 2026-10-10: two small bugfix plans); the three rows pin the field, its time zone and its source."
cleanup: skipped
cleanup_reason: "A one-field change in two existing files per app; nothing new to decompose."
audit: skipped
audit_reason: "A display defect found by Sandy reading the panel; its rows prove the fix directly."
---

# panel-last-broke-time

## Goal

"Last broke" in the editor is the newest violation's time, in local time.

## Scope

### In Scope
- `apps/indusk-mcp/src/lib/promises/health-line.ts`: the row's `lastBroke`.
- `apps/vscode-extension/src/core/{panel,panel-html,hover,view}.ts`: read `lastBroke`; `stamp` in local time.

### Out of Scope
- The admin's "last seen" wording.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1–A3 red | the health line, the core's panel and hover |
| Build Phase 1 | `lastBroke` on the line; the core reads it; `stamp(iso, timeZone?)` | Test Phase 1's rows |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A promise whose newest violation is older than its newest held run shows, in the panel and the hover, "last broke" at the violation's time, not the held run's | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-broken-promise-says-when-it-last-broke | apps/vscode-extension/src/core/last-broke.test.ts |
| A2 | The time reads in the person's time zone with no "UTC" suffix: a violation at 2026-10-09 17:46 UTC reads 1:46 pm on Oct 9 in America/New_York | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-broken-promise-says-when-it-last-broke | apps/vscode-extension/src/core/last-broke.test.ts |
| A3 | Each health line row for a promise with violations carries the newest violation's time | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-broken-promise-says-when-it-last-broke | apps/indusk-mcp/src/__tests__/promise-health-names.test.ts |

## Checklist

### Test Phase 1: The three rows, red

**Tier**: med

- [ ] Confirm this plan's worktree (`git worktree list` shows `plan/panel-last-broke-time`)
- [ ] A1, A2 in `apps/vscode-extension/src/core/last-broke.test.ts` against the core's panel model, panel HTML and hover, with a line row whose `lastSeen` is newer than its violation (the field the fix adds is read as optional, so the test loads today and fails on its assertion); A2 passes the time zone explicitly so it does not depend on the machine's
- [ ] A3 in `promise-health-names.test.ts`: a row with violations carries `lastBroke` equal to the newest violation's time
- [ ] Each fails on its own assertion, never a load error; rows set `written`

#### Test Phase 1 Verification

- [ ] A1, A2, A3 are `written` and red on their assertions (`cd apps/vscode-extension && pnpm exec vitest run src/core/last-broke.test.ts` and `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promise-health-names.test.ts`)

### Build Phase 1: The line carries the time, the editor shows it

**Tier**: med

- [ ] `health-line.ts`: each row with violations gains `lastBroke` (the newest violation's ISO time), beside the `traceId` it already carries
- [ ] Extension core: the panel and hover's "last broke" read `lastBroke` (falling back to nothing, never to `lastSeen`); "last seen" keeps `lastSeen`; `stamp(iso, timeZone?)` formats in the given time zone, else the machine's, with no "UTC"

#### Build Phase 1 Verification

- [ ] A1, A2, A3 pass (the two commands above), plus `pnpm exec vitest related` on the changed sources in both apps; tsc and biome clean

#### Build Phase 1 Context

- [ ] `apps/vscode-extension/CLAUDE.md`: "last broke" is the line's `lastBroke`, never `lastSeen`; times show in local time

#### Build Phase 1 Document

- [ ] `apps/docs/src/guide/promises-in-your-editor.md`: the panel's "last broke" is the newest violation, in your time zone; changelog `### Fixed` under `## [Unreleased]`

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/health-line.ts` | `lastBroke` on each row |
| `apps/vscode-extension/src/core/{panel,panel-html,hover,view}.ts` | read `lastBroke`; local-time `stamp` |

## Dependencies

- None.

## Notes

- The hover had the same defect as the panel (`hover.ts:20` reads `lastSeen` for a red promise).

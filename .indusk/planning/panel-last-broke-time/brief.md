---
title: "panel-last-broke-time"
date: 2026-10-10
status: draft
workflow: bugfix
---

# panel-last-broke-time — Brief

The editor's panel and hover say a broken promise "last broke" at the time it was **last seen** — the newest evaluation of any outcome — and print it in UTC. On 2026-10-10 `every-commit-evaluated` read "last broke 2026-10-10 21:20 UTC" (a run that held, 5:20 pm in New York) when its newest violation was 2026-10-09 17:46 UTC (1:46 pm the day before). `panel.ts:176` and `hover.ts:20` fill "last broke" from the line's `lastSeen`; the line already carries the newest violation's trace id (`health-line.ts:147`) but not its time.

## Expectations

None — a display defect; its row proves it fixed.

## Promises

### This plan makes

1. **`a-broken-promise-says-when-it-last-broke`** (state). Wherever the editor says a promise last broke, it shows the time of its newest violation, in the person's own time zone, never the time it was last seen.

### Existing promises

**Must not break**

- **`the-editor-shows-the-same-health-as-the-admin`**. The time travels on the health line from the package's one reader; the editor computes nothing.
- **`the-editor-only-shows`**. The extension still only reads the line.

**Changes**

None.

**Replaces**

None.

### Not promised

- The admin's own promise page wording of times: it says "last seen", which is what it shows.

## Depends On

- None.

## Blocks

- None.

---
title: "panel-last-broke-time"
date: 2026-10-10
---

# panel-last-broke-time — Retrospective

## What happened

Sandy read `every-commit-evaluated` as "last broke today at 9 pm" when it had last broken the day before. The editor's panel and hover filled "last broke" from the health line's `lastSeen` — the newest evaluation of any outcome — and printed it in UTC. The line already carried the newest violation's trace id but not its time. Now each row carries `lastBroke` (the newest violation's time), the panel and hover read it and never fall back to `lastSeen`, and `stamp` formats in the person's time zone (A1–A3, red first, then green). The extension's test config pins `TZ=UTC` so the existing time assertions hold on any machine.

## What we learned

- **A field named for one fact was used for another.** `lastSeen` was right for "last seen" and wrong for "last broke"; the hover had the same defect as the panel. Where a label names a specific event, the value should be that event's own field, not the nearest timestamp.
- **Times shown to a person belong in their time zone.** The admin-style UTC stamp read as a local time and misled.

## Quality ratchet

No lint or type errors recurred. Shape: 0 findings raised, 0 judged wrong. Falsification, cleanup and audit skipped with reasons (Sandy, 2026-10-10).

## Metrics

- 10 commits; `health-line.ts` and four extension core files, plus tests, docs and a CLAUDE.md line.
- A1–A3 passing; extension core 40/40; the package's single-definition and health-line tests 79/79.

Landed on main at 54757bf0, 2026-10-10. Installed with `pnpm install:local`; nothing published.

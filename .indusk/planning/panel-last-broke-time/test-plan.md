---
title: "panel-last-broke-time — Test Plan"
date: 2026-10-10
status: draft
---

# panel-last-broke-time — Test Plan

## Behavioral Assertions

### `a-broken-promise-says-when-it-last-broke` — wherever the editor says a promise last broke, it shows the time of its newest violation, in the person's own time zone, never the time it was last seen.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A promise whose newest violation is older than its newest held run shows, in the panel and the hover, "last broke" at the violation's time, not the held run's | unit |
| A2 | The time reads in the person's time zone with no "UTC" suffix: a violation at 2026-10-09 17:46 UTC reads 1:46 pm on Oct 9 in America/New_York | unit |
| A3 | Each health line row for a promise with violations carries the newest violation's time | unit |

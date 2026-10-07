---
title: "telemetry stop stops what it started — Retrospective"
date: 2026-10-07
---

# telemetry stop stops what it started — Retrospective

## What We Set Out to Do

The 1.65.0 release failed with nine Jaeger and otelcol processes left running
from the system tier's temporary homes. Sandy: "becoming a pattern" — the
third release in a row stopped by the system tier.

## What Actually Happened

The leaked homes had their records deleted, so `stop` had run and reported
success. It judged a recorded process its own only if its port answered; under
the release's load the port was slow, so it signalled nothing, deleted the
record and said "stopped". `stop` now judges by the process's command line
(this daemon's binary with this home's config), signals only its own, and
keeps the record and exits non-zero when something will not die. A1
reproduced the release's failure exactly before the fix.

## What We Learned

- A guard that cannot tell "not mine" from "slow to answer" turns its safety
  check into a false success. This is the root's Known Gotcha again: the
  comment said "don't SIGTERM a stranger", and the code delivered "report
  stopped without stopping".
- The release failures were not one flaky test each time but one class:
  timing under the system tier's load, met at the moment it costs most.

## What We'd Do Differently

- When a release fails, read the leaked state before rerunning: here the
  missing record named the cause in one look.

## Quality Ratchet

No rule applies. Shape raised nothing; none judged wrong.

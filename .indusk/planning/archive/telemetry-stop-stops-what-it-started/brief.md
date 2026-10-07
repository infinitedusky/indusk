---
title: "telemetry stop stops what it started"
date: 2026-10-07
status: accepted
workflow: bugfix
---

# telemetry stop stops what it started — Brief

*Opened when the 1.65.0 release failed (Sandy, 2026-10-07: "becoming a
pattern"): nine Jaeger and otelcol processes from the system tier's temporary
homes were left running, each home with its record deleted. `indusk telemetry
stop` decides a recorded process is its own only if its port answers; under
load the port is slow, so stop signals nothing, deletes the record, and
reports the daemon stopped.*

## Expectations

1. **The release's system tier stops leaving daemons behind.**
   - Measure: `check-test-daemons` at the end of each `pnpm release` and landing run names no process.
   - Look: at the next five releases.

## Promises

### This plan makes

1. **`telemetry-stop-stops-what-it-started`** (state). `indusk telemetry stop` stops the Jaeger and otelcol it started, even when their ports are slow to answer; it never signals a process that is not its own, and never reports them stopped while they still run.

### Existing promises

**Must not break**

None.

**Changes**

None.

**Replaces**

None.

### Not promised

- **The admin daemon's stop**, which has its own copy of the same port-based identity check (`lib/admin/daemon.ts`). Same pattern, separate code; in `known-issues.md`.
- **Running the system tier once per release** — [release-checks-run-once](../release-checks-run-once/brief.md).

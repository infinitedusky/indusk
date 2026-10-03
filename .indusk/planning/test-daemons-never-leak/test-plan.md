---
title: "A test run never leaves a telemetry daemon behind — Test Plan"
date: 2026-10-03
status: draft
---

# A test run never leaves a telemetry daemon behind — Test Plan

## Purpose

What must be true for a test run to leave this machine as it found it. Each
assertion names how it is tested; the impl's Test Trajectory rows come from
this table.

This has happened before. On 2026-08-13 the suite had left **2,058**
orphaned processes holding 17.1 GB, and the fix was a convention — every suite
that runs the CLI against a temporary home calls `stopTelemetryForHome`.
On 2026-10-03 there were 860 again. The assertions below are about defaults
and a guard, not about remembering.

## Behavioral Assertions

| ID | Assertion (what a person running the tests sees) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Running `indusk init` on a fixture project from inside the test suite starts no Jaeger or otelcol process — whether the test went through the CLI helper or started the CLI with its own environment | vitest integration: run `init` both ways against a temp home, list processes whose command line names that home |
| A2 | Outside the tests, `indusk telemetry register` still starts the daemon when none is running for that home — the switch changes nothing for a person using the CLI | vitest integration (system tier): register against a temp home with the switch unset, see the pair start, stop it |
| A3 | After the everyday suite, no telemetry process is running from a temporary home; one left running on purpose makes the guard fail, naming its process and its home | vitest integration: the guard's check run against a deliberately started daemon in a temp home, then against a clean machine |

## Notes

- **The switch is set for the whole test process, not only in the CLI
  helper.** Several tests start the CLI with their own environment
  (`runner-detect-home-*` among the leaked homes), and an environment set
  in the Vitest config reaches every child process that inherits it. A test
  that deliberately clears the environment is what A1's second half and A3's
  guard exist for.
- **A2 is the guard against the opposite mistake** — making the switch so
  broad that a real `register` stops starting the daemon. It needs a real
  daemon, so it is system tier.
- **A3 reads processes, not records.** The leaked pairs were unreapable
  because their only record lived in a temp home the test had deleted; the
  guard looks at what is running, the way they were found on 2026-10-03.
- The existing `stopTelemetryForHome` calls stay: with the switch they find
  nothing to stop, and removing them is not this plan's concern.

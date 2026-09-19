---
title: "Day step 4b — Monitor — Test Plan"
date: 2026-09-18
status: accepted
---

# Day step 4b — Monitor — Test Plan

## Purpose

What must be true for a behaviour promise to be watched in a running system
and for a violation to reach the plan that owns it — locally, through Jaeger,
with no hosted backend. Each assertion names how it is tested. They become the
impl's Test Trajectory.

Two mechanisms carry most rows. Where a row needs spans, a test runs code
under an OpenTelemetry in-memory exporter, or exports to a real local Jaeger
started by the test when the row is about what Jaeger returns. Where a row is
about what a person sees, it goes through the CLI or the admin over HTTP.

## Behavioral Assertions

### The mark on the running system

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A1 | Code that upholds a promise, run once, leaves a trace in Jaeger that names the promise it upheld | vitest integration, real local Jaeger |
| A2 | Code that breaks a promise leaves a trace from which "which promise broke" can be read by anyone with the raw trace, without InDusk | vitest, in-memory exporter; the assertion reads the exported span data only |
| A3 | Code that touches no promise leaves its spans exactly as before — nothing is added to spans that do not opt in | vitest, in-memory exporter |

### A test can assert on the mark

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A4 | A test can assert that a call upheld promise X — the span naming X appeared, under the parent it expects — and the test passes | vitest, the trace-shape helper against a fixture call |
| A5 | The same test still passes after a harmless change to the call's spans (an added attribute, an extra child span) and fails when the span naming X is gone | vitest |
| A6 | A test that asserts a promise through the helper counts as that promise's test link: `indusk promises check` accepts the promise with that test named, and no other citation | vitest CLI (`runCli`) against a fixture project |

### A number for each promise

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A7 | `indusk promises status` lists each behaviour promise with its violations in the window, the traces behind them, and when it was last seen upheld | vitest CLI against a real local Jaeger loaded with fixture traces |
| A8 | A behaviour promise no run exercised in the window reads "not seen", never "upheld" or zero violations | vitest CLI |
| A9 | State and structure promises are listed as watched by the suite, not by telemetry, and never given a violation count | vitest CLI |
| A10 | When Jaeger cannot be reached, `status` says so, names where it looked, and exits non-zero; it never reports "0 violations" | vitest CLI, Jaeger stopped |

### The loop

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A11 | After a violation with no open incident for that promise, running the monitor leaves one incident in the registry that names the promise, the traces, source `local` and the symptom from the span, with its root cause marked as not yet written; `indusk promises check` still passes | vitest CLI, fixture project + real local Jaeger |
| A12 | A second violation of a promise that already has an open incident adds its traces to that incident instead of opening another | vitest CLI |
| A13 | Running the monitor twice over the same violations changes nothing the second time | vitest CLI |
| A14 | The incident reopens the promise's owning plan: `list_plans` and the admin show it reopened, with a maintenance phase that names the incident | vitest integration (tool call) + HTTP |
| A15 | An incident whose root cause is still unwritten cannot be marked fixed | vitest CLI (`promises check` refuses it by name) |

### `monitor`, the quiet window

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A16 | A plan whose work is done and whose behaviour promises have been quiet for less than the window shows `monitor` in `list_plans` and on its admin plan bar, with how much of the window has passed | vitest integration + HTTP, clock fixed by the test |
| A17 | Once its promises have been quiet for the whole window, the plan reads closed | vitest integration, clock advanced |
| A18 | A violation during the window keeps the plan in `monitor` and restarts the window; the page says it restarted | vitest integration + HTTP |
| A19 | A plan holding no behaviour promise never enters `monitor` — it closes as it does today | vitest integration (regression guard) |

### Health on the Promises page

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A20 | Each behaviour promise's chip shows its observed health: red when violated in the window, green when seen upheld, hollow "unverified" when not seen, amber when declared known-violated; retired is grey | vitest HTTP against `next dev`, local Jaeger with fixture traces |
| A21 | The page sorts red first and shows violations in the window and "last seen" for each behaviour promise | vitest HTTP |
| A22 | When Jaeger cannot be reached, every behaviour chip is hollow with "health unknown since <time>"; none is green | vitest HTTP, Jaeger stopped |
| A23 | A plan holding a promise that is red shows red in the sidebar without being opened | vitest HTTP |

### The loop closes, on this repository

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A24 | In a local run of this repository under the telemetry daemon, a deliberate violation of one of its behaviour promises is detected from telemetry, opens an incident with source `local`, and reopens the owning plan — the Day row 9 acceptance, with no person finding it by reading | end-to-end test (`pnpm e2e`, its own vitest project, outside `pnpm test`; needs the `claude` CLI and the telemetry daemon), run and recorded in the retrospective |

## Untestable Assertions

None. The one judgement — whether an incident's root cause, written by a
person, is right — is outside the system by design: the monitor opens the
incident and marks the root cause unwritten (A11, A15).

## Notes

- Rows that read Jaeger start a real local Jaeger from the local-telemetry
  extension's binaries inside the test, the way `http-plan-worktrees` starts
  `next dev`: a stub of Jaeger's query API would test our reading of our own
  guess at it.
- A2 is the "without InDusk" check the brief requires: which promise broke
  must be readable from the raw trace, so a person with any OpenTelemetry
  tool, or none, can answer it.
- A14's "reopened" for an archived owner (every current behaviour promise is
  owned by an archived plan) is the ADR's to define — un-archive, or a
  maintenance plan beside it; the assertion is what a reader sees.
- The always-on tier's assertions belong to `day-always-on`.

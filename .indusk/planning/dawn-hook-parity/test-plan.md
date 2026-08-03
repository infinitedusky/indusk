---
title: "Dawn Hook Parity — Test Plan"
date: 2026-08-03
status: accepted
---

# Dawn Hook Parity — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean hook parity is working in the thin lane. Each names its test mechanism — not the test code. The observer throughout is the person (or script) running `atdawn run` and inspecting what the run leaves behind: exit codes, commits, queue files, scorecards, block messages. When all assertions hold, the thin lane enforces every invariant Claude Code enforces, produces the same history granularity, and feeds the same learning rail.

These assertions become the impl's Test Trajectory rows. The scripted-driver harness from the orchestrator plan (`src/lib/run/harness.test-support.ts`) is the workhorse mechanism — it drives the real loop with a deterministic fake model, so runs are cheap and reproducible.

## Behavioral Assertions

| ID | Assertion (observable behavior) | Mechanism |
|----|--------------------------------|-----------|
| A1 | A thin-lane run whose model tries to push CLAUDE.md past its byte budget has that write refused, and the refusal message is the same one Claude Code shows for the same edit. | vitest integration (scripted driver; temp project with a near-budget CLAUDE.md) |
| A2 | A thin-lane run leaves one git commit per completed checklist item, each commit message naming the item it closed. | vitest integration (scripted driver in a temp git repo) |
| A3 | After a thin-lane run, the pending-evals queue holds exactly one record per commit the run made. | vitest integration |
| A4 | Draining the queue produces one scorecard per pending record; running the drain again produces nothing new. | vitest integration (stubbed evaluator spawn) + manual smoke via `/rail-check` for the real spawn |
| A5 | A commit that fails (nothing staged, rejected by git) adds no record to the queue. | vitest unit |
| A6 | Running an `ask`-policy plan whose model attempts a proof-less gate skip pauses the run — exit 3, the gate question printed — rather than red-stopping or proceeding. | vitest integration (scripted driver) |
| A7 | After a human adds conversation proof to the impl and re-runs, the run continues past the previously-paused phase. | vitest integration (two-run sequence) |
| A8 | A plan with no `gate_policy` in its frontmatter behaves as `ask` in the thin lane; a plan explicitly set to `auto` runs without pauses, as today. | vitest integration |
| A9 | A run on a machine without the `claude` CLI completes normally and still fills the queue — the lane itself never needs Claude Code installed. | vitest integration (PATH stripped of `claude`) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Drained evaluations produce meaningful scorecards and lessons. | Evaluator output is LLM judgment — quality isn't machine-assertable here (same boundary the eval-agent plans drew). | A4's manual `/rail-check` smoke on real backlog; the existing eval-rail invariants and regression tests; scorecards reviewed in the admin UI. |

## Notes

- The gate-reminder shed is a *documentation* deliverable (recorded decision + master correction), not a behavior — it deliberately has no assertion row. The docs audit at retrospective checks it.
- A1's "same message both lanes" is the parity claim in miniature — the mechanism should assert on the block text coming from the shared hook script, not a thin-lane re-implementation.
- A4's dedup discipline inherits the eval rail's `markProcessed` invariant (`already_processed → STOP`) — the test should prove re-drain idempotence at the queue layer, not by observing evaluator behavior.
- A9 pins the design's central promise (no CC dependency inside the lane) — cheap to test by stripping `claude` from PATH in the child env.

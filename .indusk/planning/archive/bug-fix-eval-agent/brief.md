---
title: "Bug Fix — Eval Agent Silent Failure"
date: 2026-04-17
status: accepted
blocked_by: []
---

# Eval Agent Silent Failure — Brief

## Problem

The eval judge stopped writing scorecards to `.indusk/eval/results.log` on or before 2026-04-11. Since then:

- `system.log` shows the hook firing and the judge being spawned on every `jj describe`
- No `judge completed` or `judge crashed` entry ever follows
- No scorecard is written to `results.log`
- The judge process exits without trace

The 2026-04-10 entry in `results.log` shows the last captured error:

```
claude exited with code 1: "Input must be provided either through stdin or as a prompt argument when using --print"
```

This suggests the judge subprocess invokes `claude --print` but the prompt isn't reaching stdin — possibly a subprocess stdio configuration regression or a Claude CLI version bump that changed the stdin contract.

Downstream impact:
- `agent-roles` Phase 3 Deferred Verification (end-to-end highlight processing) cannot close without a working judge
- All Graphiti episodes written by the eval path since 2026-04-11 are missing
- Eval findings haven't accrued, so the "unresolved findings" surfaced on each `jj describe` are stale
- The context-beam relies on eval findings as one of its query sources — quality has silently degraded

## Proposed Direction

**Diagnose and fix the silent failure** using the OTel traces shipped in `improvement-eval-agent-open-telemetry` to pinpoint where the judge dies.

This is a straight-to-implementation micro-plan. The decision space is: "identify the bug, fix it, confirm with a working end-to-end smoke." No architectural choices to weigh.

**Expected investigation shape:**
1. Enable OTel (opt-in flag from the predecessor plan) + run a `jj describe` to produce a trace
2. Inspect the trace: does the judge process get past init? Does the Claude CLI subprocess start? Does it exit immediately? Are there catch-path error spans?
3. Read the judge code — `persistent-judge.js` and `judge-runner.ts` — and trace the `claude --print` invocation path
4. Identify the root cause (hypotheses: (a) prompt piped to stdin after the child detaches from parent stdio, (b) Claude CLI version bump changed the flag semantics, (c) env var the CLI needs isn't being passed through the detached spawn)
5. Fix at the actual broken point, not with a try/catch bypass
6. Regression test: run `jj describe`, confirm `results.log` gets a scorecard

**Why OTel first:** adding logging to guess at the bug is the anti-pattern we just moved away from. Ship OTel, use it to see exactly what's happening, fix the real bug. The OTel plan also serves as the observability layer for diagnosing future judge regressions.

## Scope

### In
- Diagnose the silent failure using OTel traces from the predecessor plan
- Fix the subprocess stdio / Claude CLI invocation flow
- Regression test: an automated test that invokes the judge wrapper and asserts a scorecard is written
- Graceful failure mode: if the judge absolutely must fail (e.g., claude CLI missing), ensure the failure entry reaches `results.log` every time
- Minor hygiene: remove accumulated one-off `syslog` calls that were added during prior diagnosis attempts, if any — keep the useful ones

### Out
- Rewriting the judge runner architecture
- Changing the scorecard JSON shape
- Changing the persistent-judge session resume behavior
- Adding new rubric questions

## Dependencies

- **`improvement-eval-agent-open-telemetry`** — the OTel traces are the primary diagnosis tool. Without them, this plan reduces to speculative logging, which is exactly what we're avoiding.

## Notes

This is the second of two micro-plans deliberately structured brief + impl only (no research, no ADR). Together they serve as the dogfood example for Dusk v2's micro-plan workflow. If the pattern feels right, we codify it as a first-class planner option.

Like all bug-fix plans, this one should be judged on: did we find the root cause? Is the regression test in place? Does the fix pass the falsification ritual?

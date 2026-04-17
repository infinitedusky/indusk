---
title: "Improvement — Eval Agent OpenTelemetry"
date: 2026-04-17
status: accepted
blocked_by: []
---

# Eval Agent OpenTelemetry — Brief

## Problem

The eval judge is a detached background process spawned by the `jj describe` PostToolUse hook. Once spawned, it's a black box:

- `.indusk/eval/system.log` records only hook lifecycle (spawn, config read, path resolution) — nothing about what the judge itself does
- `.indusk/eval/results.log` records only the final scorecard (if one is written)
- Everything in between — catchup, transcript read, diff analysis, per-question reasoning, tool calls, graph_capture writes, highlight processing — is invisible

We discovered during the `agent-roles` Phase 3 smoke (2026-04-17) that the judge has been silently failing since at least 2026-04-11 — results.log shows no scorecards, but no crash log either, because the judge process exits before writing to either log. With no visibility into the judge's internal state, diagnosing the failure requires adding one-off `console.error` statements and redeploying, which is the wrong pattern.

This is also a blocker for `agent-roles`. The Deferred Verification smoke (write a highlight → jj describe → verify end-to-end processing) can't run without a working judge, and we can't cleanly fix the judge without observability.

## Proposed Direction

**Add OpenTelemetry instrumentation to the eval judge**, gated behind an opt-in config flag, exporting via the existing `OTEL_EXPORTER_OTLP_ENDPOINT` (Dash0).

This is a straight-to-implementation micro-plan: no research, no ADR. The decisions are small and well-scoped.

**Design:**
- Root span per judge run: `eval.judge.run` with attributes `changeId`, `source` (`commit` / `handoff` / ...), `mode` (`eval` / `baseline`), `projectGroup`
- Lifecycle spans: `eval.judge.catchup`, `eval.judge.read_transcript`, `eval.judge.read_diff`, `eval.judge.process_highlights`, `eval.judge.answer_rubric`, `eval.judge.write_findings`, `eval.judge.write_scorecard`
- Per-highlight child spans within `process_highlights`: `eval.judge.process_highlight` with `highlight.id`, `highlight.level`, `highlight.tag`, `highlight.action` (the ultimate `wrote-episode` / `skipped`)
- Error recording: `span.recordException(err)` on every catch path; the root span's status goes to `ERROR` if any child errors

**Gating:**
- Default OFF (no cost in normal operation)
- Opt in via `eval.otel.enabled: true` in `.indusk/config.json` OR `INDUSK_EVAL_OTEL=1` env var
- If enabled but `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, log a warning to system.log and skip init (don't crash the judge)

**Testing:**
- Unit test: env-gated initialization returns a no-op tracer when the flag is off
- Unit test: enabled init creates a real tracer with the configured endpoint
- Integration: when enabled, a judge run produces a trace (mocked exporter captures the root span)

## Why Straight-to-Impl

- Pattern already established: the project uses `@opentelemetry/*` packages via the OTel extension; existing instrumentation templates at `apps/indusk-mcp/templates/instrumentation.ts` show the shape
- Span taxonomy maps 1:1 to existing judge steps (already named in the judge prompt builder)
- No architectural tradeoffs to weigh — it's add-instrumentation-to-existing-code
- Micro-plan serves as a dogfood example for the straight-to-impl pattern we may codify into Dusk v2

## Scope

### In
- OTel instrumentation in `apps/indusk-mcp/src/lib/eval/judge-runner.ts` and `apps/indusk-mcp/src/lib/eval/persistent-judge.js` (the two judge entry points)
- Config loader: read `eval.otel.enabled` from `.indusk/config.json` and merge with `INDUSK_EVAL_OTEL` env var (env var wins)
- Tests for env-gated init + span emission

### Out
- Instrumenting the Claude Code CLI itself (the judge is a subprocess; we instrument the wrapper around it, not the CLI's internals)
- New exporter choice or endpoint config — reuse the existing `OTEL_EXPORTER_OTLP_ENDPOINT` convention
- Log → trace correlation (the system.log stays line-oriented; correlation is a future enhancement)
- Metrics (only traces for now; metrics can be a later micro-plan if needed)

## Dependencies

None. This plan is a direct predecessor of `bug-fix-eval-agent` (the bugfix plan uses these traces to diagnose the silent failure) and transitively of `agent-roles` (which can't close until the bug is fixed).

## Notes

This plan is also a deliberate micro-plan experiment: brief + impl only, no research, no ADR, no retrospective narrative beyond quality-ratchet additions. If it feels clean, we'll lift the pattern into Dusk v2.

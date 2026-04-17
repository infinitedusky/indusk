---
title: "Eval Agent OpenTelemetry"
date: 2026-04-17
status: approved
gate_policy: ask
trajectory: required
workflow: feature
---

# Eval Agent OpenTelemetry — Implementation

## Goal

Add opt-in OTel tracing to the eval judge so we can see what happens between "judge spawned" and "scorecard written." Eliminate the black-box period that currently blocks diagnosis of judge failures.

## Scope

### In Scope
- OTel SDK initialization in the judge entry points (`judge-runner.ts`, `persistent-judge.js`)
- Span taxonomy covering the judge's seven-step process
- Per-highlight spans within `process_highlights`
- Config + env-var gating (default OFF)
- Graceful degradation when endpoint unset or init fails
- Unit tests for gating and span emission

### Out of Scope
- Metrics (traces only)
- Log correlation (system.log → trace id)
- Instrumenting Claude CLI internals (we instrument our wrapper)
- Changing the existing system.log / results.log format

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `eval/otel.ts` — tracer init, config loader, graceful no-op fallback | `.indusk/config.json`, `OTEL_EXPORTER_OTLP_ENDPOINT` |
| Phase 2 | Spans in judge-runner + persistent-judge covering run → catchup → transcript → diff → highlights → rubric → findings → scorecard | Phase 1 tracer |
| Phase 3 | Per-highlight child spans + error recording + smoke verification via Dash0 | Phase 2 spans |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `initEvalOtel()` returns a no-op tracer when `eval.otel.enabled` is unset and `INDUSK_EVAL_OTEL` is unset — no network calls, no SDK init | Phase 1 | Phase 1 | planned |
| T2 | `initEvalOtel()` returns a real tracer when `eval.otel.enabled: true` in `.indusk/config.json` AND `OTEL_EXPORTER_OTLP_ENDPOINT` is set | Phase 1 | Phase 1 | planned |
| T3 | `initEvalOtel()` returns a no-op tracer AND logs a warning to system.log when enabled but endpoint is missing (graceful degradation, does not throw) | Phase 1 | Phase 1 | planned |
| T4 | `INDUSK_EVAL_OTEL=1` env var overrides `eval.otel.enabled: false` in config (env wins) | Phase 1 | Phase 1 | planned |
| T5 | A judge run emits a root span `eval.judge.run` with attributes `changeId`, `source`, `mode`, `projectGroup` | Phase 2 | Phase 2 | planned |
| T6 | The root span has seven child spans named `eval.judge.{catchup,read_transcript,read_diff,process_highlights,answer_rubric,write_findings,write_scorecard}` in roughly chronological order | Phase 2 | Phase 2 | planned |
| T7 | `process_highlights` has one child span per highlight with attributes `highlight.id`, `highlight.level`, `highlight.tag`, and (post-process) `highlight.action` | Phase 3 | Phase 3 | planned |
| T8 | Any thrown exception in a step records on its span via `recordException()` and sets the root span status to `ERROR` | Phase 3 | Phase 3 | planned |

### Deferred Verification

- **Dash0 end-to-end trace visible with the expected span tree**
  - reason: requires a live Dash0 tenant + `OTEL_EXPORTER_OTLP_ENDPOINT` pointed at it; not deterministic from a local test
  - would require: integration harness with a mock OTLP endpoint that captures and replays span batches — or a Dash0 test tenant wired into CI
  - mitigation: manual smoke during Phase 3 — enable `eval.otel.enabled: true` in `.indusk/config.json`, run `jj describe`, open Dash0 and confirm a trace exists with root span `eval.judge.run` and the child span tree. This is a user-action verification step (published package required + Dash0 access required). Also tracked as a retrospective finding if the first 3 real runs after ship don't produce traces correctly.

## Checklist

### Phase 1: OTel Init + Config Gating

- [ ] Create `apps/indusk-mcp/src/lib/eval/otel.ts` exporting:
  - `initEvalOtel(projectRoot: string): Tracer` — returns a real tracer when enabled + endpoint set, no-op tracer otherwise
  - `isEvalOtelEnabled(projectRoot: string): { enabled: boolean; endpoint: string | null }` — pure predicate reading config + env
- [ ] Config read: `.indusk/config.json` `eval.otel.enabled` (boolean, default false)
- [ ] Env override: `INDUSK_EVAL_OTEL=1` forces enabled
- [ ] Endpoint read: `OTEL_EXPORTER_OTLP_ENDPOINT` (required when enabled)
- [ ] Graceful degradation: when enabled but endpoint missing, log a warning to `.indusk/eval/system.log` and return no-op tracer
- [ ] Graceful degradation: when SDK init throws, log the error and return no-op tracer

#### Phase 1 Verification
- [ ] T1 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- eval-otel`)
- [ ] T2 passes (same command)
- [ ] T3 passes (same command)
- [ ] T4 passes (same command)
- [ ] `pnpm check` passes

#### Phase 1 Context
- [ ] Add to CLAUDE.md Conventions: "Eval judge OTel is opt-in via `eval.otel.enabled` in `.indusk/config.json` or `INDUSK_EVAL_OTEL=1`. Exports to `OTEL_EXPORTER_OTLP_ENDPOINT` (Dash0). No-op when disabled — zero cost in normal operation."

#### Phase 1 Document
- [ ] Add a section to `apps/indusk-docs/src/reference/tools/otel.md` (or a new `eval-otel.md` if otel.md is crowded) explaining the opt-in flag, env override, and how to configure Dash0 export

### Phase 2: Judge Lifecycle Spans

- [ ] Update `apps/indusk-mcp/src/lib/eval/judge-runner.ts` to wrap the main run with `eval.judge.run` root span + child spans at each of the seven steps
- [ ] Update `apps/indusk-mcp/src/lib/eval/persistent-judge.js` to call `initEvalOtel` and wrap the run similarly (the persistent path is what the hook actually spawns)
- [ ] Root span attributes: `changeId`, `source` (from `INDUSK_EVAL_SOURCE`), `mode`, `projectGroup`
- [ ] End spans in the right order on the success path; `finally` blocks to ensure spans close on exception paths
- [ ] Force-flush the exporter before `process.exit(0)` so traces are not lost on detached-child termination

#### Phase 2 Verification
- [ ] T5 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- judge-spans`)
- [ ] T6 passes (same command)
- [ ] `pnpm check` passes

#### Phase 2 Context
- (none needed — Phase 1 conventions cover the flag; span taxonomy is documented in the reference page, not CLAUDE.md)

#### Phase 2 Document
- [ ] Update the OTel reference page with the span taxonomy table (root + 7 children + per-highlight grandchildren)

### Phase 3: Per-Highlight Spans + Error Recording + Smoke

- [ ] In `process_highlights`, open one child span per highlight with attributes `highlight.id`, `highlight.level`, `highlight.tag`
- [ ] Set `highlight.action` attribute after each `highlight_mark_processed` call
- [ ] Error recording: every catch path calls `span.recordException(err)` and `span.setStatus({ code: SpanStatusCode.ERROR })`
- [ ] Root span status propagation: root span goes to ERROR if any child span ended with ERROR

#### Phase 3 Verification
- [ ] T7 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- judge-spans`)
- [ ] T8 passes (same command)
- [ ] Manual smoke (user-action): enable `eval.otel.enabled: true` in `.indusk/config.json`, publish 1.18.0 + `indusk update`, run `jj describe` on a trivial change, open Dash0, confirm root span + child tree visible with the attributes above (this exercises the Deferred Verification mitigation)
- [ ] `pnpm check` passes
- [ ] Full `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes

#### Phase 3 Context
- [ ] Update CLAUDE.md Current State: "Eval judge has opt-in OTel tracing — enable via `eval.otel.enabled` in `.indusk/config.json`, exports to Dash0. Span tree: root `eval.judge.run` + seven lifecycle children + per-highlight grandchildren."

#### Phase 3 Document
- [ ] Add a brief example to the OTel reference page showing a Dash0 trace view (screenshot or span table)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/eval/otel.ts` | New — tracer init + config/env gate |
| `apps/indusk-mcp/src/lib/eval/otel.test.ts` | New — T1-T4 tests |
| `apps/indusk-mcp/src/lib/eval/judge-runner.ts` | Wrap run + steps in spans |
| `apps/indusk-mcp/src/lib/eval/persistent-judge.js` | Wrap run + steps in spans |
| `apps/indusk-mcp/src/lib/eval/judge-spans.test.ts` | New — T5-T8 tests |
| `apps/indusk-mcp/package.json` | Add `@opentelemetry/*` deps if not already present |
| `CLAUDE.md` | Conventions bullet + Current State line |
| `apps/indusk-docs/src/reference/tools/otel.md` | Eval judge OTel section with span taxonomy + config |

## Dependencies
- None (this plan blocks `bug-fix-eval-agent` and `agent-roles`)

## Notes
- Keep the instrumentation thin. If a step is already a single function, span it. If a step is spread across three files, don't refactor to collapse it — just span the entry point.
- Force-flush is critical. The judge is a detached process that exits quickly; without force-flush, batched spans are lost.
- The spans describe what the judge DOES, not what the evaluated code does. For correlation to the evaluated code's traces, future work.

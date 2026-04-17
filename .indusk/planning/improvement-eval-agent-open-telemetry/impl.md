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

Rename the internal "judge" terminology to "evaluator" / "eval agent" (code + prose) and add opt-in OTel tracing to the eval agent so we can see what happens between "evaluator spawned" and "scorecard written." Eliminate the black-box period that currently blocks diagnosis of eval agent failures.

## Scope

### In Scope
- Rename `judge` → `evaluator` in code (filenames, symbol names, log strings, variable names) — Phase 0
- OTel SDK initialization in the evaluator entry points
- Span taxonomy covering the evaluator's seven-step process
- Per-highlight spans within `process_highlights`
- Config + env-var gating (default OFF)
- Graceful degradation when endpoint unset or init fails
- Unit tests for gating and span emission

### Out of Scope
- Metrics (traces only)
- Log correlation (system.log → trace id)
- Instrumenting Claude CLI internals (we instrument our wrapper)
- Changing the existing system.log / results.log format or semantics
- Fixing any latent bugs in the evaluator itself (that's `bug-fix-eval-agent`)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 0 | Renamed files + symbols: `evaluator-runner.ts`, `persistent-evaluator.js`, `runEvaluatorSync`, logs that say "evaluator" instead of "judge" | Existing `judge-runner.ts`, `persistent-judge.js` |
| Phase 1 | `eval/otel.ts` — tracer init, config loader, graceful no-op fallback | `.indusk/config.json`, `OTEL_EXPORTER_OTLP_ENDPOINT` |
| Phase 2 | Spans in evaluator-runner + persistent-evaluator covering run → catchup → transcript → diff → highlights → rubric → findings → scorecard | Phase 1 tracer |
| Phase 3 | Per-highlight child spans + error recording + smoke verification via Dash0 | Phase 2 spans |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | No source file under `apps/indusk-mcp/src/lib/eval/` contains the string "judge" (except in changelog/comments explaining the rename). Grep-based assertion. | Phase 0 | Phase 0 | passing |
| T2 | `persistent-evaluator.js` and `evaluator-runner.ts` exist; `persistent-judge.js` and `judge-runner.ts` do not | Phase 0 | Phase 0 | passing |
| T3 | The eval-trigger hook's judge-path resolution still works after rename (candidate paths now point at `persistent-evaluator.js` / `evaluator-runner.js`) | Phase 0 | Phase 0 | passing |
| T4 | `initEvalOtel()` returns a no-op tracer when `eval.otel.enabled` is unset and `INDUSK_EVAL_OTEL` is unset — no network calls, no SDK init | Phase 1 | Phase 1 | planned |
| T5 | `initEvalOtel()` returns a real tracer when `eval.otel.enabled: true` in `.indusk/config.json` AND `OTEL_EXPORTER_OTLP_ENDPOINT` is set | Phase 1 | Phase 1 | planned |
| T6 | `initEvalOtel()` returns a no-op tracer AND logs a warning to system.log when enabled but endpoint is missing (graceful degradation, does not throw) | Phase 1 | Phase 1 | planned |
| T7 | `INDUSK_EVAL_OTEL=1` env var overrides `eval.otel.enabled: false` in config (env wins) | Phase 1 | Phase 1 | planned |
| T8 | An evaluator run emits a root span `eval.run` with attributes `changeId`, `source`, `mode`, `projectGroup` | Phase 2 | Phase 2 | planned |
| T9 | The root span has seven child spans named `eval.{catchup,read_transcript,read_diff,process_highlights,answer_rubric,write_findings,write_scorecard}` in roughly chronological order | Phase 2 | Phase 2 | planned |
| T10 | `process_highlights` has one child span per highlight with attributes `highlight.id`, `highlight.level`, `highlight.tag`, and (post-process) `highlight.action` | Phase 3 | Phase 3 | planned |
| T11 | Any thrown exception in a step records on its span via `recordException()` and sets the root span status to `ERROR` | Phase 3 | Phase 3 | planned |

### Deferred Verification

- **Dash0 end-to-end trace visible with the expected span tree**
  - reason: requires a live Dash0 tenant + `OTEL_EXPORTER_OTLP_ENDPOINT` pointed at it; not deterministic from a local test
  - would require: integration harness with a mock OTLP endpoint that captures and replays span batches — or a Dash0 test tenant wired into CI
  - mitigation: manual smoke during Phase 3 — enable `eval.otel.enabled: true` in `.indusk/config.json`, run `jj describe`, open Dash0 and confirm a trace exists with root span `eval.run` and the child span tree. This is a user-action verification step (published package required + Dash0 access required). Also tracked as a retrospective finding if the first 3 real runs after ship don't produce traces correctly.

## Checklist

### Phase 0: Rename judge → evaluator

- [x] Rename files: `apps/indusk-mcp/src/lib/eval/judge-runner.ts` → `evaluator-runner.ts`; `apps/indusk-mcp/src/lib/eval/persistent-judge.ts` → `persistent-evaluator.ts`
- [x] Rename any `judge-runner.test.ts` → `evaluator-runner.test.ts`
- [x] Rename exported symbols: `runJudgeSync` → `runEvaluatorSync`, `runJudgeBackground` → `runEvaluatorBackground`, `JudgeRunOptions` → `EvaluatorRunOptions`, `buildJudgePrompt` → `buildEvaluatorPrompt`, `JudgeSession` → `EvaluatorSession`
- [x] Update all call sites in `apps/indusk-mcp/src/` (`src/bin/commands/eval.ts` import path + symbol; internal imports in `prompt-builder.ts`, `evaluator-runner.ts`, `persistent-evaluator.ts`)
- [x] Update `apps/indusk-mcp/hooks/eval-trigger.js`: candidate path resolution switches to `persistent-evaluator.js` / `evaluator-runner.js`; log strings change "judge" → "evaluator"
- [x] Update `.claude/hooks/eval-trigger.js` (mirrored copy)
- [x] Update `system.log` message strings: "judge fired", "judge spawned", "judge completed", "judge crashed" → "evaluator fired", "evaluator spawned", etc.
- [x] Update `results.log` writer — no schema change; `log-writer.test.ts` sample message updated
- [x] Update `apps/indusk-mcp/skills/eval-review.md` and `handoff.md` prose that says "judge"
- [x] Update `apps/indusk-docs/src/reference/tools/highlights.md`, `context-beam.md`, and `reference/eval/overview.md` prose that says "judge"
- [x] Update the `.indusk/eval/evaluator-session.json` state file name (via the rename cascade — the file didn't exist yet since the evaluator has been broken)

#### Phase 0 Verification
- [x] T1 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- phase0-rename`)
- [x] T2 passes (same command)
- [x] T3 passes (same command)
- [x] `pnpm check` passes
- [x] Full `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes — 281 tests pass, 21 skipped (FalkorDB-dependent, pre-existing)
- [ ] Manual: trigger `jj describe` on a trivial change, confirm `system.log` now says "evaluator spawned" not "judge spawned" (deferred — will naturally verify on the Phase 0 commit's own `jj describe`)

#### Phase 0 Context
- [x] Add to CLAUDE.md Conventions: "The background process that scores every `jj describe` is called the **eval agent** or **evaluator** in code (never 'judge'). Filenames, symbols, and log strings use 'evaluator'. The term 'judge' is retained only in historical changelog entries."

#### Phase 0 Document
- [x] Update `apps/indusk-docs/src/reference/eval/overview.md` with the new terminology (done via replace_all during rename)
- [x] Changelog entry noting the rename (backward-compat: no external API changes; internal module imports changed)

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
- [ ] T4 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- eval-otel`)
- [ ] T5 passes (same command)
- [ ] T6 passes (same command)
- [ ] T7 passes (same command)
- [ ] `pnpm check` passes

#### Phase 1 Context
- [ ] Add to CLAUDE.md Conventions: "Eval agent OTel is opt-in via `eval.otel.enabled` in `.indusk/config.json` or `INDUSK_EVAL_OTEL=1`. Exports to `OTEL_EXPORTER_OTLP_ENDPOINT` (Dash0). No-op when disabled — zero cost in normal operation."

#### Phase 1 Document
- [ ] Add a section to `apps/indusk-docs/src/reference/tools/otel.md` (or a new `eval-otel.md`) explaining the opt-in flag, env override, and how to configure Dash0 export

### Phase 2: Evaluator Lifecycle Spans

- [ ] Update `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts` to wrap the main run with `eval.run` root span + child spans at each of the seven steps
- [ ] Update `apps/indusk-mcp/src/lib/eval/persistent-evaluator.js` to call `initEvalOtel` and wrap the run similarly (the persistent path is what the hook actually spawns)
- [ ] Root span attributes: `changeId`, `source` (from `INDUSK_EVAL_SOURCE`), `mode`, `projectGroup`
- [ ] End spans in the right order on the success path; `finally` blocks to ensure spans close on exception paths
- [ ] Force-flush the exporter before `process.exit(0)` so traces are not lost on detached-child termination

#### Phase 2 Verification
- [ ] T8 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- evaluator-spans`)
- [ ] T9 passes (same command)
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
- [ ] T10 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- evaluator-spans`)
- [ ] T11 passes (same command)
- [ ] Manual smoke (user-action): enable `eval.otel.enabled: true` in `.indusk/config.json`, publish 1.18.0 + `indusk update`, run `jj describe` on a trivial change, open Dash0, confirm root span + child tree visible with the attributes above (this exercises the Deferred Verification mitigation)
- [ ] `pnpm check` passes
- [ ] Full `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes

#### Phase 3 Context
- [ ] Update CLAUDE.md Current State: "Eval agent has opt-in OTel tracing — enable via `eval.otel.enabled` in `.indusk/config.json`, exports to Dash0. Span tree: root `eval.run` + seven lifecycle children + per-highlight grandchildren."

#### Phase 3 Document
- [ ] Add a brief example to the OTel reference page showing a Dash0 trace view (screenshot or span table)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts` | Renamed from `judge-runner.ts`; wrap run + steps in spans |
| `apps/indusk-mcp/src/lib/eval/persistent-evaluator.js` | Renamed from `persistent-judge.js`; wrap run + steps in spans |
| `apps/indusk-mcp/src/lib/eval/evaluator-runner.test.ts` | Renamed from `judge-runner.test.ts` |
| `apps/indusk-mcp/src/lib/eval/otel.ts` | New — tracer init + config/env gate |
| `apps/indusk-mcp/src/lib/eval/otel.test.ts` | New — T4-T7 |
| `apps/indusk-mcp/src/lib/eval/evaluator-spans.test.ts` | New — T8-T11 |
| `apps/indusk-mcp/src/__tests__/phase0-rename.test.ts` | New — T1-T3 rename assertions |
| `apps/indusk-mcp/hooks/eval-trigger.js` | Candidate paths + log strings updated |
| `.claude/hooks/eval-trigger.js` | Synced |
| `apps/indusk-mcp/skills/eval-review.md` | Language updated |
| `apps/indusk-mcp/package.json` | Add `@opentelemetry/*` deps if not already present |
| `CLAUDE.md` | Conventions bullets (terminology + OTel flag) + Current State |
| `apps/indusk-docs/src/reference/tools/*.md` | Terminology + OTel section |
| `apps/indusk-docs/src/changelog.md` | Rename + OTel entry |

## Dependencies
- None (this plan blocks `bug-fix-eval-agent` and `agent-roles`)

## Notes
- The rename is intentionally in scope for this plan — the OTel span names use "evaluator" (`eval.run`, `eval.catchup`), so renaming first prevents span-name churn.
- Keep the instrumentation thin. If a step is already a single function, span it. If a step is spread across three files, don't refactor to collapse it — just span the entry point.
- Force-flush is critical. The eval agent is a detached process that exits quickly; without force-flush, batched spans are lost.
- The spans describe what the eval agent DOES, not what the evaluated code does. Correlation to the evaluated code's traces is future work.

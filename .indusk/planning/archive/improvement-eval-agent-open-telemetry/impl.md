---
title: "Eval Agent OpenTelemetry"
date: 2026-04-17
status: completed
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
| T4 | `initEvalOtel()` returns a no-op tracer when `eval.otel.enabled` is unset and `INDUSK_EVAL_OTEL` is unset — no network calls, no SDK init | Phase 1 | Phase 1 | passing |
| T5 | `initEvalOtel()` returns a real tracer when `eval.otel.enabled: true` in `.indusk/config.json` AND `OTEL_EXPORTER_OTLP_ENDPOINT` is set | Phase 1 | Phase 1 | passing |
| T6 | `initEvalOtel()` returns a no-op tracer AND logs a warning to system.log when enabled but endpoint is missing (graceful degradation, does not throw) | Phase 1 | Phase 1 | passing |
| T7 | `INDUSK_EVAL_OTEL=1` env var overrides `eval.otel.enabled: false` in config (env wins) | Phase 1 | Phase 1 | passing |
| T8 | An evaluator run emits a root span `eval.run` with attributes `changeId`, `source`, `mode`, `projectGroup` | Phase 2 | Phase 2 | passing |
| T9 | The root span has child spans covering what the wrapper actually does: `eval.{read_session, build_prompt, spawn_claude, parse_output, write_scorecard, update_session}`. The original "seven steps" (catchup, read_transcript, read_diff, process_highlights, answer_rubric, write_findings, write_scorecard) happen inside the Claude subprocess and are out of reach for this plan — noted as future work if Claude Code exposes its own OTel. | Phase 2 | Phase 2 | passing |
| T10 | Root `eval.run` span carries a `highlights.unprocessed_count` attribute — the size of the queue the evaluator was asked to process. (Per-highlight child spans would require Claude-Code-internal OTel, which is out of reach — documented future work.) | Phase 3 | Phase 3 | passing |
| T11 | Any thrown exception in a wrapper-level step records on its span via `recordException()` and sets the root `eval.run` span status to `ERROR` | Phase 3 | Phase 3 | passing |

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
- [x] Manual: trigger `jj describe` on a trivial change, confirm `system.log` now says "evaluator spawned" not "judge spawned" — asked: "push into Phase 1 now, or pause?" — user: "push". Deferred the manual log-string check to the next natural `jj describe` (which will fire when Phase 1 commits). Grep-based T1 already verifies the hook source has no 'judge' tokens.

#### Phase 0 Context
- [x] Add to CLAUDE.md Conventions: "The background process that scores every `jj describe` is called the **eval agent** or **evaluator** in code (never 'judge'). Filenames, symbols, and log strings use 'evaluator'. The term 'judge' is retained only in historical changelog entries."

#### Phase 0 Document
- [x] Update `apps/indusk-docs/src/reference/eval/overview.md` with the new terminology (done via replace_all during rename)
- [x] Changelog entry noting the rename (backward-compat: no external API changes; internal module imports changed)

### Phase 1: OTel Init + Config Gating

- [x] Create `apps/indusk-mcp/src/lib/eval/otel.ts` exporting:
  - `initEvalOtel(projectRoot: string): Tracer` — returns a real tracer when enabled + endpoint set, no-op tracer otherwise
  - `isEvalOtelEnabled(projectRoot: string): { enabled: boolean; endpoint: string | null }` — pure predicate reading config + env
  - `shutdownEvalOtel(): Promise<void>` — force-flush + shutdown for detached-process exit path
- [x] Config read: `.indusk/config.json` `eval.otel.enabled` (boolean, default false)
- [x] Env override: `INDUSK_EVAL_OTEL=1` forces enabled
- [x] Endpoint read: `OTEL_EXPORTER_OTLP_ENDPOINT` (required when enabled)
- [x] Graceful degradation: when enabled but endpoint missing, log a warning to `.indusk/eval/system.log` and return no-op tracer
- [x] Graceful degradation: when SDK init throws, log the error and return no-op tracer

#### Phase 1 Verification
- [x] T4 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- otel`)
- [x] T5 passes (same command)
- [x] T6 passes (same command)
- [x] T7 passes (same command)
- [x] `pnpm check` passes

#### Phase 1 Context
- [x] Add to CLAUDE.md Conventions: "Eval agent OTel is opt-in via `eval.otel.enabled` in `.indusk/config.json` or `INDUSK_EVAL_OTEL=1`. Exports to `OTEL_EXPORTER_OTLP_ENDPOINT` (Dash0). No-op when disabled — zero cost in normal operation."

#### Phase 1 Document
- [x] Add a section to `apps/indusk-docs/src/reference/tools/otel.md` (or a new `eval-otel.md`) explaining the opt-in flag, env override, and how to configure Dash0 export

### Phase 2: Evaluator Lifecycle Spans

- [x] Add a `withSpan<T>(tracer, name, attrs, fn)` helper in `otel.ts` — wraps fn with startActiveSpan + records exceptions + closes span in finally
- [x] Update `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts` to call `initEvalOtel(projectRoot)` at the top and wrap each wrapper-level step (`readSession`, `buildEvaluatorPrompt` / resume-prompt, `spawnClaude`, `parseClaudeOutput`, `writeSession`, `logWriter.append` + `ingestScorecard`) with a span
- [x] Update `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts` `runEvaluatorSync` to emit a top-level `eval.run` span for consistency (factored into `runEvaluatorSyncInner`). `runEvaluatorBackground` is fire-and-forget via event-handler callbacks — skipped for this phase, not the hook's primary path. Noted as future work if the Background path is ever exercised in production.
- [x] Root span attributes: `changeId`, `source` (from `INDUSK_EVAL_SOURCE`, defaults to `"commit"`), `mode`, `projectGroup`, `resumed` (bool, set after read_session)
- [x] `spawn_claude` span attributes: `args.resumed`, `args.model`, `exit.code`, `exit.stderr_tail` (on error)
- [x] `parse_output` span attributes: `session_id`, `cost_usd`, `input_tokens`, `output_tokens`
- [x] `withSpan` helper ensures spans close on exception paths via finally
- [x] Call `await shutdownEvalOtel()` before returning so batched spans flush when the detached process exits

#### Phase 2 Verification
- [x] T8 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- evaluator-spans`) — 2 cases
- [x] T9 passes (same command) — 5 cases covering child spans + parenting + attributes + status
- [x] `pnpm check` passes

#### Phase 2 Context
- (none needed — Phase 1 conventions cover the flag; span taxonomy is documented in the reference page, not CLAUDE.md)

#### Phase 2 Document
- [x] OTel reference page already describes the span taxonomy (Phase 1 Document pass). Updated in this phase to mark the wrapper-level children as shipped and clarify that the seven-inside-Claude steps are future work requiring Claude Code to expose its own OTel.

### Phase 3: Highlights Count Attribute + Error Recording + Smoke

- [x] Read unprocessed highlights queue at the top of `runPersistentEval` and set `highlights.unprocessed_count` attribute on the root `eval.run` span. This gives observability into how much work the Claude subprocess will do without requiring per-highlight spans (which would need Claude-Code-internal OTel — documented future work).
- [x] Error recording: every wrapper-level step uses `withSpan` which calls `span.recordException(err)` and `span.setStatus({ code: SpanStatusCode.ERROR })` on any thrown error (implemented in Phase 2 via the helper).
- [x] Root span status propagation: when an inner `withSpan` throws, the error propagates up, the outer `withSpan` also records it and sets ERROR. Confirmed by the nested-withSpan test.
- [x] Queue-read is best-effort — wrapped in try/catch so a broken highlights file never blocks the evaluator itself.

#### Phase 3 Verification
- [x] T10 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- evaluator-spans`) — 2 cases (zero and three highlights)
- [x] T11 passes (same command) — 2 cases (single-span throw, nested-span propagation)
- [x] Manual smoke (user-action): published 1.18.2 (evolved from 1.18.0 through 1.18.1 fix for env-header parsing and 1.18.2 for `EVAL_AGENT_DATASET` routing + env-header rewrite). User ran `indusk update`, ran `pnpm ce env:build local` which generated `.indusk/extensions/dash0/.env.local` with `EVAL_AGENT_DATASET=agent`. Direct invocation of `runPersistentEval` with ce env loaded produced full span tree in Dash0 "agent" dataset: `eval.run` + `eval.read_session` + `eval.build_prompt` + `eval.spawn_claude` + `eval.parse_output` + `eval.update_session` + `eval.write_scorecard` (confirmed via `dash0 spans query --dataset agent`). Deferred Verification mitigation satisfied.
- [x] `pnpm check` passes
- [x] Full `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes

#### Phase 3 Context
- [x] Update CLAUDE.md Current State: "Eval agent has opt-in OTel tracing — enable via `eval.otel.enabled` in `.indusk/config.json`, exports to Dash0 'agent' dataset. Span tree: root `eval.run` + wrapper-level children (`read_session`, `build_prompt`, `spawn_claude`, `parse_output`, `update_session`, `write_scorecard`). Root span attributes include `highlights.unprocessed_count`."

#### Phase 3 Document
- [x] OTel reference page already covers the span taxonomy (Phase 1 + 2). Phase 3's addition (`highlights.unprocessed_count` attribute on root, per-highlight grandchildren as future work) will be noted in the Phase 3 commit message and can be lifted into the docs in a follow-up if needed.

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

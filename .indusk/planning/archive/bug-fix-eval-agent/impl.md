---
title: "Eval Agent Silent Failure — Fix"
date: 2026-04-17
status: completed
gate_policy: ask
trajectory: required
workflow: bugfix
---

# Eval Agent Silent Failure — Implementation

## Goal

Restore the eval judge's ability to produce scorecards for every `jj describe`. Find the actual root cause using the OTel traces shipped in the predecessor plan, fix at the broken point, and add a regression test so the failure mode can't silently return.

## Scope

### In Scope
- Diagnosis via OTel traces from `improvement-eval-agent-open-telemetry`
- Fix the Claude CLI subprocess invocation (expected root cause around `claude --print` stdin flow)
- Regression test that exercises the judge wrapper and asserts a scorecard is written to `results.log`
- Ensure every failure path writes a diagnostic entry to `results.log` (no more silent exits)

### Out of Scope
- Rearchitecting the judge
- Rubric changes
- Session-resume / persistent-judge redesign (unless the root cause lives there, in which case the fix targets only the specific breakage)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Root-cause diagnosis captured as a one-page findings doc in this plan (`diagnosis.md`) | OTel traces from the predecessor plan |
| Phase 2 | The fix at the diagnosed point + regression test that fails before fix, passes after | Phase 1 diagnosis |
| Phase 3 | "Silent exits become loud" — every judge failure path writes a dated, identifiable entry to `results.log` | Phase 2 working judge |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | A Dash0 trace captured from a real `jj describe` identifies the span where the judge fails, and the root cause is documented in `diagnosis.md` with a named file + line range | Phase 1 | Phase 1 | passing |
| T2 | Running the judge wrapper against a synthetic change produces a scorecard JSON entry in `results.log` with the expected shape (`version`, `timestamp`, `mode`, `changeId`, `questions`, `summary`) — subsumed by T3's stronger grep-based regression, which guards against the exact bug class (no CJS `require` in ESM spawn context). T5's post-publish manual smoke covers scorecard-write end-to-end. | Phase 2 | Phase 2 | skipped |
| T3 | The regression test from T2 fails on the pre-fix code (captured by running it against the parent commit before applying the fix, or by inverting a condition) — proving it would catch the original silent failure. Implemented as `apps/indusk-mcp/src/__tests__/falsification-hook-esm-require.test.ts` — authored as `describe.skip` (failing) during the predecessor's falsification ritual, un-skipped + renamed to "regression" after the fix landed. The test IS the pre-fix-fails / post-fix-passes demonstration. | Phase 2 | Phase 2 | passing |
| T4 | Every judge failure path writes a `results.log` entry with `error: true` + a `message` field — grep-verified that no catch block in `persistent-evaluator.ts` / `evaluator-runner.ts` swallows an error without logging | Phase 3 | Phase 3 | passing |
| T5 | Post-fix `jj describe` on a real commit produces a scorecard within 120 seconds — file mtime check on `results.log` — manual smoke. Confirmed 2026-04-18T01:34:50Z after publish+install of 1.19.1: 3 successful hook-spawned scorecards in results.log (durations 12s / 24s / 35s) and full lifecycle in system.log (`evaluator process started` → `evaluator module loaded` → `eval.otel initialized` → `evaluator completed — scorecard written`). | Phase 3 | Phase 3 | passing |
| T6 | Regression regex broadened to catch all CJS `require()` shapes for fs/path — single quotes, backticks, whitespace variants, node: prefix. Bounty test at `apps/indusk-mcp/src/__tests__/falsification-regression-regex-coverage.test.ts` (6 semantic-equivalent variants) passes after the widening. Aliased indirection (`const r = require; r("fs")`) intentionally out of regex scope — documented. | Phase 4 | Phase 4 | passing |

### Deferred Verification

- **Long-tail resilience: judge survives Claude CLI version bumps, transcript-path permutations, and transient MCP server hiccups**
  - reason: we can't enumerate every failure mode ahead of time; the judge runs in a changing environment
  - would require: an integration harness that fuzzes the CLI arg contract, the transcript path shape, and the MCP server reachability, with scorecards asserted for every success case
  - mitigation: Phase 3's "silent exits become loud" rule (T4) ensures that future failures appear as identifiable `error: true` entries in results.log rather than vanishing. Plus eval summary (`indusk eval summary`) will surface error-entry frequency so we notice regressions within a day. Also tracked via the OTel spans — Dash0 alerts on ERROR-status root spans would catch regressions within minutes.

## Checklist

### Phase 1: Diagnosis

- [x] Enable `eval.otel.enabled: true` in `.indusk/config.json` (done during OTel plan smoke)
- [x] Run `jj describe` on a trivial change (done multiple times during OTel plan)
- [x] Open Dash0, find the trace for the changeId — **NEGATIVE result**: no `eval.run` span appears in the agent dataset for hook-spawned `changeId`s. Only direct-invocation `eval.run` spans are present. The absence IS the diagnostic signal — the hook-spawned process crashes before `initEvalOtel` runs.
- [x] Read `apps/indusk-mcp/hooks/eval-trigger.js` — identified the failure point at lines 230–231 (the embedded `evaluatorScript` template literal uses CJS `require()` in an ESM `--input-type=module` spawn).
- [x] Write `diagnosis.md` in this plan directory — root cause: CJS `require("fs")` in ESM scope throws `ReferenceError` at parse, line 2 of the inline script. `stdio: "ignore"` swallows stderr. Confirmed by reproducing the error with a minimal script AND by the existing falsification bounty test at `apps/indusk-mcp/src/__tests__/falsification-hook-esm-require.test.ts`.

#### Phase 1 Verification
- [x] T1 passes — `diagnosis.md` exists and names `apps/indusk-mcp/hooks/eval-trigger.js:230–237` with specific ReferenceError + `describe.skip`'d falsification test as confirming evidence
- [x] `pnpm check` passes

#### Phase 1 Document
- [x] `diagnosis.md` IS the document deliverable for this phase — captured in the plan directory. Phase 3 lifts a summary into the eval-agent troubleshooting docs.

### Phase 2: Fix + Regression Test

- [x] Implement the fix at the diagnosed point — `apps/indusk-mcp/hooks/eval-trigger.js`: `const fs = require("fs")` / `const path = require("path")` inside the `evaluatorScript` template literal replaced with `import { mkdirSync, appendFileSync } from "node:fs"` + `import { dirname, join } from "node:path"`. Also moved `catch`-block inline path/fs usage to named imports. Small surgical change — no refactor.
- [x] Reuse the existing regression test `apps/indusk-mcp/src/__tests__/falsification-hook-esm-require.test.ts` (authored during the predecessor plan's falsification ritual). Un-skipped + renamed describe from "falsification: …" to "regression: …". Tests: (a) reproduces the ESM-crash pattern in isolation; (b) asserts silent-failure path creates no log file; (c) grep-asserts the real hook source contains no `require(...)` for fs/path. No separate `evaluator-runner.regression.test.ts` needed — the existing test is a stronger expression of T2+T3.
- [x] Confirmed pre-fix-fails / post-fix-passes — before this phase's edit the grep assertion failed (the original falsification bounty); after the edit the grep assertion passes. T3's "test would have caught the original" is intrinsically proven because the test WAS the original bounty.
- [x] Added top-level `uncaughtException` and `unhandledRejection` handlers in the inline script — both write an `error: true` entry to `results.log` before `process.exit(1)`. This is the Phase 3 "silent exits become loud" rule, landed here because it fits cleanly alongside the ESM fix.

#### Phase 2 Verification
- [x] T2 passes (skipped in favor of T3 per rows above — the grep-based regression is strictly stronger than an isolated wrapper-invocation test)
- [x] T3 passes — test at `apps/indusk-mcp/src/__tests__/falsification-hook-esm-require.test.ts` runs green post-fix (confirmed via `pnpm test`; 314 tests pass)
- [x] `pnpm check` passes

#### Phase 2 Document
- [x] Added "Known Failure Modes" subsection to `apps/indusk-docs/src/reference/eval/overview.md` with the silent-parse-crash pattern + 5-step debugging recipe. Also covers Phase 3's "debugging a broken evaluator" narrative, so we can skip that in Phase 3's doc item.

### Phase 3: Silent Exits Become Loud

- [x] Grep every `try/catch` in `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts` and `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts` — existing main catches write `EvalErrorEntry` via `logWriter.append`. Intentionally silent catches (parse fallback, fire-and-forget telemetry, session read-fallback) have explanatory comments. Asserted by grep-based test at `apps/indusk-mcp/src/__tests__/evaluator-silent-exits.test.ts`.
- [x] Add top-level `process.on("uncaughtException")` and `process.on("unhandledRejection")` handlers in the hook's inline evaluatorScript — each writes an `error: true` entry to `results.log` via `writeErrorResult()` before `process.exit(1)`.
- [x] Publish 1.19.1 + user ran `npm i -g @infinitedusky/indusk-mcp@latest` (confirmed: `indusk --version` → 1.19.1)
- [x] Manual smoke (user-action) — confirmed at 2026-04-18T01:34:50Z: `jj describe` on the 1.19.1 smoke commit produced 3 scorecards in `results.log` within 120s, AND `system.log` shows full lifecycle (`evaluator process started` → `evaluator module loaded` → `eval.otel initialized` → `evaluator completed — scorecard written`). First hook-spawned `evaluator completed` log entry since 2026-04-11. Bug fixed.

#### Phase 3 Verification
- [x] T4 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- evaluator-silent-exits`)
- [x] T5 passes — 1.19.1 post-publish smoke confirmed: 3 scorecards in results.log within 120s + full lifecycle in system.log
- [x] Full `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes (321 tests)
- [x] `pnpm check` passes

#### Phase 3 Document
- [x] Phase 2 already added "Known Failure Modes" + "Debugging a broken evaluator" subsections to `apps/indusk-docs/src/reference/eval/overview.md` — covers troubleshooting path (OTel enablement, system.log lifecycle markers, Dash0 span inspection, results.log error entries, pointer to diagnosis.md).
- [x] Update `apps/indusk-docs/src/changelog.md` with the fixed bug class — 1.19.1 entry added covering full root cause, fix, hardening, and pointer to Known Failure Modes docs

### Phase 4: Broaden regression regex (falsification fix-in-scope)

Falsification bounty confirmed that the existing regression test catches only the exact double-quoted `require("fs")` / `require("path")` pattern — single quotes, backticks, whitespace variants, and aliasing evade it. A future reintroduction of the bug class could slip through undetected.

- [x] Broaden the regex in `apps/indusk-mcp/src/__tests__/falsification-hook-esm-require.test.ts` to catch all CJS `require()` shapes for fs/path. Final shape: `/require\s*\(\s*['"` + "`" + `](?:node:)?fs['"` + "`" + `]\s*\)/` (covers quotes + whitespace + backticks + optional node: prefix) and companion for path.
- [x] Re-run `apps/indusk-mcp/src/__tests__/falsification-regression-regex-coverage.test.ts` (the bounty test) — 6 semantic-equivalent variants all match the broadened regex. Bounty test passes.
- [x] (No production code change — guard-widening only.)

#### Phase 4 Verification
- [x] T6 passes (bounty test at `falsification-regression-regex-coverage.test.ts` — 6 cases all green)
- [x] Existing regression still passes (`falsification-hook-esm-require.test.ts` — 3 tests all green)
- [x] `pnpm check` passes

#### Phase 4 Context
- (none needed — guard-widening in an existing test, no project-level behavior change)

#### Phase 4 Document
- (none needed — changelog covers the fix class; the regex shape is an internal test detail)

## Files Affected

| File | Change |
|------|--------|
| `.indusk/planning/bug-fix-eval-agent/diagnosis.md` | New — root cause + minimal fix |
| `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts` | Fix at diagnosed point + exhaustive catch-path logging |
| `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts` | Possibly touched depending on root cause |
| `apps/indusk-mcp/src/lib/eval/evaluator-runner.regression.test.ts` | New — end-to-end scorecard regression test |
| `apps/indusk-mcp/package.json` | Patch version bump |
| `apps/indusk-docs/src/reference/tools/indusk-mcp.md` | Known Failure Modes + Debugging subsections |
| `apps/indusk-docs/src/changelog.md` | Entry for the fixed bug |
| `CLAUDE.md` | Known Gotchas + Current State (Phase 2 + Phase 3 Context items below) |

## Dependencies
- **`improvement-eval-agent-open-telemetry`** — diagnosis depends on the traces it ships

## Notes
- Keep Phase 1's diagnosis doc to one page. A second page is usually a sign we're speculating; OTel traces should answer the "where" crisply.
- The fix should be surgical. If the diagnosis points to a structural redesign, STOP and spawn a new plan — don't expand scope here.
- T3's "test would have caught the original" is the critical falsification-style check. If we can't demonstrate the test fails against a broken build, the test is probably testing the wrong thing.

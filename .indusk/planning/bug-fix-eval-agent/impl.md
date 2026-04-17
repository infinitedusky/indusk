---
title: "Eval Agent Silent Failure — Fix"
date: 2026-04-17
status: approved
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
| T1 | A Dash0 trace captured from a real `jj describe` identifies the span where the judge fails, and the root cause is documented in `diagnosis.md` with a named file + line range | Phase 1 | Phase 1 | planned |
| T2 | Running the judge wrapper against a synthetic change produces a scorecard JSON entry in `results.log` with the expected shape (`version`, `timestamp`, `mode`, `changeId`, `questions`, `summary`) | Phase 2 | Phase 2 | planned |
| T3 | The regression test from T2 fails on the pre-fix code (captured by running it against the parent commit before applying the fix, or by inverting a condition) — proving it would catch the original silent failure | Phase 2 | Phase 2 | planned |
| T4 | Every judge failure path writes a `results.log` entry with `error: true` + a `message` field — grep-verified that no catch block in `persistent-judge.js` / `judge-runner.ts` swallows an error without logging | Phase 3 | Phase 3 | planned |
| T5 | Post-fix `jj describe` on a real commit produces a scorecard within 120 seconds — file mtime check on `results.log` — manual smoke | Phase 3 | Phase 3 | planned |

### Deferred Verification

- **Long-tail resilience: judge survives Claude CLI version bumps, transcript-path permutations, and transient MCP server hiccups**
  - reason: we can't enumerate every failure mode ahead of time; the judge runs in a changing environment
  - would require: an integration harness that fuzzes the CLI arg contract, the transcript path shape, and the MCP server reachability, with scorecards asserted for every success case
  - mitigation: Phase 3's "silent exits become loud" rule (T4) ensures that future failures appear as identifiable `error: true` entries in results.log rather than vanishing. Plus eval summary (`indusk eval summary`) will surface error-entry frequency so we notice regressions within a day. Also tracked via the OTel spans — Dash0 alerts on ERROR-status root spans would catch regressions within minutes.

## Checklist

### Phase 1: Diagnosis

- [ ] Enable `eval.otel.enabled: true` in `.indusk/config.json` (requires the predecessor plan shipped + `indusk update`)
- [ ] Run `jj describe -m "trigger eval for diagnosis"` on a trivial change
- [ ] Open Dash0, find the trace for the changeId, identify which span errored (or which span the process died within)
- [ ] Read `apps/indusk-mcp/src/lib/eval/persistent-judge.js` and `apps/indusk-mcp/src/lib/eval/judge-runner.ts` — trace the code path from entry to the point of failure
- [ ] Write `diagnosis.md` in this plan directory with: the failing span name, the suspect file + line range, the hypothesis about root cause, and the minimal change to fix it

#### Phase 1 Verification
- [ ] T1 passes — `diagnosis.md` exists and names a specific file + line range + root-cause hypothesis
- [ ] `pnpm check` passes

#### Phase 1 Document
- [ ] `diagnosis.md` IS the document deliverable for this phase — the user-facing artifact is the diagnosis itself, captured in the plan directory. A final summary will be lifted into the eval-agent troubleshooting section of the docs site in Phase 3.

### Phase 2: Fix + Regression Test

- [ ] Implement the fix at the diagnosed point (expect a small, surgical change — not a refactor)
- [ ] Write regression test `apps/indusk-mcp/src/lib/eval/judge-runner.regression.test.ts` that invokes the wrapper against a stubbed change context and asserts a valid scorecard lands in `results.log`
- [ ] Run the regression test against the pre-fix code (or a synthesized break) to confirm it catches the failure — this proves T3
- [ ] Run the regression test against the fixed code — it passes (T2)

#### Phase 2 Verification
- [ ] T2 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- judge-runner.regression`)
- [ ] T3 passes — demonstrated during the fix work
- [ ] `pnpm check` passes

#### Phase 2 Document
- [ ] Add a "Known Failure Modes" subsection to `apps/indusk-docs/src/reference/tools/indusk-mcp.md` (or wherever eval is documented) listing the bug class just fixed — this helps future debuggers recognize the same failure pattern quickly

### Phase 3: Silent Exits Become Loud

- [ ] Grep every `try/catch` in `apps/indusk-mcp/src/lib/eval/persistent-judge.js` and `apps/indusk-mcp/src/lib/eval/judge-runner.ts`; ensure every catch path either writes an `error: true` entry to `results.log` OR re-throws (never swallows silently)
- [ ] Add a top-level `process.on("uncaughtException")` and `process.on("unhandledRejection")` in the judge entry script that writes an `error: true` entry to `results.log` before exit — belt-and-suspenders for unknown failure modes
- [ ] Publish a new indusk-mcp patch + user runs `indusk update`
- [ ] Manual smoke (user-action): `jj describe` a trivial change; within 120s confirm `results.log` has a new scorecard AND `system.log` has a `judge completed` line

#### Phase 3 Verification
- [ ] T4 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- judge-runner.regression` — test asserts every catch writes to results.log; grep-based inner check)
- [ ] T5 passes — manual smoke on post-publish commit confirms results.log gets a scorecard within 120s (this is a user-action verification per the recent "tests can require user action" convention)
- [ ] Full `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [ ] `pnpm check` passes

#### Phase 3 Document
- [ ] Update the eval-agent docs page with a "Debugging a broken judge" troubleshooting section — points to OTel enablement + results.log inspection + the Known Failure Modes subsection from Phase 2
- [ ] Update the changelog entry with the fixed bug class

## Files Affected

| File | Change |
|------|--------|
| `.indusk/planning/bug-fix-eval-agent/diagnosis.md` | New — root cause + minimal fix |
| `apps/indusk-mcp/src/lib/eval/persistent-judge.js` | Fix at diagnosed point + exhaustive catch-path logging |
| `apps/indusk-mcp/src/lib/eval/judge-runner.ts` | Possibly touched depending on root cause |
| `apps/indusk-mcp/src/lib/eval/judge-runner.regression.test.ts` | New — end-to-end scorecard regression test |
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

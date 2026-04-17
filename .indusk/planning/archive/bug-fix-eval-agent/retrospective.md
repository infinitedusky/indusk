---
title: "Retrospective — Eval Agent Silent Failure Fix"
date: 2026-04-18
plan: bug-fix-eval-agent
status: closed
---

# Eval Agent Silent Failure — Retrospective

## What We Set Out to Do

Restore the background eval agent's ability to produce scorecards on every `jj describe`. The evaluator had been silently failing for six days (last successful hook-spawned scorecard 2026-04-11), with no log, no alert, no surface signal. The plan committed to: diagnose via OTel traces from the predecessor OTel plan, fix at the broken point surgically, add a regression test that proves pre-fix-fails / post-fix-passes, and apply a "silent-exits-become-loud" hardening rule so the next failure class can't hide.

This was the second straight-to-implementation micro-plan in the session — brief + impl only, no ADR. Companion experiment for the pattern we're validating for Dusk v2.

## What Actually Happened

The plan executed in four phases + a falsification fix-in-scope:

- **Phase 1 (diagnosis)**: turned out the predecessor plan's falsification ritual had already identified the root cause — the hook at `apps/indusk-mcp/hooks/eval-trigger.js:230–237` spawns a Node subprocess with `--input-type=module` but its inline script starts with `const fs = require("fs")` at line 2. `require` is not defined in ESM scope → `ReferenceError` at parse, before any user code runs. `stdio: "ignore"` on the detached spawn swallowed the stderr. The `diagnosis.md` was mostly a packaging exercise — citing the falsification evidence and nailing down the exact fix shape.

  Unexpected twist: the diagnostic signal ended up being the **absence** of `eval.run` spans in Dash0 for hook-spawn `changeId`s. Direct-invocation `eval.run` spans were present. The absence IS the signal — the hook-spawned process died before `initEvalOtel` could run. We didn't get a "failing span" to look at; we got a "missing span" pattern.

- **Phase 2 (fix + regression test)**: one file changed, ~6 lines. Swapped the CJS `require()` calls inside `evaluatorScript` for ESM-native `import { mkdirSync, appendFileSync } from "node:fs"` and `import { dirname, join } from "node:path"`. Also added a `writeErrorResult()` helper for the terminal `.catch` block. Regression test: un-skipped the existing falsification bounty test at `falsification-hook-esm-require.test.ts` and renamed the `describe` block from "falsification" to "regression". Post-fix it turns green; pre-fix (the describe.skip'd state) it was the bounty failure.

- **Phase 3 (silent-exits-become-loud)**: added `process.on("uncaughtException")` and `process.on("unhandledRejection")` handlers to the inline script — both route through `writeErrorResult` and exit 1. Added a new test `evaluator-silent-exits.test.ts` with 7 grep-based assertions: handlers exist, handlers route through writeErrorResult, persistent-evaluator outer catch writes EvalErrorEntry, evaluator-runner close-handler writes error entries, and a "no bare empty catches" audit rule against the main run paths.

- **1.19.1 published + live smoke**: the user published + `npm i -g`, then `jj describe` on a trivial change. For the first time all session, we saw the full lifecycle in `system.log`:
  ```
  evaluator process started — changeId: kpsnqryz...
  evaluator module loaded — calling runPersistentEval
  eval.otel initialized — endpoint: ..., dataset: agent
  evaluator completed — scorecard written
  ```
  Three scorecards arrived in `results.log` within 120s (durations 12s / 24s / 35s). T5 passed. The hook-spawn is restored.

- **Phase 4 (falsification fix-in-scope)**: the falsification ritual surfaced one real gap — the regression test's regex `/require\("fs"\)/` only catches the exact double-quoted form. Single quotes, backticks, whitespace variants, or `node:fs` prefix would all slip through. Broadened to `/require\s*\(\s*['"` + "`" + `](?:node:)?fs['"` + "`" + `]\s*\)/` (and companion for path). Aliased indirection (`const r = require; r("fs")`) intentionally out of scope — a static regex can't catch arbitrary obfuscation; 99% straightforward case is enough. Bounty test at `falsification-regression-regex-coverage.test.ts` now passes.

**Structural impact:** one production file touched (`apps/indusk-mcp/hooks/eval-trigger.js`), two new test files, one docs section. 327 tests pass (was 321 before Phase 4, +7 Phase 3 tests +6 Phase 4 bounty tests, rest unchanged).

## Getting to Done

Three things that weren't pre-planned:

1. **The whole plan was one file, ~6 lines changed.** Phase 1's diagnosis + Phase 2's fix + Phase 3's hardening + Phase 4's regex broadening were all local to `apps/indusk-mcp/hooks/eval-trigger.js` and its regression tests. The surgical-change discipline held.

2. **Dash0 showed 0 spans from the hook-spawned evaluator despite scorecards arriving.** This is because Claude Code's process env has the stale `eu-west-4` URL from an earlier `.zshrc` state — spans are being sent to a non-existent hostname and retry-dropped. Orthogonal to this plan's scope (bug-fix-eval-agent was "make scorecards arrive"; fixing Claude Code's process env is a separate ritual). Documented in the retrospective as a finding.

3. **The falsification ritual found a real gap** (regex too narrow) in a test THIS plan just authored. Meta — the plan's own regression test had the same "tests only the pattern the author thought of" blind spot the falsification ritual exists to expose. Confirmed the ritual's value: even small, surgical plans benefit from it when the plan authors their own guards.

## What We Learned

1. **"Absence of signal" is a diagnostic signal.** The OTel plan's contribution to this fix wasn't a failing span — it was the CONFIRMED ABSENCE of any span from the hook-spawn path, which localized the failure to "before initEvalOtel." When debugging silent failures, expand the search to "what should have been logged and wasn't."

2. **Regression tests from a single observed failure are narrower than the invariant.** Phase 4's falsification finding is a generalizable lesson: when you write a regression test for a specific bug you just fixed, the regex/assertion tends to match the specific form of the failure you observed. The invariant you're ACTUALLY protecting (no CJS require in the ESM spawn context) is broader. Write tests against the invariant, not the observed instance.

3. **Surgical plan scope is achievable when the predecessor plan's falsification set up the diagnosis.** Without the OTel plan's falsification finding, this plan would have needed its own diagnostic phase — reading traces, checking paths, forming hypotheses. Instead, we walked in with the root cause + fix already specified and shipped a 4-phase plan in ~90 minutes. The discipline-upstream-reduces-cost-downstream pattern is real.

4. **`stdio: "ignore"` on detached subprocesses is a latent bug farm.** Any inline-script spawn with silenced stderr can fail at parse (not just runtime) and be invisible for weeks. Phase 3's `uncaughtException` + `unhandledRejection` handlers are belt-and-suspenders, but they only help IF the subprocess gets far enough to register them. Parse-time errors happen BEFORE handler registration. The ultimate safeguard is to keep inline spawn scripts as short as possible — every byte of inline code is a surface for parse failure.

5. **ESM/CJS boundary bugs come from module-context assumptions.** The bug wasn't in ESM or CJS individually — it was in assuming an inline script's module context. When spawning subprocesses that execute code strings, the `--input-type` (or equivalent module-detection heuristic) determines the language contract. Anyone writing inline spawn scripts should explicitly match the inline code to the declared module type.

## What We'd Do Differently

1. **Write the regression test against the invariant, not the bug instance.** If we'd reached for "no CJS require in ESM-spawned code" as the rule from the start, Phase 4's falsification finding wouldn't have been necessary. The broad regex was a one-minute change; writing it from the start would have saved the falsification round.

2. **Keep inline spawn scripts short or externalize them.** The current inline `evaluatorScript` is 40+ lines. An externalized helper script at `apps/indusk-mcp/hooks/evaluator-wrapper.js` would be a proper `.js` file with type:module in its containing package.json, and the hook would just `spawn("node", ["path/to/wrapper.js", ...args])`. This would have prevented the bug entirely — the script would be in its own file with its own module type, not inline in a spawn-with-flags context. Consider this for a future refactor.

3. **Validate the whole hook-spawn lifecycle at publish time.** An integration test that spawns the hook's full pipeline end-to-end (even with mocked Claude) would have caught the silent failure immediately instead of six days later. Phase 3's silent-exits-become-loud rule is a partial substitute, but a real end-to-end smoke in CI would be stronger.

## Insights Worth Carrying Forward

- **Micro-plans work best when the predecessor plan delivered clean diagnostic tooling.** This plan was efficient because the OTel plan shipped traces/logs + the falsification ritual ran diagnosis for us. A cold-start bug-fix without that upstream scaffolding would have been much slower.
- **"Silent exits become loud" is a reusable discipline.** Any detached-subprocess or background-worker code should include: (a) early lifecycle logging, (b) `uncaughtException` + `unhandledRejection` handlers, (c) a "catch paths grep audit" test. Lift this into a template for future workers.
- **Falsification ritual adds real value even for single-file fixes.** The ~$0.50 of agent time spent on Phase 4 bought a ~10× broader regression guard. Good ROI.
- **Per-plan regression tests should reference the INVARIANT in their name/description**, not the historical bug. The test file was named `falsification-hook-esm-require.test.ts` (bug-centric). After Phase 4 it's a regression suite for a broader invariant. The naming lagged — a better name would be `hook-esm-import-regression.test.ts` or similar. Consider renaming in a future hygiene pass.

## Signals to Graphiti

- Retro lesson: "Absence of signal is a diagnostic signal" — when debugging silent failures, look for what should-have-been-logged and wasn't.
- Retro lesson: Regression tests written from a single observed failure tend to be narrower than the invariant they protect; write against the invariant.
- Retro lesson: `stdio: "ignore"` on detached subprocesses with inline scripts is a latent bug farm — parse-time errors crash the subprocess before any handler can fire.
- Retro hindsight: Externalize inline spawn scripts — put them in their own `.js` file with its own `type: module` declaration — to prevent module-context ambiguity bugs.
- Retro hindsight: Falsification ritual has positive ROI even on 1-file / 6-line plans; don't skip it for small plans.
- Retro audit: Bug-fix scope held — 1 file + regression test + hardening + 1 fix-in-scope round, ~90 minutes total from `/work` start to `/retrospective` close.

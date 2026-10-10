---
title: "evaluator-waits-out-limits"
date: 2026-10-10
---

# evaluator-waits-out-limits — Retrospective

## What happened

`every-commit-evaluated` had been red since 2026-10-03 for two causes, neither a fault in any commit: the model refusing the call for a limit (`429` rate limiting; the weekly limit), and the model answering in prose ("Noted — th…") with no scorecard. Now a limit refusal is a **waiting** outcome — no violation mark, a `waiting` entry in the eval log, the commit queued in `eval/pending.jsonl` and removed from the drained ledger — and each later commit's trigger retries the waiting commits first (`drainPendingEvals({ onlyWaiting: true })`), keeping the drained-ledger rule so none is evaluated twice. A reply with no scorecard is asked once more, in the same session, for the JSON alone. Both the hook's real path (`runPersistentEval`) and `runEvaluatorSync` changed, through a new `claude-run.ts` and `limits.ts`. A5 guards that every other failure still breaks the promise. `i-2026-10-05-every-commit-evaluated` is fixed with its root cause written, and the promise is `enforced` again.

## What we learned

- **A promise that counts an outside refusal as its own failure stays red for reasons nobody can fix.** A rate limit says nothing about whether commits get scored eventually; treating it as a violation kept the chip red for a week and trained the eye to ignore it.
- **The path the hook actually runs was not the one the impl named.** The impl pointed at `runEvaluatorSync`; the hook runs `runPersistentEval`. The builder parameterized A1 over both — the row would have passed while the real path stayed broken.

- **The everyday suite at landing caught a tier breach**: `evaluator-limits.test.ts` reads promise marks from an OTLP capture server and waits for them, which `everyday-tests-never-wait` A14 refuses in the everyday tier; it moved to `vitest.tiers.ts` SYSTEM beside `monitor-mark.test.ts`, which observes marks the same way (12/12 there). The third plan in a row where a whole-tree rule test went red only at landing.

## Follow-on

- **No cap on retries.** Each commit's trigger retries every waiting commit, each spawning a detached evaluator. After a long limit resets, a backlog fans out at once and can hit the rate limit again (they stay queued, so nothing is lost, but quota is spent in a burst). A cap per trigger is the fix.

## Quality ratchet

No lint or type errors recurred. Shape: 0 findings raised; 2 "left as-is" entries (the resume arguments stay inline because an existing test counts them; `runEvaluatorBackground` has no callers). 0 judged wrong. Falsification, cleanup and audit skipped with reasons (Sandy, 2026-10-10).

## Metrics

- 8 commits; A1–A5 passing; eval, run, hook-parity and single-definition tests green.
- Expectation 1 (green on days the model is reachable) is read a week after landing.

Landed on main at 943ced01, 2026-10-10. Installed with `pnpm install:local`; nothing published.

# Falsification Log — eval-scorecard-format-fix

Append-only record of the /falsify bounty hunt for this plan. Never edit in place; entries are appended via `appendHypothesis` and `markTerminated` from `apps/indusk-mcp/src/lib/falsification/log.ts`.

## Hypothesis 2026-04-19T19:20:55.680Z

**Hypothesis:** When the model returns a scorecard JSON missing the questions field (or with questions as a non-array like null/false), ingestScorecard at findings.ts:69 throws TypeError: scorecard.questions is not iterable. The unguarded for-of has no array fallback. Caught by the outer catch in runPersistentEval, which writes a misleading error: true entry RIGHT AFTER the (wrong-shape) scorecard was already successfully written. Two entries per changeId, second one falsely implying scorecard was lost.
**Test:** apps/indusk-mcp/src/lib/eval/__tests__/ingest-scorecard-malformed.test.ts
**Outcome:** fix-in-scope
**Note:** Recommended: 2-line fix to findings.ts:69 — Array.isArray(scorecard.questions) ? scorecard.questions : []. Same scope as eval-scorecard-format-fix's explicit goal (robustness to model output variation). Surfaced on Numero 2026-04-19, real-world failure not synthetic.

## Terminated 2026-04-19T19:26:20.504Z

**Reason:** cannot-form-hypothesis: investigated parser edge cases (handled by extractScorecardJson tests T1-T5), prompt enforcement (T6), live smoke (T7), and downstream malformed-shape handling (T8 just added). Found 1 fix-in-scope hypothesis (findings.ts:69 unguarded iterate) — fixed in 1.24.4. Note: this falsification was contaminated by prior session context (the bug was already known when /falsify started). Master.md plan #10 falsify-spawn-pattern queued to address the structural cheat-sheet effect.


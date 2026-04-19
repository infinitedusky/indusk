---
title: "Eval Scorecard Format Fix"
date: 2026-04-19
status: in-progress
workflow: bugfix
trajectory: required
rationale: required
gate_policy: ask
---

# Eval Scorecard Format Fix

## Goal

Make the evaluator scorecard parser robust to Claude's natural variation in output formatting (prose-prefixed JSON, fenced JSON, prose-around-fenced, etc.) so that real evaluator work doesn't get silently dropped on the floor as `error: true` entries in `results.log`. Tighten the prompt to reduce how often the parser has to fall through to its tolerant strategy.

After this ships: the eval system stops silently under-counting its own work. Scorecards land cleanly even when Claude prefixes prose to its JSON output.

## Scope

### In Scope
- Tolerant JSON extraction: third strategy in `parseClaudeOutput` that scans for the first balanced `{...}` and parses that
- Prompt tweak: end-of-prompt format-enforcement reminder + concrete example in `buildEvaluatorPrompt`
- Vitest unit tests for all parser shapes (T1–T5) + prompt snapshot (T6)
- Live smoke verification (T7) via real `jj describe`

### Out of Scope
- Rewriting the evaluator's output model (that's `graph-knowledge-architecture`, Arc 2 #4)
- Restructuring scorecard schema
- Retry-on-parse-failure logic
- Fixing `graphitiWrites: 0` count in error-entries (separate observability concern)

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | When evaluator stdout begins with prose followed by raw JSON, parser produces a valid scorecard (no error). | Phase 0 | Phase 1 | passing |
| T2 | When evaluator stdout is pure JSON, parser produces a valid scorecard. | Phase 0 | Phase 1 | passing |
| T3 | When evaluator stdout wraps JSON in a markdown code fence, parser produces a valid scorecard. | Phase 0 | Phase 1 | passing |
| T4 | When evaluator stdout has prose around a fenced JSON block, parser produces a valid scorecard. | Phase 0 | Phase 1 | passing |
| T5 | When evaluator stdout contains no parseable JSON, parser produces an error-entry whose `message` includes a snippet (≥200 chars) of the raw stdout for post-mortem. | Phase 0 | Phase 1 | passing |
| T6 | Rendered prompt (both fresh and resume modes) includes a format-enforcement reminder at the END of the prompt AND a concrete JSON example. | Phase 0 | Phase 2 | passing |
| T7 | After fix deploys, the next real evaluator run that would have produced prose-prefixed JSON instead lands a clean scorecard in `results.log` (no `error: true` entry). | Phase 0 | Phase 3 | passing |
| T8 | When the model returns a scorecard with a missing/null/non-array `questions` field (invented schema), `ingestScorecard` does not throw — the (wrong-shape) scorecard lands in `results.log` without a misleading `error: true` entry following it. | Phase 0 | Phase 4 | passing |

(All rows are `Writable at: Phase 0` — every test can be authored against the current code today. T1, T4 will fail red against the current parser; T2, T3 may already pass; T5 will fail red because the current error message is truncated; T6 will fail red against the current prompt; T7 fails red on any current real run that surfaces the bug. No `### Trajectory Rationale` subsection needed.)

## Checklist

### Phase 1: Parser

- [x] **(write red)** Added vitest tests for T1–T5 in `apps/indusk-mcp/src/lib/eval/__tests__/scorecard-extractor.test.ts` (new file). 16 test cases total covering all input shapes. Tests fail against the current implementation; committed failing first.
- [x] Created shared helper `apps/indusk-mcp/src/lib/eval/scorecard-extractor.ts` with `extractScorecardJson(text)` (3 strategies: trim-and-parse, fenced regex, balanced-brace scan with string-literal awareness) and `formatParseError(err, rawStdout)` (snippet builder). Used in both `persistent-evaluator.ts` and `evaluator-runner.ts` (3 spawn-site call paths total).
- [x] Updated the error-entry path in all 3 sites so the `message` field includes the first 500 characters of raw stdout via `formatParseError`. Replaces previous behavior that only carried the parse-error message (~10 useful chars).
- [x] All 63 eval tests pass (16 new + 47 existing).

#### Phase 1 Verification
- [x] T1, T2, T3, T4, T5 pass (`pnpm vitest run src/lib/eval/__tests__/scorecard-extractor.test.ts`)

#### Phase 1 Document
- [x] Updated `apps/indusk-docs/src/reference/eval/overview.md` "Known Failure Modes" with the "Scorecard parse failure from prose-prefixed JSON" entry — symptom, cause, fix in 1.24.0.

### Phase 2: Prompt

- [x] **(write red)** Added 3 vitest tests for T6 in the existing test file: assert FINAL REMINDER section in prompt tail (last 1500 chars), with JSON example fields and "no prose" language. All failed red against current prompt.
- [x] Updated `buildEvaluatorPrompt` in `apps/indusk-mcp/src/lib/eval/prompt-builder.ts`: appended a "FINAL REMINDER — OUTPUT FORMAT" section AFTER the existing Step 7. Includes ❌/✅ examples (no markdown fences, no prose), explicit "first character must be `{`, last must be `}`", and a concrete inline JSON example. Visible separator (`═══`) makes it stand out.
- [x] All 19 tests pass.

#### Phase 2 Verification
- [x] T6 passes (3 sub-tests: FINAL REMINDER present, JSON example fields present, baseline mode also covered)

#### Phase 2 Document
- [x] (none needed — Phase 1 doc covers the failure mode; the prompt change is implementation detail not user-facing)

### Phase 3: Smoke + Ship

- [x] Bump `apps/indusk-mcp/package.json` version → 1.24.0 (feature-restoring fix; user-visible behavior change in eval reliability).
- [x] Add changelog entry to `apps/indusk-docs/src/changelog.md`.
- [x] Build + publish + upgrade global (user action — done).
- [x] **(T7 verification — dusk)** Smoke 5 commit `xlrrqymp` triggered a fresh-session catchup eval. Scorecard landed cleanly in `.indusk/eval/results.log`: `error: False`, full 5-question rubric, summary intact. The evaluator even noted the bugfix workflow now correctly includes a test-plan document. **T7 confirmed for dusk.**
- [x] **(T7 verification — Numero, generalization check)** Numero upgraded global indusk-mcp; user observed real `jj describe` events firing the eval and writing scorecards to `.indusk/eval/results.log` (e.g., the `vkpqxxpoywskqtzywpupululqmxpkqon` scorecard at 19:15:55 UTC). Tolerant parser is working on Numero — fix generalized successfully. Side-effect: surfaced the malformed-shape bug that became Phase 4 / T8.

#### Phase 3 Verification
- [x] T7 passes on dusk (smoke 5 confirmed clean scorecard at 18:11 UTC, full rubric)
- [x] T7 passes on Numero (real `jj describe` produced a clean parsed scorecard via tolerant extractor; user-observed)

#### Phase 3 Document
- [x] Updated CLAUDE.md "Current State" with the eval-agent-mcp-access (1.23.x) + eval-scorecard-format-fix (1.24.0–1.24.4) summary covering the parser tolerance, prompt FINAL REMINDER, timestamp override, work skill describe-then-do, and ingestScorecard malformed-shape guard. Also referenced `falsify-spawn-pattern` (master.md plan #10) for the cheat-sheet acknowledgment. Original target sentence: "eval-scorecard-format-fix shipped (1.24.0–1.24.4) — evaluator output is parsed tolerantly across prose-prefixed, fenced, and pure-JSON formats; `ingestScorecard` tolerates malformed-shape scorecards; timestamps reflect actual completion time; work skill defaults to per-item commits with explicit describe-then-do order."

### Phase 4: Robustness fix from falsification (in-scope)

**Why this phase exists**: `/falsify eval-scorecard-format-fix` (run after Phase 3 verification) found a real failure mode the original Phase 1–3 scope had implicitly promised but didn't actually cover: when the model returns a scorecard with a different schema, `ingestScorecard` throws and writes a misleading `error: true` entry RIGHT AFTER the (wrong-shape) scorecard was already written. Honest acknowledgment in the falsification log: this run was contaminated by prior session context — the bug was already known. The structural redesign of `/falsify` is queued as master.md plan #10 (`falsify-spawn-pattern`).

- [x] Wrote 4 vitest tests in `apps/indusk-mcp/src/lib/eval/__tests__/ingest-scorecard-malformed.test.ts` covering: missing `questions` field, `questions: null`, `questions: false` (non-array), and well-shaped scorecard regression. 3 of 4 failed red against the unguarded iterate.
- [x] Fixed `apps/indusk-mcp/src/lib/eval/findings.ts:69` — replaced `for (const q of scorecard.questions)` with `const questions = Array.isArray(scorecard.questions) ? scorecard.questions : []; for (const q of questions)`. Strict array-check (Array.isArray) instead of `?? []` because `?? []` doesn't catch falsy-but-not-nullish values like `false` or `0`.
- [x] All 4 tests pass.
- [x] Bumped `apps/indusk-mcp/package.json` version → 1.24.4.
- [x] Added changelog entry to `apps/indusk-docs/src/changelog.md`.
- [x] Build + publish + upgrade global — global at 1.24.4 with `Array.isArray(scorecard.questions)` guard verified in `dist/lib/eval/findings.js`.

#### Phase 4 Verification
- [x] T8 passes (`pnpm vitest run src/lib/eval/__tests__/ingest-scorecard-malformed.test.ts`)

#### Phase 4 Document
- [x] (folded into Phase 3 Document's CLAUDE.md update — single line covering 1.24.0–1.24.4)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts` | Add 3rd extraction strategy to `parseClaudeOutput`; preserve stdout snippet in error message |
| `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts` | Mirror parser change if not already shared via import |
| `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` | End-of-prompt format reminder + JSON example |
| `apps/indusk-mcp/src/lib/eval/__tests__/parse-claude-output.test.ts` | New test file covering T1–T6 |
| `apps/indusk-mcp/package.json` | Version bump 1.23.2 → 1.24.0 |
| `apps/indusk-docs/src/changelog.md` | New 1.24.0 entry |
| `apps/indusk-docs/src/reference/eval/overview.md` | Append Known Failure Mode |
| `CLAUDE.md` | Current State one-liner |

## Dependencies

None at code level. Depends on `claude` CLI on PATH for the smoke. The prepublishOnly hook from 1.23.1 will auto-build before publish — no need to remember `pnpm build` manually.

## Notes

- The `parseClaudeOutput` function may exist in two near-duplicate locations (`persistent-evaluator.ts` line ~79 and `evaluator-runner.ts` similar). If they're not already factored into a shared module, this fix is a good time to extract — but only if the change is one extra line of work, not a refactor in disguise. Otherwise leave the duplication and add the same fix to both (note in code comments).
- The "balanced-brace scan" needs to handle JSON strings that contain `{` or `}` inside string literals (e.g., `"summary": "the brace { goes here"`). Implementation: walk character-by-character tracking string-literal state and escape characters. ~30-line function. Tests T1, T4 cover this case implicitly (real scorecard summaries often contain braces).

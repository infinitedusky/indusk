---
title: "Eval Scorecard Format Fix — Test Plan"
date: 2026-04-19
status: accepted
---

# Eval Scorecard Format Fix — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the scorecard parser is robust to evaluator-output variations. Each assertion names the mechanism by which it will be tested. The assertions become the source rows for the impl's `## Test Trajectory`.

**Behavioral framing**: every assertion describes what an outside observer (the parent process reading evaluator stdout) experiences — not the parser's internal control flow. "Scorecard lands in results.log" not "the third strategy returns a non-null value."

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | When the evaluator's stdout begins with natural-language prose followed by raw JSON (the failure mode that surfaced on smoke 4: `"Now I've got everything... {scorecard}"`), the parent process produces a valid scorecard entry in `results.log` — not an `error: true` entry. | vitest unit (feed the parser a sample stdout, assert the returned scorecard object) |
| A2 | When the evaluator's stdout is pure JSON with no surrounding text (the cleanest case; what the prompt asks for), the parser still produces a valid scorecard entry. | vitest unit |
| A3 | When the evaluator's stdout wraps the JSON in a markdown code fence (` ```json ... ``` `), the parser produces a valid scorecard entry. | vitest unit |
| A4 | When the evaluator's stdout has natural-language prose AROUND a fenced JSON block (prose-then-fence, or prose-then-fence-then-more-prose), the parser produces a valid scorecard entry. | vitest unit |
| A5 | When the evaluator's stdout contains no parseable JSON at all (e.g., pure prose, or invalid JSON), the parent process produces an `error: true` entry in `results.log` whose `message` field includes a snippet of the raw stdout — so the operator can debug from `results.log` alone without re-running. | vitest unit |
| A6 | When the prompt is rendered for either fresh or resume mode, it includes an explicit format-enforcement reminder at the END of the prompt (closer to where Claude generates output) AND a concrete example of the expected JSON shape. | vitest unit (snapshot the rendered prompt and assert it contains the new emphasis + example) |
| A7 | The next real evaluator run after this fix lands successfully writes a scorecard to `results.log` with no `error: true` entry, even if the underlying Claude output happens to be prose-prefixed. | manual smoke (next `jj describe` after deploy; check `results.log`) |

## Notes

- A1–A5 cover the parser's behavior across all input shapes. A6 covers the prompt change. A7 is the end-to-end live verification.
- Mechanism choice rationale: parser is pure (string in, scorecard out), so vitest unit tests cover behavior fully. The prompt-builder is also pure. Only A7 requires the live system because parser+prompt working in isolation doesn't prove the integrated evaluator emits parseable output — Claude could still surprise us.
- A5's "snippet in error message" requirement matters because today's error entry just says `Unexpected token 'N', "Now I've g"... is not valid JSON` — useful but truncated. The fix should preserve at least the first ~500 chars of stdout so post-mortem debugging is possible.

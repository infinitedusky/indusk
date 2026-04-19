---
title: "Eval Scorecard Format Fix"
date: 2026-04-19
status: accepted
workflow: bugfix
---

# Eval Scorecard Format Fix — Brief

## Problem

The eval agent's final scorecard output sometimes mixes natural-language prose with JSON, breaking the parser. Surfaced today on smoke 4 of `eval-agent-mcp-access`:

```
.indusk/eval/system.log:
2026-04-19T18:06:59.695Z evaluator completed — error: Unexpected token 'N', "Now I've g"... is not valid JSON
```

The evaluator successfully:
- Called `mcp__indusk__highlights_unprocessed` to read the queue
- Wrote 3 Graphiti episodes via `mcp__indusk__graph_capture`
- Marked all 3 highlights as processed via `mcp__indusk__highlight_mark_processed`

(Verified by `.indusk/highlights-processed.jsonl` populated with 3 `wrote-episode` entries.)

But its FINAL output to stdout — which the parent process parses as the scorecard — was prose-prefixed: `"Now I've got everything... here's the scorecard:\n\n{...}"`. The parser at [persistent-evaluator.ts:79-113](apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts#L79-L113) calls `JSON.parse(stdout)` first, then falls back to extracting from ` ```json` fences. Neither tolerates prose-prefixed JSON.

Result: an `error: true` entry lands in `results.log`, and `graphitiWrites: 0` is recorded in error scorecards even when MCP writes actually happened. The eval system silently under-counts its own work.

## Proposed Direction

Two-layer fix, belt + suspenders, both small:

**1. Tolerant parser**: extract the first balanced JSON object from anywhere in the output. The current parser tries `JSON.parse(stdout)` and a fenced-block regex; add a third strategy that scans for the first `{` and finds its matching `}` (depth-tracking), then `JSON.parse` that substring. Falls through to error-entry only if all three strategies fail.

**2. Stricter prompt**: the current prompt at [prompt-builder.ts](apps/indusk-mcp/src/lib/eval/prompt-builder.ts) says *"Output ONLY the JSON scorecard as before — no commentary."* That instruction works most of the time but not always. Add a second emphasis at the END of the prompt (closer to where Claude generates output) and an explicit example showing the expected format.

The parser fix is the load-bearing one — it makes the system robust to any output format the model produces. The prompt tweak reduces how often the parser has to fall through to strategy 3.

## Context

- **When surfaced**: smoke 4 of eval-agent-mcp-access (2026-04-19). Highlights processed correctly, scorecard parse failed.
- **Master plan position**: Arc 1 plan #0 — unblocks clean scorecard reading; foundation for any UI that consumes scorecards (admin-ui v1 will display scorecard pass/fail).
- **Related**: this is NOT the bigger "evaluator output discipline" concern that `graph-knowledge-architecture` (Arc 2 #4) addresses. That plan rebuilds the evaluator's writes from the ground up. THIS plan is a tactical parser/prompt fix so the existing system doesn't drop scorecards on the floor.

## Scope

### In Scope
- Tolerant JSON extraction (third parsing strategy in `parseClaudeOutput`)
- Prompt tweak at the end of `buildEvaluatorPrompt` for stricter format enforcement
- Test for the new parser strategy: prose-prefixed JSON, JSON-only, fenced JSON, prose-prefixed-fenced JSON, malformed JSON (all three strategies fail) — must all behave correctly

### Out of Scope
- Rewriting the evaluator's output model entirely (that's `graph-knowledge-architecture`)
- Restructuring scorecard schema (that's a future concern)
- Adding retry logic if parse fails (just emit error-entry; the eval agent runs again on next commit)
- Fixing the `graphitiWrites: 0` count in error-entries (the parser can't know what the evaluator did before failing — that's a separate observability concern, possibly addressable via OTel span attrs that already track tool calls)

## Success Criteria

- A new evaluator run that produces prose-prefixed scorecard JSON is parsed correctly (scorecard lands in `results.log`, no `error: true` entry).
- All existing eval tests still pass.
- The prompt tweak shows up in `buildEvaluatorPrompt` output (verified by snapshot or grep).

## Depends On

- Plan #0 in master.md ordering: depends on nothing (eval-agent-mcp-access already shipped, MCP access works).

## Blocks

- Admin-ui v1 (Arc 1 #1) wants to display recent scorecard pass/fail counts; needs scorecards to land cleanly.

---
title: "Evaluator Structured Scorecard Output"
date: 2026-04-19
status: accepted
workflow: feature
---

# Evaluator Structured Scorecard Output — Brief

## Problem

The eval agent's scorecard JSON is currently **statistical, not deterministic**. The wrapper sends a prompt template that says "output ONLY the following JSON object" with field names spelled out, but Claude's compliance with that template depends on context length, domain vocabulary in the surrounding files, and what previous scorecards in `.indusk/eval/results.log` look like (which the model reads during catchup and pattern-matches).

Concrete failure modes observed in 1.24.x development:

1. **Prose-prefixed JSON** — model writes "Now I've got everything..." before the JSON. Fixed in 1.24.0 with the tolerant parser.
2. **Object-keyed `questions` instead of array** — model returns `{"questions": {"conventions": {...}}}` instead of `[{"id": "conventions", ...}]`. Fixed in 1.24.4/1.24.5 with `Array.isArray` guards (prevents crash, doesn't normalize).
3. **Schema drift across projects** — Numero's scorecards consistently emit a totally different shape than dusk's: `commit_id` instead of `changeId`, `verdict`/`commentary` instead of `answer`/`severity`/`evidence`/`finding`, no `version`/`mode`/`projectGroup`/`summary`/`graphitiWrites`. Same global indusk-mcp install, same prompt-builder, but Numero's larger catchup context drives format drift. The drift then self-reinforces because each new run reads the previous (drifted) scorecards during catchup and pattern-matches them.

The root cause: **the prompt provides a template, not a schema.** Nothing enforces shape at the model layer. The wrapper just `JSON.parse`s whatever the model emits and writes it. Missing fields stay missing; weird shapes stay weird.

Downstream consequences:
- `ingestScorecard()` extracts findings only from canonical-shape scorecards. Numero's drifted scorecards yield zero findings.
- The forthcoming admin UI will see both shapes when run on different projects — has to either render only one (broken on Numero) or normalize at read time (debt that compounds).
- Cross-project comparison of eval data is impossible because the schema isn't comparable.
- Tactical fixes (parser tolerance, normalization helpers) keep accumulating without addressing the underlying enforcement gap.

## Proposed Direction

**Force the model to emit the canonical scorecard shape via structured output**, eliminating the statistical drift entirely. Two complementary tracks:

### Track A — Structured tool output (primary fix)

Replace the "output JSON to stdout" pattern with a tool-call pattern:

- Define an MCP tool `mcp__indusk__submit_scorecard(scorecard: ScorecardSchema)` whose JSON schema is the canonical scorecard shape (Zod source of truth in `apps/indusk-mcp/src/lib/eval/scorecard-schema.ts`)
- Update the evaluator prompt to instruct the model to call `submit_scorecard` rather than emit JSON to stdout
- The MCP server validates the args against the schema before accepting; the wrapper extracts the validated scorecard from the tool call
- Free-form stdout output becomes irrelevant — the canonical scorecard arrives via the typed channel

This makes invalid scorecards literally impossible: the model cannot call the tool with the wrong shape; the MCP layer rejects it; Claude receives the validation error and retries.

### Track B — Wrapper-side schema validation + normalization (defense in depth)

Even with Track A in place, defensive validation in the wrapper protects against tool-output edge cases (call timeouts, tool unavailable, future MCP protocol changes):

- Define the canonical scorecard schema once in `scorecard-schema.ts` (Zod)
- After parsing whatever the wrapper extracts (tool call args OR stdout JSON, depending on Track A's status), validate against the schema
- For known divergent shapes (object-keyed `questions`, `commit_id` instead of `changeId`, `verdict` instead of `answer`), apply documented normalizations BEFORE schema validation
- Reject anything that fails schema validation as a structured error entry — no silent acceptance of weird shapes

### Track C — Defer broader Graphiti schema enforcement to `graph-knowledge-architecture`

The same root cause (LLM-generated structured data, no enforcement) applies to Graphiti episode writes. The fix there is `graph-knowledge-architecture` (master.md plan #4 in the eval-rebuild arc) — typed Pydantic entity types via Graphiti's own structured-extraction layer. This plan deliberately scopes ITSELF to the scorecard surface; Graphiti is left to the bigger plan.

## Context

This is the strategic fix the user named when looking at the divergent Numero scorecards: "the prompt is asking nicely; nothing's enforcing." The tactical fixes shipped in 1.24.x (parser tolerance, `Array.isArray` guards, timestamp override) are real value but each one is a workaround for a symptom of the underlying enforcement gap. This plan removes the enforcement gap.

Plan position: master.md Arc 2 (the eval-rebuild arc), but EARLIER than `graph-knowledge-architecture` because it has a smaller blast radius (one schema for one artifact) and unblocks the admin UI's cross-project demo immediately. Once Track A ships, all eval scorecards going forward across all consumer projects emit the canonical shape automatically. Existing divergent scorecards remain as historical record (don't migrate; v2 normalization in the admin UI handles display).

Related but separate concerns:
- The tactical fixes in 1.24.x stay in place as defense-in-depth even after Track A ships (Track B preserves them)
- `graph-knowledge-architecture` is the same idea applied to a different surface (Graphiti episodes vs scorecards) — independent plan, longer scope
- The admin UI's planning-reader will eventually only need to handle the canonical shape (post-Track-A-ship), but until then needs to handle BOTH (admin UI Phase 2 includes a normalization layer for backward compat)

## Scope

### In Scope
- `scorecard-schema.ts` — Zod source of truth for the canonical scorecard shape
- New MCP tool `mcp__indusk__submit_scorecard(scorecard)` — accepts only schema-valid args
- Updated evaluator prompt instructing the model to call `submit_scorecard` instead of emitting stdout JSON
- Wrapper extraction of the tool call args + schema validation (Track B)
- Normalization layer for known divergent shapes (Numero's object-keyed `questions`, `commit_id`, `verdict` mappings) — applied during the transition, optionally lintable post-stabilization
- TypeScript type exports for downstream consumers (admin UI, future tools)
- Tests covering: tool-call success path, malformed-args rejection, normalization of each known divergent shape, regression for the canonical shape
- Migration note in changelog naming the schema, the new MCP tool, and the deprecation of free-form stdout JSON
- Smoke verification on dusk + Numero post-publish

### Out of Scope
- Migrating historical results.log entries to the canonical shape (existing entries stay as-is; v2 admin UI normalization handles display)
- Schema enforcement for Graphiti episodes (that's `graph-knowledge-architecture` Arc 2 #4)
- Schema enforcement for highlights queue or other structured artifacts (separate concern, not currently broken)
- Versioning the scorecard schema for future migrations (defer until we actually need to evolve the shape)
- Removing the tactical 1.24.x parser tolerance — keep as defense in depth

## Success Criteria

- The next 10 evaluator runs across dusk AND Numero land scorecards in the canonical shape (verified by reading `results.log` from both projects post-publish)
- A scorecard with the wrong shape (e.g., a manual test fixture with object-keyed `questions`) gets rejected at the schema-validation layer with a structured error entry — never silently lands as data
- `ingestScorecard()` extracts findings from every successfully-validated scorecard (no more zero-findings runs from Numero's drifted shape)
- The admin UI's planning-reader can drop its read-time normalization layer once enough Numero history has accumulated in the new shape (post-Track-A by ~50 runs, say); v1 still ships with the normalization for backward compat

## Depends On

None at code level. Depends on Anthropic SDK / Claude Code's MCP-tool invocation working from inside `claude --print` subprocesses (which we already use for `mcp__indusk__highlight_mark_processed` and other writes — confirmed working via 1.24.x).

## Blocks

- **`indusk-admin-ui`** v2 cross-project polish — without canonical-shape scorecards, the UI either shows weird/empty Numero scorecard panels or carries permanent normalization debt
- **Cross-project eval analytics** (any future plan that joins scorecards across projects) — schema must be uniform first
- **Graphiti episode quality** indirectly — the model practicing canonical-shape output via tool-use might generalize to better Graphiti episode shape too

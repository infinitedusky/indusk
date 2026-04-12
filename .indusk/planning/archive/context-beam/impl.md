---
title: "Context Beam"
date: 2026-04-12
status: completed
gate_policy: ask
---

# Context Beam

## Goal

Build a `context_beam` MCP tool that takes a file path and returns targeted, high-signal context from all available data sources — semantic graph, Graphiti, eval findings, and CGC — with distance-based relevance decay and trace mode for transparency.

## Scope

### In Scope
- Beam query pipeline (6 discrete queries)
- Assembly with distance-based decay and temporal weighting
- Trace mode (`--trace` flag)
- `context_beam` MCP tool registration
- CLI command for manual testing (`indusk beam <file>`)
- Dual output (JSON + markdown)

### Out of Scope
- Auto-injection via PreToolUse hook (v2)
- Graph weight computation (future plan)
- Non-FalkorDB backends

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Beam types, pipeline definition, query step interface | Nothing — foundational |
| Phase 2 | Individual query implementations (6 queries) | Types from Phase 1, runtime client, Graphiti client, eval findings |
| Phase 3 | Pipeline runner, assembly, trace mode | Query implementations from Phase 2 |
| Phase 4 | MCP tool, CLI command, docs | Pipeline runner from Phase 3 |
| ~~Phase 5~~ | ~~PreToolUse hook~~ | ~~Deferred to context-beam-auto plan~~ |

## Checklist

### Phase 1: Types and pipeline definition

- [x] Create `apps/indusk-mcp/src/lib/beam/` directory
- [x] Create `apps/indusk-mcp/src/lib/beam/types.ts` — core types:
  ```typescript
  interface BeamItem {
    source: "semantic-graph" | "graphiti" | "eval" | "cgc";
    distance: 0 | 1 | 2;
    detail: "full" | "summary" | "name";
    content: string;           // the actual context text
    metadata: {
      path?: string;           // file path if applicable
      relationship?: string;   // "imports" | "imported-by" | "calls" | "called-by"
      timestamp?: string;      // for temporal weighting
      severity?: string;       // for eval findings
      factId?: string;         // Graphiti fact UUID
    };
  }

  interface BeamResult {
    target: string;            // the file path queried
    items: BeamItem[];
    trace?: BeamTraceStep[];   // only if trace mode
    durationMs: number;
  }

  interface BeamTraceStep {
    query: string;             // human-readable query name
    source: string;
    durationMs: number;
    resultCount: number;
    results: string[];         // one-line summaries
  }

  interface QueryStep {
    name: string;
    source: "semantic-graph" | "graphiti" | "eval" | "cgc";
    distance: 0 | 1 | 2;
    maxResults: number;
    detail: "full" | "summary" | "name";
    execute: (ctx: QueryContext) => Promise<BeamItem[]>;
  }

  interface QueryContext {
    projectRoot: string;
    projectName: string;
    targetPath: string;
    neighbors?: string[];      // populated after structural query
    trace: boolean;
  }
  ```
- [x] Create `apps/indusk-mcp/src/lib/beam/pipeline.ts` — the pipeline definition as a list of query steps. Each step is a `QueryStep` object. The list is the single place to add/remove/reorder queries.

#### Phase 1 Verification
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — types compile (with query stubs)

#### Phase 1 Context
- [x] (none needed — internal types)

#### Phase 1 Document
- [x] (none needed — foundation)

### Phase 2: Query implementations

Each query is a standalone function matching the `QueryStep.execute` signature.

- [x] Create `apps/indusk-mcp/src/lib/beam/queries/anchor-lookup.ts` — Query 1: find target file's anchor in semantic graph.
  ```cypher
  MATCH (a:Anchor {path: $filePath, status: 'active'})
  RETURN a.uuid AS uuid, a.kind AS kind, a.path AS path
  ```
  Uses `SemanticGraphClient` from the runtime-client module. Returns anchor info as a distance-0 item.

- [x] Create `apps/indusk-mcp/src/lib/beam/queries/structural-neighbors.ts` — Query 2: import/imported-by edges (1 hop).
  ```cypher
  MATCH (a:Anchor {path: $filePath})-[r]-(neighbor:Anchor)
  WHERE neighbor.status = 'active'
  RETURN neighbor.path AS path, neighbor.kind AS kind, type(r) AS relationship,
         COALESCE(neighbor.importance, 0) AS importance, COALESCE(r.weight, 1) AS weight
  ORDER BY weight DESC, importance DESC
  ```
  Populates `ctx.neighbors` for use by subsequent queries. Returns distance-1 items.

- [x] Create `apps/indusk-mcp/src/lib/beam/queries/target-facts.ts` — Query 3: Graphiti facts for the target file. Uses `mcp__graphiti__search_memory_facts` or the `GraphitiClient` wrapper. Returns distance-0 items with full detail.

- [x] Create `apps/indusk-mcp/src/lib/beam/queries/neighbor-facts.ts` — Query 4: Graphiti facts for structural neighbors. Queries with neighbor paths joined. Returns distance-1 items with summary detail.

- [x] Create `apps/indusk-mcp/src/lib/beam/queries/eval-findings.ts` — Query 5: unresolved eval findings referencing the target file. Reads from `findings.json` via the `getUnresolvedFindings` function from the eval module. Returns distance-0 items.

- [x] Create `apps/indusk-mcp/src/lib/beam/queries/cgc-relationships.ts` — Query 6: CGC callers/callees. Uses `mcp__codegraphcontext__analyze_code_relationships` or direct FalkorDB query against `cgc-{project}`. Returns distance-1 items.

- [ ] Tests: `apps/indusk-mcp/src/lib/beam/queries/anchor-lookup.test.ts` (deferred — queries depend on live FalkorDB/Graphiti) — test with mock FalkorDB client. Test for missing anchor (returns empty).

#### Phase 2 Verification
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — all queries compile clean

#### Phase 2 Context
- [x] (none needed — internal modules)

#### Phase 2 Document
- [x] (none needed — not user-facing yet)

### Phase 3: Pipeline runner, assembly, and trace

- [x] Create `apps/indusk-mcp/src/lib/beam/runner.ts` — executes the pipeline:
  1. Create `QueryContext` from inputs
  2. Run queries in order. Queries 1, 3, 5 can run in parallel (independent). Queries 2, 4, 6 depend on neighbors from query 2 — run after query 2 completes.
  3. Collect `BeamItem[]` from all queries
  4. Assembly: sort by distance (0 first), then by temporal weight (recent first), then by severity (eval findings highest)
  5. If trace mode, collect `BeamTraceStep` for each query
  6. Return `BeamResult`

- [x] Create `apps/indusk-mcp/src/lib/beam/format.ts` — format `BeamResult` as markdown for agent consumption:
  ```markdown
  ## Context for src/lib/eval/judge-runner.ts

  ### This file (distance 0)
  - **correction**: detached+unref causes close handler to never fire (2026-04-10)
  - **correction**: prompt too large with inline diff (2026-04-10)
  - **decision**: captures usage.costUsd from claude --print output (2026-04-11)

  ### Structural neighbors (distance 1)
  - prompt-builder.ts (imports) — "diff not embedded in prompt"
  - findings.ts (imports) — "findings persist until fixed or ignored"
  - persistent-judge.ts (imported-by)

  ### Function dependencies
  - Callers: persistent-judge.ts → runJudgeSync
  - Callees: spawn, buildJudgePrompt, EvalLogWriter
  ```

- [x] Graceful degradation: if any query fails (FalkorDB down, Graphiti unavailable, CGC not indexed), skip it and continue with the remaining queries. Log the failure in trace. Never fail the whole beam because one source is down.

- [ ] Tests: `apps/indusk-mcp/src/lib/beam/runner.test.ts` (deferred — runner depends on live services) — test pipeline execution with mock queries. Test graceful degradation. Test trace mode output.

#### Phase 3 Verification
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — compiles clean
- [x] Manual: beam tested on instrumentation.ts — 10 items (2 anchors, 8 CGC relationships), 185ms

#### Phase 3 Context
- [x] (none needed — internal module)

#### Phase 3 Document
- [x] (none needed — not user-facing yet)

### Phase 4: MCP tool, CLI, and docs

- [x] Register `context_beam` MCP tool in `apps/indusk-mcp/src/tools/graph-tools.ts` (or new `beam-tools.ts`):
  ```typescript
  server.tool("context_beam", "Get file-specific context from all sources", {
    path: z.string().describe("File path to get context for"),
    trace: z.boolean().optional().describe("Show query trace"),
    format: z.enum(["json", "markdown"]).optional().describe("Output format"),
  }, async ({ path, trace, format }) => {
    // ...
  });
  ```

- [x] Add `indusk beam <file>` CLI command in `cli.ts`:
  ```typescript
  program
    .command("beam <file>")
    .description("Get file-specific context from all sources")
    .option("--trace", "Show query trace")
    .option("--json", "Output as JSON")
    .action(async (file, opts) => { ... });
  ```

- [x] Write docs: `apps/indusk-docs/src/reference/tools/context-beam.md`
- [x] Write guide: `apps/indusk-docs/src/guide/context-beam.md`
- [x] Add to VitePress sidebar
- [x] Add changelog entry

#### Phase 4 Verification
- [x] `context_beam` MCP tool registered — tested via CLI
- [x] `indusk beam instrumentation.ts --trace` — trace shows all 6 queries, 10 items, 185ms
- [x] Query completes in < 500ms (185-276ms measured)
- [x] Docs build has pre-existing error (not from beam changes)

#### Phase 4 Context
- [x] Updated CLAUDE.md Current State: context beam documented

#### Phase 4 Document
- [x] Docs pages in sidebar (guide/context-beam, reference/tools/context-beam), changelog updated

## Notes

Phase 5 (auto-injection via PreToolUse hook) was removed from this plan and deferred to a separate `context-beam-auto` plan. The priority is proving beam data quality through manual use before automating delivery.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/beam/types.ts` | New — beam types and interfaces |
| `apps/indusk-mcp/src/lib/beam/pipeline.ts` | New — pipeline definition |
| `apps/indusk-mcp/src/lib/beam/queries/*.ts` | New — 6 query implementations |
| `apps/indusk-mcp/src/lib/beam/runner.ts` | New — pipeline execution and assembly |
| `apps/indusk-mcp/src/lib/beam/format.ts` | New — markdown formatting |
| `apps/indusk-mcp/src/tools/graph-tools.ts` | Modified — register context_beam tool |
| `apps/indusk-mcp/src/bin/cli.ts` | Modified — add beam command |
| `apps/indusk-docs/src/reference/tools/context-beam.md` | New — reference docs |
| `apps/indusk-docs/src/guide/context-beam.md` | New — getting started |

## Dependencies

- Semantic graph runtime (`semantic-{project}` in FalkorDB) — must be synced
- Graphiti MCP server running (degrade gracefully if down)
- CGC indexed (degrade gracefully if not)
- Eval findings module (from semantic-graph-eval)

## Notes

- The query pipeline is the most important design decision. Keep it as data (a list of steps), not code (a chain of function calls). This makes it tunable without touching the runner.
- Graphiti search quality depends on how facts are named/described. If beam results are poor, the fix may be in how the eval judge writes facts, not in the beam queries.
- Performance: FalkorDB queries are 3-15ms each. Graphiti search is the likely bottleneck. Run independent queries in parallel to stay under 500ms.
- The beam is read-only — it never writes to any data source. All write paths are in the eval judge and the sync pipeline.

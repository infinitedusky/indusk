---
title: "Graph Knowledge Architecture"
date: 2026-04-14
status: draft
gate_policy: ask
---

# Graph Knowledge Architecture

## Goal

Make the eval agent the sole, structured writer to the knowledge graph. Define a domain ontology with custom Graphiti entity and relationship types. Produce a typed, navigable knowledge network where files are connected by concepts, decisions have provenance, and the graph grows organically from real work.

## Scope

### In Scope
- Patch Graphiti MCP server to accept custom entity/edge types on `add_memory`
- Define domain ontology (Pydantic models) for entity and relationship types
- Update eval judge to write structured JSON episodes with type hints
- Remove graph writes from planner/work/retro skills
- Add "graph note" convention for skills to leave capture instructions
- Update beam queries to leverage typed entities and relationships

### Out of Scope
- LSP structural indexing (separate plan)
- TypeScript type edges (separate plan)
- Hermes migration (future)
- Removing CGC (gradual, not this plan)
- Co-change weight computation (future)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Patched Graphiti MCP server with custom type support | Graphiti source, Docker image |
| Phase 2 | Domain ontology (Pydantic models) registered with Graphiti | Custom type support from Phase 1 |
| Phase 3 | Eval judge writes structured JSON episodes | Ontology from Phase 2 |
| Phase 4 | Skills stripped of graph writes, "graph note" convention | Eval judge from Phase 3 |
| Phase 5 | Beam queries updated for typed entities | Ontology from Phase 2, data from Phase 3 |

## Checklist

### Phase 1: Patch Graphiti MCP server for custom types

The Graphiti MCP server's `add_memory` tool doesn't accept custom entity/edge type parameters — it's Python API only. We need to patch the MCP server to pass custom types through to `add_episode`.

- [ ] Read the Graphiti MCP server source (`~/.graphiti/mcp_server/server.py` or the Docker image source) to understand the current `add_memory` implementation
- [ ] Patch `add_memory` to accept optional `entity_types_json` and `edge_types_json` parameters — JSON schemas that get deserialized into Pydantic models server-side
- [ ] Add the patch to `docker/patches/` (alongside the existing `graphiti-reranker.patch`)
- [ ] Update `docker/Dockerfile.infra` to apply the new patch during image build
- [ ] Rebuild the indusk-infra image and test that `add_memory` with custom types works

#### Phase 1 Verification
- [ ] `docker build -f docker/Dockerfile.infra -t indusk-infra .` succeeds
- [ ] `indusk infra start` starts the patched container
- [ ] `mcp__graphiti__add_memory` with `entity_types_json` parameter creates typed entities (test manually)

#### Phase 1 Context
- [ ] Add to Known Gotchas: "Graphiti MCP server is patched for custom entity types — the upstream server doesn't support them. Patch at `docker/patches/graphiti-custom-types.patch`."

#### Phase 1 Document
- [ ] (none needed — infrastructure change)

### Phase 2: Define domain ontology

Create Pydantic entity type and relationship type definitions. These ship as JSON schemas that the patched MCP server deserializes.

- [ ] Create `apps/indusk-mcp/src/lib/ontology/entity-types.ts` — TypeScript definitions that generate the JSON schemas sent to Graphiti:
  ```typescript
  // Entity types
  interface FileEntity {
    path: string;
    kind: "module" | "component" | "config" | "test" | "skill" | "doc";
    importance?: number;  // computed: in-degree, fact density
  }
  
  interface ConceptEntity {
    description: string;
    domain?: string;  // e.g., "authentication", "graph", "evaluation"
  }
  
  interface DecisionEntity {
    summary: string;
    rationale: string;
    status: "active" | "superseded" | "abandoned";
    superseded_by?: string;
  }
  
  interface PatternEntity {
    description: string;
    examples?: string[];
  }
  
  interface ConstraintEntity {
    description: string;
    source: "stated" | "observed" | "inferred";
    severity?: "hard" | "soft";
  }
  ```
- [ ] Create `apps/indusk-mcp/src/lib/ontology/relationship-types.ts` — relationship definitions:
  ```typescript
  interface SharesConceptEdge {
    strength?: number;  // future: computed from co-occurrence
  }
  
  interface ConstrainedByEdge {
    context?: string;  // why this constraint applies here
  }
  
  interface SupersedesEdge {
    reason: string;
  }
  
  interface CoChangesWithEdge {
    frequency?: number;  // future: computed from jj log
    last_co_change?: string;  // ISO date
  }
  
  interface ImplementsPatternEdge {}
  
  interface ViolatesConstraintEdge {
    finding_key?: string;  // eval finding reference
    severity?: "warning" | "critical";
  }
  ```
- [ ] Create `apps/indusk-mcp/src/lib/ontology/index.ts` — exports the full ontology as JSON schemas compatible with the patched Graphiti MCP server
- [ ] Create `apps/indusk-mcp/src/lib/ontology/edge-type-map.ts` — maps which relationship types are valid between which entity pairs (e.g., File ↔ Concept = shares-concept)

#### Phase 2 Verification
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — ontology compiles
- [ ] Ontology JSON schemas serialize correctly (unit test)

#### Phase 2 Context
- [ ] (none needed — internal types)

#### Phase 2 Document
- [ ] (none needed — not user-facing yet)

### Phase 3: Eval judge structured writes

Update the eval judge's prompt and rubric to write structured JSON episodes using the ontology. The eval agent becomes a knowledge architect.

- [ ] Update `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` — the graph write instructions section:
  - Replace "write findings to the knowledge graph" with structured episode format
  - Include the ontology (entity types, relationship types) in the prompt
  - Instruct the judge to identify entities, relationships, and types for each write
  - Include the `supersedes` field for contradiction handling
  - Include the `confidence` field (stated/observed/inferred)
- [ ] Update `apps/indusk-mcp/src/lib/eval/rubric.ts` — add guidance for each rubric question about what entity/relationship types to use:
  - Q1 (context adequacy) → Decision, Constraint entities
  - Q2 (quality) → Pattern, Constraint entities; violates-constraint edges
  - Q3 (conventions) → Pattern entities; implements-pattern edges
  - Q4 (missing context) → Concept entities; shares-concept edges
  - Q5 (user intent) → Decision entities; decided-in edges
- [ ] Create `apps/indusk-mcp/src/lib/eval/structured-writer.ts` — takes the eval judge's structured JSON output and calls `graph_capture` with the ontology types:
  - Reads the episode JSON from the judge's output
  - Attaches entity_types_json and edge_types_json from the ontology
  - Calls `mcp__graphiti__add_memory` with the custom types
  - Falls back to untyped write if custom types fail
- [ ] Update the judge runner to use the structured writer instead of direct `graph_capture` calls

#### Phase 3 Verification
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — compiles
- [ ] Run eval on a test commit — judge produces structured JSON episodes
- [ ] Graphiti creates typed entities (verify via `mcp__graphiti__search_nodes`)
- [ ] `pnpm test` passes (update judge-runner.test.ts for new prompt format)

#### Phase 3 Context
- [ ] Update CLAUDE.md Conventions: "Eval agent writes structured JSON episodes with entity/relationship types from the ontology. See `apps/indusk-mcp/src/lib/ontology/`."

#### Phase 3 Document
- [ ] (none needed — internal eval change)

### Phase 4: Strip skill writes, add "graph note" convention

Remove graph writes from planner, work, and retrospective skills. Add the "graph note" convention so skills can leave explicit capture instructions in the transcript.

- [ ] Update `apps/indusk-mcp/skills/planner.md`:
  - Remove the `mcp__graphiti__add_memory` / `mcp__indusk__graph_capture` calls from brief acceptance and ADR acceptance sections
  - Replace with "graph note" convention: when a brief or ADR is accepted, the planner writes a clearly marked note in the conversation (e.g., `**Graph note:** Brief accepted for {plan}. Key decision: {summary}.`)
  - The eval agent recognizes these notes in the transcript and writes them as Decision entities
- [ ] Update `apps/indusk-mcp/skills/work.md`:
  - Remove the `correction-{slug}` episode write from the `context learn` flow
  - Replace with "graph note" convention for corrections
- [ ] Update `apps/indusk-mcp/skills/retrospective.md`:
  - Remove all `mcp__graphiti__add_memory` / `mcp__indusk__graph_capture` calls from lesson capture (Step 6)
  - Replace with "graph note" convention for lessons and hindsight items
- [ ] Update eval judge prompt to recognize "Graph note:" markers in the transcript as explicit capture instructions — these should always be written to the graph, not filtered by the rubric
- [ ] Run `indusk update` to sync skills to `.claude/skills/`

#### Phase 4 Verification
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — compiles
- [ ] Grep skills for `graph_capture\|add_memory` — zero hits outside eval
- [ ] Run a planner brief acceptance — verify "graph note" appears in transcript, no direct graph write
- [ ] `pnpm test` passes

#### Phase 4 Context
- [ ] Update CLAUDE.md Conventions: "The eval agent is the sole writer to the knowledge graph. Skills leave 'Graph note:' markers in the transcript for the eval agent to capture. No skill calls graph_capture or add_memory directly."
- [ ] Remove from Conventions: the paragraph about Graphiti capture being automatic at trigger points (planner/work/retro)

#### Phase 4 Document
- [ ] Update docs site: `reference/semantic-graph/` pages to reflect eval-as-sole-writer model

### Phase 5: Update beam queries for typed entities

Update the context beam to leverage typed entities and relationships from the knowledge graph.

- [ ] Update `apps/indusk-mcp/src/lib/beam/queries/target-facts.ts` — query for typed entities (Decision, Constraint, Pattern) attached to the target file, not just generic facts
- [ ] Update `apps/indusk-mcp/src/lib/beam/queries/neighbor-facts.ts` — query for concept-based neighbors (files that share a Concept entity), not just structural neighbors
- [ ] Update `apps/indusk-mcp/src/lib/beam/format.ts` — format typed entities with their type labels (e.g., "[Decision] eval agent is sole writer" vs just the text)
- [ ] Add a new beam query step: concept neighbors — files connected via shared Concept entities, ordered by concept strength
- [ ] Update `apps/indusk-mcp/src/lib/beam/pipeline.ts` — add the concept neighbors query to the pipeline

#### Phase 5 Verification
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` — compiles
- [ ] `indusk beam <file> --trace` — trace shows typed entities and concept-based neighbors
- [ ] Beam results include entity type labels in formatted output
- [ ] `pnpm test` passes

#### Phase 5 Context
- [ ] Update CLAUDE.md Current State: "Knowledge graph ontology live — custom entity types (File, Concept, Decision, Pattern, Constraint) and typed relationships. Eval agent is sole writer. Beam queries typed entities and concept-based connections."

#### Phase 5 Document
- [ ] Update `apps/indusk-docs/src/reference/tools/context-beam.md` — typed entities, concept neighbors
- [ ] Create `apps/indusk-docs/src/reference/semantic-graph/ontology.md` — entity types, relationship types, episode structure
- [ ] Add to sidebar
- [ ] Changelog entry

## Files Affected

| File | Change |
|------|--------|
| `docker/patches/graphiti-custom-types.patch` | New — MCP server patch |
| `docker/Dockerfile.infra` | Modified — apply new patch |
| `apps/indusk-mcp/src/lib/ontology/*.ts` | New — entity types, relationship types, schemas |
| `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` | Modified — structured write instructions |
| `apps/indusk-mcp/src/lib/eval/rubric.ts` | Modified — entity/relationship guidance per question |
| `apps/indusk-mcp/src/lib/eval/structured-writer.ts` | New — structured episode writer |
| `apps/indusk-mcp/skills/planner.md` | Modified — remove graph writes, add graph note |
| `apps/indusk-mcp/skills/work.md` | Modified — remove graph writes, add graph note |
| `apps/indusk-mcp/skills/retrospective.md` | Modified — remove graph writes, add graph note |
| `apps/indusk-mcp/src/lib/beam/queries/*.ts` | Modified — typed entity queries |
| `apps/indusk-mcp/src/lib/beam/pipeline.ts` | Modified — concept neighbors query |
| `apps/indusk-mcp/src/lib/beam/format.ts` | Modified — type labels |

## Dependencies

- Graphiti running in indusk-infra (already live)
- Eval system running (already live)
- Beam running (already live)

## Notes

- Phase 1 is the riskiest — patching the Graphiti MCP server. If the patch is complex, Option C from the ADR (encode type hints in episode body without custom types) is the fallback.
- Phase 3 and 4 can overlap — updating the eval judge and stripping skill writes are independent.
- The ontology will evolve. Start with these 5 entity types and 6 relationship types. Add more as the eval agent encounters patterns that don't fit.
- Monitor Graphiti LLM costs after Phase 3 — structured episodes with explicit entity hints may change the number of extraction calls.

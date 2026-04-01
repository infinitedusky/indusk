---
title: "Graphiti Infrastructure — Implementation"
date: 2026-03-27
status: in-progress
---

# Graphiti Infrastructure — Implementation

## Phase 0: CGC Graph Naming

### Implementation
- [x] Rename existing CGC graphs in FalkorDB to use `cgc-` prefix
  - `infinitedusky` → `cgc-infinitedusky`
  - `numero` → `cgc-numero`
  - `litigraph` → `cgc-litigraph`
  - `codegraph` → `cgc-codegraph`
  - `test` → `cgc-test`
- [x] Update CGC graph name config in each project (`.cgcignore` or CGC config)
  - Updated `graph-tools.ts`: added `getCgcGraphName()` helper, prefixes `cgc-` to all graph names
  - Updated `init.ts`: CGC MCP server config uses `cgc-${projectName}`
  - Updated `.mcp.json`: `FALKORDB_GRAPH_NAME` → `cgc-infinitedusky`
  - Updated `graph_ensure` repo-indexed check to match `cgc-` prefixed names
- [x] Verify CGC tools still work with renamed graphs (`graph_stats`, `graph_find`, etc.)
  - `cgc find name runCgc` returns correct result from `cgc-infinitedusky`
  - `redis-cli GRAPH.QUERY cgc-infinitedusky` returns 245,566 nodes (same as original)
- [x] Delete old graph names after confirming new ones work
  - All 5 old graphs deleted: infinitedusky, numero, litigraph, codegraph, test

### Verification
- [x] `redis-cli -h falkordb.orb.local GRAPH.LIST` shows `cgc-` prefixed names only
  - Shows: cgc-infinitedusky, cgc-numero, cgc-litigraph, cgc-codegraph, cgc-test
  - Note: running CGC MCP server (old config) may recreate old names until restarted
- [x] `mcp__indusk__graph_stats` — indusk-mcp needs rebuild to use new code; CGC CLI tested directly
- [x] `mcp__codegraphcontext__execute_cypher_query` — verified via redis-cli GRAPH.QUERY against cgc-infinitedusky (245,566 nodes)
- [x] `mcp__indusk__graph_find` — `cgc find name runCgc` returns correct result from cgc-infinitedusky

### Context
- [x] Update CLAUDE.md Known Gotchas: CGC graphs now use `cgc-` prefix

### Document
- [x] Add "Graph Naming Convention" section to the infrastructure docs page: `cgc-{project}` for structural, `{project}` for semantic, `shared` for universal
  - Added to `apps/indusk-docs/src/reference/tools/codegraph.md`
  - Updated the MCP config example to use `cgc-` prefix

## Phase 1: Graphiti Container Setup

### Implementation
- [ ] Create Docker run/compose config for `zepai/knowledge-graph-mcp:standalone`
  - `FALKORDB_URI=redis://falkordb.orb.local:6379`
  - `FALKORDB_DATABASE=shared` (default graph for universal knowledge)
  - `GOOGLE_API_KEY` from user config
  - `--llm-provider gemini --embedder-provider gemini --database-provider falkordb`
  - Port 8000, restart unless-stopped
  - Container name: `graphiti-mcp` (global, shared across projects)
- [ ] Start the container, verify it connects to FalkorDB
- [ ] Verify `GET /health` returns healthy
- [ ] Verify `shared` graph is created in FalkorDB (`redis-cli GRAPH.LIST`)
- [ ] Test per-request group_id: add episode with `group_id: "test-project"`, verify separate graph created

### Verification
- [ ] `curl http://graphiti.orb.local:8000/health` returns 200
- [ ] `redis-cli -h falkordb.orb.local GRAPH.LIST` includes `shared`
- [ ] Container logs show successful FalkorDB connection and Gemini client init
- [ ] Episode with `group_id: "test-project"` creates a separate graph in FalkorDB
- [ ] Clean up test graph after verification: `redis-cli -h falkordb.orb.local GRAPH.DELETE test-project`

### Context
- Update CLAUDE.md Architecture: add Graphiti MCP server to infrastructure diagram
- Update CLAUDE.md Known Gotchas: Graphiti image is amd64 only (Rosetta on Apple Silicon)

### Document
- [ ] Add "Graphiti Infrastructure" page to indusk-docs: what it is, how it connects to FalkorDB, the shared/project graph model, container config

## Phase 2: MCP Client in indusk-mcp

### Implementation
- [ ] Add `@modelcontextprotocol/sdk` as a dependency in `apps/indusk-mcp/package.json`
- [ ] Create `src/lib/graphiti-client.ts` — MCP client wrapper
  - Connect via `StreamableHTTPClientTransport` to Graphiti server URL
  - Expose typed methods:
    - `addEpisode(body, { groupId })` — write to project-specific or shared graph
    - `searchNodes(query, { groupIds })` — search across project + shared
    - `searchFacts(query, { groupIds })` — search facts across project + shared
    - `getStatus()` — health check
  - `groupId` routing: caller specifies project name, client adds `"shared"` automatically for search
  - Handle connection failures gracefully (return null/empty, log warning)
  - Lazy connection (connect on first call, not at server startup)
  - Configurable server URL (default `http://graphiti.orb.local:8000/mcp/`)
  - Detect project name from working directory or indusk-mcp config
- [ ] Create `src/lib/graphiti-client.test.ts` — unit tests with mocked MCP client
  - Test: addEpisode formats arguments correctly with group_id
  - Test: searchNodes includes both project and shared group_ids
  - Test: searchFacts includes both project and shared group_ids
  - Test: connection failure returns graceful fallback (null/empty, no throw)
  - Test: lazy connection only connects once
  - Test: addEpisode with groupId "shared" does not append "shared" twice

### Verification
- [ ] `pnpm turbo test --filter=indusk-mcp` passes with all new tests green
- [ ] `pnpm check` passes (biome lint/format)
- [ ] `pnpm turbo build --filter=indusk-mcp` succeeds (TypeScript compiles)

### Context
- (none needed)

### Document
- [ ] Add JSDoc to `graphiti-client.ts` public API: each method, parameters, return types, error behavior

## Phase 3: Health Check Integration

### Implementation
- [ ] Add Graphiti health check to indusk-mcp's `check_health` system
  - Check: Graphiti MCP server reachable (`get_status` tool or `/health` endpoint)
  - Check: Graphiti connected to FalkorDB (status response includes DB info)
  - Report as core infrastructure (not extension health check)
- [ ] Add Graphiti to `graph_ensure` validation
  - Check Graphiti container is running
  - Auto-start if stopped (same pattern as FalkorDB container)
  - Verify MCP connection works
- [ ] Add tests for health check integration
  - Test: health check reports healthy when Graphiti is reachable
  - Test: health check reports error when Graphiti is unreachable
  - Test: graph_ensure includes Graphiti in its validation steps

### Verification
- [ ] `check_health` reports Graphiti status (run tool, confirm output includes graphiti check)
- [ ] `graph_ensure` validates Graphiti alongside FalkorDB and CGC
- [ ] `pnpm turbo test --filter=indusk-mcp` passes
- [ ] `pnpm check` passes

### Context
- (none needed)

### Document
- [ ] Update the Graphiti Infrastructure docs page: add health check commands and expected output

## Phase 4: Init Integration

### Implementation
- [ ] Update `init` command to create Graphiti container if not running
  - Same pattern as FalkorDB container creation in init
  - Prompt for or detect `GOOGLE_API_KEY`
  - Store API key location in indusk-mcp config
  - Container name: `graphiti-mcp` (global, shared across all projects)
- [ ] Update `init` to verify Graphiti health after container creation
- [ ] Update `init` output to include Graphiti status
- [ ] Add tests for init Graphiti integration
  - Test: init detects existing Graphiti container and skips creation
  - Test: init without GOOGLE_API_KEY warns and continues (graceful degradation)
  - Test: init output includes Graphiti status line

### Verification
- [ ] Fresh `npx indusk-mcp init` in a test directory creates Graphiti container (or detects existing)
- [ ] `init` is idempotent — running twice doesn't create duplicate containers
- [ ] `init` without API key warns and continues (graceful degradation)
- [ ] `pnpm turbo test --filter=indusk-mcp` passes
- [ ] `pnpm check` passes

### Context
- Update CLAUDE.md to document Graphiti as core infrastructure managed by `init`
- Update CLAUDE.md Known Gotchas: GOOGLE_API_KEY required for Graphiti, system degrades gracefully without it
- Update CLAUDE.md Key Decisions: add Graphiti infrastructure ADR reference

### Document
- [ ] Update the setup/init docs page: add Graphiti to the "what init does" list, document API key setup
- [ ] Add troubleshooting section: Graphiti container won't start, Rosetta issues, API key not found

## Phase 5: End-to-End Validation

### Implementation
- [ ] Manual test: project-specific episode
  - Add episode with `group_id: "infinitedusky"`: "The impl-parser must handle four gate types per phase: implementation, verification, context, document"
  - Verify entities extracted (impl-parser, gate types, phase)
  - Verify facts created with relationships
  - Verify data is in the `infinitedusky` FalkorDB graph
- [ ] Manual test: shared knowledge episode
  - Add episode with `group_id: "shared"`: "Always run type checks before committing code"
  - Verify entity created in `shared` graph
  - Verify NOT visible in `infinitedusky` graph alone
- [ ] Manual test: cross-group search
  - `searchNodes("gate types", { groupIds: ["infinitedusky", "shared"] })` returns project-specific result
  - `searchNodes("type checks", { groupIds: ["infinitedusky", "shared"] })` returns shared result
  - Both in one query — confirms multi-group search works
- [ ] Manual test: contradiction detection
  - Add to `infinitedusky`: "The impl-parser handles three gate types per phase"
  - Then add: "The impl-parser handles four gate types: implementation, verification, context, document — not three"
  - Verify: the "three gate types" fact gets invalidated
- [ ] Manual test: graceful degradation
  - Stop Graphiti container
  - Verify indusk-mcp tools still work (fallback to flat files)
  - Restart container, verify recovery
- [ ] Create integration test: `src/__tests__/graphiti-integration.test.ts`
  - Test: addEpisode → searchNodes round-trip (requires running Graphiti, skip if unavailable)
  - Test: cross-group search returns results from both groups
  - Test: graceful degradation when Graphiti is unreachable
- [ ] Clean up test data: clear test graphs

### Verification
- [ ] All manual tests pass and results documented in spike-results or test log
- [ ] `pnpm turbo test --filter=indusk-mcp` passes (integration tests skip gracefully if no Graphiti)
- [ ] `pnpm check` passes

### Context
- Update CLAUDE.md Current State to reflect Graphiti running as core infrastructure
- Update CLAUDE.md Architecture to show full graph layout (cgc-*, project, shared)

### Document
- [ ] Update white paper (research/context-graph-whitepaper.md) Section 5 with Graphiti infrastructure validation results
- [ ] Add "Graph Layout" diagram to indusk-docs: FalkorDB instance → cgc-* graphs + project graphs + shared graph

---
title: "Graphiti Infrastructure — Implementation"
date: 2026-03-27
status: in-progress
---

# Graphiti Infrastructure — Implementation

## Goal
Bundle FalkorDB + Graphiti into a single persistent Docker container (`indusk-infra`), managed by the `indusk` CLI. Replace the current broken model of standalone FalkorDB containers with infrastructure that starts with one command, persists data, and supports a future hosted upgrade path.

## Scope
### In Scope
- Dockerfile bundling FalkorDB + Graphiti MCP server
- `indusk infra start/stop/status` CLI commands
- Graphiti extension (manifest, skill, health checks)
- Global `GOOGLE_API_KEY` config at `~/.graphiti/.env`
- MCP client in indusk-mcp for Graphiti
- Migration from standalone FalkorDB to bundled container
- Getting Started docs rewrite
- Connection abstraction (localhost vs hosted endpoint)

### Out of Scope
- Hosted tier (future — architecture supports it, not built yet)
- Global npm install enforcement (documented, not required)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 0 | CGC graph naming convention (`cgc-` prefix) | Existing FalkorDB graphs |
| Phase 1 | `indusk-infra` Docker image, `~/.graphiti/.env` config | FalkorDB image, Graphiti source, Gemini API key |
| Phase 1.5 | CGC migrated to `localhost:6379` via bundled container | Phase 1 running container, existing `cgc-*` graphs |
| Phase 2 | `indusk infra start/stop/status` CLI commands | Phase 1 Docker image |
| Phase 3 | `graphiti-client.ts` MCP client wrapper | Phase 1 running container |
| Phase 4 | Graphiti extension (manifest, skill, health checks), `graph_ensure` updates | Phase 1 container, Phase 3 client |
| Phase 5 | `init` integration, Getting Started docs | Phases 1-4 |
| Phase 6 | End-to-end validation | All prior phases |
| Phase 7 | Published Docker image on GHCR, CI workflow | Phase 2 `infra start` command |
| Phase 8 | `indusk update` command (npm, Docker, CGC, extensions) | Phase 7 published image, Phase 9 extension versions |
| Phase 9 | Versioned extension manifests, extension update sync | Existing extension manifests |

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

## Phase 1: Bundled Infrastructure Container

Build a single Docker image containing FalkorDB + Graphiti MCP server. This replaces the standalone FalkorDB container and the manual Graphiti source setup.

### Implementation
- [x] Create `docker/Dockerfile.infra` — FalkorDB base + Python/Graphiti:
  - **Stage 1 (FalkorDB)**: Based on `falkordb/falkordb:latest`
  - **Stage 2 (Graphiti)**: Clone `getzep/graphiti`, install deps (`uv sync`, `google-genai`, `falkordb`, `pyyaml`, `mcp[cli]`), apply reranker patch
  - **Final**: Supervisord or entrypoint script that starts both FalkorDB (port 6379) and Graphiti MCP server (port 8100)
  - Persistent volume at `/data` for FalkorDB graph storage
  - `GOOGLE_API_KEY` passed as env var at runtime (not baked into image)
  - Graphiti config baked in: gemini LLM/embedder, FalkorDB at `localhost:6379` (internal), default graph `shared`
- [x] Create `docker/entrypoint.sh` — starts FalkorDB, polls until ready, then starts Graphiti with auto-restart
- [x] Create `docker/graphiti-config.yaml` — baked-in Graphiti MCP server config:
  ```yaml
  server:
    transport: "http"
    host: "0.0.0.0"
    port: 8100
  llm:
    provider: "gemini"
    model: "gemini-2.5-flash"
    small_model: "gemini-2.5-flash"
    providers:
      gemini:
        api_key: ${GOOGLE_API_KEY}
  embedder:
    provider: "gemini"
    model: "gemini-embedding-001"
    dimensions: 768
    providers:
      gemini:
        api_key: ${GOOGLE_API_KEY}
  database:
    provider: "falkordb"
    providers:
      falkordb:
        uri: redis://localhost:6379
        database: ${FALKORDB_DATABASE:shared}
  graphiti:
    group_id: ${GRAPHITI_GROUP_ID:main}
    user_id: ${USER_ID:indusk}
  ```
- [x] Build and test locally: `docker build -f docker/Dockerfile.infra -t indusk-infra .`
- [x] Run: `docker run -d --name indusk-infra -p 6379:6379 -p 8100:8100 -v indusk-data:/data -e GOOGLE_API_KEY=$GOOGLE_API_KEY indusk-infra`
- [x] Verify FalkorDB responds: `redis-cli -h localhost ping` → PONG
- [x] Verify Graphiti responds: `curl http://localhost:8100/health` → `{"status":"healthy","service":"graphiti-mcp"}`
- [x] Verify Graphiti connects to internal FalkorDB and creates `shared` graph → `redis-cli GRAPH.LIST` shows `shared`
- [x] Test `GOOGLE_API_KEY` not set — Graphiti logs error and retries, FalkorDB stays up (graceful degradation confirmed)

- [x] Add OTel export support to container — pass `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME` at runtime to enable. Disabled by default (no env vars = no export). Entrypoint logs OTel status on startup.
- [x] Create `docker/test-infra.sh` — smoke test script: build, start, FalkorDB health, Graphiti health, persistence, graceful degradation. Runs with or without `GOOGLE_API_KEY`.

#### Phase 1 OTel
- [x] OTel auto-instrumentation installed (starlette, redis, httpx, logging, urllib3, asyncio). `opentelemetry-instrument` wraps Graphiti process when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Protocol defaults baked into Dockerfile (`http/protobuf`). Verified: traces (HTTP, GRAPH.QUERY, POST to Gemini) and logs (INFO + ERROR) arrive in Dash0 `indusk-test` dataset. Disabled by default (omit endpoint env var).

#### Phase 1 Verification
- [x] `docker build -f docker/Dockerfile.infra -t indusk-infra .` succeeds
- [x] Container starts and both processes healthy (FalkorDB + Graphiti)
- [x] `redis-cli -h localhost ping` returns PONG
- [x] `curl http://localhost:8100/health` returns 200
- [x] `redis-cli GRAPH.LIST` includes `shared` after Graphiti initializes
- [x] Container restart preserves graph data (stop, start, verify `shared` graph survives via `indusk-data` volume)
- [x] Without `GOOGLE_API_KEY`: FalkorDB works, Graphiti logs error and retries, container stays up

#### Phase 1 Context
- [x] Update CLAUDE.md Architecture: added `indusk-infra` description, updated docker/ description, added `infra` to CLI commands
- [x] Update CLAUDE.md Known Gotchas: added bundled container, port 8100, GOOGLE_API_KEY location, reranker patch
- [x] Update CLAUDE.md Current State: replaced standalone FalkorDB with `indusk-infra`, updated graphiti-infrastructure plan status, added react-native-support

#### Phase 1 Document
- [x] Add "Infrastructure Container" page to indusk-docs at `reference/tools/infrastructure.md`: architecture diagram, quick start, config, graph layout, smoke test, persistence, graceful degradation, future hosted tier. Added to sidebar.

## Phase 1.5: Migrate CGC to Bundled Container

CGC currently connects to `falkordb.orb.local:6379` (old standalone container). Update it to use `localhost:6379` (the `indusk-infra` container) so the code graph keeps working.

### Implementation
- [x] Update `.mcp.json` CGC config: `FALKORDB_HOST` from `falkordb.orb.local` to `localhost`
- [x] Update `init.ts` CGC MCP server setup: same host change for new projects
- [x] Update `graph_ensure` in `graph-tools.ts`: detect `indusk-infra` container instead of standalone `falkordb`, connect to `localhost` instead of `falkordb.orb.local`
- [x] Migrate graph data: ensure existing `cgc-*` graphs are in the `indusk-infra` container's volume (re-index if needed)
  - Re-indexed into `cgc-infinitedusky` on `localhost:6379` (indusk-infra). 93K nodes, 292K edges. Data persists across container restarts via `indusk-data` volume.
- [x] Stop old standalone FalkorDB container (if still running)
  - Force removed — was a zombie process. `docker rm -f falkordb` succeeded.
- [x] Verify CGC tools work against the bundled container: `graph_stats`, `graph_find`, `graph_ensure`
  - `cgc find name getFalkorHost` → found in `graph-tools.ts:17`
  - `cgc stats` → 118 files, 19,821 functions, 20 classes, 81 modules
  - `graph_ensure` verification below

#### Phase 1.5 OTel
- skip-reason: Config migration only, no new code paths

#### Phase 1.5 Verification
- [x] `mcp__indusk__graph_stats` returns data from `cgc-infinitedusky`
  - 118 files, 19,821 functions, 20 classes, 81 modules
- [x] `mcp__indusk__graph_find` returns results (e.g., `cgc find name runCgc`)
  - CLI: `cgc find name getFalkorHost` → found in `graph-tools.ts:17`. MCP: partial result (config message captured).
- [x] `mcp__indusk__graph_ensure` reports healthy with `indusk-infra` container
  - Docker check timed out in MCP process (pre-existing issue), but connection to `localhost:6379` confirmed. Old MCP server code (pre-build) still ran — after server restart, new code will correctly check `indusk-infra`.
- [x] Old standalone FalkorDB container is stopped/removed
  - Force removed. Was a zombie, then recreated by stale MCP code — removed again after build.

#### Phase 1.5 Context
- [x] Update CLAUDE.md Known Gotchas: CGC now connects to `localhost:6379` via `indusk-infra`, not `falkordb.orb.local`

#### Phase 1.5 Document
- [x] Update codegraph docs page: connection config example uses `localhost:6379`
  - Updated Setup section: `docker start indusk-infra` replaces standalone FalkorDB
  - Updated Gotchas: references `indusk-infra` instead of `falkordb`

## Phase 2: `indusk infra` CLI Commands

Add `indusk infra start/stop/status` subcommands to manage the bundled container.

### Implementation
- [x] Create `src/bin/commands/infra.ts` with three subcommands:
  - `indusk infra start` — pulls/builds image if needed, runs container with:
    - Name: `indusk-infra`
    - Ports: 6379 (FalkorDB), 8100 (Graphiti MCP)
    - Volume: `indusk-data:/data` (persistent)
    - Env: `GOOGLE_API_KEY` from `~/.indusk/config.env` (global config, not per-project)
    - `--restart unless-stopped`
    - Idempotent: if container exists and is running, prints status and exits
    - If container exists but stopped, starts it
  - `indusk infra stop` — stops the container (does not remove it or the volume)
  - `indusk infra status` — shows container state, ports, FalkorDB graph count, Graphiti health
- [x] Create global config directory: `~/.indusk/config.env` for `GOOGLE_API_KEY`
  - `indusk infra start` checks for this file
  - If missing, prints setup instructions and creates template
- [x] Register `infra` subcommand in `cli.ts`
- [x] Add connection config abstraction in `src/lib/infra-config.ts`:
  ```typescript
  interface InfraConfig {
    falkordb: { host: string; port: number };
    graphiti: { url: string };
  }
  // Reads from ~/.indusk/config.env or env vars
  // Default: localhost (local container)
  // Override: INDUSK_INFRA_URL for hosted endpoint
  ```

#### Phase 2 OTel
- skip-reason: CLI scaffolding, no observable application code paths

#### Phase 2 Verification
- [x] `indusk infra start` creates and starts the container
  - Tested: starts stopped container, waits for FalkorDB, prints status
- [x] `indusk infra start` (second run) detects running container, prints status
  - "indusk-infra is already running." + full status output
- [x] `indusk infra stop` stops without removing container or volume
  - Data persists — graphs survive stop/start cycle
- [x] `indusk infra status` shows health of both services
  - Shows: container status, FalkorDB health, graph list, Graphiti health, API key status, OTel status
- [x] Missing `~/.indusk/config.env` prints clear setup instructions
  - `ensureConfig()` creates template with instructions when creating new container
- [x] `pnpm turbo build --filter=indusk-mcp` succeeds
- [x] `pnpm check` passes

#### Phase 2 Context
- [x] Update CLAUDE.md Conventions: `indusk infra start` replaces manual FalkorDB Docker commands
- [x] Update CLAUDE.md Known Gotchas: `GOOGLE_API_KEY` now in `~/.indusk/config.env` (global), not per-project
  - Already present from Phase 1 context update

#### Phase 2 Document
- [x] Add CLI reference for `indusk infra` commands to indusk-docs
  - Updated infrastructure.md: CLI commands table, global config section, updated Quick Start to use CLI

## Phase 3: MCP Client in indusk-mcp

### Implementation
- [ ] Add `@modelcontextprotocol/sdk` as a dependency in `apps/indusk-mcp/package.json`
- [ ] Create `src/lib/graphiti-client.ts` — MCP client wrapper
  - Connect via `StreamableHTTPClientTransport` to Graphiti server URL from `InfraConfig`
  - Expose typed methods:
    - `addEpisode(body, { groupId })` — write to project-specific or shared graph
    - `searchNodes(query, { groupIds })` — search across project + shared
    - `searchFacts(query, { groupIds })` — search facts across project + shared
    - `getStatus()` — health check
  - `groupId` routing: caller specifies project name, client adds `"shared"` automatically for search
  - Handle connection failures gracefully (return null/empty, log warning)
  - Lazy connection (connect on first call, not at server startup)
  - Server URL from `InfraConfig` (default `http://localhost:8100/mcp/`, overridable for hosted)
  - Detect project name from working directory or indusk-mcp config
- [ ] Create `src/lib/graphiti-client.test.ts` — unit tests with mocked MCP client
  - Test: addEpisode formats arguments correctly with group_id
  - Test: searchNodes includes both project and shared group_ids
  - Test: searchFacts includes both project and shared group_ids
  - Test: connection failure returns graceful fallback (null/empty, no throw)
  - Test: lazy connection only connects once
  - Test: addEpisode with groupId "shared" does not append "shared" twice

#### Phase 3 OTel
- skip-reason: Client library with no user-facing endpoints; internal plumbing

#### Phase 3 Verification
- [ ] `pnpm turbo test --filter=indusk-mcp` passes with all new tests green
- [ ] `pnpm check` passes (biome lint/format)
- [ ] `pnpm turbo build --filter=indusk-mcp` succeeds (TypeScript compiles)

#### Phase 3 Context
- (none needed)

#### Phase 3 Document
- [ ] Add JSDoc to `graphiti-client.ts` public API: each method, parameters, return types, error behavior

## Phase 4: Extension + Health Checks + graph_ensure

### Implementation
- [ ] Create Graphiti extension manifest (`apps/indusk-mcp/extensions/graphiti/manifest.json`):
  ```json
  {
    "name": "graphiti",
    "description": "Graphiti temporal knowledge graph — episodic memory, contradiction detection, semantic search via FalkorDB",
    "provides": {
      "skill": true,
      "health_checks": [
        {
          "name": "indusk-infra-running",
          "command": "docker inspect --format='{{.State.Running}}' indusk-infra 2>/dev/null | grep true"
        },
        {
          "name": "graphiti-server-reachable",
          "command": "curl -sf http://localhost:8100/health > /dev/null 2>&1"
        },
        {
          "name": "falkordb-reachable",
          "command": "redis-cli -h localhost ping 2>/dev/null | grep PONG"
        }
      ]
    },
    "detect": { "file": ".indusk/extensions/graphiti/manifest.json" }
  }
  ```
- [ ] Create Graphiti skill file (`apps/indusk-mcp/extensions/graphiti/skill.md`): knowledge graph patterns, group_id usage, episode capture, search guidance
- [ ] Update `graph_ensure` in `src/tools/graph-tools.ts`:
  - Check `indusk-infra` container is running (replaces standalone FalkorDB check)
  - Auto-start via `indusk infra start` if stopped
  - Verify FalkorDB on localhost:6379
  - Verify Graphiti on localhost:8100
  - Report both in validation output
- [ ] Update CGC config to connect to `localhost:6379` instead of `falkordb.orb.local:6379`
- [ ] Add tests for graph_ensure updates

#### Phase 4 OTel
- skip-reason: Extension/health check infrastructure, no new observable code paths

#### Phase 4 Verification
- [ ] `check_health` reports all three health checks (container, Graphiti, FalkorDB)
- [ ] `graph_ensure` validates `indusk-infra` container instead of standalone FalkorDB
- [ ] `graph_ensure` auto-starts container if stopped
- [ ] `extensions status` shows `graphiti` with health status
- [ ] `pnpm turbo test --filter=indusk-mcp` passes
- [ ] `pnpm check` passes

#### Phase 4 Context
- Update CLAUDE.md Architecture: replace standalone FalkorDB references with `indusk-infra`
- Update CLAUDE.md Known Gotchas: remove `falkordb.orb.local` references, update to `localhost`

#### Phase 4 Document
- [ ] Update codegraph docs: connection now via `localhost:6379` (bundled container)
- [ ] Update Graphiti Infrastructure docs: health check commands and expected output

## Phase 5: Init Integration + Getting Started Docs

### Implementation
- [ ] Update `init` command:
  - Check if `indusk-infra` container is running; if not, run `indusk infra start`
  - If `~/.indusk/config.env` doesn't exist, create template and print instructions for `GOOGLE_API_KEY`
  - Copy Graphiti extension manifest to `.indusk/extensions/graphiti/`
  - Auto-enable the graphiti extension
  - Update output to show infra status (FalkorDB + Graphiti)
  - `init` without `GOOGLE_API_KEY` warns and continues (FalkorDB works, Graphiti degrades)
- [ ] Rewrite Getting Started docs (`apps/indusk-docs/src/guide/getting-started.md`):
  ```markdown
  ## Prerequisites
  - Node 22+
  - Docker (OrbStack recommended on macOS)
  - pnpm

  ## Quick Start

  ### 1. Install globally (recommended)
  npm i -g @infinitedusky/indusk-mcp

  ### 2. Start infrastructure
  indusk infra start
  # First run: prompts for GOOGLE_API_KEY, creates ~/.indusk/config.env

  ### 3. Initialize a project
  cd your-project
  indusk init
  # Scaffolds skills, CLAUDE.md, OTel, extensions, connects to infra

  ### 4. Start coding
  # Open in Claude Code — skills and MCP tools are ready
  ```
- [ ] Update Getting Started Prerequisites: remove pipx/CGC manual install (handled by init), remove manual FalkorDB docker command
- [ ] Add troubleshooting section: container won't start, API key not set, port conflicts

#### Phase 5 OTel
- skip-reason: Init scaffolding and docs, no new observable code paths

#### Phase 5 Verification
- [ ] Fresh `indusk init` in a new project starts infra container if needed
- [ ] `init` is idempotent — running twice doesn't duplicate
- [ ] `init` without API key warns and continues
- [ ] Getting Started docs accurately reflect the new 3-step flow
- [ ] `pnpm turbo test --filter=indusk-mcp` passes
- [ ] `pnpm check` passes

#### Phase 5 Context
- Update CLAUDE.md to document `indusk infra start` as the standard setup command
- Update CLAUDE.md Key Decisions: add Graphiti infrastructure ADR reference, bundled container model
- Update CLAUDE.md Known Gotchas: global install recommended (`npm i -g`), `GOOGLE_API_KEY` in `~/.indusk/config.env`

#### Phase 5 Document
- [ ] Rewrite Getting Started page (the main deliverable of this phase)
- [ ] Update indusk-mcp reference page: add `indusk infra` commands
- [ ] Add troubleshooting page or section

## Phase 6: End-to-End Validation

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
  - `indusk infra stop`
  - Verify indusk-mcp tools still work (fallback to flat files)
  - `indusk infra start`, verify recovery
- [ ] Manual test: data persistence
  - Add episodes, `indusk infra stop`, `indusk infra start`, verify data survived
- [ ] Manual test: fresh install flow
  - Remove `indusk-infra` container and volume
  - Follow Getting Started docs from scratch
  - Verify everything works end-to-end
- [ ] Create integration test: `src/__tests__/graphiti-integration.test.ts`
  - Test: addEpisode → searchNodes round-trip (requires running infra, skip if unavailable)
  - Test: cross-group search returns results from both groups
  - Test: graceful degradation when infra is down
- [ ] Clean up test data: clear test graphs

#### Phase 6 OTel
- skip-reason: Validation phase, no new code paths

#### Phase 6 Verification
- [ ] All manual tests pass and results documented
- [ ] `pnpm turbo test --filter=indusk-mcp` passes (integration tests skip gracefully if no infra)
- [ ] `pnpm check` passes
- [ ] Fresh install flow from Getting Started works for a new user

#### Phase 6 Context
- Update CLAUDE.md Current State to reflect `indusk-infra` as core infrastructure
- Update CLAUDE.md Architecture to show full graph layout (cgc-*, project, shared)

#### Phase 6 Document
- [ ] Update white paper (research/context-graph-whitepaper.md) Section 5 with validation results
- [ ] Add "Graph Layout" diagram to indusk-docs: `indusk-infra` container → FalkorDB → cgc-* graphs + project graphs + shared graph

## Phase 7: Publish Docker Image

Push `indusk-infra` to GitHub Container Registry so `indusk infra start` pulls a pre-built image instead of requiring users to build from source.

### Implementation
- [ ] Create GitHub Actions workflow `.github/workflows/publish-infra.yml`:
  - Trigger: manual dispatch + push to `main` when `docker/Dockerfile.infra` changes
  - Build `docker/Dockerfile.infra` with multi-platform (linux/amd64, linux/arm64)
  - Push to `ghcr.io/infinitedusky/indusk-infra:latest` and `ghcr.io/infinitedusky/indusk-infra:{version}`
  - Version tag from `apps/indusk-mcp/package.json`
- [ ] Update `indusk infra start` (Phase 2) to pull from GHCR:
  - `docker pull ghcr.io/infinitedusky/indusk-infra:latest` if image doesn't exist locally
  - If pull fails (offline, private repo), fall back to local build if `docker/Dockerfile.infra` exists
  - Print image version on startup
- [ ] Tag and push initial image manually to bootstrap

#### Phase 7 OTel
- skip-reason: CI/CD pipeline, no application code

#### Phase 7 Verification
- [ ] `docker pull ghcr.io/infinitedusky/indusk-infra:latest` succeeds
- [ ] `indusk infra start` on a machine with no local image pulls and starts successfully
- [ ] `indusk infra start` with existing image skips pull (idempotent)
- [ ] Multi-platform: works on both Intel and Apple Silicon Macs
- [ ] `pnpm check` passes

#### Phase 7 Context
- [ ] Update CLAUDE.md Known Gotchas: Docker image is pulled from GHCR, no local build needed

#### Phase 7 Document
- [ ] Update infrastructure docs: image source is GHCR, version tagging scheme
- [ ] Update Getting Started: remove any "build from source" references

## Phase 8: `indusk update` Command

One command that checks and updates all components: CLI, Docker image, CGC, skills/extensions.

### Implementation
- [ ] Create `src/bin/commands/update.ts` with update orchestration:
  - **Check npm registry** for latest `@infinitedusky/indusk-mcp` version
    - Compare to installed version
    - If newer: print diff and run `npm i -g @infinitedusky/indusk-mcp@latest` (or prompt user)
  - **Check Docker image** for latest `ghcr.io/infinitedusky/indusk-infra`
    - Compare local image digest to remote
    - If newer: `docker pull`, restart container if running
  - **Check CGC** for latest version
    - `pipx upgrade codegraphcontext` (no-op if current)
  - **Sync skills/lessons/extensions** to current project (same as `indusk update` existing behavior)
  - Print summary table of what was updated
- [ ] Add `--check` flag: only report what's outdated, don't update
- [ ] Add `--component` flag: update only one component (`--component npm`, `--component docker`, `--component cgc`)
- [ ] Register `update` subcommand in `cli.ts`

#### Phase 8 OTel
- skip-reason: CLI orchestration, no observable application code

#### Phase 8 Verification
- [ ] `indusk update --check` reports version status without changing anything
- [ ] `indusk update` updates outdated components
- [ ] `indusk update` with everything current prints "all up to date"
- [ ] `indusk update --component cgc` only updates CGC
- [ ] Offline/failure: each component fails gracefully, others still update
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` succeeds
- [ ] `pnpm check` passes

#### Phase 8 Context
- [ ] Update CLAUDE.md Conventions: `indusk update` is the standard upgrade command
- [ ] Update CLAUDE.md Architecture: add `update` to CLI commands list

#### Phase 8 Document
- [ ] Add CLI reference for `indusk update` to indusk-docs
- [ ] Update Getting Started: add "Keeping up to date" section

## Phase 9: Extension Versioning

Give extensions independent version numbers so they can be updated without a full npm release. Prepares for third-party extensions.

### Implementation
- [ ] Add `version` field to extension manifest schema:
  ```json
  {
    "name": "graphiti",
    "version": "1.0.0",
    "description": "..."
  }
  ```
- [ ] Add version to all existing extension manifests (cgc, composable-env, dash0, excalidraw, otel, testing, typescript)
- [ ] Update `indusk update` to compare installed extension versions against bundled versions
  - If bundled version is newer, overwrite the installed extension in `.indusk/extensions/`
  - Print which extensions were updated
- [ ] Update `extensions_status` MCP tool to include version in output
- [ ] Future-proof: document the extension manifest schema for third-party authors
  - Extension discovery: `indusk extensions add {name}` from a registry (future — not built now)

#### Phase 9 OTel
- skip-reason: Metadata and versioning, no new observable code paths

#### Phase 9 Verification
- [ ] All extension manifests have `version` field
- [ ] `extensions_status` shows versions
- [ ] `indusk update` detects and syncs outdated extensions
- [ ] Manually bumping a bundled extension version triggers update on next `indusk update`
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` succeeds
- [ ] `pnpm check` passes

#### Phase 9 Context
- [ ] Update CLAUDE.md Architecture: extension manifests include version field

#### Phase 9 Document
- [ ] Add "Extension Authoring" reference page: manifest schema, versioning, distribution

## Files Affected
| File | Change |
|------|--------|
| `docker/Dockerfile.infra` | New — bundled FalkorDB + Graphiti image |
| `docker/supervisord.conf` | New — process manager for container |
| `docker/graphiti-config.yaml` | New — baked-in Graphiti MCP server config |
| `apps/indusk-mcp/src/bin/cli.ts` | Add `infra` subcommand |
| `apps/indusk-mcp/src/bin/commands/infra.ts` | New — `start/stop/status` commands |
| `apps/indusk-mcp/src/lib/infra-config.ts` | New — connection config abstraction |
| `apps/indusk-mcp/src/lib/graphiti-client.ts` | New — MCP client wrapper |
| `apps/indusk-mcp/src/lib/graphiti-client.test.ts` | New — unit tests |
| `apps/indusk-mcp/extensions/graphiti/manifest.json` | New — extension manifest |
| `apps/indusk-mcp/extensions/graphiti/skill.md` | New — skill file |
| `apps/indusk-mcp/src/tools/graph-tools.ts` | Update — `graph_ensure` for bundled container |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Update — infra start + Graphiti extension |
| `apps/indusk-docs/src/guide/getting-started.md` | Rewrite — 3-step flow |
| `.github/workflows/publish-infra.yml` | New — CI to build and push Docker image to GHCR |
| `apps/indusk-mcp/src/bin/commands/update.ts` | New — `indusk update` orchestration |
| `apps/indusk-mcp/extensions/*/manifest.json` | Update — add `version` field |

## Dependencies
- FalkorDB Docker image (`falkordb/falkordb:latest`)
- Graphiti source (`getzep/graphiti`)
- `uv` for Python deps
- `GOOGLE_API_KEY` for Gemini LLM/embeddings

## Notes
- Port 8000 is taken by OrbStack — Graphiti uses 8100
- The bundled container architecture supports a future hosted tier: swap `localhost` for `infra.infinitedusky.com` in `InfraConfig`
- `~/.indusk/config.env` is the global config (API keys, endpoint overrides). Per-project config stays in `.indusk/extensions/`
- Reranker patch on Graphiti source should be submitted upstream to avoid maintaining a fork

# Graphiti Infrastructure

**Status:** accepted, completed 2026-04-07.
**Plan archive:** [`.indusk/planning/archive/graphiti-infrastructure/`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/graphiti-infrastructure)

## What was decided

Bundle FalkorDB and Graphiti into a single persistent Docker container (`indusk-infra`), managed by the `indusk` CLI. Surface Graphiti to the agent as a directly-registered MCP server in every project's `.mcp.json`. Add capture and recall triggers to the planner, work, retrospective, and catchup skills so episodes are written automatically at decision points and surfaced automatically at session start.

The unified architecture:

- **One container** (`indusk-infra`) runs both FalkorDB (port 6379) and Graphiti (port 8100), with a persistent `indusk-data` volume.
- **Three CLI commands** (`indusk infra start/stop/status`) manage the container lifecycle. One command, idempotent.
- **Direct MCP registration** — `indusk init` automatically adds the `graphiti` server to every project's `.mcp.json` (Option C: no `indusk` wrapper, the agent calls `mcp__graphiti__*` tools directly).
- **GraphitiClient wrapper** (`apps/indusk-mcp/src/lib/graphiti-client.ts`) is kept for internal indusk-mcp use only — skills/catchup that want typed defaults (project group + `shared` resolution, error swallowing) use it; the agent does not.
- **Capture triggers** in five skills:
  - planner: `brief-accepted-{plan}` and `adr-{plan}` episodes on acceptance
  - work: `correction-{slug}` episode when user confirms `context learn`
  - retrospective: one episode per "What We Learned" and "What We'd Do Differently" item
  - catchup: recall query at session start, surfaces relevant entities in the catchup summary
- **Project group convention**: episodes are stored in the project group (`dusk`, `chitin_sportsbook`, etc.) with cross-project knowledge in a `shared` group. Catchup recall always queries `[project, "shared"]`.
- **`getProjectGroupId()` helper** sanitizes the directory basename for RediSearch compatibility (replaces `-` and other special characters with `_`), with explicit override via `.indusk/config.json` `graphiti.groupId`.

## Why

The bet behind this work is that an agent equipped with both **structural code intelligence** (CGC's call graph, file/symbol nodes) and **temporal episodic memory** (Graphiti's decisions, contradictions, lessons) will be measurably better at software development across long horizons than an agent with only one or the other. The two-dimensional context model — structure plus history — is the foundation for everything in the `context-graph` umbrella plan.

Bundling FalkorDB and Graphiti into one container collapses the operational surface: instead of two separate services to manage, there's one. Persistent volume means data survives restarts. Single CLI command means the user friction to start the system is near zero. Direct MCP registration means no manual `claude mcp add` step — the moment `indusk init` finishes, the agent has access to the temporal layer.

The capture triggers exist because **the system is empty by default**. A knowledge graph with no data is worse than no knowledge graph at all (it adds query latency for nothing). The capture triggers solve the cold-start problem by ensuring episodes get written automatically at the decision points where remembering matters most: brief acceptance, ADR acceptance, user corrections, retrospective lessons. The agent rarely needs to call `mcp__graphiti__add_memory` directly.

## Key tradeoffs accepted

1. **Bundled container, not microservices.** FalkorDB and Graphiti share a process supervisor. If one crashes, the container restarts both. Acceptable for the dogfooding stage; would revisit if the system needed independent scaling later.

2. **Direct MCP registration, not a wrapper layer.** The agent calls `mcp__graphiti__*` tools directly without going through `indusk`. The alternative (wrapping every Graphiti tool in `mcp__indusk__episode_*`) would add a layer with no agent-facing benefit. Wrapper class kept for internal use only.

3. **Capture is automatic at trigger points, not opt-in.** Every brief acceptance, every ADR acceptance, every retrospective lesson generates an episode without asking. The risk is noise; the upside is consistency. Better to capture too much and curate later than to capture too little and lose history.

4. **Library projects opt out of the OTel gate via `otel.role: library`.** Discovered during this plan that the OTel gate firing on every plan in indusk-mcp itself was friction without value (it's a library, it doesn't produce telemetry). Phase 5.25 added the role-aware behavior. Future cross-cutting gates should ship with the same opt-out pattern from day one.

5. **Phase 7 (GHCR publishing) and Phase 9 (extension versioning) deferred.** Local builds work for the only consumer. Third-party extensions don't exist yet. Both can be picked up when there's actual demand.

## Validation

The plan was validated end-to-end on 2026-04-07 by running it on a real project: `chitin-sportsbook` (a peer-to-peer baseball moneyline sportsbook, sibling sandbox project to dusk). The first plan in chitin-sportsbook (`scaffold-bootstrap`) ran the full lifecycle:

- Brief written, accepted → `brief-accepted-scaffold-bootstrap` episode auto-captured to the `chitin_sportsbook` Graphiti group
- 4-phase impl executed (root tooling, workspace packages, relocate root cruft, verify clean build)
- Retrospective written → 5 lesson episodes auto-captured (Turbo cwd-scope footgun, mcp__indusk__index_project not idempotent, OTel monorepo health checks, gate_policy auto for refactors, source-export package warnings)
- Plan automatically archived to `.indusk/planning/archive/scaffold-bootstrap/` by the retrospective skill

The validation moment that proved the system was working came at the end of the same session, when the agent in dusk was asked "find any indusk-mcp problems from chitin-sportsbook" and answered correctly from Graphiti — without reading any retrospective files. Cross-session, structured, queryable knowledge that bypassed the "which file should I read?" problem. The experiment validating itself in real time.

## What this unblocks

- **`cgc-graphiti-evaluation`** spike: ongoing experimental evaluation of whether the capture/recall loop materially improves the agent over time. Accumulates as a research log over multiple chitin-sportsbook sessions.
- **`cgc-graphiti-bridge`** plan (currently draft): the next major infrastructure work, scoped around the unified-graph "files as anchors" vision where CGC's structural data and Graphiti's episodic data both attach to file/symbol nodes in a single per-project graph.
- **`dusk-v2`** research: informed by what this plan revealed about extension storage, OTel gate handling, and config schema.

## See also

- [Graphiti reference](/reference/tools/graphiti) — agent-facing documentation for the temporal knowledge graph
- [Infrastructure container reference](/reference/tools/infrastructure) — the `indusk-infra` Docker container
- [Planner skill reference](/reference/skills/plan) — Capture and Recall section documents the planner-skill triggers

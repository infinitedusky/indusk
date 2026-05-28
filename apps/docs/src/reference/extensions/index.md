# Extensions

InDusk extensions are opt-in (or required-by-default) modules that ship a manifest, an agent-facing skill, and optionally an MCP server, env template, or health check. They activate based on project tech (`detect:` rules), explicit user opt-in (`indusk extensions enable {name}`), or required-by-default rules at init time.

This page is the index of every shipped extension. For setup details, follow the link in each row to that extension's reference page or skill content. For the runtime list of which extensions are enabled in a given project, call `mcp__indusk__extensions_status`.

## Decision matrix — which extension for what problem?

When extensions overlap on problem space, this table tells you which one to reach for.

| Problem | Pick |
|---|---|
| Query staging/prod logs/traces/metrics from a Datadog account | [`datadog`](#datadog) |
| Query staging/prod logs/traces/metrics from a Dash0 account | [`dash0`](#dash0) |
| Local-only OTel during dev (no SaaS account, no internet) | [`local-telemetry`](#local-telemetry) |
| Add OpenTelemetry instrumentation to your service | [`otel`](#otel) (emit side, not query side) |
| Coordinate work via Asana (tasks, projects, comments) | [`asana`](#asana) |
| Check a PR/MR/CL for unresolved comments + failing checks; fix and resolve | [`check-pr`](#check-pr) |
| Loop a PR through Greptile until 5/5 confidence + zero comments | [`greploop`](#greploop) |
| Walk code structure (callers, callees, dead code) | [`cgc`](#cgc) |
| Persist episodic memory across sessions (decisions, lessons, contradictions) | [`graphiti`](#graphiti) |
| Run FalkorDB locally for `cgc` or `graphiti` | [`falkordb`](#falkordb) |
| Visualize a graph (semantic-graph dashboard, network diagrams) | [`sigma`](#sigma) |
| Drive a browser, run Lighthouse, capture network requests | [`chrome-devtools`](#chrome-devtools) |
| Sketch hand-drawn architecture diagrams in a session | [`excalidraw`](#excalidraw) |
| Author docs site with Mermaid + FullscreenDiagram | [`vitepress`](#vitepress) |
| Build / debug Dockerfiles, multi-stage builds | [`docker`](#docker) |
| Author Next.js 13+ App Router code | [`nextjs`](#nextjs) |
| Author React components | [`react`](#react) |
| Author Solidity contracts | [`solidity`](#solidity) |
| Style with Tailwind | [`tailwind`](#tailwind) |
| Write Vitest / Jest tests | [`testing`](#testing) |
| Write TypeScript with strict mode | [`typescript`](#typescript) |
| Manage multiple worktrees in a workbench-shaped project (one `.indusk/` across worktrees) | [`worktree`](#worktree) |

## Observability — query side

These extensions configure how Claude *queries* your service's telemetry. They do NOT configure how your services emit telemetry — that's the [`otel`](#otel) skill plus your project's env-management setup. The split is deliberate: the same Claude Code session can query staging/prod data while dev services point at a local daemon.

`dash0` and `datadog` are mutually exclusive in practice (you don't run both vendors). `local-telemetry` is orthogonal — useful in dev even when staging/prod uses Dash0 or Datadog.

### `dash0`

Dash0 SaaS — query logs, traces, metrics, dashboards. Bearer token auth via `DASH0_AUTH_TOKEN` in `.env`. Includes a CLI (`brew install dash0hq/dash0-cli/dash0`) for terminal-side workflows. **When**: project ships telemetry to Dash0.

### `datadog`

Datadog SaaS — 16+ MCP tools across APM, Logs, Metrics, Monitors, Dashboards, Security Signals, Error Tracking, Feature Flags, DBM, LLM Observability. OAuth on first session launch (no token in env). Regional endpoints (US1/US3/US5/EU1/AP1/US1-FED). **When**: project ships telemetry to Datadog.

### `local-telemetry`

Native Jaeger + OTel Collector daemon running on localhost — agent-queryable via MCP tools. No SaaS account, no internet. **When**: dev-time only — fast "why did this just fail" diagnosis without leaving the machine.

## Observability — emit side

### `otel`

OpenTelemetry instrumentation patterns — auto-instrumentation, Pino structured logging, category-based filtering. Skill-only; no MCP server, no env. **When**: adding telemetry to a service for the first time, or tightening existing telemetry. Pairs with whichever query-side extension you use (`dash0`, `datadog`, `local-telemetry`).

## Project management

### `asana`

Asana Work Graph — tasks, projects, sections, comments, custom fields, time tracking. Official V2 remote MCP server, OAuth 2.0 with PKCE. Tokens scoped to MCP only (not reusable with the Asana REST API), 1-hour expiry, refresh tokens handle renewal. All actions appear as the authorizing user; bounded by their existing Asana permissions. **When**: coordinating work via Asana; cross-referencing PRs to tasks; pulling task spec/comments into context for code work.

## PR review workflows

Both extensions adapted from [greptileai/skills](https://github.com/greptileai/skills) (MIT-licensed). Each auto-detects the platform (GitHub, GitLab, or Perforce) from the environment. Skill-only — no MCP server. Manual enable via `indusk extensions enable check-pr` / `indusk extensions enable greploop`.

### `check-pr`

Check a PR/MR/CL for unresolved review comments, failing status checks, and incomplete description; categorize issues as actionable or informational, optionally fix and resolve threads. Works with `gh` (GitHub), `glab` (GitLab), or `p4` (Perforce) CLIs — no Greptile account required. **When**: addressing review feedback before merge; verifying a PR is ready to ship.

### `greploop`

Iteratively trigger Greptile review, fix actionable comments, push/re-shelve, re-review — until 5/5 confidence with zero unresolved comments (max 5 iterations). **Requires the Greptile bot installed on the repo** (the SaaS reviewer). **When**: project uses Greptile and you want to fully optimize a PR against its review standards. If you don't use Greptile, use [`check-pr`](#check-pr) instead.

## Code intelligence

### `cgc`

CodeGraphContext — structural code intelligence (callers, callees, dead code, dependency graphs) backed by FalkorDB. Required-by-default infrastructure for InDusk's blast-radius checks. **When**: investigating what depends on a file before changing it; hunting dead code; auditing unused exports.

### `graphiti`

Temporal knowledge graph — episodic memory across sessions, contradiction detection, semantic search. Backed by FalkorDB. The eval agent writes structured episodes here at trigger points (brief acceptance, ADR acceptance, retro lessons). **When**: cross-session context retention; querying past decisions; surfacing contradicted facts.

### `sigma`

Sigma.js WebGL graph visualization — used for the semantic-graph admin UI dashboard. **When**: rendering large semantic graphs in admin UI / dashboards.

### `falkordb`

FalkorDB graph database — shared global OrbStack container. Backs both `cgc` and `graphiti`. **When**: infrastructure for the above two.

## Browser & web automation

### `chrome-devtools`

Browser automation via Chrome DevTools MCP — performance traces with CrUX data, Lighthouse audits, network inspection, screenshots, JavaScript console access. **When**: investigating a UI bug, running a Lighthouse audit, capturing network requests for a flaky integration, taking screenshots for a bug report.

## Diagrams & docs

### `excalidraw`

Hand-drawn diagrams in chat via Excalidraw MCP. **When**: conceptual sketches, debug illustrations, architecture visuals that don't need formal Mermaid syntax. Pairs with `vitepress` for embedding diagrams in docs pages.

### `vitepress`

VitePress patterns — Mermaid diagram conventions, sidebar config, FullscreenDiagram component (clickable expand-to-modal viewer with pan/zoom). Skill-only knowledge for docs authoring. **When**: authoring docs site content.

## Development workflow

### `worktree`

Per-repo worktree management for workbench-shaped indusk projects. One `.indusk/` at the workbench root survives worktree create/destroy without state being duplicated, merged across worktrees, or silently lost. Bare `pnpm wt <slug> <cmd>` is the execution surface; `composeProjectName` in `ce.json` enables cross-cwd docker-compose targeting (one stack per repo). **When**: multi-worktree work on a wrapped repo where `.indusk/` state (plans, eval, highlights, config) must NOT be duplicated or lost across worktrees. **Status**: under active development on the `indusk-worktree-extension` plan; full surface ships across Phases 2–7. **Don't enable on single-repo projects** — assumes `production/<repo>` + `worktrees/` directories exist.

## Domain / framework skills (skill-only)

These extensions ship just a `skill.md` — no MCP server, no env config, no health checks. They're pure agent-facing knowledge that activates when the project uses the relevant tech.

### `docker`

Multi-stage builds, layer caching, security best practices, Alpine gotchas. **When**: project has a Dockerfile.

### `nextjs`

Next.js 13+ App Router, server components, caching, performance patterns. **When**: project uses Next.js 13+.

### `react`

Hooks, component composition, state management, common anti-patterns. **When**: project uses React.

### `solidity`

Smart contract patterns — reentrancy, overflow, gas optimization, OpenZeppelin conventions. **When**: project has Solidity contracts.

### `tailwind`

Utility-first CSS, responsive design, dark mode, common gotchas. **When**: project uses Tailwind.

### `testing`

Arrange-act-assert structure, test isolation, mocking patterns, common gotchas. **When**: project has tests.

### `typescript`

Strict mode, generics, discriminated unions, common gotchas. **When**: project uses TypeScript.

## How extensions are wired

A complete extension has at minimum a `manifest.json` and `skill.md`. Extensions with runtime config (auth tokens, endpoint URLs) also ship `.env.example` as a template that's copied to `.indusk/extensions/{name}/.env` on enable.

For the full extension authoring schema (manifest fields, `required: true` flag, `mcp_server` config, hooks), see [`extension-spec.md`](../extension-spec.md).

## Adding a new extension

1. Create `apps/indusk-mcp/extensions/{name}/` with `manifest.json` + `skill.md` (+ `.env.example` if needed).
2. If wrapping an MCP server, add the `mcp_server` block to the manifest.
3. Add an entry to this index page AND to the internal index at [`apps/indusk-mcp/extensions/README.md`](https://github.com/your-org/indusk-mcp/blob/main/apps/indusk-mcp/extensions/README.md).
4. If the new extension belongs in a problem space with existing alternatives (e.g., a third observability vendor), update the relevant sibling skills' "See Also" sections to cross-reference.
5. If `required: true`, add to `lib/extension-loader.ts`'s default-enabled list and ensure `update.ts` migrates pre-existing projects.

Don't add an extension without updating this index — the cost of authoring the extension is small (~3 files), but the cost of leaving the catalog out of sync is real (silent unfindability for future agents).

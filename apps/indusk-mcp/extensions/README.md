# InDusk Extensions — Index

This directory holds InDusk extensions: opt-in (or required-by-default) modules that ship a manifest, an agent-facing skill, and optionally an MCP server registration, env template, or health-check command.

This index lists every shipped extension with a one-line summary and "when to use" guidance. For setup details on any individual extension, see its `skill.md`. For the runtime list of which extensions are enabled in a given project, call `mcp__indusk__extensions_status`.

The user-facing version of this index lives at [`apps/docs/src/reference/extensions/index.md`](../../docs/src/reference/extensions/index.md) and is what gets served on the docs site.

## Decision matrix

When extensions overlap on problem space, this table tells you which one to reach for.

| Problem | Pick |
|---|---|
| Query staging/prod logs/traces/metrics from a Datadog account | `datadog` |
| Query staging/prod logs/traces/metrics from a Dash0 account | `dash0` |
| Local-only OTel during dev (no SaaS account, no internet) | `local-telemetry` |
| Add OpenTelemetry instrumentation to your service | `otel` (skill — emit side, not query side) |
| Coordinate work via Asana (tasks, projects, comments) | `asana` |
| Check a PR/MR/CL for unresolved comments + failing checks; fix and resolve | `check-pr` |
| Loop a PR through Greptile until 5/5 confidence + zero comments | `greploop` |
| Walk code structure (callers, callees, dead code) | `cgc` |
| Persist episodic memory across sessions (decisions, lessons, contradictions) | `graphiti` |
| Run FalkorDB locally for `cgc` or `graphiti` | `falkordb` |
| Visualize a graph (semantic-graph dashboard, network diagrams) | `sigma` |
| Drive a browser, run Lighthouse, capture network requests | `chrome-devtools` |
| Sketch hand-drawn architecture diagrams in a session | `excalidraw` |
| Author docs site with Mermaid + FullscreenDiagram | `vitepress` |
| Build / debug Dockerfiles, multi-stage builds | `docker` |
| Author Next.js 13+ App Router code | `nextjs` |
| Author React components | `react` |
| Author Solidity contracts | `solidity` |
| Style with Tailwind | `tailwind` |
| Write Vitest / Jest tests | `testing` |
| Write TypeScript with strict mode | `typescript` |
| Manage multiple worktrees in a workbench-shaped project (one `.indusk/` across worktrees, scripted scaffolding) | `worktree` |

## Grouped catalog

### Observability — query side (read your service's data)

| Extension | One-liner | Auth | When |
|---|---|---|---|
| `dash0` | Dash0 SaaS — logs, traces, metrics, dashboards | Bearer token in env | Project ships telemetry to Dash0 |
| `datadog` | Datadog SaaS — logs, traces, metrics, monitors, security signals (16+ tools) | OAuth (browser flow) | Project ships telemetry to Datadog |
| `local-telemetry` | Native Jaeger + OTel Collector daemon, agent-queryable via MCP | None (localhost) | Dev-time only — no internet, no SaaS account |

`dash0` and `datadog` are mutually exclusive in practice (you don't run both vendors). `local-telemetry` is orthogonal — useful in dev even when staging/prod uses Dash0 or Datadog. See each skill's "Read-side only" section for the emit-vs-query split.

### Observability — emit side (instrument your service)

| Extension | One-liner | When |
|---|---|---|
| `otel` | OpenTelemetry instrumentation patterns — auto-instrumentation, Pino logging, category filtering | Adding telemetry to a service for the first time, or tightening existing telemetry |

### Project management

| Extension | One-liner | Auth | When |
|---|---|---|---|
| `asana` | Asana Work Graph — tasks, projects, comments, custom fields | OAuth (browser flow) | Coordinating work via Asana; cross-referencing PRs to tasks |

### PR review workflows

Both adapted from [greptileai/skills](https://github.com/greptileai/skills) (MIT). Auto-detect GitHub / GitLab / Perforce from the environment.

| Extension | One-liner | Requires | When |
|---|---|---|---|
| `check-pr` | Check PR/MR/CL for unresolved comments, failing checks, incomplete description; fix and resolve threads | `gh` / `glab` / `p4` CLI authenticated | Addressing review feedback; preparing a PR for merge |
| `greploop` | Loop: trigger Greptile review, fix actionable comments, push, re-review — until 5/5 confidence | Greptile bot installed on the repo + `gh` / `glab` / `p4` | Project uses Greptile and you want to fully optimize a PR against its review standards |

`check-pr` is the general-purpose one — works whether you use Greptile or not. `greploop` is Greptile-specific (it triggers reviews from the SaaS bot).

### Code intelligence

| Extension | One-liner | When |
|---|---|---|
| `cgc` | CodeGraphContext — structural code intelligence (callers, callees, dead code) | Investigating blast radius of a change; hunting unused code |
| `graphiti` | Temporal knowledge graph — episodic memory across sessions | Cross-session context retention, contradiction detection |
| `sigma` | Sigma.js WebGL graph visualization | Rendering large semantic graphs in admin UI / dashboards |
| `falkordb` | FalkorDB graph database — shared OrbStack instance | Infrastructure for `cgc` and `graphiti` |

### Browser & web automation

| Extension | One-liner | When |
|---|---|---|
| `chrome-devtools` | Browser automation, performance traces with CrUX data, Lighthouse audits, screenshots | Investigating a UI bug, running a Lighthouse audit, capturing network requests for a flaky integration |

### Diagrams & docs

| Extension | One-liner | When |
|---|---|---|
| `excalidraw` | Hand-drawn diagrams in chat | Conceptual sketches, debug illustrations |
| `vitepress` | VitePress patterns — Mermaid diagrams, sidebar config, FullscreenDiagram | Authoring docs site content |

### Development workflow

| Extension | One-liner | When |
|---|---|---|
| `worktree` | Per-repo worktree management for workbench-shaped projects — one `.indusk/` survives worktree create/destroy; bare `pnpm wt <slug> <cmd>` execution surface; `composeProjectName` cross-cwd docker-compose targeting | Multi-worktree work on a wrapped repo where `.indusk/` state (plans, eval, highlights) must NOT be duplicated or lost across worktrees |

### Domain / framework skills (skill-only, no MCP server)

These extensions ship just a `skill.md` — no MCP server, no env config, no health checks. They're pure agent-facing knowledge that activates when the project uses the relevant tech.

| Extension | One-liner | When |
|---|---|---|
| `docker` | Multi-stage builds, layer caching, security, Alpine gotchas | Project has a Dockerfile |
| `nextjs` | App Router, server components, caching | Project uses Next.js 13+ |
| `react` | Hooks, component composition, anti-patterns | Project uses React |
| `solidity` | Reentrancy, overflow, gas optimization, OpenZeppelin | Project has Solidity contracts |
| `tailwind` | Utility-first, responsive, dark mode | Project uses Tailwind |
| `testing` | Arrange-act-assert, test isolation, mocking | Project has tests |
| `typescript` | Strict mode, generics, discriminated unions | Project uses TypeScript |

## How extensions are wired

A complete extension at minimum has:

```
extensions/{name}/
├── manifest.json    # name, description, provides, detect, mcp_server (optional), hooks (optional)
└── skill.md         # agent-facing usage guide
```

Extensions with secrets or runtime config also have:

```
├── .env.example     # template; copied to .indusk/extensions/{name}/.env on enable
```

The manifest's `provides.skill: true` opts the skill into syncing with the project's `.claude/skills/{name}/SKILL.md` on `indusk update`. The manifest's `mcp_server` block (if present) registers the extension's MCP server in the project's `.mcp.json` on `indusk extensions enable {name}` (or fresh init for required-by-default extensions). The manifest's `provides.health_checks` runs every `mcp__indusk__check_health` invocation; non-ok checks degrade catchup.

For the full schema + the `required: true` flag (auto-enable on init/update), see [`apps/docs/src/reference/extension-spec.md`](../../docs/src/reference/extension-spec.md).

## Adding a new extension

1. Create `extensions/{name}/` with `manifest.json` + `skill.md` (and `.env.example` if needed).
2. If wrapping an MCP server, add the `mcp_server` block to the manifest. Use `DASH0_AUTH_TOKEN` / `DATADOG_MCP_URL` style env-var references — these get resolved from `.env` at enable time.
3. Add an entry to this README (decision matrix + grouped catalog) AND to the docs version at `apps/docs/src/reference/extensions/index.md`.
4. If the extension belongs in a problem space that already has alternatives (e.g., a third observability vendor), update the relevant sibling skills' "See Also" sections to cross-reference the new sibling.
5. If `required: true`, add the extension to `lib/extension-loader.ts`'s default-enabled list and ensure `update.ts` migrates pre-existing projects.

The cost of an extension is small (~3 files), but the cost of LISTING an extension correctly across the catalog is real. Don't add new extensions without updating this index.

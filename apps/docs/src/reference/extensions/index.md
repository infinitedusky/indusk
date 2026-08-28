# Extensions

Extensions carry tool- and domain-specific knowledge so InDusk core never hardcodes it. Enable what a project uses; the rest stay inert.

```bash
indusk extensions list
indusk extensions enable typescript testing
indusk extensions status
```

**21 extensions ship with 1.38.3.** Only `local-telemetry` is required by default — it is the daemon InDusk itself runs. Everything else is detect-driven or opt-in.


## Language & framework patterns

| Extension | What it carries |
|---|---|
| `typescript` | TypeScript patterns — strict mode, generics, discriminated unions, common gotchas |
| `react` | React patterns — hooks, component composition, state management, anti-patterns |
| `nextjs` | Next |
| `tailwind` | Tailwind CSS patterns — utility-first, responsive, dark mode, common gotchas |
| `solidity` | Solidity patterns — security (reentrancy, overflow), gas optimization, OpenZeppelin |
| `testing` | Testing patterns — arrange-act-assert, test isolation, mocking, common gotchas |
| `docker` | Docker patterns — multi-stage builds, layer caching, security, Alpine gotchas |
| `vitepress` | VitePress patterns — Mermaid diagrams, sidebar config, frontmatter, FullscreenDiagram |

## Observability

| Extension | What it carries |
|---|---|
| `local-telemetry` **(required)** | Local OTel telemetry daemon — Jaeger + OTel Collector running natively, agent-queryable via MCP tools for fast 'why did this just fail' diagnosis |
| `otel` | OpenTelemetry instrumentation — auto-instrumentation, Pino structured logging, category-based filtering |
| `dash0` | Dash0 observability — query logs, traces, and metrics from your OpenTelemetry data via MCP and CLI |
| `datadog` | Datadog observability — query logs, traces, metrics, monitors, dashboards, security signals via Datadog's official remote MCP server (16+ tools, OAuth) |
| `posthog` | PostHog user-behavior layer — query events, persons, insights, replays, flags, errors and experiments via PostHog's remote MCP server |

## Environment & worktrees

| Extension | What it carries |
|---|---|
| `doppler` | Doppler-backed environment management — env vars from Doppler branched configs + plain docker-compose, with per-worktree auto-provisioning |
| `worktree` | Worktree management for workbench-shaped indusk projects — per-repo config, scripts that author and refresh worktrees with upstream-file-overlay support, and a `pnpm wt <slug> <cmd>` execution surface for running commands inside any worktree (env layering via the doppler extension or worktree-config copy/append; legacy composable |

## External services

| Extension | What it carries |
|---|---|
| `asana` | Asana project management — query the Asana Work Graph (tasks, projects, comments, sections, custom fields, time tracking) via Asana's official V2 remote MCP server (OAuth) |
| `chrome-devtools` | Chrome DevTools MCP — browser automation, performance traces with CrUX data, Lighthouse audits, network inspection, screenshots |
| `excalidraw` | Hand-drawn diagrams via Excalidraw MCP — conceptual sketches, architecture visuals, debug illustrations |
| `sigma` | Sigma |

## Code review

| Extension | What it carries |
|---|---|
| `check-pr` | Check a GitHub PR / GitLab MR / Perforce CL for unresolved review comments, failing status checks, and incomplete description; optionally fix and resolve threads |
| `greploop` | Iteratively fix a PR/MR/CL until Greptile gives 5/5 confidence with zero unresolved comments — trigger review, fix actionable comments, push/re-shelve, repeat (max 5 iterations) |

## Writing one

See [the extension spec](/reference/extension-spec).


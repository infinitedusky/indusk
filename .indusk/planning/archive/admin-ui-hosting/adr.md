---
title: "Admin UI Hosting"
date: 2026-04-19
status: accepted
---

# Admin UI Hosting

## Goal

**One local Node daemon hosts the admin UI for every InDusk project on the machine, started by `indusk ui start`, registered into via `indusk init` and `indusk update`, navigable via project cards on a homepage and a header switcher inside per-project pages.**

Today (1.26.0) the admin UI only works inside the dusk monorepo because the npm tarball doesn't bundle the admin app. Consumer projects like Numero get an "indusk-admin app not found" error from `indusk ui` and have no way to view their own plans. After this lands, the user runs `npm install -g @infinitedusky/indusk-mcp@1.27` once, runs `indusk ui start` from any registered project, and sees every InDusk project they've init-ed in a single browser window — switchable via header, with a cross-project scorecards view at `/scorecards`.

## Y-Statement

**In the context of:**
running the InDusk admin UI on consumer projects (Numero, chitin-sportsbook, any project that installs indusk-mcp from npm) where the user owns multiple InDusk projects on one machine and wants a single place to view their plans and cross-project signal.

**Facing:**
the broken bundling in 1.26.0 (the admin app is a workspace-only artifact, never published to npm) AND the misshapen per-project model (one dev server per project means N processes, no cross-project view, scoping friction every time the user wants to look at a different project).

**We decided for:**
a single long-lived native Node daemon — started via `indusk ui start`, persistent until reboot or `indusk ui stop` — that reads a per-user JSON registry at `~/.indusk/projects.json` and serves every registered project under `/p/[project]/...` routes, with a homepage at `/` showing a grid of project cards. The admin app ships as a pre-built Next.js production bundle inside the indusk-mcp npm tarball (variant A3 from research), so consumers never run `pnpm install` or `next build` themselves.

**And against:**
(1) keeping the per-project dev-server model and just bundling the source (variant A1) — rejected because it inherits the per-project scoping problem and adds 5–15s install latency on first start; (2) running the admin UI in a Docker container via composable.env — rejected because Docker volume mounts can't cleanly handle "projects in arbitrary paths on disk" (would force a single mounted root, which is wrong for users whose projects span multiple parent dirs); (3) a separate `@infinitedusky/indusk-admin` npm package — rejected because two packages means two version numbers, two `indusk update` round-trips, and admin/CLI version drift becomes a real failure mode.

**To achieve:**
zero-friction multi-project access ("one URL, all my projects, switchable via UI"), invisible bundling ("`npm install -g indusk-mcp` and `indusk ui start` and it works — no other commands"), and the cross-project view that was the user's original framing for scorecards as a system-improvement signal.

**Accepting:**
a tarball size growth of ~10–30 MB (one-time download cost on each `indusk update`), `next` + `react` + `react-dom` becoming production deps of indusk-mcp (large dep surface for what's nominally a CLI/MCP server), one extra CI step (`prepublishOnly` runs `pnpm --filter indusk-admin build`), no LAN-accessible mode in v1 (localhost-only, no auth), and the loss of per-project dev-mode hot-reload (the production bundle is what runs — admin app developers still get hot-reload via direct `pnpm --filter indusk-admin dev`).

**Because:**
the per-project model in 1.26.0 was a v1 misstep — it shipped a working CLI but the wrong scoping. The brief surfaced that the user wants cross-project visibility (especially for scorecards), the registry pattern is well-understood (`pm2`, `asdf`, etc.), and Node daemons via `spawn(..., { detached: true })` + PID file + port probe are a five-line standard pattern. Variant A3 is the only bundling option that satisfies test assertions A1 (start in <3s) AND A17 (zero extra tooling on a fresh install) — the alternatives each fail one of these.

## Context

This plan exists because of `indusk-admin-ui` Phase 6's known v1 limitation, surfaced concretely when the user tried to smoke the published 1.26.0 on Numero. Three observations from that conversation shaped this decision:

1. **The per-project model is wrong for actual usage.** The user has many projects; the natural mental model is "open the admin UI" not "open the admin UI for project X". A single daemon with project switching matches the mental model.
2. **Composable.env / Docker was the wrong answer.** Initial framing leaned toward containerizing because the indusk-infra (FalkorDB + Graphiti) container already uses composable.env. But Docker volume mounts assume a fixed root; the user's projects live in arbitrary paths. A native daemon that reads a registry file sidesteps this entirely.
3. **The eval scorecards framing reinforced the global-server direction.** Scorecards are system-improvement signal, not plan-specific data. They naturally want to span projects. A single daemon serving all registered projects makes `/scorecards` trivially cross-project.

Code-graph context: the changes are mid-sized — ~10 files in `apps/indusk-admin/` (route restructure), 3 new commands + 2 new libs in `apps/indusk-mcp/`, the tarball bundling change, and updates to 2 existing CLI commands (`init`, `update`). The components inside the admin app (`<PlanList>`, `<PlanDetail>`, `<Scorecards>`) are reused as-is; only the routing scaffolding around them changes.

## Decision

### CLI shape

```
indusk ui start [--port <n>] [--no-open]   # spawn daemon, open browser
indusk ui stop                              # SIGTERM + grace + SIGKILL fallback
indusk ui status                            # running? port? registered project count?
indusk ui                                   # alias for `start` (friendly)
```

### Daemon mechanics

- `spawn(["next", "start"], { cwd: bundledAdminDir, detached: true, stdio: "ignore" })` + `unref()`
- PID written to `~/.indusk/admin-ui.pid`
- Port + log path persisted to `~/.indusk/admin-ui.json`
- Logs streamed to `~/.indusk/admin-ui.log` (no rotation in v1; user can `: > ~/.indusk/admin-ui.log` if it grows)
- `status` requires both PID-file-process-alive AND port-probe-accepts before reporting "running"
- Default port 3939 (same as 1.26.0); auto-bump on conflict; persisted

### Project registry

`~/.indusk/projects.json` — single file, schema versioned:

```json
{
  "version": 1,
  "projects": [
    { "name": "dusk", "path": "/abs/path", "registeredAt": "ISO-8601", "lastSeenAt": "ISO-8601" }
  ]
}
```

- `indusk init` appends on success; basename of cwd as name; numeric suffix on collision (`-2`, `-3`)
- `indusk update` validates the path-exists invariant, updates `lastSeenAt`, adds the entry if missing
- Stale entries (path no longer on disk) are NOT auto-pruned — `/p/{name}/` for those routes returns 200 with a "needs reconfiguration" failure page

### Routing

- `/` — project grid (homepage, lists every entry from registry)
- `/p/[project]` — per-project empty state ("select a plan from the sidebar")
- `/p/[project]/plan/[name]` — plan detail (current `/plan/[name]` moved here)
- `/scorecards` — cross-project scorecards (walks every registered project's `.indusk/eval/results.log`)
- `/p/[project]/layout.tsx` — wraps per-project pages with sidebar + header dropdown switcher

Bare `indusk ui` from inside a registered project opens to `/p/{this-project}/`; from anywhere else, opens to `/`.

### Bundling — variant A3

- `prepublishOnly` in `apps/indusk-mcp/package.json` runs `pnpm --filter indusk-admin build`
- The published indusk-mcp tarball gains an `admin/` directory containing the `next build` output (`.next/` + minimal source needed to run `next start`)
- `next`, `react`, `react-dom`, `react-markdown`, `remark-gfm`, `lucide-react` move to `dependencies` of `apps/indusk-mcp/package.json` (the daemon needs them at runtime)
- The CLI's `resolveAdminDir()` is replaced by a fixed lookup at the bundled location relative to the indusk-mcp install root

### Lifecycle of stale registry entries

User-action-only resolution. The failure page surfaces:
- The registered name and path
- A note: "this project's path no longer exists. Run `indusk update` from the new location, OR remove `~/.indusk/projects.json` to start fresh"

No UI affordance to remove the entry. Discipline: registry mutations only via CLI commands.

## Alternatives Considered

### Per-project dev-server bundled into tarball (variant A1)

`indusk ui` continues to spawn a per-project Next.js dev server, but the admin app source is now bundled in the npm tarball and `pnpm install`-ed in a cache dir on first start.

**Why rejected**:
- Inherits the per-project scoping problem (no cross-project view, multiple processes)
- 5–15 second `pnpm install` latency on first `indusk ui` post-upgrade
- Requires `pnpm` (or `npm`) to be installed on every consumer machine — true today but adds an implicit dep
- Per-machine build artifacts duplicate work CI already did

### Docker container via composable.env

A new `indusk-admin` service in `docker/Dockerfile.admin`, mounted with the user's project root, served via `indusk infra start`.

**Why rejected**:
- Docker volume mounts assume a single fixed parent directory; the user's projects live in arbitrary paths
- Requires Docker on every consumer (true for users running indusk-infra, but those who don't have indusk-infra still need to install Docker for this)
- Networking through Docker → localhost adds latency vs native
- Container restart on machine boot is a Docker config concern, not solved by Docker itself

### Separate `@infinitedusky/indusk-admin` npm package

Two npm packages — CLI installs both as deps; admin app at its own version.

**Why rejected**:
- Two version numbers — drift between admin and CLI is a real failure mode
- Two `indusk update` round-trips
- The split adds release-coordination overhead with no architectural benefit (the admin app and CLI are tightly coupled by the registry shape and the daemon-spawn contract)

### Variant A4 — source + lifted deps

Source bundled in the tarball; admin app's prod deps lifted into indusk-mcp's `dependencies`.

**Why rejected**:
- Same dep-surface as A3 but with no pre-built bundle benefit
- `next` and `react` would still need to be in indusk-mcp's deps either way
- A3 strictly dominates: same dep surface, smaller runtime work (no `next build` per machine)

### Lazy npx-style download on first run

`indusk ui start` runs `npx @infinitedusky/indusk-admin@latest` to fetch and cache the admin app on first use.

**Why rejected**:
- Requires network on first run (annoying offline)
- Admin/CLI version drift is possible (admin@1.27 might not match CLI@1.26 contracts)
- Cache invalidation is a known unsolved problem in npx — users hit "stale npx cache" issues regularly

## Consequences

### Positive

- One server, multiple projects, browser-bookmarkable URL — matches the user's actual mental model
- Zero extra-tooling install: `npm install -g indusk-mcp` + `indusk ui start` is the entire ceremony
- Cross-project scorecards naturally fall out (one daemon reads every registered project's `.indusk/eval/`)
- The bundling problem is solved structurally, not patched — `apps/indusk-admin/` is shipped, period
- Per-project failure modes are isolated (a stale entry shows a failure page, doesn't break the rest of the UI)
- The CLI `start`/`stop`/`status` shape mirrors `indusk infra` — consistent mental model

### Negative

- Tarball size grows ~10–30 MB (measured during impl; capped at 50 MB by test assertion A18)
- `next` + `react` + `react-dom` in indusk-mcp's prod deps — large surface for an MCP server's package
- One extra CI step (`prepublishOnly` runs the admin build)
- The 1.26.0 per-project model is removed wholesale — anyone relying on it (no one yet, in practice) gets a breaking change
- No LAN access, no auth, no HTTPS — single-user, single-machine in v1

### Risks

- **Risk**: `next build` produces a bundle that needs platform-specific binaries (e.g., `@swc/core` native bindings) that don't survive the tarball round-trip on a different OS than where the build was run.
  - **Mitigation**: build with `--no-lint --no-mangling` or whatever flags produce a portable output. Failing that, run the build inside a node:lts Docker image during CI to ensure consistent platform. Validated in impl Phase 1.
- **Risk**: the tarball grows past the 50 MB cap.
  - **Mitigation**: profile the build output during impl Phase 1; if oversize, exclude unused Next.js features (e.g., disable image optimization since admin UI has no images), or reconsider the bundling variant.
- **Risk**: detached daemon on macOS doesn't survive terminal close due to job-control inheritance edge cases.
  - **Mitigation**: explicit `setsid`-equivalent via `process.setpgid()` or Node's `detached: true` + `unref()` + `stdio: "ignore"`. Test assertion A2 catches regressions.
- **Risk**: the user runs `indusk ui start`, then `indusk update` on a project, and the running daemon has stale registry data in memory.
  - **Mitigation**: the daemon reads the registry on every request (server-side) — it's a flat file, the read cost is negligible. No in-memory cache for v1.

## Documentation Plan

### Pages

- **Update**: `apps/indusk-docs/src/reference/admin-ui/overview.md` — replace the per-project CLI section with the daemon model (start/stop/status), explain the registry, document the homepage + per-project routing
- **New**: `apps/indusk-docs/src/reference/admin-ui/cli.md` — full CLI reference for `indusk ui start/stop/status`, exit codes, env vars, port behavior
- **Update**: `apps/indusk-docs/src/reference/admin-ui/component-conventions.md` — append a "Routing" section documenting `/p/[project]/...` scoping
- **Update**: `apps/indusk-docs/src/changelog.md` — 1.27.0 entry naming the daemon model, the registry, the breaking change from 1.26.0's per-project mode

### Diagrams

- **Architecture diagram** in `overview.md` — Mermaid sequence showing `indusk ui start` → daemon spawn → registry read → browser request → per-project file read
- **Routing tree** in `cli.md` — visualizing `/`, `/p/[project]`, `/p/[project]/plan/[name]`, `/scorecards`

### Changelog

- **1.27.0**: "Admin UI hosted as a single local daemon. New CLI: `indusk ui start/stop/status`. Multi-project via `~/.indusk/projects.json` registry, populated by `indusk init` and `indusk update`. Routes restructured to `/p/[project]/...`. **Breaking change**: 1.26.0's per-project `indusk ui` model is removed; consumers must run `indusk init` once per project to register, then `indusk ui start` from anywhere."

### ADR in Docs

Yes — publish to `apps/indusk-docs/src/decisions/admin-ui-hosting.md`. The Y-statement, the alternatives-considered (especially the Docker rejection), and the variant-A3 rationale are all worth preserving for future readers / consultants. The retrospective skill's knowledge-handoff step does this automatically.

## References

- [Research](./research.md) — bundling variant comparison, daemon mechanics, comparable patterns (`pm2 web`)
- [Brief](./brief.md) — problem framing, success criteria, scope boundaries
- [Test plan](./test-plan.md) — 18 behavioral assertions; A17 + A1 are the load-bearing tests for variant A3
- [`apps/indusk-mcp/src/bin/commands/infra.ts`](../../../apps/indusk-mcp/src/bin/commands/infra.ts) — pattern to mirror for `ui start/stop/status`
- [`apps/indusk-mcp/src/bin/commands/ui.ts`](../../../apps/indusk-mcp/src/bin/commands/ui.ts) — current per-project implementation; replaced wholesale
- [`apps/indusk-admin/`](../../../apps/indusk-admin/) — admin app; route restructure but components reused as-is
- Closest external precedent: `pm2 web` (long-lived daemon + project-like registry + web UI with per-entity scoping)

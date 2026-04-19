---
title: "Admin UI Hosting"
date: 2026-04-19
status: accepted
workflow: feature
---

# Admin UI Hosting — Brief

## Problem

`indusk-admin-ui` (1.26.0) shipped the admin app as a workspace dep of indusk-mcp, spawnable via `indusk ui` from the dusk monorepo. It works there. **It does not work anywhere else** — the npm package's `files` array doesn't include `apps/indusk-admin/`, so on a consumer project (Numero, chitin-sportsbook, anything that ran `npm install -g @infinitedusky/indusk-mcp`), `indusk ui` fails to find the admin app and exits with an error.

This is a hard blocker for the smoke that motivated the whole admin-ui plan. It also points at a deeper scoping problem: the per-project model (`indusk ui` spawns a dev server per repo) is wrong for the actual usage pattern. A user has multiple InDusk projects on their machine; they want to look at all of them in one place, switch between them, see cross-project signal (especially eval scorecards as a system-improvement view, per the framing landed earlier this session). Per-project dev servers are friction without a corresponding gain.

The fix: **one local daemon, registry of projects, project switcher in the UI**. `indusk init` and `indusk update` register the project in a global file. `indusk ui start` brings up a single Node process that serves every registered project at `/p/{name}/...`. Bundling stops mattering at the consumer level because the admin app's deps live with the daemon's install (one place, not every repo).

## Proposed Direction

**A native Node daemon — not a Docker container — backed by a per-user registry**, started and managed via three new CLI subcommands.

### CLI shape

```
indusk ui start [--port <n>] [--no-open]   # spawn daemon, open browser by default
indusk ui stop                              # SIGTERM the daemon
indusk ui status                            # is it running, what port, registered projects
indusk ui                                   # alias for `start` (friendly default)
```

Daemon is detached from the spawning shell (`spawn(..., { detached: true, stdio: "ignore" })` + `unref()`), writes its PID to `~/.indusk/admin-ui.pid` and its port + log paths to `~/.indusk/admin-ui.json`. Logs accumulate at `~/.indusk/admin-ui.log` (`tail -f`able). Runs until reboot or explicit `indusk ui stop`. `indusk ui status` reads the PID file AND probes the port — both must agree before reporting "running".

Default port: **3939** (same as the per-project model in 1.26.0). Auto-bump on conflict; persist actual port in `~/.indusk/admin-ui.json`.

### Project registry

Single JSON file at `~/.indusk/projects.json`:

```json
{
  "version": 1,
  "projects": [
    {
      "name": "dusk",
      "path": "/Users/the_dusky/code/sandbox/dusk",
      "registeredAt": "2026-04-19T20:00:00.000Z",
      "lastSeenAt": "2026-04-19T20:30:00.000Z"
    }
  ]
}
```

`indusk init` appends the project on success (basename of cwd as the name; numeric suffix on collision). `indusk update` validates the existing entry (path still exists), updates `lastSeenAt`, adds the entry if missing.

Stale entries (registered path no longer on disk) surface as a "this project needs to be reconfigured" failure page in the UI. No auto-prune, no fix-me prompt — keep the registry stable; the user reconfigures explicitly.

### Routing

The current per-project routing flattens into a project-scoped namespace:

| Current | New |
|---------|-----|
| `/` (empty state) | `/` (grid of project cards) |
| `/plan/[name]` | `/p/[project]/plan/[name]` |
| (n/a) | `/p/[project]` (per-project empty state with sidebar) |
| `/scorecards` (per-project, recently added) | `/scorecards` (cross-project, walks every registered project's results.log) |

Layout split: root `app/layout.tsx` handles global nav; new `app/p/[project]/layout.tsx` reads the registered project, renders the sidebar with the existing `<PlanList>` scoped to that project, and adds a header dropdown for switching projects.

Bare `indusk ui` from inside a registered project opens to `/p/{this-project}/`; from anywhere else, opens to `/`.

### Bundling

**Variant A3 from research: ship a pre-built Next.js production bundle in the indusk-mcp tarball.** Specifically, the published tarball gains an `admin/` directory containing the output of `next build` (the `.next/` directory + `package.json` + the minimal source needed to run `next start`). `prepublishOnly` runs `pnpm --filter indusk-admin build` before the publish.

Trade-offs accepted:
- Tarball grows by ~10–30 MB (a one-time download cost on `indusk update`)
- CI gets one more build step
- Zero start latency on `indusk ui start` (no `pnpm install` per machine)

`next` and `react` become production deps of indusk-mcp (~30 MB resolved) — the daemon needs them at runtime. Annoying but the alternative variants (A1 lazy-install, A4 lifted deps) are worse in different ways.

### Homepage cards

Each project card shows: name, last-seen-at (humanized), count of active plans, status of any in-progress plan, count of unread/unresolved eval findings (if any). Click → `/p/{name}/`. Skip last-commit summary for v1 — too much complexity for marginal value.

### Daemon discovery flow (end-to-end)

1. User on Numero runs `indusk init` (already does — the dusk-published package is at 1.26.0)
2. `init` writes `~/.indusk/projects.json` entry for Numero
3. User runs `indusk ui start` from Numero (or anywhere)
4. CLI checks PID file + port probe — daemon not running
5. CLI spawns the bundled `admin/` Next.js production build with `INDUSK_PROJECTS_REGISTRY=~/.indusk/projects.json`, detached
6. Daemon listens on 3939, serves `/` (project grid reading from registry)
7. CLI prints URL, opens browser
8. User clicks Numero card → `/p/numero/` → sidebar with Numero's plans
9. User can switch to dusk via header dropdown without restarting anything

## Context

This plan exists because of a known v1 limitation in `indusk-admin-ui` (Phase 6 explicitly flagged "v2 may switch to a built static export" — that "v2" is now). It builds on:

- The admin app itself (`apps/indusk-admin/`, ~700 lines of components) — most of it survives unchanged; the routing restructure scopes routes by project but the components inside (PlanList, PlanDetail, Scorecards) are reused as-is
- The CLI extensibility shown by `indusk infra start/stop/status` — same shape, different subject (Node process vs Docker container)
- The per-user config pattern at `~/.indusk/config.env` — `~/.indusk/projects.json` is a sibling
- The composable.env framing the user originally raised was rejected during research — Docker volume mounts can't easily handle "my projects live in arbitrary paths" without baking in a single fixed root, which would be wrong for users whose projects span multiple parent dirs

Strategic significance: this is the asset that makes the admin UI actually usable on Numero, which is the test case that motivated `indusk-admin-ui` in the first place. Without this, the admin UI is dusk-monorepo-only — defeating the demo-asset framing in master.md Arc 1.

## Scope

### In Scope

- New CLI subcommands: `indusk ui start`, `indusk ui stop`, `indusk ui status`, bare `indusk ui` as alias for `start`
- Detached Node daemon with PID file + port probe + log file + explicit lifecycle
- `~/.indusk/projects.json` registry (read/write/validate)
- `indusk init` adds the project to the registry
- `indusk update` validates + updates the registry entry
- Stale-registry failure page in the admin UI
- Route restructure: `/` (project grid), `/p/[project]/...`, `/scorecards` (cross-project)
- Header project switcher in per-project layout
- Bundling: A3 — pre-built Next.js production bundle shipped in the indusk-mcp tarball; `prepublishOnly` runs `pnpm --filter indusk-admin build`; published tarball grows by ~10–30 MB
- `next` + `react` + `react-dom` move to production deps of indusk-mcp
- Removal/replacement of the current per-project `ui()` function in `apps/indusk-mcp/src/bin/commands/ui.ts`
- Homepage cards: name, last-seen, plan count, in-progress status, unread findings count
- Updated docs page at `apps/indusk-docs/src/reference/admin-ui/overview.md` reflecting the new architecture
- Manual smoke on dusk + Numero (the plan's own existence is motivated by Numero, so the smoke is mandatory)

### Out of Scope

- LAN access / auth (v1 is localhost-only; daemon binds to 127.0.0.1; no auth)
- Auto-prune of stale registry entries (failure page is the only UI affordance)
- HTTPS / TLS (localhost-only, plain HTTP)
- Project add/remove via the UI (only `indusk init` and `indusk update` write to the registry; UI is read-only — same discipline as the rest of the admin UI)
- Daemon auto-start at login / launchd / systemd integration (user invokes explicitly via `indusk ui start`)
- Cross-machine sync of the project registry (it's per-user, per-machine)
- Last-commit summary on homepage cards (defer to v2 — needs jj/git integration on the daemon side)
- Eval-agent change to capture commit message in scorecards at write time (separate small patch — already discussed in this session)
- Migrating the existing per-project `INDUSK_PROJECT_ROOT` env var pattern (kept as fallback for the workaround command users may still need before this lands)

## Success Criteria

- `indusk ui start` from a fresh terminal on Numero (or any consumer project running indusk-mcp 1.27+) brings up the admin UI in <3s wall clock and opens the browser to a populated project grid
- The grid shows every InDusk project the user has init-ed on this machine, ordered by `lastSeenAt` desc
- Clicking a project card navigates to `/p/{name}/` and renders the same sidebar+detail experience as 1.26.0's per-project mode
- Header dropdown switches between any two registered projects without restarting the daemon
- `indusk ui stop` cleanly shuts down the daemon (SIGTERM with timeout, SIGKILL fallback); subsequent `indusk ui status` reports "not running"
- A registered project whose path was deleted/moved surfaces a "needs reconfiguration" failure page when its URL is visited, never a 500
- The daemon survives the user closing the terminal it was started from (detached cleanly)
- Numero's actual plans render correctly in the daemon — same fidelity as dusk's plans render today

## Depends On

- None at the code level. All inputs (admin app, CLI patterns, config patterns) already exist.
- One soft dependency on the eval-agent commit-message change (a separate small patch noted as out-of-scope here) — the commit-message field on scorecards looks better when persisted at write time, but the UI fallback added in this session works retroactively until that lands.

## Blocks

- The full Arc 1 demo arc (master.md plan #1's success criteria explicitly require Numero rendering correctly — without this hosting fix, Numero rendering is gated)
- `playwright-auth-pattern` (master.md plan #1.5) — that plan's "test the auth flow with a real Playwright instance" depends on the admin UI being a stable, hostable target for end-to-end tests, which the per-project model doesn't give cleanly
- The cross-project scorecards view's full value is realized once multiple projects are registered — single-project mode shows only the dusk results, missing the comparison-across-projects framing the user landed on in this session

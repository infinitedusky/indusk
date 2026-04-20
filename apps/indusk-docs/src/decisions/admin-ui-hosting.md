# Admin UI Hosting — Decision Summary

Shipped in `@infinitedusky/indusk-mcp@1.27.0` through `1.27.7`. Archived at `.indusk/planning/archive/admin-ui-hosting/` in the repo.

## The Problem

`indusk-admin-ui` shipped in 1.26.0 with a per-project hosting model: `indusk ui` in each project spawned its own `next dev` subprocess. In practice this broke under trivial multi-project use — port conflicts, no recovery path, and no way to view plans from one project without killing the admin running for another. The per-project model was a false economy: the admin UI reads the filesystem on every request, so there's no per-project state that a single daemon can't serve.

## The Decision

Replace the per-project model with a **single long-lived native Node daemon** that serves every InDusk project on the machine, backed by a machine-global project registry.

- **Lifecycle**: `indusk ui start` spawns a detached Node process running `next start`; `indusk ui stop` signals and reaps it; `indusk ui status` reports liveness + registered projects. Daemon metadata at `~/.indusk/admin-ui.{pid,json,log}`. Bare `indusk ui` is aliased to `start` with cwd-aware browser-open (inside a registered project → `/p/{this-project}/`, else → `/`).
- **Registry**: `~/.indusk/projects.json` populated by `indusk init` (append via `addProject`) and `indusk update` (validate + touch). No UI affordance for add/remove — registry mutations are CLI-only by design.
- **Routes**: restructured to `/p/[project]/...` for per-project content, `/` for the project grid. Stale registry entries (path deleted) render a 200-page `StaleProjectFailurePage` with a CLI recovery hint; never 500, never 404.
- **Bundling (variant A3)**: `prepublishOnly` runs `pnpm build && pnpm --filter indusk-admin build && node scripts/bundle-admin.js`, shipping the pre-built Next.js production output inside the indusk-mcp tarball. Consumers need zero extra tooling — no `pnpm install`, no `next build`, no workspace assumption. ~12 MB tarball under a 50 MB cap.

## Why This Shape

| Decision | Rationale |
|----------|-----------|
| **Single machine-global daemon** | The admin UI is a reader — no per-project mutable state needs isolation. One process avoids port conflicts, collapses resource cost, and gives a single upgrade path via `indusk ui restart`. |
| **Registry instead of project enumeration** | `indusk init` / `indusk update` are the natural registration touchpoints, and they already run whenever someone's setting up InDusk on a new project. The registry decouples "which projects exist" from "which projects are mounted on this machine," which is what multi-project rendering needs. |
| **Project-scoped routes (`/p/{project}/...`)** | The old single-project routes (`/plan/{name}`) couldn't disambiguate across projects. Scoping under `/p/{project}/` makes every URL self-identifying, and cross-project aggregates (originally `/scorecards`, later moved to per-project) live at distinct top-level paths. |
| **Stale-entry failure page (200)** | A registered project whose path was deleted is a configuration issue, not a server error. Returning 200 with a `StaleProjectFailurePage` that shows the recovery CLI command turns "broken deploy" into "clear next action." |
| **Bundling variant A3 (pre-built in tarball)** | Alternatives: (1) dev-server spawn in each project = the broken 1.26.0 model; (2) source workspace dep = fragile for consumers outside the monorepo; (3) separate npm package = version-drift hazard. Variant A3 — bundle the pre-built output inside indusk-mcp's own tarball — keeps indusk-mcp the only dependency consumers install and the single source of truth for admin UI version. |

## Surfaces from Falsification

The falsification dogfood on this plan (Phase 7, shipped 1.27.5) surfaced four hazards that happy-path tests didn't cover, each now hardened:

- **PID reuse**: `daemonStatus` and `daemonStop` gate on `verifyIdentity(pid, port)` = `isAlive(pid) && isPortListening(port)`. Before the fix, a recycled PID after a daemon crash would be reported as "running" (blocking `uiStart`) or SIGTERMed by `uiStop` (killing a stranger's process).
- **Silent registry data loss**: `readRegistry` quarantines malformed `projects.json` to `.corrupt.{ISO}.bak` before returning empty. Before the fix, a hand-edit typo followed by any `addProject` call would cleanly overwrite damaged data with a single-entry clean registry, destroying every prior entry.
- **Cwd walk-up regression**: `resolveOpenPath` walks up cwd's parents (capped at 40 ancestors) to find the nearest registered project. Before the fix, any invocation deeper than the project root silently fell through to `/` — `cd apps/indusk-mcp && indusk ui` opened the grid instead of the project page.
- **Admin UI falsification-phase rendering gap**: `PlanDetail` didn't know about the phase-authoring falsification flow from 1.27.4 — it only checked for the legacy `falsification.md` file. Shipped in 1.27.6 with a three-section render (pre-phases → Falsification → Follow-up Phases) that hoists the falsification phase out of the main Phases list.

Plus one discovered-during-dogfood UX polish: `<CollapsibleSection>` now persists open/closed state to `localStorage` via an optional `persistKey` prop (shipped 1.27.7). Brief sections stay closed once the user closes them, rather than re-opening on every page visit.

## What It Replaces

- The per-project `indusk ui` from 1.26.0 (removed — breaking change, no users outside dusk at ship time).
- The `/scorecards` cross-project view from 1.26.0/1.27.0 (removed in 1.27.2 — superseded by per-project `/p/{project}/scorecards`).

## Load-bearing Gotchas

Three implementation details are kept in CLAUDE.md as gotchas because missing them silently breaks the daemon:

1. **commander@13 silently drops duplicate options on subcommands** — flags live ONLY on the parent, read via `this.optsWithGlobals()`.
2. **vitest `fileParallelism: false`** in the node project — multiple HTTP smoke tests each spawn `next dev`, and parallel spawns miss "Ready in" under CPU contention.
3. **`resolveOpenPath` realpath-normalization** — macOS `/var` ↔ `/private/var` symlink asymmetry between `mkdtempSync` and `process.cwd()` breaks raw string-compare of registered paths.

## Related Plans

- Builds on `indusk-admin-ui` (1.26.0) — the first admin app, whose per-project model this plan replaced.
- Consumes `falsify-phase-authoring` (1.27.4) — Phase 7's falsification used the new flow, and Phase 8 shipped the admin UI rendering to match it.

See the archived plan at `.indusk/planning/archive/admin-ui-hosting/` for the full brief, ADR, test plan, impl (9 phases, 30 trajectory rows), and retrospective.

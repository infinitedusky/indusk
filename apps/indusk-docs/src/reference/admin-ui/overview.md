---
title: Admin UI — Overview
---

# Admin UI — Overview

The InDusk admin UI is a read-only viewer over every InDusk project's `.indusk/planning/` and `.indusk/eval/` directories. It's the first Arc 1 demo asset: a visible, demoable surface for the working agent's flow (plans, phases, trajectory rows, falsification logs, eval scorecards).

Since 1.27.0 it runs as a **single long-lived local daemon** — one Node process serves every InDusk project on your machine, not a new Next.js instance per project. You start it once with `indusk ui start`, close your terminal, and it keeps running in the background until you `indusk ui stop`.

## The daemon model

```mermaid
sequenceDiagram
    actor You
    participant CLI as indusk ui start
    participant Daemon as Admin UI daemon<br/>(detached Node)
    participant Registry as ~/.indusk/projects.json
    participant Browser
    participant FS as Project .indusk/

    You->>CLI: indusk ui start
    CLI->>CLI: check ~/.indusk/admin-ui.pid<br/>(already running? no-op)
    CLI->>Registry: read registered projects
    CLI->>Daemon: spawn detached: next start -p <port>
    Note over Daemon: writes pid, port, log<br/>to ~/.indusk/admin-ui.*
    CLI->>Browser: open http://localhost:<port><br/>(cwd-aware: /p/{project}/ or /)
    CLI-->>You: "Admin UI running at ..."<br/>(CLI exits; daemon persists)

    Browser->>Daemon: GET /p/{project}/plan/{name}
    Daemon->>Registry: resolve project name → path
    Daemon->>FS: read planning/{name}/*.md, eval/results.log
    Daemon-->>Browser: rendered plan page
```

The daemon reads `~/.indusk/projects.json` on every request, so newly `indusk init`'d projects appear without a restart. It does not watch the filesystem — each browser request re-reads from disk, which is fine at the scale of a single developer's local projects.

When you close your terminal, the daemon survives: it was spawned with `detached: true` and inherits no parent process handles. `indusk ui stop` finds it via the pid file and sends SIGTERM.

## The registry

`~/.indusk/projects.json` is the canonical list of projects the admin UI knows about. It's populated by two CLI commands:

- **`indusk init`** — appends a new entry for the project it's initializing (`addProject(projectRoot)`)
- **`indusk update`** — validates the entry exists and matches the current path, touching its `lastSeenAt` timestamp (`validateProject(name)` + `touchProject(name)`, or `addProject` if the entry is missing or diverged)

Registry entries look like:

```json
{
  "version": 1,
  "projects": {
    "dusk": {
      "path": "/Users/you/code/dusk",
      "registeredAt": "2026-04-19T...",
      "lastSeenAt": "2026-04-20T..."
    },
    "numero": { ... }
  }
}
```

No auto-pruning. If a registered project's path is deleted from disk, `indusk ui status` still lists it and `/p/{name}/` renders a **stale failure page** (HTTP 200 with a "needs reconfiguration" affordance — never 500 or 404). Recovery is user-action-only: `cd` to the project's current location and run `indusk update`, or hand-edit `~/.indusk/projects.json`. The registry is mutated only by CLI commands.

## Routing tree

```
/                        # Project grid — one card per registered project
/scorecards              # Cross-project scorecards, labeled + sorted most-recent first
/p/{project}/            # Per-project home (plan list in sidebar)
/p/{project}/plan/{name} # Plan detail page
```

Cross-project views (`/scorecards`, eventually more) stay at top-level routes. Anything project-scoped lives under `/p/{project}/...`. The per-project layout at `app/p/[project]/layout.tsx` owns the sidebar, plan list, and project switcher; the root layout (`app/layout.tsx`) is global-nav-only.

## What each page shows

**`/` (project grid)** — one card per registered project with name, path, last-seen-at, and active-plan count. Clicking a card navigates to `/p/{name}/`.

**`/p/{project}/` (per-project home)** — sidebar + empty-state main pane. Sidebar lists active plans in the order declared by that project's `.indusk/planning/master.md` pipeline tables. Plans not in `master.md` appear in an "Unordered" group. Archived plans appear in a collapsed `Archived (N)` section at the bottom. Each plan link routes to `/p/{project}/plan/{name}`. A header `<ProjectSwitcher>` lets you jump between registered projects without restarting the daemon.

**`/p/{project}/plan/{name}` (plan detail)** — sections render conditionally on which documents are present:

| Section | Source | Behavior |
|---------|--------|----------|
| Header | `name` + computed `status` | Always visible — name, archived/active marker, status badge |
| Malformed banner | `plan.malformed` | Red banner when any document failed to parse |
| Raw documents | `plan.rawDocuments` | One CollapsibleSection per malformed file with raw markdown in a `<pre>` |
| Brief | `brief.md` | Markdown rendered (`react-markdown`) |
| Test Plan | `test-plan.md` | Collapsible Markdown render |
| ADR | `adr.md` | Collapsible Markdown render |
| Phases | `impl.md` | One CollapsibleSection per `### Phase N:` heading. Each phase contains a trajectory `<Table>` (filtered to rows whose `Passes at` matches the phase number) followed by the phase's full markdown |
| Falsification | `falsification.md` | One entry per hypothesis, outcome-color-coded (`fix-in-scope` → green, `spawn-plan` → blue, `accept-finding` → gray) |
| Scorecards | `.indusk/eval/results.log` | Table of scorecards whose timestamp falls in the plan's date range (`brief.date` → `retrospective.date`/now). Most-recent first |

Missing optional documents are not errors — sections simply don't render.

**`/scorecards` (cross-project)** — flat table of every scorecard from every registered project's `.indusk/eval/results.log`, labeled with project name, sorted most-recent-first. When only one registered project has scorecards, the project label collapses (the view looks identical to 1.26.0's single-project mode).

**`/p/{deleted}/` (stale failure page)** — registered name whose path no longer exists on disk. Returns HTTP 200 with a `StaleProjectFailurePage` that shows the registered name, the old path, and the recovery command (`cd <current-path> && indusk update`). Never 500, never 404.

## How to run it

From anywhere on your machine (doesn't matter which directory):

```bash
indusk ui start
```

That spawns the detached daemon, writes pid/port/log to `~/.indusk/admin-ui.*`, and opens your default browser. If you're currently `cd`'d inside a registered project, the browser opens to `/p/{this-project}/`; otherwise it opens to `/`. Subsequent `indusk ui start` calls detect the running daemon and no-op (print the existing URL).

See [CLI reference](./cli) for `start`, `stop`, `status`, flags, exit codes, env vars, and port behavior.

## Upgrading from 1.26.0

1.26.0 shipped the broken per-project model (`indusk ui` in each project spawned its own `next dev`). 1.27.0 is a **breaking change**: run once per project to register, then start the daemon once globally.

```bash
# For each existing 1.26.0 project (already init'd with indusk)
cd ~/code/some-project
indusk update

# Then from anywhere on your machine
indusk ui start
```

New projects use `indusk init` as before — registry write happens automatically.

## What's in v1, what's in v2

**v1 (1.26.0 + 1.27.0):**
- Read-only viewer over plans + scorecards on disk
- Custom Tailwind primitives (no shadcn / no Radix)
- Server components for the data layer (no client-side fetching)
- Per-project routing under `/p/[project]/...` with cross-project `/scorecards`
- Color-coded trajectory states
- Falsification log with outcome badges
- Scorecards joined by date-range overlap (approximate — see [known gotchas in CLAUDE.md](https://github.com/infinite-dusky/dusk/blob/main/CLAUDE.md))
- Component-reuse audit (`pnpm vitest run src/__tests__/component-reuse-audit.test.ts`) catches inline JSX where a primitive exists
- Stale-entry failure page for `/p/{deleted}/` with recovery hint

**Deliberately deferred to v2 (Arc 2 / Arc 3):**
- Knowledge-graph viewer (waits for `graph-knowledge-architecture` to settle the schema)
- Test-run timeline (Arc 1 plan #2: `test-run-history`)
- Runtime telemetry (Arc 1 plan #3: `local-telemetry`)
- Cross-project polish (waits for `evaluator-structured-scorecard-output` to canonicalize scorecard schema across projects)
- Mutations (anything that writes — writes belong to the working agent)
- Auto-pruning of stale registry entries (explicit-user-action recovery is intentional in v1)
- LAN/remote access, auth, HTTPS (local-daemon-by-design)

## How it's organized

```
apps/indusk-admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Global nav only (slimmed down in 1.27.0)
│   │   ├── page.tsx                      # Project grid (/)
│   │   ├── scorecards/page.tsx           # Cross-project scorecards
│   │   └── p/[project]/
│   │       ├── layout.tsx                # Per-project sidebar + switcher
│   │       ├── page.tsx                  # Per-project home (empty state)
│   │       └── plan/[name]/page.tsx      # Plan detail
│   ├── components/
│   │   ├── ui/                           # Primitives: Button, Badge, Table, CollapsibleSection, Sidebar
│   │   ├── ProjectGrid.tsx               # Homepage card grid
│   │   ├── ProjectSwitcher.tsx           # Header dropdown
│   │   ├── StaleProjectFailurePage.tsx   # 200-page for deleted registry entries
│   │   ├── Markdown.tsx                  # react-markdown wrapper (single swap surface)
│   │   ├── PlanList.tsx                  # Sidebar list (accepts planHrefPrefix prop)
│   │   └── PlanDetail.tsx                # Main pane composition
│   ├── lib/
│   │   ├── registry-client.ts            # Reads ~/.indusk/projects.json
│   │   ├── planning-reader.ts            # Filesystem reader; reuses indusk-mcp parsers
│   │   └── phases.ts                     # Extracts Phase[] from impl markdown
│   └── __tests__/                        # vitest: node + @vitest/browser-playwright

apps/indusk-mcp/
├── src/
│   ├── bin/commands/ui.ts                # uiStart / uiStop / uiStatus
│   └── lib/admin/
│       ├── registry.ts                   # ~/.indusk/projects.json read/write/validate
│       └── daemon.ts                     # PID + port + log file management
├── scripts/bundle-admin.js               # Copies admin /.next into apps/indusk-mcp/admin/
└── admin/                                # Bundled pre-built admin (published in tarball)
```

See [Component conventions](./component-conventions) for the visual primitive discipline that `<PlanList>`, `<PlanDetail>`, and `<ProjectGrid>` consume.

## See also

- [CLI reference](./cli) — full `indusk ui start/stop/status` reference, exit codes, env vars, port behavior
- [Component conventions](./component-conventions) — the primitives, the no-shadcn rationale, the audit
- [`apps/indusk-docs/src/changelog.md`](/changelog) — the 1.26.0 and 1.27.0 entries
- [`apps/indusk-docs/src/lessons/`](/lessons) — retrospective lessons

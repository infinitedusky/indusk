---
title: "Admin UI Hosting — Research"
date: 2026-04-19
status: complete
---

# Admin UI Hosting — Research

## Question

`indusk-admin-ui` (1.26.0) ships a Next.js app that the `indusk ui` CLI subcommand spawns from `apps/indusk-admin/` in the dusk monorepo. The app works locally — but the npm package only includes `["dist", "skills", "templates", "hooks", "lessons", "extensions"]`, so when a consumer project (e.g., Numero) installs `indusk-mcp` and runs `indusk ui`, the CLI's `resolveAdminDir()` walk finds nothing and the command fails. The per-project model also creates an annoying scoping problem: the user wants to view all of their InDusk projects (and their cross-project scorecards) in one place, not start a separate dev server per repo.

This research explores **how to host the admin UI as a single, persistent, local daemon that knows about every InDusk project on the machine via a registry**, so:

- `indusk ui start` from anywhere starts one server, accessible at a known URL forever
- `indusk init` and `indusk update` add the project to a global registry (`~/.indusk/projects.json`)
- The server's homepage is a grid of registered projects; per-project routes (`/p/{name}/...`) reuse the existing `<PlanList>` and `<PlanDetail>` components scoped to one project
- Bundling the admin app stops being a per-consumer problem because the daemon's install (one place) carries the admin app's deps

## Findings

### Comparable patterns in other tools

Several CLI-installable dev tools ship a local web UI with this shape. Surveying their approaches:

- **Storybook**: ships its UI as part of the npm package; `start-storybook` boots a Webpack dev server per project. NOT a single global daemon — invokes per-project. Doesn't solve the registry / cross-project view we want.
- **Lefthook / Husky / commitlint**: pure CLI, no UI. Not relevant.
- **`npm run dev` (any framework)**: per-project. Same scoping limitation.
- **GraphiQL / Hasura console**: hosted as part of the running backend, not as a long-running standalone daemon.
- **Linear desktop / GitHub CLI's `gh repo view --web`**: open browser to a known cloud URL — different model entirely.

The closest precedent is **VS Code's window-per-project + extension-host model** (single VS Code install, opens any project) — but VS Code is a desktop app, not a daemon. The "long-running local daemon with a project registry" pattern is more common in service-discovery / observability tools:

- **Tilt, Skaffold**: developer-facing local daemons that monitor running clusters. Both run a long-lived process and expose a web UI on a known port.
- **`pm2`**: process manager with a long-lived daemon (`pm2 list`/`pm2 web`); registers processes via add commands; `~/.pm2/dump.pm2` is its registry.
- **`asdf` / `mise`**: version managers with a global config (`~/.tool-versions` as the registry); each project registers via a per-project file but is discovered via parent-walk.
- **Direnv**: per-project `.envrc` plus a global hook in the shell — different mechanism, but shows how per-project config + global runtime can coexist.

The closest match by intent is **`pm2 web`**: long-lived daemon, project-like registry, web UI with per-entity scoping. We can borrow its lifecycle model.

### Bundling a Next.js app inside an npm package

`apps/indusk-admin/` is a full Next.js 16 app with React 19, Tailwind 4, react-markdown, etc. Three sub-variants for shipping it inside the indusk-mcp tarball:

#### Variant A1 — ship source, install on first start

Pros:
- Smallest tarball (~100 KB of source + configs)
- Always uses the user's exact Node version for build artifacts

Cons:
- First `indusk ui start` after upgrade runs `pnpm install` (~5–15s wall clock if cached, much longer if not)
- Requires `pnpm` (or `npm`) to be installed on every consumer machine — this is true for indusk users today but worth flagging
- Build artifacts (`.next/`) regenerated per-machine — wasted CI work

#### Variant A3 — ship pre-built Next.js production bundle

Pros:
- Zero install delay on `indusk ui start` (just `next start` against the prebuilt `.next/`)
- Tarball is the production-built artifact — same on every machine
- No `pnpm install` needed at runtime

Cons:
- Larger tarball (~10–30 MB depending on what Next.js bakes in — needs measurement)
- CI must run `next build` against `apps/indusk-admin/` before publishing indusk-mcp (one more step in `prepublishOnly`)
- The tarball includes a `.next/` directory which is normally `.gitignore`d; needs explicit inclusion in the `files` array
- Prod runtime still needs `next` and `react` resolvable — these become production deps of indusk-mcp

#### Variant A4 — ship source, lift admin's deps into indusk-mcp's prod deps

Pros:
- No `pnpm install` at runtime
- Source-shaped tarball is small
- All deps resolvable from indusk-mcp's `node_modules/` after `npm install -g indusk-mcp`

Cons:
- indusk-mcp's `dependencies` list balloons (next, react, react-dom, react-markdown, remark-gfm, lucide-react, @tailwindcss/postcss, @tailwindcss/typography, tailwindcss, etc.) — surface area for the MCP server itself
- A separate `pnpm install` step on the consumer is replaced by a heavier `npm install -g indusk-mcp` step
- npm dedup means consumer projects already using these libs may end up with duplicates (rarely a real issue)

#### Comparison

| Variant | Tarball size | First-start latency | CI complexity | Runtime deps |
|---------|-------------|---------------------|---------------|--------------|
| A1 (source + install on start) | ~100 KB | 5–15s (if pnpm cache warm) | None | Admin's pnpm install fetches |
| A3 (pre-built bundle) | ~10–30 MB | <1s | `next build` in `prepublishOnly` | next + react via indusk-mcp deps |
| A4 (source + lifted deps) | ~100 KB + heavy deps | <1s | None | All admin deps in indusk-mcp |

A3 has the best UX trade-off — zero per-start latency at the cost of a one-time CI step and bigger downloads. A1 is friendliest to npm tarball size but pays per-machine build cost. A4 is dependency-heavy and conflates the MCP server's surface with the admin app's.

**Recommendation candidate: A3.** Validates in the brief.

### Daemon process management

Standard Node daemon pattern:
- `spawn(command, args, { detached: true, stdio: "ignore" })` to detach from parent
- `child.unref()` so the parent can exit while the child keeps running
- Write the child's PID to `~/.indusk/admin-ui.pid` for `indusk ui status` / `indusk ui stop` to find it
- Write logs to `~/.indusk/admin-ui.log` (rotating optional, `tail -f`able)
- Stop = read PID, `process.kill(pid, "SIGTERM")`, then re-check after delay; SIGKILL if still alive

Status detection — three approaches:
1. **PID file only** — read `~/.indusk/admin-ui.pid`, check if process exists (`kill(pid, 0)`)
2. **Port probe** — try to connect to known port; if accepts, daemon is up
3. **Both** — PID file gives identity; port probe confirms it's actually listening (handles stale PID files for crashed processes)

The combo (3) is most robust. PID file resolves "is THIS daemon ours?", port probe confirms "is it actually serving?". `indusk ui status` should report both.

Port assignment — fixed default (e.g., 3939) so users bookmark `http://localhost:3939/`. Auto-bump on conflict. Persist the chosen port in `~/.indusk/admin-ui.json` so `status` and `stop` know where to look.

### Registry shape — `~/.indusk/projects.json`

Proposed schema:

```json
{
  "version": 1,
  "projects": [
    {
      "name": "dusk",
      "path": "/Users/the_dusky/code/sandbox/dusk",
      "registeredAt": "2026-04-19T20:00:00.000Z",
      "lastSeenAt": "2026-04-19T20:30:00.000Z"
    },
    {
      "name": "numero",
      "path": "/Users/the_dusky/code/sandbox/numero",
      "registeredAt": "2026-04-19T20:05:00.000Z",
      "lastSeenAt": "2026-04-19T20:31:00.000Z"
    }
  ]
}
```

Name comes from the basename of the path (with collision suffix `-2` etc. if needed). `lastSeenAt` updated on every `indusk update` for that project. Stale entries (registered path no longer exists) surface as "needs reconfiguration" failure pages, per user direction — no auto-prune.

`init` writes the entry on success. `update` validates the existing entry (path still exists, basename still matches the registered name) and updates `lastSeenAt`; if the entry is missing, adds it. Collision case: if a different path already holds the registered name, generate a numeric suffix and persist the new name with a warning printed to stdout.

### Routing changes in the admin app

Current routes:
- `/` → "Select a plan" empty state
- `/plan/[name]` → plan detail
- `/scorecards` → global scorecards list (added in this session)

Proposed routes:
- `/` → grid of all registered projects (homepage with project cards)
- `/p/[project]` → that project's "Select a plan" empty state (current `/`)
- `/p/[project]/plan/[name]` → plan detail (current `/plan/[name]`, project-scoped)
- `/scorecards` → cross-project scorecards (no project scoping; reads from every registered project's `.indusk/eval/results.log`, surfaces project name on each card)

The layout's sidebar gains a header dropdown to switch projects. When on `/p/{name}/...`, the dropdown is bound to that project; when on `/` or `/scorecards`, the dropdown is unset and the sidebar shows global navigation only.

### Dynamic params and the layout

Next.js 16 server components can read route params via `params` props on pages, but the layout (in App Router) doesn't get params directly — children do. The layout will need to read the request URL via `headers()` to determine the current project for the dropdown, OR we can move the per-project layout into a `/p/[project]/layout.tsx` that wraps the per-project pages with the project switcher and plan list, leaving the root layout as the project grid + global nav.

Per-project layout pattern is cleaner — Next.js auto-passes `params.project` to the nested layout, the root layout handles global concerns, and the type system stays clean.

### Cross-project filesystem access

The daemon runs as the user, so it has read access to every registered project path. No permission magic required — the registry just tells it where to look. Each per-project request reads from the registered path; if the path doesn't exist (project moved or deleted), surface the failure page instead of throwing a 500.

### What changes in `apps/indusk-mcp/`

Per the code graph and the existing CLI structure (`apps/indusk-mcp/src/bin/cli.ts`), the changes:

- `apps/indusk-mcp/src/bin/commands/ui.ts` — replace single `ui()` function with `uiStart()`, `uiStop()`, `uiStatus()`. Bare `indusk ui` aliases to `uiStart` for friendliness.
- `apps/indusk-mcp/src/bin/commands/init.ts` — append project to `~/.indusk/projects.json` after init succeeds.
- `apps/indusk-mcp/src/bin/commands/update.ts` — validate registry entry, update `lastSeenAt`, add if missing.
- New library: `apps/indusk-mcp/src/lib/admin/registry.ts` — read/write `~/.indusk/projects.json`, collision handling, validation. Used by both `init`, `update`, and the admin app's server components.
- New library: `apps/indusk-mcp/src/lib/admin/daemon.ts` — start/stop/status helpers; PID file + port probe + log file management.
- `apps/indusk-mcp/package.json` — `files` array gains `"admin"` (or wherever the bundled admin app lives in the published tarball, depending on bundling variant choice).

### What changes in `apps/indusk-admin/`

Per the routing-changes section above:

- `src/app/page.tsx` becomes the project grid (currently the empty-state)
- New `src/app/p/[project]/layout.tsx` for per-project layout (current root layout's content moves here, scoped to one project via `params.project`)
- New `src/app/p/[project]/page.tsx` — per-project empty state (current root `page.tsx`)
- Move `src/app/plan/[name]/page.tsx` to `src/app/p/[project]/plan/[name]/page.tsx`
- Update `src/lib/project-root.ts` — `getProjectRoot()` becomes `getProjectRoot(name: string)` that looks up the registered path; throws / returns null for unregistered/stale entries
- `src/components/PlanList.tsx` — sidebar gets a project switcher above the global nav (or in a separate header component)
- `/scorecards` route updates to walk every registered project's `.indusk/eval/results.log` and label each card with its project name

Estimated scope: ~10 files modified in admin app + 3 new commands + 2 new libs in indusk-mcp + tarball bundling change. Mid-sized feature.

### Existing comparable code in dusk

- `apps/indusk-mcp/src/lib/config.ts` already manages a global config (`~/.indusk/config.env`) — pattern reusable for `~/.indusk/projects.json` and `~/.indusk/admin-ui.{pid,json}`
- `apps/indusk-mcp/src/bin/commands/infra.ts` already does daemon-style management (start/stop/status for the indusk-infra Docker container) — pattern reusable for the admin daemon, except non-Docker
- The existing `resolveAdminDir()` in `ui.ts` becomes obsolete; replaced by reading the bundled location from a published path

## Open Questions

- **A1 vs A3 vs A4 for bundling.** Recommendation candidate: A3 (pre-built bundle in tarball). Confirm in the brief; final decision in the ADR.
- **Port number.** 3939 is the current default. Should the daemon use a different fixed port to avoid conflicts with the per-project `indusk ui` model that 1.26.0 shipped (which also uses 3939)? Probably no — the per-project model is going away in this plan.
- **Behavior of bare `indusk ui` from inside a registered project.** The user's earlier preference was "just open the browser". Should it open to `/p/{this-project}/` (cwd-aware) or `/` (landing)? My lean: `/p/{this-project}/` if cwd is a registered project, else `/`.
- **What does the homepage grid look like?** Cards with project name, last-seen-at, count of plans, status of any in-progress plan. Could also show last commit summary if we have the working git/jj integration. Defer detail to brief.
- **Does the daemon need any auth?** It's localhost-only by default. v1 likely no auth. v2 if exposing to LAN, basic auth or an HMAC-signed cookie. Out of scope here.

## Sources

- Existing implementation: [`apps/indusk-mcp/src/bin/commands/ui.ts`](../../../apps/indusk-mcp/src/bin/commands/ui.ts), [`apps/indusk-mcp/src/bin/commands/infra.ts`](../../../apps/indusk-mcp/src/bin/commands/infra.ts)
- Admin app: [`apps/indusk-admin/`](../../../apps/indusk-admin/)
- Closest external precedent: `pm2 web` (long-lived daemon + registry pattern)
- Next.js App Router params propagation: docs at https://nextjs.org/docs/app/api-reference/file-conventions/layout
- Daemonization in Node: `spawn(..., { detached: true, stdio: "ignore" })` + `unref()` (standard pattern, no library needed)

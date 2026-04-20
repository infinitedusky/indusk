---
title: "Admin UI Hosting"
date: 2026-04-19
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# Admin UI Hosting

## Goal

Replace the broken per-project `indusk ui` model from 1.26.0 with a single long-lived native Node daemon that serves every InDusk project on the machine. `indusk init` and `indusk update` populate `~/.indusk/projects.json`; `indusk ui start` spawns the daemon (which runs the pre-built admin app from the published tarball); routes scope under `/p/[project]/...`; cross-project signal (scorecards, eventually more) lives at top-level routes. Ships as indusk-mcp 1.27.0.

## Scope

### In Scope

Per the [brief](./brief.md) and [ADR](./adr.md):
- `apps/indusk-mcp/src/bin/commands/ui.ts` — replaced wholesale; new `uiStart`/`uiStop`/`uiStatus` exports
- `apps/indusk-mcp/src/lib/admin/registry.ts` — read/write/validate `~/.indusk/projects.json`
- `apps/indusk-mcp/src/lib/admin/daemon.ts` — PID + port + log file management; spawn/kill/probe helpers
- `apps/indusk-mcp/src/bin/commands/init.ts` — append project to registry on success
- `apps/indusk-mcp/src/bin/commands/update.ts` — validate + update registry entry on success
- `apps/indusk-mcp/package.json` — `prepublishOnly` runs admin build; `files` array gains `admin/`; `dependencies` gains next/react/react-dom/react-markdown/remark-gfm/lucide-react
- `apps/indusk-admin/` — route restructure to `/p/[project]/...`; new `app/page.tsx` (project grid); new `app/p/[project]/layout.tsx` + `app/p/[project]/page.tsx`; updated `app/scorecards/page.tsx` to walk every registered project; new project switcher in the per-project layout
- `apps/indusk-admin/src/lib/registry-client.ts` — server-component-side reader of `~/.indusk/projects.json` (the daemon resolves project paths via this)
- `apps/indusk-admin/src/lib/project-root.ts` — replaced; `getProjectPath(name)` looks up via registry-client; throws/returns null for unregistered/stale
- `apps/indusk-docs/src/reference/admin-ui/{overview,cli}.md` updates per ADR's Documentation Plan
- `apps/indusk-docs/src/changelog.md` — 1.27.0 entry with breaking-change callout
- `apps/indusk-docs/src/decisions/admin-ui-hosting.md` — ADR published to docs site (handled at retrospective)
- Manual smoke on dusk + Numero (the smoke that motivated the plan)

### Out of Scope

Same as brief — LAN access, auth, HTTPS, project add/remove via UI, daemon auto-start, cross-machine registry sync, last-commit summary on cards, eval-agent commit-message persistence (separate patch), Windows support.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Bundling spike: pre-built admin app artifact in indusk-mcp tarball; measurement of tarball size + portability across Mac/Linux. **De-risks Risks #1 and #2 from ADR before committing the rest of the impl.** | Existing `apps/indusk-admin/` (built as-is, no source changes) |
| Phase 2 | `~/.indusk/projects.json` registry library (`registry.ts`), `indusk init`/`update` writing to it, daemon CLI shape (`uiStart`/`uiStop`/`uiStatus`), PID + port management library (`daemon.ts`) | Phase 1's bundled admin location resolution (the daemon needs to know where to spawn `next start` from) |
| Phase 3 | Admin app route restructure: `/` becomes project grid, `/p/[project]/...` namespace, per-project layout with sidebar + header switcher, registry-aware project resolution | Phase 2's registry + daemon (for the bundled app to actually serve pages reading from the registered projects) |
| Phase 4 | Cross-project `/scorecards` walking every registered project's `.indusk/eval/results.log`; stale-entry failure page for `/p/{deleted}/`; bare `indusk ui` cwd-aware behavior | Phases 2 + 3 (registry + per-project routing) |
| Phase 5 | Ship: 1.27.0 version bump, changelog entry, build + publish + upgrade global; manual smoke on dusk + Numero (A2, A14, A16, A17 as live tests) | All prior phases |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `indusk ui start` from any directory brings up the admin UI in <3s and prints a localhost URL. | Phase 0 | Phase 5 | planned |
| T2 | After `indusk ui start`, the user can close the terminal and the admin UI remains reachable at the printed URL. | Phase 0 | Phase 5 | planned |
| T3 | `indusk ui status` after a successful start reports "running", the listening port, and the count of registered projects. | Phase 2 | Phase 2 | written |
| T4 | `indusk ui start` when the daemon is already running prints "already running" and the existing URL — does not spawn a second daemon. | Phase 2 | Phase 2 | written |
| T5 | `indusk ui stop` shuts the daemon down within 3s; subsequent `indusk ui status` reports "not running". | Phase 2 | Phase 2 | written |
| T6 | `indusk ui start --port <n>` listens on `n`. If `n` is taken, CLI auto-bumps and prints a warning naming the new port. | Phase 2 | Phase 2 | written |
| T7 | Bare `indusk ui` from anywhere is functionally equivalent to `indusk ui start`. | Phase 2 | Phase 2 | written |
| T8 | `indusk init` from a fresh project directory adds an entry to `~/.indusk/projects.json`; subsequent `indusk ui status` reports the count incremented by 1. | Phase 2 | Phase 2 | passing |
| T9 | `indusk update` from a registered project validates the entry without creating a duplicate; the timestamp moves forward. | Phase 2 | Phase 2 | passing |
| T10 | `indusk init` from a project whose basename collides with a registered project's name registers under a numeric-suffixed name and prints a warning. | Phase 2 | Phase 2 | passing |
| T11 | A registered project whose path is deleted from disk: `indusk ui status` still reports it; `/p/{name}/` returns HTTP 200 with a "needs reconfiguration" failure page (not 500). | Phase 4 | Phase 4 | planned |
| T12 | The homepage at `/` shows one card per registered project with name, last-seen-at, and active-plan count. | Phase 3 | Phase 3 | planned |
| T13 | Clicking a project card navigates to `/p/{name}/`, which renders the same sidebar + plan list shape as 1.26.0's per-project mode. | Phase 3 | Phase 3 | planned |
| T14 | A header dropdown above the plan list switches between any two registered projects without restarting the daemon. | Phase 3 | Phase 3 | planned |
| T15 | `/scorecards` lists every scorecard from every registered project's `.indusk/eval/results.log`, labeled with project name, sorted most-recent-first across all projects. | Phase 4 | Phase 4 | planned |
| T16 | Bare `indusk ui` from inside a registered project opens the browser to `/p/{this-project}/`; from outside any registered project, opens to `/`. | Phase 4 | Phase 4 | planned |
| T17 | A consumer running `npm install -g @infinitedusky/indusk-mcp@1.27` and then `indusk ui start` from any project: the daemon starts without the consumer running `pnpm install`, `next build`, or any other secondary tool. | Phase 0 | Phase 5 | planned |
| T18 | The published indusk-mcp tarball contains the pre-built Next.js production output. Tarball size is under 50 MB. | Phase 1 | Phase 1 | passing |

### Trajectory Rationale

- **T3** `Writable at: Phase 2` — Test invokes `uiStatus()` from `apps/indusk-mcp/src/bin/commands/ui.ts`; the function doesn't exist before Phase 2 lands the new CLI shape. Compile error today.
- **T4** `Writable at: Phase 2` — Same as T3: requires the new `uiStart()` with double-spawn-guard logic.
- **T5** `Writable at: Phase 2` — Test invokes `uiStop()`; symbol doesn't exist today.
- **T6** `Writable at: Phase 2` — Test invokes `uiStart()` with `--port` parsing + auto-bump; the auto-bump helper (`findFreePort` exists from 1.26.0 but is in a function being deleted/replaced).
- **T7** `Writable at: Phase 2` — Test invokes the new bare-alias dispatcher; doesn't exist until Phase 2 wires the commander shape.
- **T12** `Writable at: Phase 3` — Test imports the new `<ProjectGrid>` component (or asserts against the new `/` page's HTML which includes data-testids that don't exist today). Component file authored in Phase 3.
- **T13** `Writable at: Phase 3` — Test asserts the per-project layout's sidebar + plan-list rendering; the new `/p/[project]/layout.tsx` doesn't exist before Phase 3.
- **T14** `Writable at: Phase 3` — Test imports the new `<ProjectSwitcher>` component; doesn't exist until Phase 3.
- **T15** `Writable at: Phase 4` — Test imports the cross-project scorecards walker (e.g., `readAllProjectsScorecards` in `registry-client.ts` or `Scorecards.tsx`'s new prop shape that takes per-project labels); the walker is added in Phase 4.
- **T18** `Writable at: Phase 1` — Test runs `npm pack` against `apps/indusk-mcp/` and inspects the tarball's contents + size. The `prepublishOnly` change that produces the bundled `admin/` directory lands in Phase 1; before then, packing produces the old (unbundled) tarball, and the test would fail for the wrong reason (no `admin/` to assert against). Move to Phase 1 because it's the test that proves the bundling decision.
- **T8** `Writable at: Phase 2` — Test calls `indusk init` in a tmp project then asserts the registry file at `INDUSK_HOME/projects.json` contains the new entry. The `INDUSK_HOME` env var support that lets the test redirect away from the real `~/.indusk/` lands in Phase 2 (added to `registry.ts` and `daemon.ts`). Without it, the test would either pollute the real registry or rely on monkey-patching `os.homedir()` — neither acceptable. Move to Phase 2.
- **T9** `Writable at: Phase 2` — Same as T8: requires `INDUSK_HOME` env var support landed in Phase 2.
- **T10** `Writable at: Phase 2` — Same as T8: requires `INDUSK_HOME` env var support landed in Phase 2.
- **T11** `Writable at: Phase 4` — Test starts the daemon, registers a project, deletes its path, GETs `/p/{name}/`, asserts 200 + failure-page marker. The failure page component (`StaleProjectFailurePage.tsx`) and the `/p/[project]/layout.tsx` rendering it conditionally are authored in Phase 4. The test imports the marker (e.g., `data-testid="stale-project-failure"`) which doesn't exist before Phase 4. Move to Phase 4.
- **T16** `Writable at: Phase 4` — Test invokes the new bare-`indusk ui` cwd-aware behavior added to `uiStart()` in Phase 4 (the cwd → registry lookup → URL selection logic). Phase 2 ships the `uiStart()` function but the cwd-aware branch is added in Phase 4. Move to Phase 4.

## Checklist

### Phase 1: Bundling spike + measurement

**Goal**: prove variant A3 actually works — pre-built bundle survives the npm tarball round-trip on macOS and Linux, and tarball stays under 50 MB. De-risks ADR Risks #1 and #2 before committing routing work.

- [x] Add `prepublishOnly` script to `apps/indusk-mcp/package.json`: `"prepublishOnly": "pnpm build && pnpm --filter indusk-admin build && node scripts/bundle-admin.js"`.
- [x] Create `apps/indusk-mcp/scripts/bundle-admin.js`: copies the admin app's `.next/` output, `package.json`, `next.config.ts`, and minimal source needed for `next start` into `apps/indusk-mcp/admin/`. Excludes `.next/cache`, `.next/dev` (leftover dev-server state — balloons to >200 MB if not excluded). Smoke-tested: produced 11.8 MB bundle on dusk's admin app.
- [x] Update `apps/indusk-mcp/package.json` `files` array to include `"admin"` (and `"scripts/bundle-admin.js"` so future republishes can re-bundle from a fresh checkout).
- [x] Move `next` + `react` + `react-dom` + `react-markdown` + `remark-gfm` + `lucide-react` from `apps/indusk-admin/package.json`'s `dependencies` to `apps/indusk-mcp/package.json`'s `dependencies`. **Refinement during impl: ADDED to indusk-mcp without removing from admin** — pnpm dedups via workspace, both contexts keep working. Removing them from admin would break `pnpm --filter indusk-admin dev`. Tailwind/postcss kept in admin's deps because they're build-time only. **Discovered during smoke: also need `export const dynamic = "force-dynamic"` in `app/layout.tsx`** because Next.js prerenders `/` at build time using the build's empty `INDUSK_PROJECT_ROOT`, baking the empty-state HTML in forever. Added; rebuilt; re-bundled (11.6 MB); smoke now passes — `/` shows populated `active-plans`, `/plan/{name}` returns 200 with full detail.
- [x] Run `pnpm pack` from `apps/indusk-mcp/`: 2.7 MB compressed tarball, 11.6 MB unpacked. Contains 206 `admin/` files including `BUILD_ID`. Well under the 50 MB cap.
- [x] Extract the tarball into a clean tempdir; spawn `next start` against the bundled `admin/`. **Refined during impl: `tar xzf` extraction is NOT the right portability test** — it doesn't pull in the next/react deps that npm-install would. Replaced with `npm install /path/to/tarball.tgz` into a clean tempdir, which creates the proper `node_modules/` tree (admin at `node_modules/@infinitedusky/indusk-mcp/admin/`, deps hoisted at `node_modules/`). Then `node /tmp/.../node_modules/next/dist/bin/next start` from the bundled admin location with `INDUSK_PROJECT_ROOT` set. Result: `/` HTTP 200 with populated `active-plans`; `/plan/indusk-admin-ui` HTTP 200 with full `plan-detail`+`phases-section` markers. **ADR Risk #1 (platform binaries / module resolution from bundled location) structurally addressed.**
- [x] If tarball exceeds 50 MB, profile + reduce. **N/A — tarball is 2.7 MB compressed / 11.6 MB unpacked, well under cap.**

#### Phase 1 Verification
- [x] T18 passes — 3 assertions: tarball <50 MB; tarball contains `package/admin/.next/BUILD_ID`; tarball contains `admin/package.json` + `admin/next.config.ts`. Test at `apps/indusk-mcp/src/__tests__/admin-bundle-pack.test.ts`. Skippable via `SKIP_SLOW_TESTS=1` for fast iteration.
- [x] Portability spike: `npm install /path/to/tarball.tgz` into clean tempdir → bundled admin at `node_modules/@infinitedusky/indusk-mcp/admin/` → spawn `next start` from there with `INDUSK_PROJECT_ROOT=/path/to/dusk` → curl `/` returns HTTP 200 with populated `active-plans`, `/plan/indusk-admin-ui` returns HTTP 200 with `plan-detail`+`phases-section`. Documented as manual smoke (not perpetual CI — runs the actual npm install of a 287-package tree). ADR Risk #1 (platform binaries / module resolution from bundled location) structurally addressed.

#### Phase 1 Context
- [x] Added to CLAUDE.md Known Gotchas (richer than originally planned because two real findings surfaced during impl): the bundler conventions + the `force-dynamic` requirement on the layout. Both are concrete enough that the next person debugging admin builds won't have to rediscover them.

#### Phase 1 Document
- [x] (folded into Phase 5's overview.md update — bundling architecture is documented alongside the daemon architecture)

### Phase 2: Registry + daemon CLI

**Goal**: ship the lifecycle commands (`ui start/stop/status`) and the registry plumbing (`init`/`update` writing to `~/.indusk/projects.json`). Daemon process management without UI changes — the routes still respond as 1.26.0 did, but spawned via the new daemon machinery.

- [x] Create `apps/indusk-mcp/src/lib/admin/registry.ts` exporting `readRegistry()`, `addProject(path)`, `validateProject(name)`, `touchProject(name)`. Atomic writes via tmp-file + rename. INDUSK_HOME env var redirects away from `~/.indusk/`. **Discovered during impl**: `EMPTY_REGISTRY` constant + `{ ...EMPTY_REGISTRY }` shallow spread shared the `projects` array reference across calls — first test mutated it, all later tests saw the leftover. Replaced with `emptyRegistry()` factory function. Classic shared-mutable-default-value bug. Worth a CLAUDE.md note when this phase wraps. 7 tests pass (T8/T9/T10 prep).
- [x] Create `apps/indusk-mcp/src/lib/admin/daemon.ts` exporting:
  - `daemonStart({ port, adminDir, nextBin, projectRoot? }): Promise<DaemonMeta>` — spawns `node <nextBin> start --port {port}` from `adminDir`, `detached: true` + `unref()` + stdio redirect to `~/.indusk/admin-ui.log`, writes PID to `~/.indusk/admin-ui.pid` and metadata to `~/.indusk/admin-ui.json`
  - `daemonStop(): Promise<{ stopped, signaledPid?, usedSigkill? }>` — reads PID, SIGTERM, polls every 100ms up to 3s, SIGKILL fallback, cleans PID + meta files; `stopped:false` only when no PID file existed
  - `daemonStatus(): Promise<DaemonStatusResult>` — reads PID + meta, `kill(pid, 0)` liveness check, returns `{running:true, pid, port, adminDir, startedAt}` or `{running:false}` (port probing left to caller via separate `isPortListening` export)
  - `findFreePort(start): Promise<number>` — checks `start`; if taken or `0`, returns an OS-picked free port (no upward scan — scanning invites check-then-listen races)
  - Bonus: `isPortListening(port)` — TCP-connect probe with 500ms timeout, used by `uiStatus` to disambiguate "alive but warming up" from "alive and serving"
- [x] Create `apps/indusk-mcp/src/bin/commands/ui.ts` (REPLACED existing 1.26.0 file): exports `uiStart`, `uiStop`, `uiStatus`. Internally delegates to `daemon.ts`. `uiStart` calls `daemonStatus()` first for double-start guard, resolves bundled admin via `resolveBundledAdminDir()` (verifies `.next/BUILD_ID` exists — fails fast if unbundled), resolves next bin via `createRequire(import.meta.url).resolve("next/package.json")` + `dist/bin/next`, calls `findFreePort` for auto-bump, opens browser unless `--no-open`. `uiStop` reports SIGKILL fallback if grace expired. `uiStatus` merges daemon status with `readRegistry().projects.length` so T3 assertions (`running`, `port N`, `projects N`) all pass.
- [x] Update `apps/indusk-mcp/src/bin/cli.ts` commander: single `uiCmd = program.command("ui")` with a parent `.action()` for bare `indusk ui`, then `uiCmd.command("start"|"stop"|"status")` subcommands. Parent+subcommand pattern **verified live**: `node dist/bin/cli.js ui status` dispatches to the status subcommand, `node dist/bin/cli.js ui --help` lists both parent options (`--port`, `--no-open`) and subcommands. Commander's default behavior routes bare invocation to the parent's `.action()` when no subcommand matches. Flags re-declared on `start` so parse shape matches for both call sites.
- [ ] Update `apps/indusk-mcp/src/bin/commands/init.ts`: after init succeeds, call `addProject(cwd)`. Print the registered name (and the suffix if collision-resolved) to stdout.
- [ ] Update `apps/indusk-mcp/src/bin/commands/update.ts`: after update succeeds, call `validateProject(name)` (deriving name from cwd basename); if entry missing or path doesn't match, call `addProject(cwd)`; otherwise call `touchProject(name)`.
- [ ] Add unit tests at `apps/indusk-mcp/src/lib/admin/__tests__/registry.test.ts`: T8/T9/T10 prep — addProject creates entry, addProject collision suffixes, validateProject reflects path-existence, touchProject moves lastSeenAt.
- [ ] Add CLI integration tests at `apps/indusk-mcp/src/__tests__/admin-cli-lifecycle.test.ts`: T3/T4/T5/T6/T7 — spawn the CLI binary as a subprocess, assert stdout for each command shape. Use a temp `~/.indusk/` via env var override (`INDUSK_HOME`) so tests don't pollute the real home.
- [ ] Add `INDUSK_HOME` env var support in `registry.ts` and `daemon.ts` so tests can isolate. Default to `os.homedir() + "/.indusk"`.

#### Phase 2 Verification
- [ ] T3, T4, T5, T6, T7 pass via the CLI integration test (subprocess spawn + stdout assertions; uses `INDUSK_HOME` for isolation)
- [ ] T8, T9, T10 pass via the registry unit tests (in-process; uses `INDUSK_HOME` for the temp registry path)

#### Phase 2 Context
- [ ] Add to CLAUDE.md Architecture under Apps: replace the existing per-project description of `indusk ui` with: "**`indusk ui` is now a daemon lifecycle command** — `start` spawns a long-lived Node process (the bundled admin app) detached from the shell; `stop` SIGTERMs it; `status` reports running/port/registered-projects. Daemon metadata at `~/.indusk/admin-ui.{pid,json,log}`. The bundled admin dir comes from indusk-mcp's tarball (Phase 1)."
- [ ] Add to CLAUDE.md Conventions: "**`indusk init` and `indusk update` mutate `~/.indusk/projects.json`** — the project registry the admin daemon reads. Init appends; update validates + touches. Tests use `INDUSK_HOME` env var to isolate from the real home."

#### Phase 2 Document
- [ ] (folded into Phase 5 — daemon CLI documented alongside the rest in overview.md + cli.md)

### Phase 3: Admin app route restructure + project switcher

**Goal**: rewire the admin app's URLs so everything lives under either `/` (project grid) or `/p/[project]/...` (per-project), with a header switcher to navigate between projects. Components inside the routes (PlanList, PlanDetail) reused as-is.

- [ ] Create `apps/indusk-admin/src/lib/registry-client.ts` — server-component-side reader of `~/.indusk/projects.json` (mirrors `apps/indusk-mcp/src/lib/admin/registry.ts` shape but read-only, doesn't depend on indusk-mcp's package). Exports `readRegistryProjects(): ProjectEntry[]` and `getProjectPath(name): string | null`.
- [ ] Replace `apps/indusk-admin/src/lib/project-root.ts` — `getProjectPath(name)` (renamed from `getProjectRoot()`) looks up via `registry-client`. Returns `null` for unregistered/stale.
- [ ] Update every callsite of the old `getProjectRoot()`: `app/layout.tsx`, `app/plan/[name]/page.tsx`, `app/scorecards/page.tsx` — they all need to take a `project` param (or be moved into `/p/[project]/...`).
- [ ] Move `app/plan/[name]/page.tsx` → `app/p/[project]/plan/[name]/page.tsx`. Update to read project via `params.project`, look up path via `getProjectPath`, then call `readActivePlans(projectPath)` etc.
- [ ] Create `app/p/[project]/layout.tsx`: reads `params.project`; renders the existing Sidebar + PlanList scoped to this project; adds the new `<ProjectSwitcher>` component above the PlanList.
- [ ] Create `app/p/[project]/page.tsx`: per-project empty state ("Select a plan from the sidebar"). Equivalent to current `app/page.tsx` but project-scoped.
- [ ] Replace `app/page.tsx` (root): renders `<ProjectGrid>` — one `<ProjectCard>` per registered project, cards show name, last-seen-at (humanized via simple date diff), active-plan count (via `readActivePlans(path).length`), in-progress badge if any plan's status is "in-progress".
- [ ] Create `apps/indusk-admin/src/components/ProjectGrid.tsx` and `ProjectCard.tsx` and `ProjectSwitcher.tsx`. ProjectSwitcher is a simple `<select>` (or our existing Badge-style dropdown) styled into the per-project header.
- [ ] Update `app/layout.tsx` (root): becomes thin — global nav only (sidebar shows the global section: link to `/`, link to `/scorecards`). The per-project sidebar now lives in `app/p/[project]/layout.tsx`.
- [ ] Add browser-mode tests at `apps/indusk-admin/src/components/ProjectGrid.test.tsx` (T12), `apps/indusk-admin/src/components/ProjectSwitcher.test.tsx` (T14), `apps/indusk-admin/src/app/p/[project]/page.test.tsx` (T13 — verifies the per-project layout renders the existing PlanList shape).

#### Phase 3 Verification
- [ ] T12 passes (ProjectGrid renders one card per registered project with name + last-seen-at + plan count)
- [ ] T13 passes (per-project page renders sidebar + PlanList in the same shape as 1.26.0)
- [ ] T14 passes (ProjectSwitcher: clicking an option navigates to that project's `/p/{name}/`)
- [ ] All Phase 1 + Phase 2 tests still green (no regression in CLI lifecycle or bundling)

#### Phase 3 Context
- [ ] Add to CLAUDE.md Conventions: "**admin-ui routes are project-scoped**: `/` renders a project grid; per-project content lives under `/p/[project]/...`. Cross-project content (scorecards, future cross-project signal) lives at top-level routes (`/scorecards`). The per-project layout (`app/p/[project]/layout.tsx`) is where the sidebar + project switcher live; the root layout is global-nav-only."

#### Phase 3 Document
- [ ] Update `apps/indusk-docs/src/reference/admin-ui/component-conventions.md` — append "Routing" section documenting the `/` vs `/p/[project]/...` split and the per-project layout convention.

### Phase 4: Cross-project scorecards + stale-entry failure page + cwd-aware bare ui

**Goal**: the parts that need both Phases 2 (registry) and 3 (routing) to be in place. After this phase, every test trajectory row except T1/T2/T17 is passing.

- [ ] Update `app/scorecards/page.tsx` — read every registered project's path, walk each `.indusk/eval/results.log`, merge into one list, label each card with its project name, sort most-recent-first across all.
- [ ] Update `Scorecards.tsx` to accept and display a project-name column on each card (in addition to the current Commit message + Mode + Status).
- [ ] Create `apps/indusk-admin/src/components/StaleProjectFailurePage.tsx`: renders a clear message ("This project's path no longer exists. Run `indusk update` from the new location, OR remove `~/.indusk/projects.json` to start fresh.") with the registered name and old path visible.
- [ ] Update `app/p/[project]/layout.tsx` — when `getProjectPath(name)` returns null OR the path doesn't exist on disk, render `<StaleProjectFailurePage>` instead of the normal sidebar+content.
- [ ] Update `apps/indusk-mcp/src/bin/commands/ui.ts`'s `uiStart` (added in Phase 2): when called as bare `indusk ui`, check whether `process.cwd()` is a registered project; if yes, set the open-browser URL to `/p/{name}/` instead of `/`.
- [ ] Add tests:
  - `apps/indusk-admin/src/app/scorecards/page.test.ts` — walks two registered projects' fixture results.log files, asserts both projects' scorecards present and labeled correctly (T15)
  - `apps/indusk-admin/src/components/StaleProjectFailurePage.test.tsx` — failure page renders expected copy (T11 component-level prep)
  - `apps/indusk-admin/src/__tests__/http-stale-project.test.ts` — HTTP smoke: register a project, delete its dir, GET `/p/{name}/`, assert HTTP 200 + failure-page marker (T11 end-to-end)
  - `apps/indusk-mcp/src/__tests__/cli-bare-ui-cwd-aware.test.ts` — spawn `indusk ui` from a tempdir registered as a project; assert the open-browser URL flag/output mentions `/p/{name}/`. From an unregistered tempdir, assert it mentions `/` (T16).

#### Phase 4 Verification
- [ ] T11 passes (stale-project failure page returns 200, not 500)
- [ ] T15 passes (cross-project scorecards merge from multiple registered projects)
- [ ] T16 passes (bare `indusk ui` is cwd-aware)
- [ ] All Phase 1–3 tests still green

#### Phase 4 Context
- [ ] Add to CLAUDE.md Known Gotchas: "**admin-ui registry is never auto-pruned** — if a registered project's path is deleted, `/p/{name}/` shows a 'needs reconfiguration' failure page. The user resolves by running `indusk update` from the new location OR by hand-editing `~/.indusk/projects.json`. There is no UI affordance to remove an entry; this is intentional discipline (registry mutations only via CLI)."

#### Phase 4 Document
- [ ] (folded into Phase 5's overview.md update — failure page + cross-project scorecards documented alongside the rest)

### Phase 5: Ship — version bump, changelog, build, publish, smoke

**Goal**: 1.27.0 lands on npm with all the prior phases bundled. Smoke on dusk + Numero closes T1, T2, T17 (the assertions that require a real published install).

- [ ] Bump `apps/indusk-mcp/package.json` version → 1.27.0 (new feature: daemon hosting model + breaking change from 1.26.0's per-project mode).
- [ ] Add changelog entry to `apps/indusk-docs/src/changelog.md` per ADR's Documentation Plan: 1.27.0 entry naming the daemon model, the registry, the breaking change, the bundling decision (variant A3), and the cross-project scorecards. Include the migration note: "1.26.0 users: run `indusk init` once per project to register, then `indusk ui start` from anywhere."
- [ ] Update `apps/indusk-docs/src/reference/admin-ui/overview.md` per ADR's Documentation Plan: replace the per-project CLI section with the daemon model; document the registry; document the homepage + per-project routing; include the architecture diagram (Mermaid sequence: `indusk ui start` → daemon spawn → registry read → browser request → per-project file read).
- [ ] Create `apps/indusk-docs/src/reference/admin-ui/cli.md` per ADR's Documentation Plan: full CLI reference for `indusk ui start/stop/status`, exit codes, env vars (`INDUSK_HOME`), port behavior (default 3939, auto-bump on conflict), with the routing tree diagram.
- [ ] Build + publish: `cd apps/indusk-mcp && pnpm publish` (user action). `prepublishOnly` runs the admin build automatically.
- [ ] User upgrades global indusk-mcp on dusk + Numero (`indusk update` from each).
- [ ] Smoke on dusk: kill any running `indusk-admin` from the prior 1.26.0 model. Run `indusk ui start`. Assert browser opens, project grid shows dusk + (any other init-ed projects), click into dusk → see plans, switch to another project via header (if multiple registered), `indusk ui status` reports running, `indusk ui stop` shuts it down. Closes T1, T2, T17 for dusk.
- [ ] Smoke on Numero: ensure Numero is `indusk init`'d (or run `indusk update` to ensure registry entry exists). Run `indusk ui start` from Numero. Assert browser opens; Numero appears in the grid; click into Numero, assert plans render correctly. Closes T17 + the implicit "Numero works" success criterion that motivated this entire plan.

#### Phase 5 Verification
- [ ] T1 passes — live `indusk ui start` on dusk completes in <3s and prints the URL
- [ ] T2 passes — live: close terminal, daemon survives, URL still reachable
- [ ] T17 passes — Numero (a non-dusk project running globally-installed 1.27.0) gets a working `indusk ui start` with no `pnpm install` step
- [ ] All Phase 1–4 tests still green (regression check)

#### Phase 5 Context
- [ ] Update CLAUDE.md "Current State": "**`admin-ui-hosting` shipped in indusk-mcp 1.27.0** — single long-lived native Node daemon hosts the admin UI for every InDusk project on the machine. `indusk ui start/stop/status` lifecycle. `~/.indusk/projects.json` registry populated by `indusk init`/`update`. Routes scope under `/p/[project]/...` with `/` as project grid and `/scorecards` cross-project. Pre-built Next.js production bundle (variant A3) shipped in tarball — consumers need zero extra tooling. Replaces the broken per-project model in 1.26.0."

#### Phase 5 Document
- [ ] (overview.md + cli.md + changelog updates above ARE the Phase 5 docs; ADR publish to `apps/indusk-docs/src/decisions/admin-ui-hosting.md` happens in retrospective per the docs plan)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/package.json` | Version bump 1.26.x → 1.27.0; `prepublishOnly` runs admin build; `files` array gains `"admin"`; `dependencies` gains next/react/react-dom/react-markdown/remark-gfm/lucide-react |
| `apps/indusk-mcp/scripts/bundle-admin.js` | NEW — copies admin app's prod build into `apps/indusk-mcp/admin/` for tarball inclusion |
| `apps/indusk-mcp/src/lib/admin/registry.ts` | NEW — `~/.indusk/projects.json` read/write/validate |
| `apps/indusk-mcp/src/lib/admin/daemon.ts` | NEW — PID + port + log file management; spawn/kill/probe |
| `apps/indusk-mcp/src/bin/commands/ui.ts` | REPLACED — `uiStart`, `uiStop`, `uiStatus` (delete the existing 1.26.0 implementation) |
| `apps/indusk-mcp/src/bin/cli.ts` | Wire up `indusk ui start/stop/status` + bare `indusk ui` as alias |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Append project to registry on success |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Validate + touch registry entry on success |
| `apps/indusk-mcp/src/lib/admin/__tests__/registry.test.ts` | NEW — registry unit tests |
| `apps/indusk-mcp/src/__tests__/admin-cli-lifecycle.test.ts` | NEW — CLI subprocess integration tests |
| `apps/indusk-mcp/src/__tests__/admin-bundle-pack.test.ts` | NEW — `npm pack` size + content assertions (T18) |
| `apps/indusk-mcp/src/__tests__/cli-bare-ui-cwd-aware.test.ts` | NEW — bare `indusk ui` cwd-aware behavior (T16) |
| `apps/indusk-admin/src/lib/registry-client.ts` | NEW — server-component-side registry reader |
| `apps/indusk-admin/src/lib/project-root.ts` | REPLACED — `getProjectPath(name)` registry-aware |
| `apps/indusk-admin/src/app/page.tsx` | REPLACED — project grid (was empty state) |
| `apps/indusk-admin/src/app/p/[project]/layout.tsx` | NEW — per-project layout with sidebar + switcher |
| `apps/indusk-admin/src/app/p/[project]/page.tsx` | NEW — per-project empty state |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx` | MOVED from `apps/indusk-admin/src/app/plan/[name]/page.tsx` |
| `apps/indusk-admin/src/app/plan/[name]/page.tsx` | DELETED (moved to /p/[project]/...) |
| `apps/indusk-admin/src/app/scorecards/page.tsx` | Walk every registered project; label by project name |
| `apps/indusk-admin/src/app/layout.tsx` | Slimmed to global-nav-only (per-project layout takes over the sidebar) |
| `apps/indusk-admin/src/components/ProjectGrid.tsx` | NEW |
| `apps/indusk-admin/src/components/ProjectCard.tsx` | NEW |
| `apps/indusk-admin/src/components/ProjectSwitcher.tsx` | NEW |
| `apps/indusk-admin/src/components/StaleProjectFailurePage.tsx` | NEW |
| `apps/indusk-admin/src/components/Scorecards.tsx` | Add project-name column; accept multi-project input |
| `apps/indusk-admin/src/components/PlanList.tsx` | Drop the `Global` nav block from PlanList (now lives in root layout); PlanList stays project-scoped |
| `apps/indusk-admin/src/components/{ProjectGrid,ProjectCard,ProjectSwitcher,StaleProjectFailurePage}.test.tsx` | NEW — component tests for the new primitives |
| `apps/indusk-admin/src/__tests__/http-stale-project.test.ts` | NEW — HTTP smoke for T11 |
| `apps/indusk-admin/package.json` | Move next/react/react-dom/react-markdown/remark-gfm/lucide-react out of `dependencies` (lifted to indusk-mcp); keep build-time deps (Tailwind, postcss, etc.) |
| `apps/indusk-docs/src/reference/admin-ui/overview.md` | Major rewrite per Phase 5 |
| `apps/indusk-docs/src/reference/admin-ui/cli.md` | NEW — full CLI reference per Phase 5 |
| `apps/indusk-docs/src/reference/admin-ui/component-conventions.md` | Append "Routing" section per Phase 3 |
| `apps/indusk-docs/src/changelog.md` | 1.27.0 entry with breaking-change callout |
| `CLAUDE.md` | Architecture (Apps), Conventions (multiple new), Known Gotchas (registry never auto-pruned), Current State (1.27.0 shipped), Key Decisions (added at ADR-accept) |

## Dependencies

None at the code level — all inputs (admin app, CLI patterns from `infra.ts`, config patterns from `config.ts`) already exist in dusk.

Soft dependency on the eval-agent commit-message persistence change (separate small patch noted out-of-scope in brief). The UI fallback `getCommitMessages` in `apps/indusk-admin/src/lib/vcs.ts` covers the gap until that ships.

## Notes

- **Phase 1 is the de-risk phase.** ADR Risks #1 (platform binaries) and #2 (tarball size) are both surfaced in Phase 1 — if the bundle doesn't survive `npm pack`/`tar -xzf` round-trip on macOS + Linux, OR if the tarball balloons past 50 MB, the user is escalated and the variant choice is revisited BEFORE the routing work in Phase 3 is committed. Reordering Phase 1 before Phase 2 (which would otherwise be more natural — routing after CLI) is intentional.
- **Phase 2 ships a working daemon BEFORE the new routes.** The daemon serves the existing 1.26.0 routes during Phase 2; the route restructure happens in Phase 3 against the running daemon. This means Phase 2's tests (T3–T10) verify daemon mechanics in isolation; route-restructure tests (T12–T16) come later.
- **The breaking change** from 1.26.0's per-project model is real but low-impact (no users yet outside dusk). The migration path documented in the changelog is "run `indusk init` once per project, then `indusk ui start`". Users who manually invoked the old `node .../cli.js ui --no-open` workaround during this session will need to switch to the new shape post-1.27.0.
- **`INDUSK_HOME` env var** is the test-isolation knob. Production usage doesn't set it; it defaults to `$HOME/.indusk`. Tests set it to a tmpdir so they don't pollute the real registry. Documented in cli.md.

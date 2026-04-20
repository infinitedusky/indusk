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
| Phase 5 | Ship: 1.27.0 version bump, changelog entry, build + publish + upgrade global; manual smoke on dusk + Numero (A2, A14, A16, A17 as live tests). 1.27.1 follow-up adds `indusk ui restart` | All prior phases |
| Phase 6 | UX polish as 1.27.2: scorecards project-siloing (`/p/[project]/scorecards`), per-project research section (`/p/[project]/research/[slug]` backed by `.indusk/research/`), brief section collapsible for parity with Test Plan + ADR | Phase 3's `/p/[project]/` namespace; Phase 4's scorecards walker (repurposed for single-project) |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `indusk ui start` from any directory brings up the admin UI in <3s and prints a localhost URL. | Phase 0 | Phase 5 | passing |
| T2 | After `indusk ui start`, the user can close the terminal and the admin UI remains reachable at the printed URL. | Phase 0 | Phase 5 | passing |
| T3 | `indusk ui status` after a successful start reports "running", the listening port, and the count of registered projects. | Phase 2 | Phase 2 | passing |
| T4 | `indusk ui start` when the daemon is already running prints "already running" and the existing URL — does not spawn a second daemon. | Phase 2 | Phase 2 | passing |
| T5 | `indusk ui stop` shuts the daemon down within 3s; subsequent `indusk ui status` reports "not running". | Phase 2 | Phase 2 | passing |
| T6 | `indusk ui start --port <n>` listens on `n`. If `n` is taken, CLI auto-bumps and prints a warning naming the new port. | Phase 2 | Phase 2 | passing |
| T7 | Bare `indusk ui` from anywhere is functionally equivalent to `indusk ui start`. | Phase 2 | Phase 2 | passing |
| T8 | `indusk init` from a fresh project directory adds an entry to `~/.indusk/projects.json`; subsequent `indusk ui status` reports the count incremented by 1. | Phase 2 | Phase 2 | passing |
| T9 | `indusk update` from a registered project validates the entry without creating a duplicate; the timestamp moves forward. | Phase 2 | Phase 2 | passing |
| T10 | `indusk init` from a project whose basename collides with a registered project's name registers under a numeric-suffixed name and prints a warning. | Phase 2 | Phase 2 | passing |
| T11 | A registered project whose path is deleted from disk: `indusk ui status` still reports it; `/p/{name}/` returns HTTP 200 with a "needs reconfiguration" failure page (not 500). | Phase 4 | Phase 4 | passing |
| T12 | The homepage at `/` shows one card per registered project with name, last-seen-at, and active-plan count. | Phase 3 | Phase 3 | passing |
| T13 | Clicking a project card navigates to `/p/{name}/`, which renders the same sidebar + plan list shape as 1.26.0's per-project mode. | Phase 3 | Phase 3 | passing |
| T14 | A header dropdown above the plan list switches between any two registered projects without restarting the daemon. | Phase 3 | Phase 3 | passing |
| T15 | `/scorecards` lists every scorecard from every registered project's `.indusk/eval/results.log`, labeled with project name, sorted most-recent-first across all projects. **Feature removed in Phase 6; superseded by T19.** Test file deleted alongside the route. | Phase 4 | Phase 4 | passing |
| T16 | Bare `indusk ui` from inside a registered project opens the browser to `/p/{this-project}/`; from outside any registered project, opens to `/`. | Phase 4 | Phase 4 | passing |
| T17 | A consumer running `npm install -g @infinitedusky/indusk-mcp@1.27` and then `indusk ui start` from any project: the daemon starts without the consumer running `pnpm install`, `next build`, or any other secondary tool. | Phase 0 | Phase 5 | passing |
| T18 | The published indusk-mcp tarball contains the pre-built Next.js production output. Tarball size is under 50 MB. | Phase 1 | Phase 1 | passing |
| T19 | `/p/{project}/scorecards` renders that project's scorecards (from its `.indusk/eval/results.log`). The top-level `/scorecards` route is removed (404) or redirects into the current project. Per-project sidebar has a "Scorecards" link next to the plan list. | Phase 6 | Phase 6 | written |
| T20 | `/p/{project}/research/{slug}` renders a markdown file from that project's `.indusk/research/` directory via the same `<Markdown>` component used for plans. The per-project sidebar has a "Research" group listing every top-level `.md` slug under `.indusk/research/` (nested dirs shown as collapsible subgroups). Empty state when the directory is missing. | Phase 6 | Phase 6 | written |
| T21 | The Brief section on `/p/{project}/plan/{name}` is rendered inside a `<CollapsibleSection>` with the same expand/collapse control as Test Plan and ADR. Default state is expanded. | Phase 6 | Phase 6 | written |

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
- **T19** `Writable at: Phase 6` — Test imports the new `/p/[project]/scorecards/page.tsx` route component; file doesn't exist today. Top-level `/scorecards/page.tsx` still exports the cross-project walker (Phase 4 code). Compile error against today's symbols until Phase 6 creates the new route.
- **T20** `Writable at: Phase 6` — Test imports the new research reader (e.g., `readResearchDir(projectRoot)` in `planning-reader.ts` or a new `research-reader.ts`) AND the new `/p/[project]/research/[slug]/page.tsx` route. Neither symbol exists today. Compile error until Phase 6.
- **T21** `Writable at: Phase 6` — Test asserts the Brief section in `PlanDetail.tsx` is wrapped in a `<CollapsibleSection>` (either via querying the DOM for the expand/collapse chevron inside the brief region, or by asserting the structural change to the component tree). Today the Brief renders inline without the wrapper — the test would fail for the right reason but only after the Phase 6 component change flips the DOM shape.

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
- [x] Update `apps/indusk-mcp/src/bin/commands/init.ts`: after all other init steps succeed (section 13, before the "Done!" summary), dynamically import `addProject` and register `projectRoot`. If the returned entry's name differs from the cwd basename, print the collision-suffixed form; otherwise print the plain name. Uses dynamic import so the fast-path `init` module doesn't pay the admin/registry import cost when CGC isn't configured.
- [x] Update `apps/indusk-mcp/src/bin/commands/update.ts`: section 10 after local-mode overlay. Derives `projectName` from `basename(projectRoot)`, tries `validateProject(name)`: on match-both-name-and-path, `touchProject` to bump lastSeenAt; on name-match-but-path-differs, `addProject` (gives fresh entry). `validateProject` throws when the name isn't registered — the catch branch calls `addProject` for pre-1.27 projects being upgraded, handling the collision-suffix case too. All paths print a line under `[Project registry]` describing what happened.
- [x] Add unit tests at `apps/indusk-mcp/src/lib/admin/__tests__/registry.test.ts`: landed alongside registry.ts in Phase 2 item 1. 7/7 passing. Covers empty-state read, addProject entry shape, validateProject pathExists for present + deleted, touchProject idempotence, T10 collision suffix (2- and 3-depth).
- [x] Add CLI integration tests at `apps/indusk-mcp/src/__tests__/admin-cli-lifecycle.test.ts`: authored as red during phase-start. 5 tests for T3–T7 spawning `node dist/bin/cli.js` with `INDUSK_HOME=<tmpdir>`. Each uses `it.skipIf(SKIP_SLOW_TESTS)` so CI defaults to skip; dev runs unskipped.
- [x] Add `INDUSK_HOME` env var support in `registry.ts` and `daemon.ts` so tests can isolate. Both modules read `process.env.INDUSK_HOME ?? join(homedir(), ".indusk")` via a shared `induskHome()` helper (duplicated across the two files rather than hoisted — each is <5 lines and hoisting would create a circular import risk between registry and daemon).

#### Phase 2 Verification
- [x] T3, T4, T5, T6, T7 pass via the CLI integration test (subprocess spawn + stdout assertions; uses `INDUSK_HOME` for isolation) — `pnpm vitest run src/__tests__/admin-cli-lifecycle.test.ts` → 5/5 in 32s
- [x] T8, T9, T10 pass via the registry unit tests (in-process; uses `INDUSK_HOME` for the temp registry path) — `pnpm vitest run src/lib/admin/__tests__/registry.test.ts` → 7/7 in 147ms

#### Phase 2 Context
- [x] Added to CLAUDE.md Architecture (`indusk-admin` app entry): daemon hosting via `indusk ui start/stop/status` with `~/.indusk/admin-ui.{pid,json,log}` lifecycle files, bundled admin at `apps/indusk-mcp/admin/`.
- [x] Added to CLAUDE.md Conventions: `indusk init` and `indusk update` mutate `~/.indusk/projects.json` via `registry.ts` (never by hand); tests redirect via `INDUSK_HOME`.
- [x] Added to CLAUDE.md Known Gotchas: commander@13 drops duplicate options on subcommands — declare on parent only, read via `this.optsWithGlobals()`. Surfaced during Phase 2 item 4 spike (the default port kept being 3939 instead of the passed value).

#### Phase 2 Document
- [x] (folded into Phase 5 — daemon CLI documented alongside the rest in overview.md + cli.md)

### Phase 3: Admin app route restructure + project switcher

**Goal**: rewire the admin app's URLs so everything lives under either `/` (project grid) or `/p/[project]/...` (per-project), with a header switcher to navigate between projects. Components inside the routes (PlanList, PlanDetail) reused as-is.

- [x] Create `apps/indusk-admin/src/lib/registry-client.ts` — server-component-side reader of `~/.indusk/projects.json`. Deliberately duplicates the `ProjectEntry` shape from indusk-mcp rather than importing — keeps admin-ui's deployment bundle free of a runtime dependency on indusk-mcp internals. Exports `readRegistryProjects(): ProjectEntry[]` (returns `[]` on absent/malformed) and `getProjectPath(name): string | null` (no on-disk check — callers like the Phase 4 stale-failure page branch own that).
- [x] Replace `apps/indusk-admin/src/lib/project-root.ts` — thin wrapper that re-exports `getProjectPath` from `registry-client.ts`. The old `getProjectRoot(): string` is gone — callers now name which project they're asking about. The file is kept (vs deleted) so existing imports from `@/lib/project-root` continue to resolve during the route migration in the next item.
- [x] Update every callsite of the old `getProjectRoot()`: `app/scorecards/page.tsx` walks the registry for Phase 3 (Phase 4 adds per-project labels); `app/layout.tsx` is slimmed to global-nav only so no longer needs project data; the old `app/plan/[name]/page.tsx` was deleted (moved to nested route).
- [x] Move `app/plan/[name]/page.tsx` → `app/p/[project]/plan/[name]/page.tsx`. Reads both `project` and `name` from params, resolves path via `getProjectPath`, 404s on unregistered project OR unknown plan name (both failure modes share the Next.js not-found UI for Phase 3; Phase 4 adds the richer stale-project failure page). Updated `http-smoke.test.ts` to hit the new URL with a registry-backed `INDUSK_HOME` fixture.
- [x] Create `app/p/[project]/layout.tsx`: renders Sidebar + PlanList scoped to project with ProjectSwitcher above the plan list. Typed with a local `PerProjectLayoutProps` interface rather than Next 16's global `LayoutProps<"/p/[project]">` helper because the latter regenerates from the route tree during `next build` — `tsc --noEmit` in isolation fails to resolve it. Local interface keeps typecheck hermetic.
- [x] Create `app/p/[project]/page.tsx`: per-project empty state. `notFound()` for unregistered project.
- [x] Replace `app/page.tsx` (root): renders `<ProjectGrid>` awaiting `readActivePlans` across every registered project in parallel. Cards show name, humanized last-seen-at, active-plan count, in-progress badge when any plan's status === "in-progress". Stale paths (deleted on disk) render `0 active plans` without crashing — `readActivePlans.catch(() => [])`.
- [x] Create `apps/indusk-admin/src/components/ProjectGrid.tsx` + `ProjectCard.tsx` + `ProjectSwitcher.tsx`. ProjectSwitcher is a native `<select>` with `useRouter().push` — omits entirely when only one project is registered (no point showing it with a single option). ProjectCard IS a `<Link>` (the whole card is clickable), verified in T12 via `card.getAttribute("href")` instead of `card.querySelector("a")`.
- [x] Update `app/layout.tsx` (root): slimmed to a header + content area. Global nav lives in the header (`Projects` / `Scorecards`); per-project sidebars now live in `app/p/[project]/layout.tsx`. Also dropped the `Global` nav block from `PlanList.tsx` (no longer needed since the global nav moved). `PlanList` now accepts an optional `planHrefPrefix` prop (default `/plan/` for back-compat with existing tests; the per-project layout passes `/p/${project}/plan/`).
- [x] Add browser-mode tests at `ProjectGrid.test.tsx` (T12, 3 tests: one card per project + empty state + in-progress badge), `ProjectSwitcher.test.tsx` (T14, 3 tests: options + onChange navigation + hidden when single project), `app/p/[project]/page.test.tsx` (T13, 1 test: layout renders PlanList with per-project href prefix + children slot passes through). T13 mocks `@/lib/planning-reader` and `@/lib/registry-client` to avoid `node:fs` externalization in the browser runtime.

#### Phase 3 Verification
- [x] T12 passes — `pnpm vitest run src/components/ProjectGrid.test.tsx` → 3/3
- [x] T13 passes — `pnpm vitest run src/app/p/[project]/page.test.tsx` → 1/1
- [x] T14 passes — `pnpm vitest run src/components/ProjectSwitcher.test.tsx` → 3/3
- [x] Admin-ui full suite green — `pnpm vitest run` → 75/75 across 11 files. Updated `http-smoke.test.ts` to the new route structure with a registry-backed INDUSK_HOME fixture; it now covers GET `/` (project grid), `/p/dusk/` (sidebar), `/p/dusk/plan/indusk-admin-ui` (detail), and the 404 path.
- [x] Indusk-mcp suite: 408/409 pass. The one failure (`plan-parser.test.ts: returns all plans sorted by name — expected names to include 'agent-roles'`) is a pre-existing stale fixture — `agent-roles` was archived to `.indusk/planning/archive/agent-roles/` in earlier work, and the test is asserting it still lives in the active planning dir. **Not a Phase 3 regression** — the test was already failing against main before this branch touched anything. Queued as an unrelated fix for a separate commit.

#### Phase 3 Context
- [x] Added to CLAUDE.md Conventions (admin-ui routes are project-scoped): `/` = ProjectGrid, `/p/[project]/...` = per-project, `/scorecards` cross-project. Per-project layout owns sidebar+switcher; root layout is global-nav-only. `PlanList` accepts optional `planHrefPrefix` (default `/plan/`, per-project passes `/p/${project}/plan/`).

#### Phase 3 Document
- [x] Updated `apps/indusk-docs/src/reference/admin-ui/component-conventions.md` — new "Routing" section documents the `/` vs `/p/[project]/...` split, the per-project layout convention, how to add cross-project vs per-project routes, and the `planHrefPrefix` prop on `PlanList`.

### Phase 4: Cross-project scorecards + stale-entry failure page + cwd-aware bare ui

**Goal**: the parts that need both Phases 2 (registry) and 3 (routing) to be in place. After this phase, every test trajectory row except T1/T2/T17 is passing.

- [x] Update `app/scorecards/page.tsx` — walker injects `project: entry.name` on each scorecard after reading the results.log so Scorecards.tsx can surface the label. The sort lives in `ScorecardsList` (`[...scorecards].sort((a,b) => b.timestamp.localeCompare(a.timestamp))`), which lets the page hand over an unsorted per-project union.
- [x] Update `Scorecards.tsx` to accept and display a project-name column on each card. Added an optional `project?: string` field to the `Scorecard` interface (it rides the existing `[key: string]: unknown` index signature, but the explicit key documents the contract). Each `ScorecardCard`'s title row renders `<Badge variant="neutral" data-testid="scorecard-project-label">{project}</Badge>` when present.
- [x] Create `apps/indusk-admin/src/components/StaleProjectFailurePage.tsx` — 200-page failure view. Two callable shapes: `{projectName, projectPath}` for the path-deleted case and `{projectName}` alone for the unregistered-name case. Both render the `data-testid="stale-project-failure"` marker (what the HTTP smoke asserts on) plus the recovery procedure naming `indusk update` and `~/.indusk/projects.json`.
- [x] Update `app/p/[project]/layout.tsx` — renders `<StaleProjectFailurePage>` when `getProjectPath(project)` returns null OR when `projectPathExists(path)` is false. Moved the `existsSync` wrapper into `registry-client.ts`'s new `projectPathExists` export so the layout imports only from registry-client (browser test runtime can mock it without reaching for `node:fs`). Plan-detail page uses the same helper and early-returns null when the project is stale so the layout's failure branch owns the final render.
- [x] Update `apps/indusk-mcp/src/bin/commands/ui.ts`'s `uiStart` — new `resolveOpenPath()` helper reads the registry and matches cwd against each entry's `path`. Both sides normalized via `realpathSync` so macOS's `/var` ↔ `/private/var` symlink doesn't cause a false mismatch (mkdtempSync returns the un-resolved form). Computed URL printed with `console.info('Opening ${url}')` — that line doubles as the T16 test-assertion surface.
- [x] Tests landed: `StaleProjectFailurePage.test.tsx` (3 browser tests), `http-stale-project.test.ts` (2 HTTP tests covering both deleted-path and unregistered-name branches), `http-scorecards-cross-project.test.ts` (1 HTTP test, moved from `src/app/scorecards/` to `src/__tests__/` so it lands in the node vitest project, not browser), `cli-bare-ui-cwd-aware.test.ts` (2 CLI subprocess tests for cwd-aware opening).

**Discovered during Phase 4**: running multiple HTTP smoke tests (each spawns `next dev`) in parallel reliably fails with ECONNREFUSED — `next dev` can't reach "Ready in" stdout within 30s under CPU contention. Fix: added `fileParallelism: false` to the node vitest project so HTTP tests serialize per file. Non-HTTP node tests pay a tiny serial overhead but run in ms each.

#### Phase 4 Verification
- [x] T11 passes — `pnpm vitest run src/components/StaleProjectFailurePage.test.tsx src/__tests__/http-stale-project.test.ts` → 5/5 (3 component + 2 HTTP)
- [x] T15 passes — `pnpm vitest run src/__tests__/http-scorecards-cross-project.test.ts` → 1/1 (two fixture projects labeled correctly)
- [x] T16 passes — `pnpm vitest run src/__tests__/cli-bare-ui-cwd-aware.test.ts` → 2/2 (cwd-match opens `/p/{name}/`, unregistered opens `/`)
- [x] All admin-ui tests green — `pnpm vitest run` → 81/81 across 14 files
- [x] Indusk-mcp suite: 410/411. The same pre-existing stale `agent-roles` failure from Phase 3 (archived plan referenced by an older test fixture). Not a Phase 4 regression.

#### Phase 4 Context
- [x] Added to CLAUDE.md Known Gotchas: admin-ui registry never auto-pruned — `/p/{name}/` shows StaleProjectFailurePage (200, not 500/404) when the registered path is missing or the name is unregistered. Recovery = CLI-only (`indusk update` or hand-edit `~/.indusk/projects.json`).

#### Phase 4 Document
- [x] (folded into Phase 5's overview.md update — failure page + cross-project scorecards + cwd-aware bare `indusk ui` all documented alongside the daemon model)

### Phase 5: Ship — version bump, changelog, build, publish, smoke

**Goal**: 1.27.0 lands on npm with all the prior phases bundled. Smoke on dusk + Numero closes T1, T2, T17 (the assertions that require a real published install).

- [x] Bump `apps/indusk-mcp/package.json` version → 1.27.0 (new feature: daemon hosting model + breaking change from 1.26.0's per-project mode).
- [x] Add changelog entry to `apps/indusk-docs/src/changelog.md` per ADR's Documentation Plan: 1.27.0 entry naming the daemon model, the registry, the breaking change, the bundling decision (variant A3), and the cross-project scorecards. Include the migration note: "1.26.0 users: run `indusk init` once per project to register, then `indusk ui start` from anywhere."
- [x] Update `apps/indusk-docs/src/reference/admin-ui/overview.md` per ADR's Documentation Plan: replace the per-project CLI section with the daemon model; document the registry; document the homepage + per-project routing; include the architecture diagram (Mermaid sequence: `indusk ui start` → daemon spawn → registry read → browser request → per-project file read).
- [x] Create `apps/indusk-docs/src/reference/admin-ui/cli.md` per ADR's Documentation Plan: full CLI reference for `indusk ui start/stop/status`, exit codes, env vars (`INDUSK_HOME`), port behavior (default 3939, auto-bump on conflict), with the routing tree diagram.
- [x] Build + publish: `cd apps/indusk-mcp && pnpm publish` (user action). `prepublishOnly` runs the admin build automatically. **Shipped 1.27.0 then 1.27.1 in same phase** — 1.27.1 adds `indusk ui restart` subcommand (scope addition surfaced during smoke: 1.26.0 leftovers held port 3939 and `indusk ui start` no-ops on running daemon per T4, so users had no one-command recovery after `npm i -g`).
- [x] User upgrades global indusk-mcp on dusk + Numero (`indusk update` from each).
- [x] Smoke on dusk: `indusk ui restart` from dusk. Browser opens, project grid shows dusk + numero, click into dusk → plans render, `indusk ui status` reports running. Closed T1, T2, T17 for dusk.
- [x] Smoke on Numero: Numero is registered in `~/.indusk/projects.json`. `indusk ui restart` picks up Numero as a second project; browser shows numero in the grid; clicking into numero renders plans correctly. Closed T17 + the implicit "Numero works" success criterion that motivated this entire plan.

#### Phase 5 Verification
- [x] T1 passes — live `indusk ui start` on dusk completes in <3s and prints the URL
- [x] T2 passes — live: close terminal, daemon survives, URL still reachable
- [x] T17 passes — Numero (a non-dusk project running globally-installed 1.27.1) gets a working `indusk ui start` with no `pnpm install` step
- [x] All Phase 1–4 tests still green (regression check)

#### Phase 5 Context
- [x] Update CLAUDE.md "Current State": "**`admin-ui-hosting` shipped in indusk-mcp 1.27.0** — single long-lived native Node daemon hosts the admin UI for every InDusk project on the machine. `indusk ui start/stop/status` lifecycle. `~/.indusk/projects.json` registry populated by `indusk init`/`update`. Routes scope under `/p/[project]/...` with `/` as project grid and `/scorecards` cross-project. Pre-built Next.js production bundle (variant A3) shipped in tarball — consumers need zero extra tooling. Replaces the broken per-project model in 1.26.0."

#### Phase 5 Document
- [x] (overview.md + cli.md + changelog updates above ARE the Phase 5 docs; ADR publish to `apps/indusk-docs/src/decisions/admin-ui-hosting.md` happens in retrospective per the docs plan)

### Phase 6: UX polish — scorecards siloing, research section, brief collapsible (1.27.2)

**Goal**: three deferred UX improvements batched into 1.27.2 after the 1.27.x daemon model proved stable in smoke. Scorecards become per-project (matching the rest of the project-siloed architecture), standalone `.indusk/research/` gets first-class treatment in the per-project view, and the Brief section reaches parity with Test Plan + ADR for expand/collapse control.

- [x] ~~Add `readProjectScorecards(projectRoot)` helper~~ — existing `readEvalScorecards(projectRoot, {from, to})` already operates per-project, so no new helper needed. Called directly from the new route.
- [x] Create `apps/indusk-admin/src/app/p/[project]/scorecards/page.tsx` — server component reading the current project's scorecards via `readEvalScorecards`, rendering `<ScorecardsList>` (without project-label column). Mirrors per-project layout's stale-path handling via `<StaleProjectFailurePage>`. Empty state when no scorecards yet. T19.
- [x] Remove top-level `apps/indusk-admin/src/app/scorecards/page.tsx` (route goes 404). Cross-project scorecards view is deliberately out of scope in Phase 6 — project-siloed is canonical. T19.
- [x] Add "Scorecards" link to the per-project sidebar in `apps/indusk-admin/src/app/p/[project]/layout.tsx` — `<nav>` block above `<PlanList>` with a single Next `Link` to `/p/${project}/scorecards`. T19.
- [x] Add `readProjectResearch(projectRoot)` + `readResearchContent(projectRoot, slug)` to `apps/indusk-admin/src/lib/planning-reader.ts`. `readProjectResearch` returns `ResearchEntry[] = { slug, path, title, isDirectory }` — top-level `.md` files OR subdirs with optional `README.md`. `readResearchContent` resolves `{slug}.md` or `{slug}/README.md`, rejects path-traversal (`..`, `/`, leading `.`). Missing dir → `[]`; missing slug → `null`. T20.
- [x] Create `apps/indusk-admin/src/app/p/[project]/research/[slug]/page.tsx` — server component reads via `readResearchContent(projectPath, slug)` and renders `<Markdown>`. `notFound()` for missing slugs. Shares stale-path handling with sibling `/p/{project}/...` routes. T20.
- [ ] Add "Research" group to the per-project sidebar in `apps/indusk-admin/src/app/p/[project]/layout.tsx` listing every research slug as a link to `/p/{project}/research/{slug}`. Empty state: omit the group entirely when the research dir is absent or empty (don't render an empty header). T20.
- [ ] Wrap the Brief section in `apps/indusk-admin/src/components/PlanDetail.tsx` inside `<CollapsibleSection>` with `defaultOpen={true}` — same pattern as the existing Test Plan + ADR wrappers. T21.
- [ ] Bump `apps/indusk-mcp/package.json` version → 1.27.2.
- [ ] Add changelog entry to `apps/indusk-docs/src/changelog.md` naming the three changes; flag scorecards relocation as a minor breaking-change for bookmarks (`/scorecards` is gone; use `/p/{project}/scorecards`).
- [ ] Update `apps/indusk-docs/src/reference/admin-ui/overview.md` "Routing tree" + "What each page shows" sections — replace `/scorecards` row with `/p/{project}/scorecards`, add `/p/{project}/research/{slug}`, note Brief is collapsible.
- [ ] Update `apps/indusk-docs/src/reference/admin-ui/cli.md` Routing tree section to match.
- [ ] Build + publish: `cd apps/indusk-mcp && pnpm publish` (user action).
- [ ] Upgrade global: `npm i -g @infinitedusky/indusk-mcp@1.27.2 && indusk ui restart`.
- [ ] Smoke: browse `/p/dusk/scorecards` → sees dusk's scorecards; `/p/numero/scorecards` → sees numero's. Top-level `/scorecards` → 404. `/p/dusk/research/anchor-overlay-pattern` → renders markdown; sidebar lists research slugs. Plan detail: Brief section has a working chevron. Closes T19, T20, T21.

#### Phase 6 Verification
- [ ] T19 passes — `/p/{project}/scorecards` renders only that project's scorecards; top-level `/scorecards` is removed (404)
- [ ] T20 passes — `/p/{project}/research/{slug}` renders markdown from `.indusk/research/`; per-project sidebar lists slugs; empty state hides the group
- [ ] T21 passes — Brief section is visually collapsible with working chevron; default expanded
- [ ] All Phase 1–5 tests still green (regression check)

#### Phase 6 Context
- [ ] Append to CLAUDE.md "Current State": "1.27.2 follow-up on 2026-04-20 — scorecards became project-siloed under `/p/[project]/scorecards`, per-project research section at `/p/[project]/research/[slug]` backed by `.indusk/research/`, Brief section made collapsible in PlanDetail. Top-level `/scorecards` removed — bookmark break, no replacement planned (cross-project scorecards view is deliberately out of scope; project-siloed is canonical going forward)."

#### Phase 6 Document
- [ ] overview.md + cli.md updates above ARE the Phase 6 docs (routing tree changes, new research route, Brief collapsibility note). No separate guide page needed — these are additive documentation changes.

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

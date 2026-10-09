@AGENTS.md

# indusk-admin — rules for working in this app

Loaded by Claude Code when a file under `apps/indusk-admin/` is read. Rules that
apply only here; cross-cutting design intent stays in the root `CLAUDE.md`.
Each entry is a rule and a pointer; the pointer holds the story.

- **The admin writes only through the package**: its routes (`app/api/sessions/`)
  start, answer and stop sessions through `@infinitedusky/indusk-mcp/session`,
  and plans change through `/plans`; no file in this app writes a plan file,
  spawns a process (beyond the two read-only git readers) or parses Claude's
  protocol. Guarded by `admin-uses-package-commands.test.ts`.
- **Every handler under `app/api` calls `adminOnly(request)` first**: the
  `Host` must be the admin's own (`isAdminHost`), and a `POST`'s `Origin`
  must match it. Listening on 127.0.0.1 is not enough: DNS rebinding points
  another site's name there, and its `Origin` and `Host` agree. Guarded by
  `admin-hosts.test.ts`, which calls every handler every route module
  exports. The session panel
  (`components/session/`) renders the events the package's protocol produced
  and sends a person's choices back through the routes; a client component
  imports only *types* from `/session`, whose code is Node's. — see
  `/reference/admin-ui/sessions`
- **What a plan's page offers is one rule, `planActions`**: a plan is started
  by its worktree in normal mode or its `code.json` in a workbench, and gets
  the same buttons either way; a workbench session runs at the root with the
  code worktree added (`planLocation`). — see `/reference/admin-ui/sessions`
- Next.js App Router viewer over `.indusk/planning/` + each project's eval results in its home,
  hosted as one machine-global daemon (`indusk ui start/stop/restart/status`,
  registry `~/.indusk/projects.json`, routes `/p/[project]/...`). Custom
  Tailwind primitives — no shadcn, no Radix. Reuse indusk-mcp's parsers through
  workspace subpath exports; never duplicate parsing. Bundled pre-built into
  the tarball by `prepublishOnly`. Why a standalone read-only viewer — see
  `/decisions/indusk-admin-ui`; why one daemon and a registry — see
  `/decisions/admin-ui-hosting`
- Tailwind 4 needs Node 22 ("Cannot find native binding" on 18).
- **The plan page is live**: `LiveRefresh` probes the page and
  `router.refresh()`es every `admin.refresh_ms` (default 5000), pauses when
  hidden, stops visibly on failure; the Promises page is live the same way (also
  its health cache); no other page polls. — see `/reference/admin-ui/overview`
- **The sidebar tree is derived entirely from declarations** — one root node
  (`readPlanDeclarations().root`) with parents and unclaimed plans beneath it;
  directly under the root means unclaimed. Grouping lives in
  `PlanList.buildGroups`; subplan children resolve against active + archived
  with active winning, identically in sidebar and detail; parents render
  additively via `ParentPlanView`, doc-less plans header-only.
- **Phases render through `parseImplString`** (the `impl-parser` subpath) —
  never a local heading regex; rows attach by `(passesAtKind, passesAt)`. The
  active phase is the most recent boundary record among open phases;
  first-open-phase with a visible hint when there are none; a malformed record
  file is an error block, never a guess. The rows table shows `Level` and
  `For` from the package's parser (`levelText`, `purpose`), never its own
  reading of a cell; the copied markdown carries the same columns.
- **One home per piece**: rows table + ritual section in `components/phases/`,
  progress lines in `bars/ProgressLines`, display vocabulary (incl. `phaseTitle`
  — the page says `Phase 4`; the package's `phaseLabel` is for logs, never a
  component) and every chip/label map in `bars/labels.ts`, badge maps in
  `ui/badge-variant.ts`, research reads in `lib/research-reader.ts`, project
  reads in `lib/project-reader.ts` (config via the `./config` subpath, never
  parsed by hand). Pinned by `cleanup-pins.test.ts`.
- The label maps are `satisfies Record<…>` over the lifecycle's unions and
  `lifecycle-render-parity.test.ts` names any member without a renderer. A
  plan's type and what it requires come only from the `workflow-types` subpath;
  a component never restates a document list.
- **Papers** render from the shared parser's `papers` field; `published
  (stale)` is derived from the content hash on every read; a papers-only plan
  takes the paper-stage status as its header status.
- **The Promises page** reads only through the `promises/registry` subpath
  (`lib/promises-reader.ts`, which also derives "holding N"); marks — the
  chips' and the timeline's — come from the store (`lib/promise-timeline.ts`),
  which reads only uncovered ranges, never the whole window per request, and re-reads a
  late tail (`lesson: a-store-that-reads-only-what-is-new-must-still-read-what-arrives-late`); the store and the
  health read take `Deps` (clock, resolve, read, probe) and their rules are tested with
  `fakeSource` (`lesson: code-that-decides-takes-its-clock-and-its-reads`); a test that starts `next dev`
  or a server belongs in `vitest.tiers.ts` `SYSTEM` (`lesson: everyday-tests-never-wait`); observed health in
  `lib/promise-health.ts` (one cached 2 s read per source; a behaviour
  promise has a chip per source, the alarm source's first, and the sidebar's
  red follows the alarm source only; unreachable = hollow, never
  green; reads from `promises/sources`; *watcher blind* — `WatcherBlind`, from `promises/sources`
  beside `JaegerUnreachable` — is a state of the read with its own banner,
  never a chip colour); `monitor` is the one time-filled bar segment; a violated row names the
  span's environment or says unknown. Readers import `telemetry/status.ts`,
  never `daemon.ts` (Turbopack parses its binary). The heard counts come from
  the home's `heard.jsonl` through the `promises/heard` subpath
  (`readProjectHeard`), never a second reader; incidents (`IncidentsTable.tsx`)
  show their age, worded by `promises/age` as the CLI words it, and their
  owner's Maintenance phase.
- **The daemon records production breaks** from `src/instrumentation.ts`:
  one package loop (`admin/recorder-loop`) per registered project that names
  `promises.jaeger`, every `admin.refresh_ms`, each pass the package's
  `recordBreaks`; a local-only project gets none, and `ui stop` ends the loops
  with the process. The admin composes; the writing is the package's. Guarded
  by `admin-recorder.test.ts` (system tier). — see `/decisions/incident-recording`
- **Active plans and their boundary records are read from each plan's live
  root** (`worktree/plan-worktrees`); `components/Worktrees.tsx` renders the
  worktree chip, a broken assignment, unassigned worktrees and the record error.
- Tests: `next/link` needs a `vi.mock` stub in vitest browser tests
  (synchronous factory); a page that gains a `lib/*` import needs that module
  mocked in every browser test that renders it (`node:fs` is externalized);
  browser tests mock every export a component imports, from the module it
  imports from. HTTP-level tests boot `next dev` through
  `__tests__/helpers/next-dev.ts`, one at a time — Next locks `.next/`, so
  `fileParallelism: false` is load-bearing and a stray dev server on the app
  dir fails every smoke; the live rows drive it with Playwright from the node
  project. `typecheck.test.ts` makes `tsc` a test. — see
  `/reference/admin-ui/component-conventions`
- `dynamic = "force-dynamic"` in the root layout is load-bearing; markdown
  renders only through `<Markdown>`; the registry is never auto-pruned
  (`indusk ui prune [--dry-run]` backs up first); `runCli` pins `INDUSK_HOME`
  to a temp dir; malformed files quarantine to `.corrupt.{ISO}.bak`; daemon
  identity = PID liveness AND port-listening; the scorecard-to-plan join is
  date-range approximate.

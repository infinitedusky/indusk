@AGENTS.md

# indusk-admin — rules for working in this app

Loaded by Claude Code when a file under `apps/indusk-admin/` is read. Rules that
apply only here; cross-cutting design intent stays in the root `CLAUDE.md`.
Each entry is a rule and a pointer; the pointer holds the story.

- **The admin writes only through the package**: its routes start, answer and
  stop sessions through `@infinitedusky/indusk-mcp/session`, change plans
  through `/plans`, and keep a project conversation through `./new-project`;
  no file in this app writes a plan or project file, spawns a process (beyond
  the two read-only git readers) or parses Claude's protocol. Guarded by
  `admin-uses-package-commands.test.ts`.
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
- **The project conversation renders a thread, not the session panel**:
  `lib/conversation-turns`'s `turnsOf(events)` reads a session's events as
  alternating you/agent turns (the reply is the last text, the tools and
  earlier text are its working, an open question or permission is *waiting* and
  never folded; each agent turn has a `status` - working, done or stopped - drawn
  as `Message`'s dot, and Start launches the agent so the thread opens with it
  working); `ConversationThread` draws them as `Message` bubbles, the
  reply through `Markdown`; the draft's `transcript.jsonl` (appended by
  `startProjectConversation`) is what a reopened page shows. The plan
  conversation, builds and Fix with Claude still use the session panel until
  they move. Guarded by `conversation-turns.test.ts` and
  `ConversationThread.test.tsx`. — `promise: a-project-conversation-is-a-back-and-forth`
- **What a plan's page offers is one rule, `planActions`**: a plan is started
  by its worktree in normal mode or its `code.json` in a workbench, and gets
  the same buttons either way; a workbench session runs at the root with the
  code worktree added (`planLocation`). — see `/reference/admin-ui/sessions`
- **A plan route finds its plan through `lib/plan-page`'s `readPlanPage`**,
  never its own lookup: the plan page, `/brief` and `/doc/[doc]` share the
  registry lookup, the stale-path `null` and the active-over-archived find.
  Guarded by `plan-page.test.ts`.
- Next.js App Router viewer over `.indusk/planning/` + each project's eval results in its home,
  hosted as one machine-global daemon (`indusk ui start/stop/restart/status`,
  registry `~/.indusk/projects.json`, routes `/p/[project]/...`). Custom
  Tailwind primitives — no shadcn, no Radix. Reuse indusk-mcp's parsers through
  workspace subpath exports; never duplicate parsing. Bundled pre-built into
  the tarball by `prepublishOnly`. Why a standalone read-only viewer — see
  `/decisions/indusk-admin-ui`; why one daemon and a registry — see
  `/decisions/admin-ui-hosting`
- **The plan page is live**: `LiveRefresh` probes the page and
  `router.refresh()`es every `admin.refresh_ms` (default 5000), pauses when
  hidden, stops visibly on failure; the Promises page is live the same way (also
  its health cache); no other page polls. — see `/reference/admin-ui/overview`
- **The sidebar tree is derived entirely from declarations** — one root node
  (`readPlanDeclarations().root`) with parents and unclaimed plans beneath it;
  directly under the root means unclaimed. Grouping is
  `lib/plan-groups.ts`; subplan children resolve against active + archived
  with active winning, identically in sidebar and detail; parents render
  additively via `ParentPlanView`, doc-less plans header-only.
- **Phases render through `parseImplString`** (the `impl-parser` subpath) —
  never a local heading regex; rows attach by `(passesAtKind, passesAt)`. The
  active phase is the most recent boundary record among open phases;
  first-open-phase with a visible hint when there are none; a malformed record
  file is an error block, never a guess. The rows table shows `Level` and
  `For` from the package's parser (`levelText`, `purpose`), never its own
  reading of a cell; the copied markdown carries the same columns.
- **One home per piece**: rows table `components/phases/`,
  progress lines `bars/ProgressLines`, display vocabulary (`phaseTitle`:
  `Phase 4`, not `phaseLabel`; a plan is `plan.title`, initials from it, the
  handle only for links, data attributes) and chip/label maps in
  `bars/labels.ts`, badge maps `ui/badge-variant.ts`, research reads
  `lib/research-reader.ts`, project reads `lib/project-reader.ts` (config
  via `./config`, never hand-parsed). Pinned by `cleanup-pins.test.ts`.
- The label maps are `satisfies Record<…>` over the lifecycle's unions and
  `lifecycle-render-parity.test.ts` names any member without a renderer;
  phases are keyed `{kind, number}`, an absent kind a build phase
  (`/decisions/admin-ui-phase-progress`). A
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
  by `admin-recorder.test.ts` (system tier). An HTTP test whose fixture names a
  `promises.jaeger` runs this recorder too: assert through its incidents, never a
  hand-written one beside them. — see `/decisions/incident-recording`
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
  identity = PID liveness AND its command line, never its port
  (`lib/process-identity.ts`); the scorecard-to-plan join is date-range
  approximate.
- **Promise timeline**: compact sliced reads;
  an admin store that reads only what is new plus a late tail; one
  `violationState` (unrecorded / open / fixed) for chip and timeline;
  incidents record `fixed` via `promises fix`. — see
  `/decisions/promise-timeline`
- **Admin plan authoring**: `plans start →
  approve → build → accept → land`, through the developer's own `claude`;
  nothing lands unaccepted. — see `/decisions/admin-plan-authoring`
- **A fact the cockpit shows is read from a package module** (`promises/standing`,
  `proof`, `fix`; `plans/steps`, `waiting`, `history`); the admin's `lib/` holds
  only fs-to-props glue, never a second definition. What a plan waits on is
  `planWaiting`'s answer alone, amendments included; the nav and the page add
  none. Guarded by `cockpit-single-definition.test.ts`. — see
  `/decisions/plan-cockpit`
- **A look's state is read from `promises/standing` and `looks/*`, never
  computed here**: the Looks page reads `looks/overview`, the dashboard and the
  nav's broken count `readLookStanding`, Approve calls `looks/approvals`'
  `approve` (the person is `approver`; the mockup's and the foundation's
  hashes the ones the page showed, each mockup's in a group). The approve
  route also requires the browser-set `Sec-Fetch-Site: same-origin`, which a
  local process that sets `Host` and `Origin` does not send — guarded by
  `looks-approve-binding.test.tsx`.
  Guarded by `cockpit-single-definition.test.ts` (`approvalOf`, `coverageOf`,
  `verdict`, `lookStandingOf`). The Looks page tests run in the node project
  (`vitest.tiers.ts` `NODE_PAGES`) against a real fixture project; a listed
  path under `[project]` is escaped (`asGlob`) before vitest globs it. — see
  `/reference/admin-ui/overview`
- **The admin's look is held by `.indusk/mockups/admin/`**: every colour, size,
  radius, font and motion value is a token of its foundation, generated into
  `src/app/foundation.generated.css` by `indusk looks tokens admin --tailwind`
  (never edited by hand); Tailwind's stock theme is reset to it, so a stock
  class has no value to compile. A new screen, state or `data-component` needs
  its mockup approved first. Guarded by `looks-admin-foundation.test.ts`,
  `indusk looks coverage admin` and `indusk looks check admin`. Two traps: layout
  is not a token and the value check does not see it (`translate-x-0` once
  compiled to nothing and left the nav off-screen), so a restyle is also looked
  at; and the Typography plugin is gone — `.prose` is written on the foundation
  in `globals.css`. — see `/decisions/ui-promises`
- **A plan's page shows its brief's three parts from `plans/parts` and computes
  none**: promises, expectations and looks (each look the approved `LookRow`
  with `LookFrame` one click on, proposed until a person approves it on the
  Looks page) and any waiting amendment come from the package's
  `readPlanParts`, read from the plan's own checkout on every request; Approve
  on an amendment posts to `plans/[name]/reapprove`. The review's `evidence`
  group is read, not signed off. Guarded by `cockpit-single-definition.test.ts`
  and `plan-parts.test.tsx` (A15). — see `/reference/admin-ui/overview`
- **A decision's card is read again from what the daemon holds after every
  answer**: a started release clears the build's stop and a second accept is
  refused while it runs, and an answer delivered but not recorded is reported
  sent, never failed. Guarded by `src/lib/build-host.release.test.ts` and
  `src/lib/decisions.test.ts`. — see `/decisions/plan-cockpit`
- **Storybook is `@storybook/nextjs-vite`; its story tests are the system
  tier's**: the `storybook` vitest project is named in `SYSTEM_PROJECTS`
  (`vitest.tiers.ts`) and defined by `vitest.config.ts` only for a run the
  system config started, so `pnpm test` never renders a story; `next` stays at
  16.2.x until storybookjs#36720. `build:storybook` writes the git-ignored
  `public/storybook/`, which the admin serves at `/storybook/index.html`.
  Guarded by `everyday-tests-never-wait.test.ts` (A21). — see
  `/decisions/storybook-components`
- **A component is one file whose root carries `data-component`; a screen
  never carries a component's marker**: a name marked in two files, or a
  screen writing a component's element out beside its own file, is refused by
  `indusk looks lint admin` (`duplicate component`, `component markup outside
  its file`). Read `.indusk/mockups/admin/components.json` — each component's
  file, properties and states, written by `indusk looks stories admin` — before
  writing one; a marked component with no story is listed in `screens.json`
  `uncatalogued` until it has, and the list only shrinks. Guarded by
  `looks-components-cli.test.ts` (A1, A3, A14) and `component-reuse-audit.test.ts`.
  — see `/decisions/storybook-components`
- **A component a mockup names is one file, with a story per state, and
  presentational**: its root carries `data-component="<name>"`, a second
  marker anywhere is a finding, data arrives as props. Nineteen in
  `components/ui/`, listed in `/reference/admin-ui/component-conventions`.
  Guarded by `looks-components-cli.test.ts` (A1, A3) and
  `looks-admin-components.test.ts` (A2).
- **Stories are shown from the served `/storybook`, never from a Storybook dev
  server, and approved by their snapshot hash**: the Looks page frames
  `/storybook/iframe.html?id=<id>` (the id is in `components.json`) at the
  component's own size, a device chosen only on request, in a list-and-stage
  view or a cascade; a story's Approve sends the snapshot hash it showed and a mockup's
  its `componentsHash`, through the one approve route. Guarded by
  `looks-components.contract.test.ts` (A18) and `looks-components.test.tsx`.
  — see `/decisions/storybook-components`
- **A new admin screen's mockup composes existing components and declares
  any new one; a composed component must draw as its story does**: a mockup
  places a component by `<indusk-component name state>` and draws none of its
  markup (`component drawn in mockup`), declares a new one and gets a story, and
  changing a component's markup or style reopens every mockup that uses it.
  A component's styles are generated per component into
  `.indusk/mockups/admin/components/<name>.css` and are **unlayered** — a
  mockup's own page styles are, and an unlayered rule beats a layered one — so
  never hand-edit one and never rewrite the generator to layer. A person's
  Unapprove takes an approval back; an agent's is refused. Guarded by
  `looks-components-cli.test.ts` (A8, A9, A25–A28) and
  `composition.contract.test.ts` (A30, which compares a composed component with
  its story and cannot see a defect inside the component). — see
  `/guide/components`
- **A page composes components and passes them data as props; it renders no
  component's markup itself**: the nav is `Shell` and `Nav` with `PlanRow` and
  `ViewLink` (a row or link given an `href` is drawn as a link, so the page
  hands it where to go), the dashboard `SummaryBar` and `PromiseRow`, the Looks
  list `LookRow` with `DeviceChoice` and `DeviceFrame` at the stage. A piece a
  test must find (`data-testid`) goes in a wrapper or in a slot the component
  takes (`stage`, `count`, `evals`, `toggleProps`, `optionProps`), never into
  the component's markup, which would reopen every mockup that uses it. Guarded
  by `looks-components-cli.test.ts` (A3) through `component-reuse-audit.test.ts`.
  — see `/reference/admin-ui/overview`
- **Whether a plan's document is finished comes from `plans/steps`'
  `documentFinished`, never a status compared in the admin** — `complete` and
  `accepted` both finish a brief, and a `superseded` one or an archived plan has
  no current step; a hand-written `=== "accepted"` showed "The brief is
  incomplete" on finished plans. Guarded by `PlanSummary.test.tsx` (A28). — see
  `/reference/admin-ui/overview`
- **The nav's width is the person's, per browser; its tree is drawn by
  `nav.expanded`**: `CockpitFrame` keeps the width in `localStorage`
  (`indusk-admin.nav.width`), no `NavHandle` below 760 px; every width goes
  through `NavHandle`'s `clampNavWidth` (drag, key step, kept width, `?nav=`).
  `PlanList` only draws the tree (`NavPath`, `PlanRow`, `NavGroup`), never its
  own markup. Guarded by `CockpitFrame.test.tsx` (A1–A4) and
  `PlanList.test.tsx`. — see `/decisions/cockpit-redraw`
- **The brief page and plan page are held to `brief.*` and `plan.*`**: each
  reports its state with `data-look-state` (`lib/look-state.ts`), never a
  `?state=`; `screens.json` lists one path per state at A10's fixture plans,
  which the real project lacks, so there the check names them `unchecked …
  answered 404`, never a failure. A change to either page is drawn and approved
  first; `?nav=<px>` sets the nav's width for one page. Guarded by
  `look-state.test.ts`, `cockpit-redraw.contract.test.ts` (A10). — see
  `/decisions/cockpit-redraw`
- **A running agent's events are heard through `useSessionEvents`** — `components/session/use-session-events.ts`, the one subscription every conversation uses (the `EventSource` on `/api/sessions/:id/events`, `running`, a refresh on a write and on exit, an `onWrite` callback). A new view of a session uses it rather than opening its own `EventSource`; a draft's agent is found with `draftSession`/`stopDraftSession` in `lib/new-project-session.ts`, never by comparing `sessionManager().current()?.plan`. Guarded by `use-session-events.test.tsx` (A34).

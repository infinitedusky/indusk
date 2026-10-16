---
title: "Looks check speed"
date: 2026-10-16
status: proposed
---

# Looks check speed

## Goal

**A look check opens only the looks whose inputs changed, opens each of those once, and refuses a server it would crawl through.**

Today `indusk looks check admin` loads 1,056 pages (176 looks × 3 devices × 2
schemes), each in a fresh browser context, and took 25–35 minutes on
2026-10-15/16 — waited on twice to confirm one row. A screen look costs 16–33
seconds, and most of a big page's measuring is the browser handing 75,000
values back one object at a time (1.15 s, against 30 ms to compute them). After
this, a check after a small change reports the unchanged looks from their last
held result in seconds, and a full check is about a minute.

## Y-Statement

**In the context of:**
`indusk looks check <app>`, which holds the running app to its approved
foundation by opening every approved screen state and story in Chromium at
every reference device and colour scheme and handing the measured values to
`looks/verdict`, run at every UI plan's live check and whenever a person wants
to know a look still holds.

**Facing:**
a cost that grows with every look × device × scheme whatever changed: six
fresh page loads per look, the server's render repeated six times for every
screen, a measurement whose return dominates its work, and no memory of what
held last time — so a one-row change costs the same half hour as a release,
and against `next dev` it is slower still.

**We decided for:**
keeping each look's last held result in the project's machine-state home,
keyed on what the look is held to (its snapshot hashes, the foundation, the
declarations and devices) and what it is drawn from (the stories rendered from
the current sources; for a screen, a hash of the app's page code and its seed),
decided by a pure `looks/reuse` rule; loading each look's page once and
measuring every device and scheme on it in place (device metrics set through
Chromium, the scheme by media emulation, running CSS transitions finished
before each measurement, the result returned as one JSON string); refusing a
development server from one HTTP fetch of a page, naming the app's declared
`serve` command; `--all` to reopen everything and `--only <name>` to check
named looks; a reused look sending an upheld signal marked reused, with when it
was really measured; and the full `--all` check of the admin as a system-tier test,
so it runs in the background after every landing and at every release.

**And against:**
keying reuse on the snapshot hashes alone (blind to a component edited without
a re-render, and to a screen's own page code); fingerprinting the scripts and
stylesheets each page loaded (one shared CSS file and shared chunks made it
reopen every look for a one-class change); hashing all of the app's sources
into every look (any edit reopens everything, so the check costs the same as
today); keeping held results beside the approvals in `.indusk/mockups/`
(committed state a reviewer would trust without running it); one page per
distinct pixel ratio (two loads where one does); and building and serving the
app automatically when given a dev server (the check would own a build it
cannot know how to make for every app).

**To achieve:**
a check after a one-component change that opens that component's stories and
the screens that compose it and reports every other look reused, in seconds; a
full `--all` run of about a minute against a production build; and no run that
spends half an hour in a development server.

**Accepting:**
that a screen's data (plans, promises the admin renders) is in no key, so a new
element with a raw value appearing only because the data changed is reused
past in a plan's phases until the full check after the next landing; that a
broken look found there is an incident after the fact, never a blocked landing;
that any edit to page code reopens every screen; that the
stories must be rendered before anything is reused after a source change; and
that dev-server detection reads known markers (Next, webpack, Vite) and would
miss an unknown framework's.

**Because:**
the snapshots are rendered output, so a component used inside another changes
both, and the stylesheet hash is the component's own CSS slice — the most
precise record of what a look draws that already exists, and the one approvals
bind; making their currency a condition of reuse closes the one way they go
stale. In-place measuring was measured equal to fresh loads once transitions
are finished, and one string instead of 75,000 objects is a tenth of the cost.
Machine state is where InDusk keeps what only one machine's build makes true.

## Context

[research.md](research.md) has the measurements: per-look costs both ways, the
server's 41 s floor for 48 screen renders, the transfer cost, the in-place
comparison and its transition finding, the dev and production probes. The
[brief](brief.md) promises `a-look-check-costs-what-changed` with five clauses
and must not break `tokens-are-held-exactly` or `everyday-tests-never-wait`;
the [test plan](test-plan.md) holds 26 assertions under them.
Sandy's decisions of 2026-10-16 (research, Decisions): a reused look sends an
upheld signal marked reused; landing and release always run the full check,
in the slow tier, which never blocks either (the 2026-10-08 rule, kept); the
60-second full run stays an expectation.

Rules this lands under: "A look's verdict is decided in `looks/verdict` from
values handed to it; the browser only measures" (`apps/indusk-mcp/CLAUDE.md`);
"Every looks hash is computed in `mockups.ts`"
(`apps/indusk-mcp/src/lib/looks/CLAUDE.md`); machine state lives in
`bookkeepingRoots(cwd).home` (`/decisions/bookkeeping-lives-where-it-is-read`).

## Decision

1. **A held result is kept per look, in machine state.**
   `<project home>/looks/<app>.json` (`bookkeepingRoots(projectRoot).home`),
   written atomically after each run: for each look (`story:<name>` or
   `screen:<name>`) whose every device × scheme held, its key and when it held.
   A look broken or unchecked at any device is removed, so it is reopened. The
   file is the same from every worktree of the project; the key decides reuse.

2. **A look is reused only when its key is unchanged, decided in
   `looks/reuse`.** The rule takes the stored record and the current key as
   values and returns *reuse* (with when it held) or *reopen* (with the first
   input that changed, for the output). The key:
   - every look: `app.foundation.hash`, `app.declarationsHash`, the device
     list and the schemes;
   - a story: `Story.hash` and `Story.stylesheetHash`;
   - a screen: the composed `Mockup.hash` and `Mockup.componentsHash`, the
     page path and state, the seed and unseed text, and `pageSourcesHash` —
     sha256 over the path and bytes of every file under the app's `sources`
     that is not a catalogued component's implementation, a story or a test.
   Nothing is reused unless the catalog was rendered from the current sources:
   the render step (`looks/stories`) records `renderedFrom`, a hash of every
   file under `sources`, in `components.json`, and the check compares it with
   the sources now; a catalog without it is not current (absence is a rule, not
   a migration). A screen named in `uncomposed` is never reused. Both new hashes
   are computed in `mockups.ts`.

   *Amended 2026-10-16 (Build Phase 3).* Two more inputs close ways a token
   change could be hidden. The configuration a look is drawn with that no source
   file holds — the app's Tailwind and PostCSS config, its `.storybook` folder
   and `pnpm-lock.yaml` — is hashed (`configHashOf`, in `mockups.ts`) into every
   look's key. And the build served at `--url` is checked against the sources,
   not put in the key: the check reads the app's root (and the first story's
   frame) once, takes the identity of the build from the page's script and
   stylesheet names and inline styles (`servedBuildOf`), and keeps it with the
   sources hash on each held record; the same sources must be served by the same
   build, and edited sources by a rebuilt one, so a server still on the build
   from before an edit reopens the look instead of recording it held. A build
   identity inside the key was the first reading and is the fingerprinting
   rejected below: a rebuild after one component edit changes the page's chunks
   and stylesheet for every look. A page that cannot be read, or that loads
   nothing to tell by, reuses nothing.

3. **`--all` reopens every look; `--only <name>` (repeatable) checks the looks
   of that name** — a screen state, a story, or both — measured even when
   reusable, and nothing else opened or reported. An unknown name is refused,
   named, before any page opens.

4. **A look loads once, and every device and scheme is measured on that
   page.** One context and page per look; for each device,
   `Emulation.setDeviceMetricsOverride` (width, height, pixel ratio) through a
   CDP session; for each scheme, `page.emulateMedia({ colorScheme })`; then two
   animation frames, every running `CSSTransition` finished, and the measure.
   A story is opened with the theme global left to `match`, so it follows the
   emulated scheme like a screen; `judgeStory`'s scheme check still holds the
   page to the scheme it drew. The measure returns `JSON.stringify` of its
   result, parsed in Node. A look that does not load or draw in time is
   unchecked at every device and scheme (`openWithinTime` around the load).
   Unseeded screens open three at a time, seeded screens one at a time after
   them, stories eight at a time.

5. **A reused look sends a signal marked reused** (Sandy, 2026-10-16).
   `reportLooks` emits, for each reused look, one `indusk.looks.check` span per
   device × scheme with the outcome of the result reused (upheld), plus
   `indusk.look.reused = true` and `indusk.look.measured_at` (the ISO time it
   was really measured), both added to `LOOK_MARK`. A look's standing keeps
   reading holding and never decays to no signal, and a reader can always tell
   a reused span from a fresh measurement. Its output line is
   `reused  <subject> — held <when>, unchanged`, one per look, and the summary
   counts it beside held, broken and unchecked; a run where everything was
   reused exits 0.

6. **A development server is refused before any look opens.** When at least
   one look must be opened, the check fetches the first screen's page (or the
   Storybook frame, when only stories are opened) over plain HTTP and hands its
   HTML to `devServerMarker` in `looks/dev-server`, which returns the marker it
   found — Next's Turbopack HMR client (`hmr-client`), webpack's
   `react-refresh`, `/_next/webpack-hmr`, Vite's `/@vite/client` — or null. A
   marker refuses the run: `<url> is a development server (<marker>) — build
   and serve the app, then check again: <serve>`, where `<serve>` is the
   app's new optional `serve` in `screens.json` (not part of the declarations
   hash), or, when it declares none, how to declare one. The admin declares
   `pnpm --filter indusk-admin build && pnpm --filter indusk-admin start --port 3940`.

7. **Landing and release always run the full check; plan phases use the fast
   default** (Sandy, 2026-10-16). The full check is a system-tier test,
   `looks-admin-all.contract.test.ts`: it starts the bundled admin (built by
   `test:system`'s `prepublishOnly`) on a free port with a temporary
   `INDUSK_HOME` and runs `indusk looks check admin --all --url <it>`, failing
   on any broken look. The system tier runs in the background after landing
   and at release (`workflow.steps.release.slow_tests`, `pnpm -w test:system`,
   `when: after`) and never blocks either — the 2026-10-08 rule, kept (Sandy,
   2026-10-16). No step declaration changes. A broken look there fails a JUnit
   file whose trajectory row names `tokens-are-held-exactly`, and is routed to
   that promise as an incident.

## Alternatives Considered

### Reuse keyed on the snapshot hashes alone

What the research first proposed and the brief names. Rejected as the whole
key: a component edited without re-running `indusk looks stories` leaves its
snapshot hash unchanged while the served story changed, and a screen is drawn
by page code no snapshot covers. Kept as part of the key, with the render's
currency and the page code beside it.

### Fingerprinting what each page loaded

Hash the bytes of every script and stylesheet a page loaded, and re-fetch them
next run (static files answer in about 1 ms). Framework-neutral, and it sees
code no snapshot does. Rejected: 10 of 12 initial chunks are shared by all five
admin pages sampled, and the app's CSS is one file every page and story loads,
so a component gaining one utility class reopens everything; and a screen's
server-rendered markup is in no chunk.

### Hashing all of the app's sources into every look

Sound and simple. Rejected: every edit reopens every look, which is today's
cost with extra steps and breaks the promise outright.

### Held results beside the approvals, committed

Lets a reviewer see the last result without rerunning. Rejected: a result is
true of one machine's build, and a committed one is trusted by someone who
never ran it; it would also put a writer on `.indusk/mockups/` that is not a
person's approval.

### Declaring the slow tier as a landing step

Setting `workflow.steps.land.slow_tests` would make every landing run and wait
on the system tier. Rejected (Sandy, 2026-10-16): the slow tier never blocks
landing or release; it runs in the background after, failures as broken
promises.

### Building and serving the app when given a dev server

Rejected: the check would own a build for every app it can check. Naming the
app's own command keeps the build the app's.

### One page load per distinct pixel ratio

Playwright cannot change the ratio on an open page; two loads (ratio 3, ratio
2) would cover the admin's devices. Rejected: Chromium's device-metrics
override changes it in place, so one load does.

## Consequences

### Positive
- A check after a small change opens only what changed; a full one loads 176
  pages instead of 1,056 and returns each measurement in a tenth of the time.
- `--only` makes confirming one row a one-look run.
- A dev server is refused in one request instead of crawled for half an hour.

### Negative
- Page code reopens every screen; a change to a layout or a helper costs a
  screen run of about a minute.
- After any source change, nothing is reused until the stories are rendered.
- One more file in machine state, and one more optional declaration (`serve`).
- A broken look the full check finds is reported after landing or release, as
  an incident, not before.

### Risks
- **A reuse that hides a break.** Mitigation: the key includes the foundation
  (so `tokens-are-held-exactly` cannot be hidden), the render's currency and the
  page code; only fully held looks are kept; `--all` reopens everything and is
  what the brief's full-check expectation times, and what the slow tier runs
  after every landing and at every release.
- **Data-driven drift** (Untestable U1 in the test plan: a new element with a
  raw value that appears only because the admin's data changed). Mitigation:
  the slow tier runs the full check with every look opened after every landing
  and at every release; a break becomes an incident on `tokens-are-held-exactly`.
- **In-place measuring differs from a fresh load** for a page that measures
  itself once on mount or animates forever. Mitigation: the contract test
  compares in place with fresh for a transitioning page and a pixel-ratio media
  query; an infinite animation is left running, as a fresh load would.
- **An unknown dev server is not recognised.** Mitigation: the marker list is
  one unit-tested function; a refusal names its marker so a miss is easy to add.
- **Under 60 s is projected, not measured** (50–70 s, moderate confidence; the
  Looks page renders in 3.3 s). Mitigation: the build closes with the timed
  run; an expectation missed is information, and the Looks page's render is a
  separate plan.

## Documentation Plan

### Pages
- Update: `apps/docs/src/reference/cli/looks.md` — `indusk looks check` gains
  `--all`, `--only`, the reused line and summary, the dev-server refusal and
  `serve`; where held results are kept.
- Update: `apps/docs/src/guide/ui-promises.md` — "checking looks": what a check
  reopens, why the stories are rendered first, that landing and release run
  `--all`, and how a reused look reads in telemetry.

### Diagrams
- A Mermaid flowchart in `reference/cli/looks.md`: for each look, render
  current? → key unchanged? → reused, else one load → six measurements →
  verdict → held result kept.

### Changelog
- `apps/docs/src/changelog.md` (Unreleased): "`indusk looks check` checks what
  changed: an unchanged look is reported reused from its last held result, each
  look loads once for every device and scheme, a development server is refused
  with the command that serves the app, and `--all` / `--only <look>` choose
  what is opened."

### ADR in Docs
- Yes: `apps/docs/src/decisions/looks-check-speed.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/planning/storybook-components/` — snapshots, stylesheet hashes, `openWithinTime`
- `/decisions/bookkeeping-lives-where-it-is-read`
- `/decisions/ui-promises` — the check and the verdict split

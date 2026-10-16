---
title: "Looks check speed — research"
date: 2026-10-12
status: complete
---

# Looks check speed — Research

## Question

Why does `indusk looks check admin` take 25–35 minutes, where does the time
go, and what does a check that costs what changed need: what a reused result
is keyed on and where it is kept, whether one page can be measured at every
device and scheme, how a development server is told apart, and what `--only`
selects.

## Background

Found at storybook-components' live check (Build Phase 8, 2026-10-12).
`indusk looks check` opens every approved look at every reference device in
both colour schemes, each in a fresh browser context. storybook-components
fixed what was a defect (stories eight at a time, a timed-out look reported
unchecked rather than ending the run — `openWithinTime` — and a story measured
once drawn: 162 s against a production build on 2026-10-12). What is left is
design: the cost grows with every look × device × scheme.

The admin has grown since: on 2026-10-15/16 a full run took about 25–35
minutes, against `next dev` and against the built daemon alike, and was waited
on twice to confirm one row.

## Findings

### What the admin asks for today (counted 2026-10-16)

- 36 declared screens with 66 screen states (`screens.json`), 18 of them on
  the `/new` screens, which run a seed command first.
- 110 stories in the catalog (`components.json`).
- 3 reference devices (`phone` 390×844 @3, `narrow-laptop` 1024×768 @2,
  `desktop` 1440×900 @2) × 2 schemes (the foundation names dark values).
- 176 looks × 6 = **1,056 page loads**, each in a new browser context
  (`measure` in `apps/indusk-mcp/src/lib/looks/check.ts`). Screens one at a
  time; stories eight at a time.

### Where the time goes (measured 2026-10-16 against the built daemon on :3939)

A read-only script (Playwright, the same measure script, against the
person's daemon, which serves a production build: `next-server`, hashed
chunks, no HMR client) timed seven looks both ways: as today, a fresh context
per device × scheme, and as one page resized and switched in place.

| Look | Elements / values | Today, 6 fresh loads | of which: load / settle / measure | One page, in place |
|---|---|---|---|---|
| `nav.expanded` (promises page) | 2,842 / 75,815 | 17.2 s | 6.0 / 3.3 / 7.4 s | 9.0 s |
| `dashboard.default` | 2,842 / 75,815 | 15.9 s | 5.1 / 3.2 / 7.2 s | 9.1 s |
| `looks.default` (Looks page) | 3,247 / 82,062 | 32.5 s | 21.1 / 3.2 / 7.9 s | 12.0 s |
| `plan.parts` | 45 / 340 | 6.4 s | 2.4 / 3.6 / 0.1 s | 1.2 s |
| story `badge.needs` | 3 / 86 | 1.1 s | 0.56 / 0.28 / 0.06 s | 0.34 s |
| story `button.default` | 2 / 56 | 1.1 s | 0.56 / 0.27 / 0.05 s | 0.35 s |
| story `amendment-card.waiting` | 11 / 294 | 1.1 s | 0.56 / 0.29 / 0.08 s | 0.36 s |

- **A screen costs 16–33 s, a story about 1.1 s.** Today's full run is about
  66 × ~16 s ≈ 18 minutes of screens (one at a time) plus ~660 story loads,
  plus seeds — the 25–35 minutes seen.
- **Measuring a big page is mostly carrying the answer back.** On
  `nav.expanded` the in-page work (every element's computed style) takes
  **30 ms**; returning 75,815 values as objects over the browser protocol
  takes **1,149 ms**; returning the same result as one JSON string (8.7 MB)
  takes **120 ms**. A tenth of the cost, same values.
- **The server's render is the floor for screens.** A plain HTTP fetch of
  each of the 48 unseeded screen states took 41.2 s in all: 0.3–1.2 s for most,
  3.1–3.4 s for each of the four on the Looks page. The admin's server renders
  one page at a time, so screens opened a few at a time overlap the browser's
  work with the server's, not the server with itself.
- **Settling** (`networkidle`, capped at 3 s) averaged about 0.55 s a load.
- **Context creation** is 30–70 ms a load: small.

Projected for a full run once each look loads once and returns one string: the
server's ~46 s of renders, about 0.5 s of settling per screen, and 6 × ~0.15 s
of measuring on the heavy pages, with screens three at a time and stories
eight at a time — **about 50–70 s** (moderate confidence). Under 60 s is
within reach but not certain; the four Looks-page renders alone are 13 s.

### Resizing and switching scheme in place, against fresh loads

The same seven looks, each loaded once at the first device, then resized
(`setViewportSize`) and switched (`emulateMedia({ colorScheme })`), measured
after two animation frames at every device × scheme, compared value by value
with the fresh loads:

- **First run: differences on every page with a button**, all on elements
  with `transition-colors`: switching the scheme in place starts a CSS colour
  transition, and the measure caught it half-way (`rgb(47, 55, 65)` on the way
  to the dark value). A fresh load never transitions. Measured mid-way, a held
  look reads broken.
- **Second run, finishing running CSS transitions before measuring**
  (`document.getAnimations()` filtered to `CSSTransition`, each `finish()`ed;
  infinite animations such as spinners cannot be finished and are left alone):
  **no differences** on any look, device or scheme. Element counts were equal
  everywhere, including the Looks page, which hosts `LookFrame.tsx` (the
  component research worried measures itself on mount).
- **Pixel ratio.** Playwright cannot change `deviceScaleFactor` on an open
  page; the run kept the first device's ratio (3) for all three and saw no
  value differences, because computed CSS values do not depend on it. A page
  with a `resolution` media query would. Chromium's
  `Emulation.setDeviceMetricsOverride` (a CDP session from Playwright) sets
  width, height and ratio together in place, so the device's own ratio is
  available without a second load.
- **Stories**: Storybook's preview (`apps/indusk-admin/.storybook/preview.ts`)
  leaves `data-theme` off when the theme global is `match`, so a story opened
  without `globals=theme:` follows `prefers-color-scheme` and switches with
  `emulateMedia` like a screen. Today's `storyUrl` pins the theme per load.

### What a reused result must be keyed on

The brief's clause names four things: snapshot, foundation, declarations,
device set. What each is in the code:

- **Foundation**: `app.foundation.hash` (sha256 of `foundation.tokens.json`).
  Every approval binds it already (`boundToNow` in `approvals.ts`), and
  `tokens-are-held-exactly` needs it in the key so a token change reopens every
  look. The schemes a look is opened under (`schemesOf`) follow from it.
- **Declarations**: `app.declarationsHash` — devices, `ignore`, `sources`
  (`declarationsHashOf` in `mockups.ts`). The device set is inside it; naming
  it separately in the key costs nothing and makes the reason readable.
- **Snapshot**: for a story, `Story.hash` and `Story.stylesheetHash` — the
  rendered markup and the compiled CSS slice of its component, the two its
  approval binds. For a screen, `Mockup.hash` (composed) and
  `Mockup.componentsHash` (the snapshots and stylesheets it composes).

What the four leave out, which matters because the check holds **the running
app**, not the mockup:

- **A snapshot is only as new as the last render.** `indusk looks stories`
  writes the snapshots from the real components; a component edited without a
  re-render leaves its snapshot hash unchanged while the served story changed.
  A reused result keyed on the snapshot alone would hide that. The render step
  must record what it rendered from (a hash of the app's sources), and the
  check reuse nothing that the current sources do not match.
  `storybookBuildIsStale` in `stories.ts` already compares the Storybook build
  with its sources, by modification time; a content hash survives `git
  checkout` (which rewrites modification times) where a time does not.
- **A screen is also drawn by its page code**, which no mockup or snapshot
  covers: route files, layouts, helpers, the app's CSS. A screen's key needs a
  hash of the app's sources that are not a catalogued component's
  implementation, a story or a test (`isImplementationFile`, `isTestFile` in
  `components.ts`; the catalog's `file` per component). A component change
  then reaches screens only through the snapshots their mockups compose — the
  snapshots are rendered output, so a component used inside another (a button
  inside an amendment card) changes both snapshots.
- **A mockup that still draws its components inline** (`uncomposed` in
  `screens.json`) composes no snapshot for them, so a component change would
  not reach it: such a screen is never reused.
- **Seeded screens**: the seed and unseed commands' text belongs in the key.
- **Data** the admin renders (plans, promises) is not in any key. A held page
  whose data changed shows the same tokens on different elements; the residual
  is a new element carrying a raw value that was never on screen before.
  `--all` checks everything.

Rejected while measuring: fingerprinting what the page loaded (the bytes of
every script and stylesheet, re-fetched next run). It is framework-neutral and
cheap (a missing static chunk answers 404 in under 1 ms) but coarse: 10 of the
12 initial chunks were shared by all five pages sampled, and the app's CSS is
one file every page and story loads, so a component that gains one utility
class would reopen every look. And a screen's own markup is server-rendered,
in no chunk at all.

### Where the last held result is kept

`/decisions/bookkeeping-lives-where-it-is-read` (`lib/bookkeeping/roots.ts`):
notes people read live in the main checkout; InDusk's machine state lives in
the project's home outside every checkout,
`~/.indusk/projects/<id>-<pathKey>/` (`bookkeepingRoots(cwd).home`), the same
from every worktree. A held result is machine state: nobody reads it, it is
only true of the build that served it, and a committed one would be trusted
by a reviewer who never ran it (research's earlier open question). It goes at
`<home>/looks/<app>.json`. Shared across worktrees is right: the key, not the
checkout, decides reuse, so a worktree with different sources simply does not
match.

### Telling a development server

Probed 2026-10-16: a temporary `next dev` of the admin on :3961 (Next 16.2.4,
Turbopack), against the daemon's production server on :3939.

| Probe | `next dev` | production |
|---|---|---|
| Page HTML references `…_browser_dev_hmr-client_…js` | yes (4 references, `_dev_` twice) | no |
| Chunk names | readable paths (`0ea8_next_dist_client_…`) | content hashes (`0my-dgs-thrfj.css`) |
| `GET /_next/webpack-hmr` | 404 | 404 |
| WebSocket upgrade on `/_next/webpack-hmr` | 101 | no answer within 3 s |
| `X-Powered-By` | `Next.js` | `Next.js` |

The page's HTML is the cheapest reliable fact: one GET, and the HMR client is
present only in development. Vite's development server serves `/@vite/client`
in every page; webpack-based `next dev` serves `react-refresh`. A first `next
dev` render of the promises page took 7.8 s, the second 0.7 s; under the
2026-10-12 swap pressure it was 86 s — the reason to refuse rather than crawl.

The command to name: the admin is built with `pnpm --filter indusk-admin
build` (Storybook into `public/storybook`, then `next build`) and served with
`pnpm --filter indusk-admin start`. The daemon on :3939 serves the main
checkout's bundled build (`apps/indusk-mcp/admin`), not a worktree's, so a
plan checking its own changes builds and serves its own.

### `--only`

A look is named `<screen>.<state>` (a screen state) or `<component>.<state>`
(a story's snapshot); one name can be both (`nav.expanded`, which the looks
area's context file notes for spans). `--only <name>` selects every look of
that name, at every device and scheme; a name that is neither is refused,
named. A look asked for by name is measured, not reused.

### What a reused look reports

`reportLooks` emits one span per measured result (`indusk.looks.check`,
marked like a promise); `look-standing.ts` reads them, newest first, per look
and kind, over a window. Two ways to report a reused look were weighed: no
span (telemetry never carries a measurement that was not taken, `lesson:
a-value-check-that-says-held-has-not-seen-the-layout`, but an unchanged look's
standing decays to no signal once its last real span leaves the window), or a
span saying upheld that says it was reused and when it was really measured.
Sandy chose the second (Decisions, below). `look-standing.ts` ignores
attributes it does not read, so a reused span counts as holding today.

### Where landing and release run a check

`workflow.steps` in `.indusk/config.json` declares facts, never logic
(`lib/checks/steps.ts`). Release runs `workflow.steps.release.slow_tests`
(`pnpm -w test:system`, after publishing; its JUnit failures route to the
promise of the trajectory rows that name the failing file). Landing runs
`indusk checks slow`, which runs `workflow.steps.land.slow_tests` — dusk
declares none, so dusk's landing runs no slow tests today. A green landing run
is recorded by the code it covered, and release then skips its own slow run on
the same code (`findCoveringRun` in `lib/checks/record.ts` matches on the code
key, not the command). So a landing command narrower than release's would make
release skip the system tier it never ran. The full look check therefore
belongs in the system tier, as a test file that starts the bundled admin
(`test:system` builds it first, through `prepublishOnly`) and runs
`indusk looks check admin --all` against it; release already runs it, and
landing runs it once `land.slow_tests` names the same command as release.

## Decisions

- **Production looks sampled in rotation** moved to `workbench-server` (Sandy,
  2026-10-16): the watcher runs continuously, so by promise-core's sorting rule
  it belongs to the server.
- **A full check is `--all`** (Sandy, in the brief, 2026-10-16): the plain
  command checks what changed.
- Held results live in machine state, not next to the approvals (this
  research, 2026-10-16, from `/decisions/bookkeeping-lives-where-it-is-read`).
- **A reused look sends a signal marked reused** (Sandy, 2026-10-16): the
  outcome of the result reused (upheld), plus an attribute saying it was reused
  and the time it was really measured — "so a look keeps reading holding and
  never decays to no signal, and telemetry never claims a fresh measurement."
- **Landing and release always run the full `--all` check** (Sandy,
  2026-10-16), declared in the project's landing and release steps; plan phases
  use the fast default. Placed in the system tier, with
  `workflow.steps.land.slow_tests` set to release's command (see "Where
  landing and release run a check").
- **The 60-second full run stays an expectation** (Sandy, 2026-10-16):
  accepted as is; a miss is information.

## Open Questions

- How long `indusk looks stories admin` takes after a one-component change. A
  reused result needs current snapshots, so the render may become the slow
  step after a change; the brief measures the check alone.
- Many screen states are the same page: `/p/dusk/promises?state=…` reports
  the same `data-look-state` for every state asked (`nav.expanded`,
  `dashboard.default`, `promise-row.no-signal`). One load could judge several
  looks; this plan keeps one load per look, as the brief says.
- Whether 50–70 s for a full run is enough, or the Looks page's 3.3 s render
  is the next thing to fix (not this plan's: the brief does not promise faster
  admin pages).

## Sources

- `apps/indusk-mcp/src/lib/looks/check.ts`, `approvals.ts`, `mockups.ts`,
  `stories.ts`, `components.ts`, `report.ts`
- `apps/indusk-mcp/src/lib/bookkeeping/roots.ts`
- `apps/indusk-admin/.storybook/preview.ts`
- The timing script and its output (session scratchpad, 2026-10-16; not
  committed)
- `.indusk/planning/storybook-components/` — the timeout and draw fixes

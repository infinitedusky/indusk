---
title: "Storybook components — Retrospective"
date: 2026-10-12
---

# Storybook components — Retrospective

## What We Set Out to Do

Plan 2 of 4 of the look series. The admin's eleven approved mockups were whole
screens that wrote a badge out 55 times, and the running admin did not look
like them. The plan set out to define each of the nineteen components the
mockups name once, in the app, with a Storybook story per state rendered to a
snapshot a person approves. Every mockup would place components by name, and a
changed component would reopen exactly the mockups that use it. A catalog file
would list every component for an agent. The admin was to be rebuilt from
those components (brief: three expectations, five promises made, three
changed).

## What Actually Happened

The plan touched 277 files, +20,880 / −3,458, over 392 commits; the code alone
is 174 files under `apps/`, +12,018 / −1,138. It produced:

- `lib/looks/` in the package: `components`, `compose`, `stories`,
  `stories-catalog`, `component-styles`, `lint-components`, and, from cleanup,
  `approve`.
- `indusk looks stories`.
- Storybook 10.6 in the admin, served at `/storybook`.
- Nineteen components with 57 stories.
- The eleven mockups rewritten to compose components.
- The nav, dashboard, Looks, promise and plan pages rebuilt from the
  components.

The phases ran Test Phase 1, then Build Phases 1–8, then falsification (Build
Phase 9), cleanup (10), and the audit's two fixes (11).

Where reality differed from the plan:

- **The render step runs inside the app's Vitest, not as a Node script**
  (Build Phase 2). The ADR assumed portable stories rendered to markup from a
  plain Node process. `@storybook/nextjs-vite` resolves only under its own
  Vite plugin, and that plugin's aliases fail outside Vitest, so the step
  drives the admin's Vitest with the addon.
- **A composed mockup drew its components unstyled** (Build Phase 6).
  Snapshots are Tailwind utility markup, and a mockup frame carries only the
  foundation's `tokens.css`. ADR decision 10 was added mid-plan: the render
  step writes a compiled, token-resolved, *unlayered* stylesheet per component,
  inlined into each mockup that names it and bound into `componentsHash`. Row
  A30, a computed-style comparison in Chromium, holds a composed component to
  its story.
- **A story is one fixed rendering**, so a mockup cannot pass a component data.
  The nav's current link and a plan page's single tag come from the story, and
  a missing variant means a missing story. This was accepted as a scope line.
- **Unapprove was added** (decision 11) after Sandy approved a look by mistake
  and the record had no way back. `a-mockup-is-approved-by-a-person` widened to
  match.
- **The live check took six minutes** (342 of 354 looks were stories opened one
  at a time). Stories now open eight at a time; a look that times out is tried
  once more and then recorded unchecked rather than ending the run. A story is
  measured once it is drawn, not when Storybook marks the body shown: measured
  early, it was empty and "held" with nothing judged.
- **The needs-you ring became a foundation token** (`--shadow-ring`), and the
  lint now refuses a shadow assembled from other tokens. The lint had passed
  it part by part while the value check refused it whole. Sandy's call: the
  lint should refuse what the check will fail.
- **Expectation 1 was not met.** U1, the deferred person's comparison of each
  screen beside its mockup, read *does not match*. The plan page looks nothing
  like `plan.*`, and the running admin has parts no mockup draws (breadcrumbs,
  the checkout choice, the theme switch, the page header). Coverage read
  everything covered because it counts `data-component` markers. Sandy chose to
  close with the expectation recorded unmet and carry the plan page, the nav
  and the coverage gap to mockup-matching.

## Getting to Done

- **Falsification (Build Phase 9) found six holes in what an approval binds**,
  each confirmed red and fixed:
  - a style-only change left a story approved;
  - an Unapprove under an approved mockup reopened nothing but the lint;
  - a group Approve recorded mockups before their stories, which was the
    refusal Sandy saw flash and vanish in Build Phase 7;
  - a mockup could be approved without the only hash that holds its
    stylesheets;
  - the story frame showed the admin's own Storybook build, while Approve
    bound the selected checkout's snapshot;
  - a `globals.css` change did not rebuild Storybook.
- **The first re-approval after falsification silently did nothing.** The
  cockpit had been running since morning on the pre-falsification package. Its
  Approve wrote story entries without the new stylesheet hash and returned
  success, and all 68 looks stayed proposed. Restarting the dev server and
  approving again fixed it.
- **Cleanup (Build Phase 10)** removed cross-file copies the phases had grown
  one at a time:
  - four sha256 helpers;
  - the snapshot and stylesheet hashes, written and read by separate code;
  - three JSON readers and four `data-component` readers;
  - two routes parsing one request;
  - three copies of the Looks page's POST state.

  `approvals.ts` split into the record and its reading, and `approve.ts` for
  the write side. `LookDecision` was not extracted: its four copies differed in
  more than props.
- **The audit (cold reader, Opus) found two defects the build had missed**,
  fixed in Build Phase 11 at Sandy's choice:
  - Row A2 (a component the mockups name with no implementation is reported
    by name) could not fail, because nothing printed the line its test read.
  - A story's check span carried the same keys as a screen's, so the held
    story `nav.expanded` could stand for a broken screen `nav.expanded` on the
    dashboard. Story spans now carry `indusk.look.kind`.
- **Not run during the build:** A7, A18 and A19 boot their own `next dev`, and
  the dev server Sandy approved through held `.next/` the whole time. They are
  owed at landing. Run at landing, 2026-10-12, with the cockpit stopped: all
  three pass (A18 alone took 221 s).

## What We Learned

- **A test that compares a computed list with an expected list passes when
  both are empty.** A2 compared "components coverage reports missing" with
  "components actually missing". No code produced the first list, and the
  admin has nothing missing, so the row was green from the day it was written.
  The fix is a companion row that plants a missing component and must see it
  reported. A comparison row is not proven until a case makes its expected
  side non-empty.
- **Telemetry keys are a namespace, and two kinds of subject sharing one key
  set collide silently.** Stories and screens both reported as
  app/screen/state/device, and the admin has a component and a screen both
  named `nav` with matching state names. Nothing failed; a broken screen could
  simply read held.
- **A running server is part of what a test of the approval path depends on.**
  The re-approval went through code older than the change it exercised, and
  the old code accepted the request. When a phase changes what an endpoint
  writes, restart whatever serves it before a person uses it, or have the
  endpoint refuse a request from an older client.
- **Hashing what a person saw needs every input to what they saw.** Each of
  the six falsification holes was an input to the rendered look (stylesheet,
  composed stories, frame source, CSS freshness) that the approval did not
  bind.
- **"We thought the Looks page should frame Storybook's iframe; we found it
  must frame the snapshot."** The ADR's decision 6 framed the served build;
  Approve bound the checkout's snapshot. Two sources for one look meant a
  person could approve what they did not see.

## What We'd Do Differently

- **Bind every input of the rendered look from the first approval design**, not
  by falsification. The question "what does this look depend on, and is each
  input in the hash?" would have found five of the six holes at the ADR.
- **Write the companion "it can fail" case with every comparison row** in Test
  Phase 1, rather than relying on the cold audit to notice.
- **Separate the dev server Sandy approves through from the one the contract
  tests boot**, so the contract rows run in-phase instead of being owed at
  landing for six phases.
- **Read the running admin beside its mockups before Build Phase 7, not at
  Build Phase 8.** U1's "does not match" arrived after every screen was
  rebuilt; a first comparison on the plan page would have shown the coverage
  gap while it was cheap.

## Insights Worth Carrying Forward

- A look's approval binds everything the frame drew: markup, stylesheet,
  composed stories, foundation and declarations. When adding an input to a
  rendered look, add it to the hash in the same change.
- Coverage that counts markers cannot see what has no marker. mockup-matching's
  whole-screen comparison is the check that sees it.
- Storybook on Next 16 + Vite renders only under its own Vite plugin, so do
  rendering inside Vitest. Pin Next at 16.2 until storybookjs#36720.

## Quality

- **Biome:** no new rule. The recurring fixes were formatting, caught by
  `biome check`. Two pre-existing lints outside this plan (`store.ts`,
  `hook-cwd-independence.test.ts`) were seen and left.
- **Shape:** 16 findings raised across the eleven build phases. Phases 1, 3, 6
  and 8 raised one each; Phases 4, 5, 7 and 9 two each; Phase 2 three; Phase 10
  one; Phase 11 none. None was judged wrong by a person. Several "left as-is"
  records (`approvals.ts`, `Looks.tsx`) named the cross-file cut as cleanup's,
  and cleanup made it.
- **Audit:** 33 findings. Two were defects, fixed here. Several "never
  promised" findings (the `shadow-not-token` rule, the unchecked-on-timeout
  behaviour) were Sandy's recorded calls in the working impl, which the reader
  is deliberately not shown. The rest are carried below.

- **Everyday suite at close:** 2,632 passed, 6 failed. Two failures were
  this plan's, both in promises-cli row A15, which runs `indusk promises check`
  at the repo root:
  - `the-nav-fits-a-phone` still named the removed `Sidebar.tsx` as its site.
  - A test comment, `// A15's file and promise: a component…`, read as a token
    for a promise named `a`.

  Both are fixed. The other four also fail on `main` and are not this plan's:
  `impl-corpus` A4, `plan-worktrees-cli` A13 (`?? .mcp.json`),
  `registry-leak-scan` A22, and `inbox` A17.
- **Confirming the promises** refused three times:
  - The brief's two widening notes were parsed as part of the changed
    promises' sentences. They now sit in a paragraph under the list.
  - No code carried `a-changed-component-reopens-its-mockups`. Now
    `approvalOf` does.

  All eight promises are confirmed.

## Carried forward

To mockup-matching (plan 3 of 4), from U1 and the audit:

- The plan page and nav rebuild. U1 read *does not match*.
- Parts of a screen with no `data-component` marker are invisible to coverage.
- An edited component reopens nothing until `indusk looks stories` reruns; no
  hook or workflow step runs it or notices a stale snapshot (audit, rows A11
  and A26 edit snapshot files directly).
- A snapshot is never compared with what its component renders now, so a
  hand-edited one can be approved.
- `screens.json`'s `uncomposed` and `uncatalogued` lists say "only ever
  shortened", and nothing enforces it.
- `look-standing.ts` builds no look row for a story's check, an uncovered
  story, a `no story` state, or a component missing from the catalog.

Not this plan's: `src/lib/promises/inbox.test.ts` fails two tests in this
worktree, with no file under `lib/promises/inbox` changed here.

## Release

This machine runs the landed build (`pnpm install:local`, 1.70.0); nothing is published. Publishing is deliberate, through `indusk release`. The regenerated admin bundle (`apps/indusk-mcp/admin/next.config.ts`, `package.json`) is left modified on trunk for that release commit: trunk-guard refuses it as a code commit, as with `f95bbcec`.

Landed on main at bc5102d8, 2026-10-12.

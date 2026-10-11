---
title: "UI promises — what an app looks like, held to approved mockups"
date: 2026-10-10
status: complete
---

# UI promises — Research

## Question

Can an app's user interface be described and held by contracts the way its
behaviour is by promises — and if not by the same kind of promise, by what?

## Background

**The motivating case.** [plan-cockpit](../plan-cockpit/impl.md) was built to
the mockup in
[`research/promise-ui/mockups/plan-cockpit.html`](../../research/promise-ui/mockups/plan-cockpit.html).
Every trajectory row passed — the nav nests Paths, the decision card appears
once, no page scrolls sideways at phone width — and the result looks nothing
like the mockup. None of the mockup's tokens (the dusk accent, the
ok/warn/bad/idle washes, Bricolage Grotesque and IBM Plex, the surface and
shadow, the dark theme) reached `apps/indusk-admin/src`, and `globals.css` was
untouched. The only look-and-feel check was the plan's Deferred Verification
row U1, "the recording reads as the mockup does" — a person's judgment at the
demo rehearsal — so no gate could fail on it. The mockup was the contract, and
nothing checked against it.

**What exists today.**
- Promises (`/decisions/day-promises`): one file per promise in
  `.indusk/promises/`, kinds `behaviour` / `state` / `structure`, linked to
  code by a `promise: <name>` token; health read from spans
  (`/decisions/day-monitor`). No notion of appearance, surfaces or baselines.
- [promise-devtools](../../research/promise-ui/plans/promise-devtools/brief.md)
  (draft, research folder): runs a page's promise checks against the live UI
  in DevTools; declares what a promise covers with `data-promise="<id>"`,
  selectors as fallback. Its open question 3 is where that declaration format
  lives.
- [contract-ui](../contract-ui/brief.md) (draft): the home view as premises →
  promises → phases. No screen or element level.
- [plan-premises](../plan-premises/brief.md) (draft): premises are claims about
  the world, scored by a person; precedent for "a person sets the state, an
  agent never does".

## Findings

### Appearance is not behaviour

- **Behaviour composes; appearance does not.** Layer enough behavioural
  promises about a server and you back into its functionality. Layer a hundred
  about a page and you still do not get the page. That is why UI testing is its
  own discipline: Storybook (components in each state, rendered) and Chromatic
  (each render diffed against an approved baseline).
- **No right answer to compute.** A behaviour has an expected value a test
  derives; a look has a reference a person approved. The pass state is "this
  version was approved", not "an assertion held".
- **The approver cannot be the builder.** The aim
  ([plan-premises/aim.md](../plan-premises/aim.md)) is building with agents
  whose work cannot be taken on trust; an agent approving its own baseline is
  the gate it would game.
- **Counterargument, kept.** Much of UI *is* behaviour — one decision card per
  page, a drawer below 760 px, Approve disabled while posting. Those stay
  ordinary promises; plan-cockpit's rows show they work. UI promises cover
  appearance and composition, not interaction.

### The accumulating mockup

The first mockup becomes the first reference. From it, tokens and components
are fixed ("primary button: 40 px tall, 12 px radius, `--dusk` fill"), and
contracts are made against those rather than against pixels in one picture.
The next mockup is composed from the established tokens and components, so each
is more exact than the last and the reference set grows with the product. This
is how design systems already work; the new part is that the mockup is a
versioned, approved artifact the running app is checked against.

### Two tiers of check

| Tier | What it reads | Exact? | Where it runs |
|---|---|---|---|
| Computed style | `getComputedStyle` on an element vs. the token it claims | Deterministic, no image | Anywhere, including live |
| Screenshot diff | A surface in a named state, rendered with frozen data and fonts, vs. its approved baseline | Pixel, with tolerance and masks | Scheduled or at landing, against fixtures |

Whole-page pixel diffs against live data on a schedule produce false alarms —
font rendering, anti-aliasing, animation, changing content — and a check that
cries wolf is ignored. Production diffs are possible for stable surfaces with
dynamic regions masked; untried here.

### Tools, against lock-in (surveyed 2026-10-10)

The criterion (Sandy, 2026-10-10): avoid vendor lock-in unless the thing is an
industry standard and fully open. Read as: OSI licence, runs locally with no
account, artefacts (baselines, tokens) in open formats we hold in git, so
leaving the tool costs a rewrite of the runner and nothing else.

**Already in the repo.** `apps/indusk-admin` runs Vitest 4 browser mode with
`@vitest/browser-playwright` and `playwright`. Vitest 4 added
`toMatchScreenshot` to browser mode (current docs are v5.0.3): it captures an
element or page, compares it with a reference PNG in `__screenshots__/` beside
the test, named `<test>-<browser>-<platform>.png`, using `pixelmatch` by
default (`threshold`, `allowedMismatchedPixelRatio`, `allowedMismatchedPixels`;
third-party comparators can be registered). References are written with
`--update` and reviewed before commit; failures leave actual and diff images
in `.vitest/attachments`. The docs do not label it stable or experimental.

| Tool | Licence | State | Verdict |
|---|---|---|---|
| Vitest `toMatchScreenshot` | MIT (vitest 5.0.3) | Active; already our runner | **Recommended** — no new runner, baselines are PNGs in git |
| Playwright `toHaveScreenshot` | Apache-2.0 (1.64.0) | Active; the most-cited default | Equivalent fallback; same baseline model, a second runner |
| pixelmatch | ISC (8.0.0) | Active | The comparator under both; replaceable (odiff, MIT, 4.5.0) |
| BackstopJS | MIT (6.3.25) | Active | Open, but its own config and runner beside Vitest |
| reg-suit | MIT (0.14.5) | Last publish 2025-08 | Built around cloud baseline storage |
| Lost Pixel | MIT (3.22.0) | Last publish 2024-11 | Stale; a vendor blog claims its team joined Figma — unconfirmed |
| Chromatic, Percy, Applitools, Argos | Proprietary hosted services | — | Rejected: a hosted service holds the baselines and the approvals |
| Lastest | FSL-1.1 (its own table) | New | Rejected: not an OSI licence |
| Storybook | MIT | Industry standard | Optional later: a component catalogue, not needed to hold a surface |

**Tokens have an open standard.** The W3C Design Tokens Community Group
published its first stable format, *Design Tokens Format Module 2025.10*, on
2025-10-28: vendor-neutral JSON (`$value`, `$type`, `$description`), aliases,
themes, Display P3 and Oklch. It is a Community Group final report, not a W3C
Recommendation, but it is the one open format design tools and token
pipelines converge on. Style Dictionary (Apache-2.0, 5.6.1) reads it and emits
CSS custom properties (`css/variables`). The computed-style tier needs no tool
at all: `getComputedStyle` is a web standard, and a token resolved to a CSS
custom property can be compared to the element's computed value.

**What the open option costs.** Every source agrees on one failure: rendering
differs by OS, GPU, font pipeline and browser version, so a baseline approved
on one machine fails on another. The answer is a pinned renderer — the
official Playwright Docker image, or baselines only ever written by one named
environment. Vitest suffixes references by platform, so a darwin baseline and
a linux one live side by side; the question is which one is the reference.
This project lands on a Mac and serves from Linux (Fly), so it has both.

**The lock-in result.** Choosing Vitest + pixelmatch + DTCG tokens + git holds
every artefact in an open format: baselines are PNGs, tokens are DTCG JSON,
approvals are commits. Moving to Playwright's runner, BackstopJS or a hosted
reviewer later means pointing a new runner at the same files.

### Fit with the promise loop

A check emits a span marking held or broken — the same plain-OTel mark the
monitor already reads — so a UI promise's state can land on the dashboard
plan-cockpit built, broken first.

## Decisions

- **UI appearance gets its own kind of contract, distinct from behavioural
  promises** (Sandy, 2026-10-10): UI is not strictly behaviour, and applying
  the current promise kinds to it would not converge on the design.
- **UI behaviour stays ordinary promises** (2026-10-10): the contract covers
  appearance and composition only.
- **Mockups accumulate** (Sandy, 2026-10-10): each approved mockup is a
  reference the next is built from; contracts are made against tokens and
  components it fixes.
- **Use an existing differ; do not build one** (2026-10-10, per the project
  rule against reinventing).
- **No vendor lock-in unless the thing is an industry standard and fully
  open** (Sandy, 2026-10-10). Every hosted reviewer (Chromatic, Percy,
  Applitools, Argos) and every non-OSI licence is out; artefacts stay in open
  formats in git. The survey above recommends Vitest `toMatchScreenshot` +
  pixelmatch for surfaces and DTCG tokens for the computed-style tier; the ADR
  makes the choice.
- **Its own plan, not folded into promise-devtools** (2026-10-10): the format
  is shared by the registry, the cockpit and the devtools; a browser tool
  should not dictate the schema.

- **Reference devices × one reference renderer** (Sandy, 2026-10-10). Two or
  three named devices (a phone, a narrow laptop, a desktop) fix size, density
  and touch, and stress responsiveness. They do not fix rasterisation: an
  emulated phone is still desktop Chromium on whichever machine runs it. So
  every baseline is also drawn by one pinned renderer — the Playwright Docker
  image — wherever it runs. Emulation is not real Safari; on-device rendering
  needs a hosted device farm and is out.
- **The contract is platform-neutral; runners are extensions** (Sandy,
  2026-10-10, as a stress test, not a scope change). Surfaces × states ×
  devices, baselines in git, DTCG tokens and the approval rule hold for any
  UI. Each platform supplies a runner and a reference renderer — web here;
  later, open native tools as extensions: swift-snapshot-testing (iOS),
  Paparazzi or Roborazzi (Android), Flutter's golden tests, React Native via
  native simulators. Not verified in this survey. The computed-style tier is
  a web advantage; on native the screenshot tier carries most of the weight.
  The format is designed so these fit without a change.
- **Animation is covered without video** (Sandy, 2026-10-10). End states are
  screenshots with motion off or fast-forwarded; duration, delay and easing
  are tokens (DTCG `duration`, `cubicBezier`, `transition`) the computed-style
  tier checks; when it starts, how long it takes, that it never blocks input
  and that reduced motion skips it are ordinary promises
  (`document.getAnimations()` exposes timing on the web); a frame at a fixed
  time is a deterministic screenshot if ever needed. Whether it feels right is
  a person's call. Recording and diffing video is out: the brittle whole-page
  diff multiplied by every frame.
- **No mockup leaves anything undefined** (Sandy, 2026-10-10). Every visual
  value in a mockup or the app is a token; a raw literal is refused (a lint —
  stylelint, MIT, has rules and plugins that refuse raw values for variables).
  So the first mockup must define the foundation — palette, type, spacing,
  radius, shadow, motion — and a palette cannot wait for the fifth. Measured on
  `plan-cockpit.html`: 156 `var(--…)` uses for colour and font, but over 400
  raw sizes (`8px` ×42, `6px` ×38, `12px` ×38, `13px` ×25): spacing, radius
  and type size were never defined. The rule is InDusk's; each app's
  foundation is its own.
- **Promises = mockup** (Sandy, 2026-10-10). The approved mockups are the
  contract for how the app looks, and coverage is part of it: every screen in
  each state and every component is covered by one, or reported uncovered.
  promise-devtools' drafted `every-element-says-what-covers-it` is the live,
  element-level view of the same rule.
- **Mockups render in the cockpit, and the mockup is the baseline** (Sandy,
  2026-10-10). A mockup is HTML + CSS in a known place in the project, loading
  the app's own tokens, opened in the cockpit at each reference device. The
  pinned renderer draws it, and that picture is what the app is compared
  against — so a person approves a mockup, never a screenshot. Answers the open
  question of whether the mockup is the first baseline. Plain HTML over the
  app's real components (Storybook-style) to start: quicker to draw, and design
  stays ahead of code; moderate confidence.
- **This is the demo's next important step** (Sandy, 2026-10-10): the demo
  has to show the power — a look held to its design and a break caught —
  for the magic to land. Where it sits in the demo's sequence is settled
  after the brief.

- **Named `ui-promises`, not `ui-contract`** (Sandy, 2026-10-10): `contract-ui` already names the home-view plan; the two names were too close.

## Open Questions

- Does a UI promise extend the promise registry (a new kind beside
  `behaviour`, `state`, `structure`) or sit beside it as its own registry?
- What is the unit: a surface (screen) in a state, a component in a state, or
  both, with components referenced from surfaces?
- Where do baselines live — the repo (git history as the approval record) or a
  service?
- How is an approval recorded so that only a person can make it — the route
  plan-cockpit's decisions use (`.indusk/plan-history/`), or its own?
- Which environment is the reference renderer — the pinned Playwright Docker
  image on any machine, or this Mac's darwin baselines with Linux as a second
  set? Rendering differs by OS and fonts, so one has to be named.
- Do tokens become DTCG JSON as the source of truth, generating the CSS, or is
  the CSS the source and DTCG an export? The first is the open standard; the
  second is the smaller change to today's admin.

## Sources

- [plan-cockpit impl](../plan-cockpit/impl.md) — the trajectory and U1
- [`research/promise-ui/`](../../research/promise-ui/README.md) — the mockups
  and the promise-devtools draft
- `/decisions/day-promises`, `/decisions/day-monitor`
- [Vitest — visual regression testing](https://vitest.dev/guide/browser/visual-regression-testing)
- [Vitest 4 release — browser mode and visual regression](https://main.vitest.dev/blog/vitest-4)
- [Design Tokens Format Module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/) and [the stable-version announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- [Argos — Playwright visual testing in CI](https://argos-ci.com/blog/playwright-visual-regression-testing-ci) (a vendor; used for the cross-platform rendering problem only)
- [Bug0 — open source visual regression tools, 2026](https://bug0.com/knowledge-base/open-source-visual-regression-testing-tools), [Lastest — open-source tools for Playwright](https://lastest.cloud/blog/best-open-source-visual-regression-testing-playwright) (vendor-written; licences and publish dates checked with `npm view`, 2026-10-10)

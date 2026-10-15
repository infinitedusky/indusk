---
title: "UI promises — Retrospective"
date: 2026-10-11
---

# UI promises — Retrospective

## What We Set Out to Do

A second kind of promise, for how an app looks: mockups a person approves in
the cockpit, built on one DTCG foundation with no raw values, covering every
screen, state and component, and the running app checked by value in Chromium
with its breaks reported beside promises. The first app held was to be the
cockpit itself (brief, expectations 1–3; six promises).

## What Actually Happened

The plan touched 168 files, +13,964 / −626, over 97 commits before this
retrospective: `lib/looks/` (foundation, mockups, lint, approvals, coverage,
verdict, check, report, markup, overview), `indusk looks lint | status |
coverage | check | tokens`, the approval guard hook, the admin's Looks page and
Approve route, looks in `promises/standing` and the editor, and the admin
restyled onto its own foundation with eleven mockups.

Where reality differed from the plan:

- **Approval moved from `main` to the worktree** (Build Phase 5, Sandy's call).
  Build Phase 4 built Approve against `main`; a mockup drawn in a plan worktree
  could not be approved until merged, which made the plan's own pause point
  impossible. Group approval was added at the same time.
- **The restyle found five bugs in the package, not the admin**: tokens unset
  under Tailwind (`@theme static`), shadows compared as text, `.25` vs `0.25`,
  `margin: auto` read as pixels, and `translate-x-0` compiling to nothing once
  Tailwind's spacing was reset — the nav sat off-screen with 33 looks held.
- **Falsification (Build Phase 6) was the most productive phase.** The guard saw
  only Edit/Write; the route trusted headers `curl` sets; the lint's strict list
  let nine kinds of raw value through; coverage counted text in comments; a
  state the page ignored measured as held; the dark scheme was emitted and never
  opened. All fixed. One fix — binding the declarations into each approval —
  un-approved the eleven admin mockups, and nothing told the expectation reader.
- **Cleanup (Build Phase 7)** split `lint.ts` (533 → three rule modules and an
  orchestrator), `standing.ts` (461 → look standing in its own module) and two
  test files, behaviour unchanged.

## Getting to Done

- At this retrospective the admin read 11 proposed / nothing held. Sandy
  re-approved them; `indusk looks check admin` then read 12 held, 54 unchecked,
  and the one-token live check (A21, a manual live-check row asserting a token
  changed in the admin alone shows broken) caught `--color-dusk` on all six
  light looks. The dashboard half could not be read from the worktree — the
  dashboard reads looks from `main`'s checkout — so it is read after landing.
- The root CLAUDE.md went over its 80 % budget line (A13 in
  `context-tiers-register.test.ts`) at Build Phase 1 and stayed red through
  every phase as "outside this phase". Fixed here by moving the display-names
  rule to `apps/indusk-mcp/CLAUDE.md`, where its enforcer already lived.
- The published decision page claimed the check runs at landing and on the
  watcher pass, and that undeclared routes are reported. Neither is built;
  corrected here.

## What We Learned

- **A falsification fix can silently invalidate an expectation already met.**
  Binding `declarationsHash` was right, and it turned the cockpit from held to
  nothing held; A21's state stayed `passing` because a manual row records a run,
  not a standing. A fix that changes what an approval or baseline means should
  re-read every expectation and live-check row that depended on the old meaning.
- **A value check that says held has not seen the layout.** Thirty-three looks
  held with the nav off-screen. Values and layout are different questions; the
  restyle was caught by a page test, not the check.
- **Most declared states are unreachable.** Only 12 of 66 looks are checkable
  because only the dashboard and Looks pages can say which state they drew.
  Declaring a state is cheap; making the page report it is the real work, and
  should be planned per screen, not discovered at the check.
- **"Outside this phase" accumulates.** A13 was named in five phases'
  Forward Intelligence and fixed by none; a failing check that every phase
  defers becomes the landing's problem.

## What We'd Do Differently

- Read the dashboard, not just the CLI, when a row says "the dashboard shows it"
  — Build Phase 5 recorded the CLI verdict and noted the dashboard as not seen.
- Decide in the ADR how a page reports its state before declaring states in
  `screens.json`; eleven mockups were drawn for states the admin cannot report.
- Fix a budget-line failure in the phase that caused it.
- Keep decisions the plan did not build (landing and watcher runs, route
  derivation) out of the published decision page, or mark them planned.

## Insights Worth Carrying Forward

- The audit's cold reader found what three rituals by the builder did not: the
  expectation unmet, the docs over-claiming, the unwired runs. Read `audit.md`
  before writing the retrospective, not after.
- Follow-ups named, not built: `looks-min-max-sizes` (reading-measure tokens,
  then `min-*`/`max-*` held); the nav, promise and plan pages reporting their
  state; running the check at landing and on the watcher pass; looks on the
  dashboard read from the plan's checkout; and the audit's open findings
  (an agent clicking Approve through a browser MCP, easing and weight falling
  back to defaults read as held, unmeasured outline/line-height/letter-spacing,
  inline `.tsx` styles unlinted).

## Quality

- **Shape**: 21 Shape entries across the phases — 12 findings acted on, 9
  reviewed and left as-is with reasons. A human judged none wrong (0).
- No recurring lint or type class during `/work` suggested a new Biome rule.
- **Deferred Verification**: U1 (the redrawn mockups are the intended design) —
  mitigated by the approval itself, done twice, the second time at this
  retrospective. U2 (the demo watcher sees the power) — downstream to
  demo-rehearsal, step 7 of the indusk-demo master plan.

## Release

Landing installs (`pnpm install:local`); nothing is published by this close.

## After landing

- Expectation 2 read on the landed build, 2026-10-11: the admin daemon (port 3939) held 12 looks, 54 unchecked; a throwaway copy of the landed admin with `--color-dusk` changed to `#d07020` alone checked 6 of 12 broken, and the **dashboard listed the six broken looks first**, each naming `token --color-dusk approved #c2620b actual #d07020`; checked against the daemon again, 12 held. Reading it needed the local telemetry daemon restarted — the one running since 2026-10-02 belonged to the old published install, its collector down.
- Found on the way, not this plan's: `impl-corpus.test.ts` A4 and `registry-leak-scan.test.ts` A22 fail on `main` since browser-template-claims landed; the real registry holds 2,662 leaked `ma-init-*`/`demo-workbench-*` test homes; `day-monitor.e2e.test.ts` A24 expects an evaluator message that changed.
- Release: landing installed the build (`pnpm install:local`); nothing published, no bump — this project publishes deliberately.

Landed on main at 7b2a91dd, 2026-10-11.

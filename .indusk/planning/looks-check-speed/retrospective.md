---
title: "Looks check speed — Retrospective"
date: 2026-10-16
---

# Looks check speed — Retrospective

## What We Set Out to Do

A full look check of the admin took about 35 minutes, and `one-promise-language`
waited on it twice in one plan. Sandy pulled this plan forward to stop that.
The brief made one promise, `a-look-check-costs-what-changed`: a check takes
time in proportion to what changed, not to how many looks there are. Its
clauses were that an unchanged look is not reopened, a page loads once per
look, a development server is refused, a slow look never ends the run, and
`--only` checks just the named looks. Two existing promises had to hold:
`tokens-are-held-exactly` (a reuse must never hide a token change) and
`everyday-tests-never-wait` (the browser check stays in the system tier). The
brief's two expectations were a one-component check in under 15 seconds and a
full `--all` check in under 60.

## What Actually Happened

Research measured where the time went: 1,056 page loads in a full run, 16–33 s
per screen look (six fresh loads, one per device and scheme), and most of the
measuring cost spent passing results back from the page one object at a time
(1,149 ms as objects against 120 ms as one string).

The build, in three phases:

- **One page load per look.** The page loads once at the first device, then is
  resized and switched between colour schemes in place, with colour transitions
  finished before each read; the measurement comes back as one string. Screens
  open three at a time. `--only <name>` checks just the named looks.
- **Reuse of unchanged looks.** A look that held at every device and scheme is
  recorded, with what it was checked from, as machine state under the
  project's home (`<project home>/looks/<app>.json`), never in the checkout. A
  later run reports it reused, without opening it, while every input in its key
  is unchanged. A reused look sends an upheld signal marked reused, with when it
  was really measured, so it keeps reading holding. `--all` reopens everything.
- **Development servers refused**, naming the command that builds and serves the
  app.

Sandy's calls during the plan: the reused signal (a reused look keeps
reading holding rather than going silent); and the full check stays in the
background slow tier — the 2026-10-08 rule that the slow tier never blocks
landing or release is kept.

**Measured** against a production build of the admin: 98 s for `--all`, 89–95 s
after a one-component change, 57 s with nothing changed — against about 35
minutes before. Both expectations (60 s, 15 s) were missed. Sandy accepted the
misses as information: about 40 looks in this checkout can never be checked
(pages that do not report their state, fixture plans answering 404), and a look
last unchecked is always reopened, so they set a 57 s floor no change removes.
That floor is carried to `looks-as-promises`, the plan that makes looks
promises.

**Structure:** the plan touched 41 files, +3,890 / −422 over 70 commits; the
code alone is 34 files under `apps/`, +3,432 / −342. New files: `reuse.ts`,
`reuse-run.ts`, `dev-server.ts`, `served.ts`, `browser.ts`, `errors.ts`, their tests, and the contract test
`looks-check-speed.contract.test.ts`.

## Getting to Done

- **The audit found 10 problems**, mostly ways reuse could hide a change. All
  were fixed in Build Phase 4, the falsification phase:
  - a look measured against a server still serving the build from before an
    edit was kept as held (the worst; now the result is not kept and the run
    says the server is behind its sources);
  - the stylesheet's element and body rules were in no story's key;
  - the checker's own version (its measured properties and verdict rules) was
    in no key;
  - two checks of one project writing at once could overwrite each other's
    removals;
  - the root read had no timeout;
  - development markers were searched for in the page's text, so a production
    page that mentions `react-refresh` was refused — now only in asset URLs;
  - the root read ignored the base URL's path;
  - a page that reads its size or scheme once on mount was measured at the
    first device's drawing — now detected and measured fresh;
  - a look held at some device and scheme pairs and not others was handled
    only in a hand-made test;
  - stale row text and the ADR's list of what no key covers.

  Narrow cases remain (the record write is not locked across the
  milliseconds between read and rename; code the app imports from outside its
  sources is in no key). The full `--all` check in the slow tier catches them.
- **Cleanup** split `check.ts` from 1,232 lines back to 565: the served-page
  read (`served.ts`), the browser work (`browser.ts`) and the run's reuse
  planning (`reuse-run.ts`, beside the rule in `reuse.ts`) each got a file.

## What We Learned

- **A cache of a check must key on what the check measured against, not only
  on the sources.** The first key held the sources; the falsification found
  that a stale server, the checker's own rules and the stylesheet's base rules
  all changed the result without changing the key.
- **Measuring cost was in the transport, not the browser.** Returning one string
  instead of one object per value was a tenfold gain on the largest pages,
  found only by measuring.
- **An unreadable look is a fixed cost.** A floor of looks that can never be
  checked makes a "proportional to change" promise unreachable until those
  looks are fixed or excluded.

## What We'd Do Differently

- **Measure the floor before writing the expectation.** The 15 s expectation
  was set before anyone counted the looks a check can never read; a run with
  nothing changed would have shown the 57 s floor at research time.
- **Give the served-build and configuration work trajectory rows when they are
  added.** They shipped in Build Phase 3 with tests but no rows; the audit
  flagged that this is exactly the work that decides whether a look is reported
  held without opening it.

## Insights Worth Carrying Forward

- A reuse rule is a promise about the build, not the source tree: what was
  served, what measured it, and with which rules.
- Keep the full check running somewhere (here, the background slow tier) as
  the backstop for every narrow case the reuse key cannot see.

## Quality

- **Biome:** no new rule. Fixes during the work were formatting.
- **Shape:** 2 findings raised across the five build phases — Build Phase 1 one
  (an unused re-export in `check-run.fixtures.ts`), Build Phase 4 one (move the
  reuse notices out of `planReuse` into their own function); Build Phases 2, 3
  and 5 none. None was judged wrong by a person.
- **Audit:** 10 problems, all fixed in Build Phase 4 (above).
- **Tests at close:** 38 trajectory rows — 36 passing, 2 skipped (the two
  timing rows, accepted as information). `auditPlanAtClose`: nothing blocked,
  nothing non-terminal. Its one Deferred Verification row — a screen whose
  data changed is reused past, since data is in no key — is classified
  `downstream-plan`, but its real mitigation is the system-tier full check
  (`looks-admin-all.contract.test.ts`, listed in `vitest.tiers.ts`). The
  classifier has no kind for a slow-tier test; flagged, not changed.

## Carried forward

To `looks-as-promises`: the 57-second floor of an unchanged look check — about
40 looks that can never be checked and are reopened on every run.

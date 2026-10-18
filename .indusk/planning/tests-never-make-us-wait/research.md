---
title: "Tests never make us wait"
date: 2026-10-17
status: complete
---

# Tests never make us wait — Research

## Question

Which tests should run while a plan is built, and how does everything else get run
without anyone waiting on it?

## Background

Development slowed to a crawl on tests (Sandy, 2026-10-17): a CSS bugfix took five
build phases, one story-frame check took 23 minutes, and `pnpm test` took 3 m 45 s. The
slow loop is a release's slow test failing, then an incident, then a Maintenance phase,
then a bugfix plan, then a visual check inside a phase. That loop is what stalled the
autonomy work in [promise-core](../promise-core/master.md) (`run-the-master`), so this
plan comes first.

The philosophy: software that keeps moving and fixing itself over time, not perfect at
every commit. Test the change now; sample regression over time; production telemetry is
the backstop.

## Findings

### When tests run today

- **Each phase:** that phase's own test rows, plus `vitest related` on the files it
  changed, then tsc and biome (the work skill's Verification gate).
- **Landing:** the retrospective runs the whole `pnpm test` after merging main. `plans
  land` runs `plans.land_checks`, and dusk declares none; landing declares no slow tests.
- **Release:** `indusk release` runs `pnpm -w test:system` after publishing. A failing
  file becomes an incident on the promise its row names, or a draft bugfix plan
  (`a-failing-slow-test-breaks-its-promise`). On 2026-10-16 that told every agent "a
  promise broke in production" seven times, for test failures.
- **e2e:** when the retrospective calls for it.
- **On commit:** nothing runs; the eval agent scores the commit.

### Where the everyday suite's time goes (2026-10-17, this machine, 10 cores)

`pnpm test` took about 150 s on every run, and its own guard reported
`everyday-suite-stays-fast` broken at 150 s.

| Package | Wall time |
|---|---|
| indusk-mcp | 128 s (509 files, 1,080 s of test time) |
| indusk-admin | 32 s |
| indusk (editor) | 2 s |
| seat-holds | under 1 s |

In indusk-mcp, the 92 files over 3 s account for 869 s of the 1,080 s (80%). They start
the CLI, a git repository or a workbench: `run/workbench-split` 58 s,
`plans-workbench` 52 s, `new-project-cli` 45 s, `impl-corpus` 41 s, `promises-contract`
38 s, `looks-components-cli` 34 s, `promises-check` 27 s, `release-incident` 25 s,
`promises-confirm` 24 s.

### What tests already say about promises

A test row's `For` cell names a promise or a clause, and a test file carries `promise:
<name>` or `clause: <promise>/<clause>`; `indusk promises confirm` writes each promise's
`tests:` from them. So "the tests of the promises a brief lists as Must not break" can
already be read from the registry. Nothing records when a test last ran or what it
returned.

### Prior art: systems that already do this

- **Google's TAP.** Before submission a change runs only the tests relevant to it;
  after submission the wider set runs in batches over ranges of commits, and an
  automated culprit finder narrows down which commit broke a failing test. Detection
  is about one to two hours after the change; work is moving towards running the
  tests most likely to fail more often. ([What Breaks Google?](https://research.google/pubs/what-breaks-google/),
  [Speculative testing](https://research.google/pubs/speculative-testing-at-google-with-transition-prediction/),
  [Flake-aware culprit finding](https://hackthology.com/flake-aware-culprit-finding.html))
- **Choosing a change's tests.** Vitest has it: `vitest related <files>` and
  `--changed <ref>` run the tests whose imports reach the changed files
  ([Vitest `changed`](https://main.vitest.dev/config/changed)). Launchable and
  Develocity learn the choice from history; Develocity is Gradle and Maven only,
  Launchable a hosted service. Neither fits.
  ([Launchable](https://www.launchableinc.com/topics/test-impact-analysis/),
  [Develocity](https://gradle.com/develocity/product-tour/accelerate/predictive-test-selection))
- **Visual checks of what changed.** Chromatic's TurboSnap uses git and the bundler's
  dependency graph to find the stories a change reaches, snapshots those and carries
  the rest's baselines forward ([TurboSnap](https://www.chromatic.com/features/turbosnap)).
  Paid and hosted; the looks system already does the comparison, so the shape is
  borrowed, not the product.
- **Order.** History-based prioritisation in CI finds that past failures predict
  future ones; the earliest form ranked tests by when they last ran and whether they
  had found a fault ([Haghighatkhah et al., 2018](https://arxiv.org/pdf/1809.00143)).

### Promises in force that this plan comes near

- `everyday-suite-stays-fast` (behaviour): the suite finishes within two minutes; a slow
  run reads broken. A time target is an expectation, met by degree, not a promise.
- `a-failing-slow-test-breaks-its-promise` (state): a failing slow test opens an
  incident.
- `slow-checks-run-once-per-tree` (state): release skips the slow tier when landing
  already ran it green.
- `a-look-check-costs-what-changed` (state): a look check takes time in proportion to
  what changed.
- `everyday-tests-never-wait` (structure): its sentence says the system tier "runs at
  landing and on release".
- `the-everyday-suite-passes-on-main` (state).
- `a-plan-is-approved-with-its-looks-approved` (state): a person's approval of a look,
  which is not visual regression.

`promises replace` is the only way to take an enforced promise out of the registry.

## Decisions

All Sandy, 2026-10-17:

- **Promises say what happens, literally.** Not a time, not "never waits": "a plan runs
  the tests it writes and the tests of what it must not break". Times and outcomes are
  the purpose, and go in the brief's Expectations, which are met by degree and never
  break.
- **A plan runs the tests it writes and the tests of the promises its brief lists as
  Must not break.** Not every promise whose code the diff touches: a promise the diff
  touches and the brief does not list is the sampler's.
- **When tests run stays as today**: each phase for what it changed, everything the plan
  runs at landing. What changes is which tests run.
- **Visual testing is not visual regression.** A visual test checks the look a change
  touched, in seconds, in the work. Regression across every look and device is too slow
  to wait on and becomes the sampler's.
- **Everything else runs behind the scenes, oldest first.** Each test and look check
  records when it last ran and what it returned; the sampler runs the ones run longest
  ago. A failure it finds alerts, as "found by the sampler", never as "in production".
- **No slow tier and no release test.** Tests that start the CLI, a git repository or a
  workbench run when a plan needs them, or when the sampler reaches them. Updating
  InDusk from npm right after a publish is what tests the package.
- **The sampler runs recently failed tests first, then those run longest ago**
  (Sandy, 2026-10-17, from the prior art).
- **A sampler failure is run once more; one that passes then is noted as a flake and
  breaks nothing**, as the release path treats a flake today (Sandy, 2026-10-17).
- **Every run records its commit and result; finding the commit that broke a test is
  `a-break-runs-its-tests`'s** (Sandy, 2026-10-17).
- **A sampler failure breaks the promise its test names, with "found by the sampler"
  as its source; no new page.** A page listing each test with its last run is later,
  if wanted (Sandy, 2026-10-17).
- **This is package behaviour**: every project InDusk runs gets the same rule for what
  a plan runs and the same sampler, not only dusk.
- **One docs page explains the whole thing** (Sandy, 2026-10-17): what a plan runs and
  when, what a visual test checks, what the sampler runs, in what order, and how a
  failure reaches you, from one page in the guide. Today the model is spread across
  `guide/test-kinds.md`, `guide/test-levels.md`, `guide/test-trajectory.md` and the
  `release-checks-run-once` and `looks-check-speed` decisions; the new page is where a
  reader starts, those pages are brought into line with it, and what this plan retires
  (the slow tier, the release test) is removed from them. The ADR's Documentation Plan
  names it and the impl gives it a Document item.
- **Not now:** a clause's break running that clause's tests (`a-break-runs-its-tests`,
  after `mark-first`); landing through pull requests, once InDusk has users or a team.

## Open Questions

- For the ADR: which process runs the sampler on a schedule (the admin daemon is the
  likely one), where each run is recorded (machine state under `~/.indusk/projects/`),
  how many tests a run takes, and what leaves the release path.

## Sources

- `.indusk/planning/promise-core/master.md`, the `tests-never-make-us-wait` entry
- `.indusk/planning/telemetry-from-day-one/master.md`, the `a-break-runs-its-tests` entry
- The `pnpm test` runs of 2026-10-17 while closing `a-new-project-starts-instrumented`

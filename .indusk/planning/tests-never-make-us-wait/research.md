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
- **Not now:** a clause's break running that clause's tests (`a-break-runs-its-tests`,
  after `mark-first`); landing through pull requests, once InDusk has users or a team.

## Open Questions

- How often the sampler runs, and how many tests a run takes.
- Where the sampler's alert reaches the person: the admin, `/catchup`, or both.

## Sources

- `.indusk/planning/promise-core/master.md`, the `tests-never-make-us-wait` entry
- `.indusk/planning/telemetry-from-day-one/master.md`, the `a-break-runs-its-tests` entry
- The `pnpm test` runs of 2026-10-17 while closing `a-new-project-starts-instrumented`

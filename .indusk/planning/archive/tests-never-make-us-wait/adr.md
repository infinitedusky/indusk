---
title: "Tests never make us wait"
date: 2026-10-17
status: accepted
---

# Tests never make us wait

## Goal

**A plan runs only its own tests, the tests its changes reach and the tests of what it must not break, and a visual test opens only the looks a change touched.**

On 2026-10-17 every `pnpm test` took about 150 s and the retrospective ran it whole at
landing; 92 files that start the command line or git made up 80% of that time while the
guard that keeps the everyday suite fast did not count starting a process as waiting.
One edit to any admin page reopened every screen in a look check, because all screens
share one hash over the app's sources. After this, the waiting is gone from the build
loop, and the rest is the sampler's (the next plan).

## Y-Statement

**In the context of:**
a plan's phases and landing, which today run what the skills' prose says (the rows' test files, `vitest related`, then the whole suite at landing), and look checks that reuse an unchanged story but reopen every screen on any page change.

**Facing:**
an everyday suite of about 150 s, nothing in the command line that computes the tests a phase's changes reach or the tests of a brief's Must-not-break promises, and no mapping from a changed file to the screens drawn from it.

**We decided for:**
one command, `indusk plans tests <plan> --phase <N> | --landing`, that computes and runs the plan's test set (its rows' files, the tests whose imports reach the files it changed, and at landing the registry tests of its Must-not-break promises), named by the work, verify and retrospective skills in place of the whole suite; the everyday guard counting a test that starts the command line, git or Node as one that belongs in the system tier, and the 92 such files moved there; and `indusk looks check --changed <ref>`, which opens a look only when a file in its page's or component's import closure, or the app's foundation, changed.

**And against:**
keeping `pnpm test` at landing (it is the waiting), a test-impact service such as Launchable or Develocity (hosted or Gradle-only, and history-trained where the import graph already answers), Chromatic's TurboSnap (paid, hosted, and the looks system already compares), and a hand-kept list of the tests per promise beyond the registry's `tests:`.

**To achieve:**
seconds per phase, a landing that runs what the plan touched and what it must not break, and a look check that costs what changed.

**Accepting:**
that until the sampler lands, a test no plan names, reaches or protects does not run unless a person runs it; that `pnpm test:system` grows by the moved files and still runs after a publish; and that an app whose imports cannot be traced is checked whole.

**Because:**
the import graph and the registry already say which tests a change and a brief concern (prior art: Google's TAP runs the relevant tests before submitting and the rest after), and the change we just made is what needs checking now.

## Context

[research.md](research.md) holds the timings, where each test runs today, the full
accounting of where the testing model is described, and the decisions with Sandy. The
promises are in [brief.md](brief.md), the assertions in [test-plan.md](test-plan.md).

## Decision

1. **The plan's test set is computed in one place.** `lib/plans/test-set.ts`
   `planTestSet(reads, { phase } | { landing: true })` is pure, handed what was read:
   the trajectory rows, the files changed (a phase's from the phase-boundary record,
   `changedFilesForPhase`; landing's from the plan branch against the trunk), the
   brief's Must-not-break names (`parseBriefContract`), the registry (`readPromises`,
   `findPromise`), and a `related(files)` function. A phase gets the files of rows whose
   `Writable at` or `Passes at` is that phase, plus `related(changed)`; landing gets
   every row's files, `related(changed)`, and each Must-not-break promise's `tests:`. A
   promise with none is listed under "no tests" in the output, never dropped (A5).
   `manual:` rows are listed as manual, not run.
2. **`related` is Vitest's, and it runs as it finds.** Vitest has no way to list the
   tests related to a file without running them (`vitest list` takes no `--related`,
   checked 2026-10-17 on 4.1.11), so in each package the changes touch the command runs
   `vitest related <changed files> --run --reporter=json --outputFile.json=<path>` and
   reads the files that ran from the report; they are part of the set and are not run
   again. A3 is the contract row over that report.
3. **`indusk plans tests <plan> --phase <N> | --landing [--list]`** runs the set through
   the project's test command per package (`resolveTestCommand`, `lib/verify/red-tests.ts`),
   reading exit codes, and prints each file with its reason (row, reached, must not
   break). `--list` prints the rows' and the Must-not-break promises' files without
   running anything, and says the reached tests are found by running them. The work and verify skills' Verification
   step and the retrospective's landing step name this command; the retrospective no
   longer runs `pnpm test` or `indusk checks slow` (A7).
4. **The everyday guard counts processes.** `everyday-tests-never-wait.test.ts` adds
   `runCli(`, `runCliAsync(`, and a `spawnSync`/`execFileSync`/`spawn`/`execFile` of
   `"git"` or `"node"` to its patterns (helpers stay exempt, as today), and every file
   it then flags moves to its package's `SYSTEM` list. `everyday-tests-never-wait`'s
   sentence changes in the same phase (`indusk promises change`).
5. **A look is touched by its import closure.** For a screen, the page file is its
   `page` in `screens.json` when given, else derived for a Next.js app router from its
   `path` (segments matched against the `app/` folders, `[param]` matching any segment,
   with the `layout` files above it); for a story, its component file. The closure is
   read with the app's own TypeScript (`preProcessFile` and `resolveModuleName` with the
   app's `tsconfig`), loaded from the app's directory. A changed file in a look's
   closure, a change to the app's foundation or `screens.json`, or an app whose closure
   cannot be read touches the look; nothing else does (A8–A10, A12).
6. **`indusk looks check --changed <ref>`** hands `planReuse` the touched set: a touched
   look is opened on every device it is drawn for; an untouched one is reused from its
   held result even when its key changed elsewhere (A11, A12). `--all` still opens all.
7. **The suite's time is still recorded.** `scripts/suite-speed.js` keeps recording each
   run's duration as the brief's expectation reads it; its mark stops naming the
   replaced `everyday-suite-stays-fast`.

## Alternatives Considered

### Run the whole suite at landing, only faster
Rejected: the brief's limit is that nothing else runs; a fast whole suite is still the
regression check the sampler takes over, and it grows with the repository.

### A test-impact product (Launchable, Develocity)
Rejected: hosted or Gradle and Maven only, and both learn from history what the import
graph and the registry already state.

### TurboSnap or another hosted visual service
Rejected: paid and hosted; the looks system already compares. Its shape, the git diff
plus the bundler's graph, is what decision 5 borrows.

### A screen's sources declared by hand in `screens.json`
Kept only as the override (`page`): a hand list drifts from the code; the import graph
does not.

## Consequences

### Positive
- A phase runs seconds of tests; landing runs the plan's own set.
- The everyday suite, for a person who runs it, comes down to roughly half a minute.
- A page edit reopens only its screens.

### Negative
- `pnpm test:system` gets longer, after a publish, until the sampler replaces it.
- A test reached only through a spawned CLI (no import) is not "reached"; it runs when
  a row names it or a Must-not-break promise lists it.

### Risks
- **A must-not-break promise with stale `tests:`** runs the wrong files. Mitigation: A5
  names a promise with none; `indusk promises check` already refuses a missing file.
- **The derived page for a route is wrong** for an unusual Next.js layout (route groups,
  parallel routes). Mitigation: a route that matches no page file touches every screen
  of the app, so it over-reports; `page` overrides it.

## Documentation Plan

### Pages
- Update: `guide/test-levels.md` (what a phase and a landing run), `reference/cli/plans.md`
  (`plans tests`), `reference/cli/looks.md` (`--changed`, `page`),
  `reference/skills/retrospective.md`.
- The Testing and telemetry approach section is a documentation plan of its own, later.

### Diagrams
- None.

### Changelog
- A plan runs its own tests, what its changes reach and its Must-not-break tests; a look
  check of what changed opens only the looks it touched.

### ADR in Docs
- Yes: `decisions/tests-never-make-us-wait.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/planning/the-sampler/` — the next plan

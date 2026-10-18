# Tests Never Make Us Wait

Every `pnpm test` took about 150 seconds, the retrospective ran it whole at
landing, and 92 test files that start the command line or git made up 80% of
that time. The guard that keeps the everyday suite fast did not count starting a
process as waiting. Separately, one edit to any admin page reopened every screen
in a look check, because all screens share one hash over the app's sources.

Full ADR: `.indusk/planning/archive/tests-never-make-us-wait/adr.md`.

## What was decided

**A plan runs its own tests, the tests its changes reach and the tests of what
it must not break, and a visual test opens only the looks a change touched.**

| Decision | What it is |
| --- | --- |
| The test set is computed once | `planTestSet` in `lib/plans/test-set.ts`: a phase gets its rows' files plus the tests its changed files reach; landing adds the tests of every promise the brief lists as Must not break. A promise that names no test is listed as having none, never dropped. |
| Reached tests are Vitest's | `vitest related <changed files>` runs in each package the change touches (a package is the nearest folder with its own Vitest config, so `examples/*` counts), under its default and its system config; the files it ran are the reached set. Code and JSON files are searched; documents are not. |
| One command | `indusk plans tests <plan> --phase N \| --landing [--list]` runs the set and prints each file with its reason and its own result (read from Vitest's JSON report). The work, verify and retrospective skills name it in place of the whole suite. |
| One way to run a test file | `lib/tests/run-files.ts` runs files package by package and tier by tier, for the plan's test set and for `indusk verify`, so a passing system-tier row is not reported red. Verify now reads Vitest's JSON report file for per-file results, a reversal of the earlier runner-agnostic rule, which held only exit codes; other runners still get one file per call and an exit code. |
| The guard counts processes | A test that starts the command line, git or Node, directly or through a test helper that does, is a system test; about 190 files moved to their package's system tier, and `pnpm test` went from about 150 s to 33 s. |
| A look is touched by its import closure | A screen's page, layouts and imports, a story's component and imports, read with the app's own TypeScript. Foundation, stylesheets, styling config, the app's `public/` files and its Next.js config touch every look, and so does a closure that cannot be read. |
| `looks check --changed <ref>` | A touched look opens on every device; an untouched one is reused from its held result even when its key moved. `--all` and `--only` win. |
| The suite's time is still recorded | Each `pnpm test` appends its seconds to machine state; it no longer marks the promise this plan replaced. |

## Consequences

- A phase runs seconds of tests; landing runs the plan's own set. A page edit on
  the admin touches 27 of its 181 looks.
- Until the sampler (the next plan) lands, a test no plan names, reaches or
  protects does not run unless a person runs it. `pnpm test:system` is longer by
  the moved files and still runs after a publish.
- A test reached only through a spawned command line, with no import, is not
  "reached"; it runs when a row names it or a Must-not-break promise lists it.
- A route the app-router match gets wrong, or an app with no TypeScript to load,
  touches every look: the check over-reports and never under-reports. A screen's
  `page` in `screens.json` overrides the match.

## Known gaps

- A changed `package.json` or Vitest config makes Vitest's related search rerun
  that package's whole suite, both tiers: one dependency bump costs a full run.
- The everyday guard misses a helper that starts git through another helper's
  import, and does not scan the editor extension's tests; a few of this repo's
  fast tests still start git. The fast/slow split is this repository's own
  arrangement and is to leave InDusk.

## Rejected

- Running the whole suite at landing, only faster: the sampler takes the
  regression check over, and a whole suite grows with the repository.
- A hosted test-impact service, or a hosted visual service: paid or hosted, and
  the import graph and the registry already state what they would learn.
- A hand list of each screen's sources in `screens.json`: it drifts from the
  code. It stays only as the `page` override.

See [`plans tests`](/reference/cli/plans) and [`looks check`](/reference/cli/looks).

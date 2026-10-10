---
title: "release-records-its-failures"
date: 2026-10-10
---

# release-records-its-failures — Retrospective

## What We Set Out to Do

The 1.69.0 release stopped on three system-tier tests that had fallen behind two deliberate changes, because nothing had run the slow tier since landing stopped running it. Sandy had already decided he would rather ship a failure than wait; the release script still welded the slow tests in front of the publish. The brief asked for a release that is a declared step of the workflow — its order and what "done" means stated in config — whose slow-test failures become incidents on the promises their rows name, or draft bugfix plans, instead of a stopped release. Generic, not npm-only; JUnit as the report format; not a pipeline runner.

## What Actually Happened

All of it shipped across a test phase and eight build phases: five planned, a falsification phase (Build Phase 6), a cleanup phase (Build Phase 7) and a phase the audit produced (Build Phase 8). 77 commits; 52 files outside `.indusk/` (+3,245/−67). 29 trajectory rows passing; A19, the live release, is deferred to the first real `indusk release` after landing.

- **`indusk release`** runs `workflow.steps.release`: slow tests `before` or `after` the command, `done_when: published | green`, a covering green run skips the slow tier, exit 0 only when done; one line per release in `releases.jsonl`; green runs now record their commit.
- **Failures come from the JUnit report** (`fast-xml-parser`), one rerun by file through a declared `rerun` template, flakes listed, more than half the files failing read as the environment.
- **Routing** through trajectory rows: a row's promise gets a test-born incident (`source: release`, `tests:` + `release:` evidence, the suspect commits since the last green run), committed on the trunk and put in the break inbox like the recorder's; anything else becomes a draft `fix-<stem>` bugfix plan on its own branch.
- **dusk declares its own release**: `test:system` left the release script; each package writes a JUnit report; `scripts/rerun-system.js` reruns only the given files per package; `dusk-installs-its-own-build` now says publishing's slow tests run after it.

## Getting to Done

- **The environment rule contradicted two promises.** Accepting the ADR's "more than half the files failing opens nothing" made promises 4 and 5 untrue as worded; both were withdrawn and re-declared under the same names, with A22 added. A rule added in an ADR's Risks section can change what the brief promised.
- **Build Phase 3 put the root `CLAUDE.md` over its ceiling** (Build Phase 1's Key Decisions line) and `context-tiers-register.test.ts` went red; fixed in Build Phase 4 by moving a VS Code rule down to the extension's own file. The package `CLAUDE.md` was already over its nested budget and refused Build Phase 4's context line; the `lib/promises/` and `lib/release/` rules moved into those folders' own `CLAUDE.md`.
- **Build Phase 5 found the impl's rerun form did not work**: `pnpm -w test:system -- {files}` reruns everything, because the root script never reads its arguments. `scripts/rerun-system.js` replaced it. It also found that vitest writes package-relative paths, which would have routed every real failure nowhere; the reader now resolves them against the report's package.
- **Sandy asked that a release's incidents be committed and announced** like the recorder's (A23), which brought `a-break-reaches-the-working-agent` into the brief.
- **Falsification found five real gaps**, all confirmed red first: stale reports read as this run's (A24), a routing throw after publish losing the outcome and the record (A25), two test files with one name sharing a plan (A26), a recurring failure colliding with its archived fix plan (A27), and an unquoted file list in the rerun shell command (A28).
- **The everyday suite at landing caught a single-definition breach**: Build Phase 1's `headCommit` spelled `rev-parse HEAD` itself, which `head-sha-single-definition.test.ts` A19 forbids outside `lib/git.ts`; a synchronous `headShaSyncOrNull` was added there and `headCommit` reads through it. No phase ran that pin — it runs only in the whole suite.
- **The audit found two more**: a file merely absent from the rerun's report counted as a flake (A29) — the A9/A10/A28 fixtures had encoded that very behaviour — and a `fix-<stem>` name held on the trunk or by a branch leaving a failure unrouted forever (A30).

## What We Learned

- **A rule added to an ADR can silently contradict the brief.** The environment rule was a reasonable risk mitigation and made two accepted promises false; it was caught only because the impl's rows had to name a promise and the sentence no longer fit.
- **A command written in a plan is untested until it runs.** The rerun form and the JUnit path shape were both reasoned, not run; Build Phase 5 ran them and both were wrong. The same lesson the work skill records about its own tsx commands.
- **Test fixtures can encode the bug.** A9's rerun fixture produced a report that simply omitted the flaky file, so "absent means passed" was asserted as correct behaviour; the audit, reading cold, saw what three phases of the builder did not.
- **The audit earned its place again.** Its question 1 (does each row prove its promise as worded) found the flake gap; falsification, run by the builder, had looked at the rerun and quoted it but not questioned what "passed" meant.

## What We'd Do Differently

- Run every command an impl names, once, before writing it into the plan — the rerun template and the report paths would have been right in the impl.
- When an ADR adds a rule, re-read the brief's promise sentences against it in the same sitting.

## Insights Worth Carrying Forward

- The first real `indusk release` (1.70.0) is A19's live check: record its output and its `releases.jsonl` line here.
- Follow-ons: slow tests after landing (the same declaration, `land.slow_tests` with `when: after`); the environment rule applied per package report (one package's broken environment still opens a plan per file); backfilling `For` and `Test` cells in archived rows so more failures reach a promise.
- `lib/promises/inbox.test.ts` A17 fails on `main` and on this branch alike; it predates the plan and is recorded in known-issues.

## Quality Ratchet

No recurring lint or type errors; no Biome rule is warranted. Shape: 5 findings raised across the phases (Test Phase 1: `declaredRelease`; Build Phase 3: `claimsOf`; Build Phase 4: `routeUnclaimed`; Build Phase 6: `routeWithoutLosingTheRelease`; one more in Build Phase 2's settle extraction), 0 judged wrong by a person; 6 Shape entries recorded nothing found or left as-is.

## Metrics

- 77 commits; 52 files outside `.indusk/`, +3,245 / −67.
- 29 trajectory rows passing, 1 deferred (A19, the live release).
- Falsification: 5 hypotheses, all confirmed and fixed. Audit: 24 findings, 2 fixed before close, the rest carried.

---
title: "The admin says what kind of plan it is"
date: 2026-10-01
---

# The admin says what kind of plan it is — Retrospective

## What We Set Out to Do

The plan bar drew every absent earlier document the same way. A bugfix that
never needed research and a bugfix that closed without its test plan both got
a dashed "skipped" segment, so the bar asserted a judgment nothing had made.
`release-ritual`, a bugfix, had closed that way and nobody could see it.

The brief named the fix: a plan declares its type (`workflow:` in its brief),
the admin shows it as a chip that explains itself, and an absent document
reads one of four ways according to that type — skipped, missing, pending or
unknown. The type is never guessed from which documents exist.

## What Actually Happened

That shipped, and the plan turned out to be about a wider thing than the bar.
66 commits on 2026-10-01 before the landing; 46 files, about +2,700/−185, of
which `apps/` is 36 files, +2,321/−109. Six phases: Test Phase 1, three build phases, a falsification
phase and a cleanup phase. 26 trajectory rows, all passing.

**The cause was upstream of the admin.** The ground-truth check before the
brief was accepted found that three of the four workflow templates, and the
planner's reference page, omitted the test plan while the planner skill's own
table required it. A bugfix written from the template could close without a
test plan because the template never asked for one. So Build Phase 1 made one
module, `workflow-types.ts`, the statement of what each type requires, and
pinned the skill's table, the four templates and the reference page to it by
test. The admin's chip and bar read the same module.

**Falsification found that the type judged documents and nothing else.** Six
hypotheses were authored; five were confirmed as written and one was half
wrong.

- **A19**, the row asserting a `workflow:` value that is not a plain word is
  never read as a type. `String()` of a one-element YAML list is its
  element's text, so `workflow: [bugfix]` read as a bugfix. Confirmed. The
  same row's claim that `workflow: no` parses to `false` was wrong: this
  YAML parser reads `no` as the word. The case stays as a guard and the impl
  records the correction.
- **A20**, the row asserting the sentence under the bar names an
  unrecognised declaration. A plan that declared `hotfix` was told by its
  chip that `hotfix` is not a type and by its bar that it declares no type.
- **A21**, the row asserting a spike reads executing, falsify and cleanup as
  skipped. Both spikes in this repository read them as pending forever.
- **A22**, the row asserting a finished document with nothing required after
  it does not say it awaits the next one.
- **A23**, the row asserting the plan list's next step is the next document
  the type requires. A bugfix with an accepted test plan was told to create
  the ADR. This plan was, between its own test plan and impl.
- **A24**, the row asserting the chip is shown whenever the bar is.

**A25 was not a hypothesis. It was found by printing.** After A23 went green
I printed this repository's own plans, which the phase's Verification asked
for. `jev-decision-model`, a spike, still read "Review research" in the plan
list while its bar said the spike ends there. A23's spike case had used
`status: completed`. Thirty-three of the thirty-six research documents here
say `complete`, and the plan list did not count that word as finished. The
test passed without touching a single plan that exists. Following that led to
`advance_plan`, a second door onto "what comes next" with its own answers
written in: "test-plan → adr" for every plan, and a third copy of the
finished-word list, also one word short.

**Cleanup pinned what falsification had fixed by hand.** Two questions had
each been answered in three files. The single-definition scan that should
have caught that read only `src/lib`; two of the three copies of each were in
`src/tools`. A26, the row asserting one definition each of a document's
label, the finished words and the next required document, widened the scan.
It went red on a third thing spelled three times that nobody had noticed: the
human word for a document.

## Getting to Done

- **A stray dev server failed 43 admin tests, twice.** The first time it was
  the server I had started for the by-eye check. The second time it was a
  `next-server` orphaned when I killed an interrupted suite run: I killed the
  parent with `-9` and the child kept the directory. Both look identical to
  43 real failures.
- **A fresh worktree fails nine package tests** until the admin is built and
  bundled into it. `pnpm --filter indusk-admin build` alone is not enough.
- **A formatter run from the wrong directory reformatted a whole file.**
  `biome check --write` from `apps/indusk-mcp` on an admin file applied the
  package's formatting to it, 489 lines of diff for an 8-line change. Caught
  in the diff before committing; restored and redone.
- **One commit left out a file it named.** `f5c8b2a5` was given three paths
  and committed two; the `advance_plan` change itself was missing and landed
  in `7f120548`. I do not know why. The suites ran against the working tree,
  so nothing was green on false grounds, but from then on every commit was
  checked with `git show --stat`.
- **The parity snapshot had to be re-baselined** for seven closed plans,
  each going from "Review retrospective (status: complete)" to "Done". Named
  one by one in the commit and the impl.
- **CLAUDE.md closed 3 bytes under its budget.** Every context edit in this
  plan was a compaction first and an addition second.

## What We Learned

- **A fixture that uses a word nobody uses proves nothing about the plans
  that exist.** A23 passed with `completed` while every real spike said
  `complete`. Printing the repository's own data after the fix is what found
  it; the test never would have.
- **When a new fact becomes the judge of a question, find every reader of
  the question, not every reader of the data.** The type was wired into the
  one place that read documents. Four places answered "what comes next"
  — the bar's segments, its label, the plan list, `advance_plan` — and three
  of them had never heard of the type.
- **A scan that asserts one definition only covers the directories it
  reads.** The lifecycle pin read `src/lib` and reported one definition while
  `src/tools` held two more copies of each.
- **`String()` of a parsed YAML value is not what was written.** A list of
  one coerces to its element; a mapping to `[object Object]`. A value matched
  against a vocabulary is a plain string or it is unrecognised, and what is
  shown to a person comes from the line as written.
- **Templates are a statement of the rules too.** The skill said a bugfix
  needs a test plan; the template a bugfix is written from did not. Whichever
  an author reads last wins.

## What We'd Do Differently

- **Author falsification rows against real data.** Each hypothesis test
  should include one case lifted from a plan that exists, not only a
  constructed one. A23 would have been red on `jev-decision-model` from the
  start and A25 would have been a hypothesis instead of an accident.
- **List the readers of the question in the brief.** The ground-truth check
  found the templates. It did not ask "what else says what a plan needs
  next", and that list is three grep results long.
- **Kill a test run by process tree, and check for leftovers by working
  directory** before starting the next one. Both stray-server failures cost a
  full suite run each.
- **Run a formatter from the directory of the file it formats.**

## Insights Worth Carrying Forward

- A one-clause change to a row is still a change to a row. A23 says "a plan
  with no type reads as it does today". Counting `complete` as finished made
  an untyped plan with complete research read "Create brief" instead of
  "Review research". The row's text was left alone and the change recorded as
  a discovered item, with the seven plans it moved named. It was reported at
  the phase's close; nobody has yet said whether the row should be reworded.
- `advance_plan` still treats a brief or a test plan as finished only when
  its status is `accepted`, while the plan list uses the wider list. No plan
  here has a brief marked `complete`, so nothing reads wrong today. It is the
  same shape as the defect A25 fixed and is written here so the next reader
  of that function knows it was seen and left.
- The next plan that adds a fact a plan declares — `plan-premises` adds an
  aim and metrics, `context-tiers` adds tiers — should start from
  `helpers/plan-folder.ts` and from the question "who else reads this".

## Quality Ratchet

No new Biome rule. The mistakes here were not lintable: a coercion that is
valid TypeScript, and duplicated answers to one question in files a rule
cannot relate. The ratchet that did tighten is the single-definition scan,
which now reads `src/tools` and pins three more definitions.

**Shape**: 2 findings across six phases, both in Build Phase 4 (name the
"plan bar is drawn" condition once in `PlanDetail.tsx`; let `readWorkflow`
own what an unrecognised declaration shows). Both were worked. No human
reviewed either, so 0 judged wrong and 0 judged right. Four phases recorded
"nothing to change" and one recorded two files considered and left.

## Metrics

| | |
|---|---|
| Commits on the branch | 66 before the landing |
| Files changed | 46 (about +2,700 / −185); `apps/` 36 (+2,321 / −109) |
| Trajectory rows | 26, all passing (18 planned, 7 from falsification, 1 from cleanup) |
| Trajectory audit at close | 0 deferred, 0 blocked, 0 non-terminal |
| Package suite | 1,681 passed, 5 skipped, at `801db2b8` |
| Admin suite | 340 passed, at `801db2b8` |
| Docs site | builds, no dead links |
| CLAUDE.md | 61,438 of 61,440 bytes after the close-out compaction |

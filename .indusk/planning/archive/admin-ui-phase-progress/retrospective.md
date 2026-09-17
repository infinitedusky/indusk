---
title: "Admin UI phase progress — Retrospective"
date: 2026-09-17
status: complete
---

# Admin UI phase progress — Retrospective

## What We Set Out to Do

Day step 3, "Execution visible live": the admin's plan page should show where
a plan stands and what is happening in it right now, without a reload. The
brief made that two layers — a plan bar from research to retrospective and a
phase bar for the phase being worked — and set two rules that shaped
everything after: progress is **derived from a lifecycle definition, never
from which documents happen to exist**, and the plan builds **the finished
picture as of now, built so the next picture is an addition** — only the
stages no plan has defined yet (Midnight's `monitor`) wait, and a plan that
adds a stage adds its rendering in the same plan, pinned by a test.

Sandy's direction during the brief and the review set the vocabulary: positions
are nouns and activities are verbs, inside `executing` only; every segment is
done / active / pending / skipped, with skipped drawn so every plan's bar has
the same shape; the active segment carries the message. The plan also absorbed
`project-list-workbenches-only` after Sandy called filtering the project list
to workbenches "an over-simplification" — label by shape, prune the dead.

## What Actually Happened

Everything the brief named shipped, and the picture was finished as of now:
one test phase, seven build phases, a second test phase for the live rows,
then falsification and cleanup as Build Phases 8 and 9. 106 commits, 113
files, +6864/−1123; the package 36 files (+2655/−295), the admin 57
(+3514/−623), nine docs pages. Thirty-seven trajectory rows, all passing, two
deferred to human judgement (U1, U2) with their reviews recorded.

**The lifecycle was written once, and three readers stopped disagreeing.**
Before this plan the admin's phase view had its own heading regex, written
before Test Phases existed, so every impl written since August rendered wrong;
`plan-parser` kept a private stage order that skipped `test-plan`; the
retrospective gate restated the ritual words. `lib/lifecycle.ts` now owns
positions, activities, gate stages and ritual order, and `parsePlan`, the gate
and the admin read it — pinned single-definition. A corpus-parity snapshot
(A13) proved the reader behaviour-preserving over 83 plan folders; the one
expected change was six brief-accepted archives now saying "Create test-plan".

**The three-line zoom came from the review, not the ADR.** The first
rendering put three bars on the page that each said "Phase 4". Sandy's
direction at the U1 review — a phase line under the plan bar, each line
naming the level below it, "Implementation Plan" not "Phases", everything
collapsed by default, a Cleanup section beside Falsification — added two rows
(A26, A27) and reshaped the top of the page into `executing: Phase 4` /
`Phase 4: Verification` / `verifying: <item> (n of m)`. The equal-width bar
was accepted as is; no weighted v2 is filed.

**Phase identity became `{kind, number}` all the way down.** Shape's twelve
signatures, the boundary record (an optional `kind`, absent meaning build — a
rule the reader states, no file rewritten) and the admin's adapter all address
a phase by its sequence and number. Shape can review a Test Phase for the
first time.

**Live by `router.refresh()`.** A client wrapper probes the page with a HEAD,
refreshes every `admin.refresh_ms` (default 5000, floor 1000), pauses when
hidden, and stops visibly on failure. Two Playwright rows drive `next dev`
from the node project and pass in about seven seconds. No route handler, no
socket, no second data shape.

**The registry.** The developer's `~/.indusk/projects.json` had 2,307 entries,
11 alive: seven test suites had registered a temp directory per run for
months. `indusk ui prune` removed 2,296 with a backup; a scan pins that every
test spawning a registering command sets `INDUSK_HOME`; the project list
labels `workbench` / `normal-mode` and lists dead entries in a note.

**Falsification found six defects by reading, all confirmed red then fixed**
(A28–A33). Three were the bar telling a confident lie: a completed impl with a
`blocked` row read "cleaned, awaiting /retrospective"; a null readiness read
the same; an in-progress impl with every item checked had an active segment
with no message. One was the root title: the fallback matched the first `# `
line of the raw file, and the real root master carries four YAML comment
lines in its frontmatter. One was the boundary writer accepting what every
reader refuses — observed live, not hypothesised: a record I wrote by hand
with `phase: {kind, number}` made Shape, the dogfood test and the plan page
refuse the whole file at once. One was the registry leak's fix yielding to a
developer who exports `INDUSK_HOME`; the pin moved into the shared CLI helper.

**Cleanup found what a phase-scoped review cannot**: the trajectory-rows table
written three times, the Cleanup section a near-byte copy of the Falsification
one with its own exporter, two spellings of one phase on one page ("Phase 4"
in every heading, "Build Phase 4" in the rows' cells), the progress-line
derivation living in a view that composes ten sections, project-level readers
in the plan-folder reader, and one of them parsing `config.json` by hand. Six
extractions and moves, five reasoned leave-as-is, and a pins test that counts
each definition so a second copy fails the suite.

## Getting to Done

- **The admin's type-check had been red for a month and nobody knew.** Ten
  hand-written trajectory fixtures lacked the `writableAtKind` /
  `passesAtKind` fields. `tsc` was not a test; A25 made it one, and the fixes
  were test work in Test Phase 1.
- **Browser tests cannot import `node:fs`.** The package parser and the
  boundary record had to split into filesystem-free cores
  (`impl-parser-core.ts`, `shape/boundary-record.ts`) with the disk-touching
  functions re-exported beside them; gray-matter needs `Buffer`, so it is
  called only when a document opens with `---`.
- **The boundary record could not open a Build Phase 1.** `recordPhaseStart`
  is idempotent on `{plan, phase}`, so Test Phase 1's record blocked Build
  Phase 1's until `kind` landed in Build Phase 2; Build Phases 3 and 4 opened
  their boundaries after the fact at their starting commits.
- **Gate A's ordering bit twice.** Checking off an item in the same turn as
  the row-state edit it depends on was refused when the checkoff ran first.
  Rows first, then checkoffs — sequentially.
- **The daemon and bundle suites were red only in the worktree.** Nine tests
  failed here and passed on `main` because the admin bundle is a build artifact
  the worktree never had. Building it also ran a production `next build` of
  the changed admin, clean.
- **The corpus-parity snapshot includes the plan in flight.** A13 flagged this
  plan's own folder six times across the close-out — status to `completed`,
  back to `in-progress` for each ritual, rows going `passing` — and was
  re-baselined by hand each time with no other folder moving. The reader never
  changed; the corpus did, because the corpus contains the executing plan.
- **A validator refused a phase over a test's describe-name.** "T10" in a
  Cleanup item looked like a trajectory id; the first commit carried the rows
  and status without the phase block.
- **CLAUDE.md sat within 6 bytes of its budget** for the last three phases.
  Every context edit was paid for by trimming an anecdote from a shipped plan's
  entry — nine trims in all. The budget is doing its job; the file is at the
  point where each rule added costs a story removed.

## What We Learned

- **Define the vocabulary before you render it.** The admin's drift came from
  composing its own lifecycle out of parser output; a fourth copy would have
  drifted the same way. Once the lifecycle was one exported module, the bars
  were a day's work and the pin (`satisfies Record<…>` plus a render-parity
  test) means the next stage cannot be added without being drawn.
- **A writer must validate with its reader's predicate.** One malformed
  append blinded every reader of the boundary file at once, and the readers
  were *right* to refuse — the defect was that the writer did not. The
  predicate now lives in one function both directions call. `tsx -e` does not
  type-check, so a hand-written call's shape is enforced only at the write.
- **The active segment must never claim a fact the reader does not hold.**
  Three of six falsification findings were the same shape: a message that
  sounded finished ("cleaned, awaiting /retrospective") over a state the code
  had not checked. The fix each time was to name what blocks, or to say
  "unknown", never to pick the reassuring default.
- **Pin at the shared chokepoint, not per file.** A `??=` pin in seven test
  files was a rule each file had to remember, and it yielded to an exported
  variable. The CLI test helper every suite already goes through is the one
  place; the scan is the second line.
- **A corpus snapshot must not contain the executing plan.** Every state
  change of the plan under test re-baselines a test that is supposed to pin
  the *reader*. Six hand re-baselines in one close-out is the measurement.
- **Two spellings for two audiences is fine; two spellings on one page is
  not.** The package's `phaseLabel` ("Build Phase 4") is right for logs and
  the headings parser; the page speaks the impl's own spelling ("Phase 4").
  The defect was a component reaching for the package's word.
- **Prose in a docblock can trip a string pin.** The A37 pin for "no hand
  parse of config.json" matched the new module's own comment naming the file.
  A pin for a *code* shape should match the shape (the quoted literal a
  `join(…, "config.json")` needs), not the word.

## What We'd Do Differently

- **Split the plan.** Nine phases, 37 rows, 106 commits across the parser,
  the gate, Shape and the admin. The lifecycle definition plus phase identity
  was one plan; rendering it was another. The brief chose one plan so the
  definition and its first consumer landed together, and that reasoning held,
  but two parity rows and six snapshot re-baselines are the price of one plan
  crossing three subsystems.
- **Exclude the in-flight plan from the parity corpus in Test Phase 1**, when
  A13 was authored. The churn was predictable from the design and became
  visible only at the first status flip.
- **Open every boundary through the documented command, never a hand-typed
  call.** The one record written with a guessed argument shape cost a
  falsification row. The skill's snippet was right all along.
- **Make the admin's `tsc` a test on day one of any admin plan.** A month of
  silent red is what "not a test" costs.

## Insights Worth Carrying Forward

- The convention is now in the lifecycle guide and CLAUDE.md: a plan that adds
  a lifecycle position, activity or gate kind adds its admin rendering in the
  same plan, as a Document gate item. Midnight's `monitor` is the first case:
  listed, labelled, drawn as pending until Midnight derives it.
- `checkRetrospectiveReadiness` reports `rows` and the bar names them; the
  gate and the page can no longer disagree about whether a plan is ready.
- The boundary record is addressed by `{kind, number}` everywhere; a record
  without `kind` is a build phase by rule. Shape reviews Test Phases.
- The admin's one-home-per-piece map after cleanup is in
  `component-conventions.md` and pinned by `cleanup-pins.test.ts`.

## Follow-ons

- **`lifecycle-parity.test.ts` should snapshot the archive only, or skip the
  folder whose impl is `in-progress`/just-completed** — a small change to a
  test; carried to the root master's "Small, not a step" list.
- **U2 — the refresh interval**: Sandy reviews on 2026-09-30 whether 5000 ms
  feels live or loads the daemon; `admin.refresh_ms` is the knob.
- **Test coverage gaps noticed, not fixed**: `LiveRefresh`'s pause on a hidden
  tab has no test (the e2e rows keep the tab visible); `pruneRegistry` over a
  missing registry file; `derivePlanPosition` for a `paper`-stage plan; the
  master bar's placeholder fill. None changes a claim the rows make.

## Quality Ratchet

No Biome rule emerged. The plan's mistakes were shape-and-order mistakes — a
hand-typed call with the wrong argument shape, a pin that yielded to the
environment, a checkoff issued before the row state it depended on, a
snapshot whose corpus moved — and none is a pattern a linter can see. Two
pre-existing Biome findings in the package (`init.ts`'s unused `noIndex`,
`update.ts`'s unused import) predate this plan and were left for their owners.

**Shape findings: 0 raised, 0 judged wrong by a human.** Eleven Shape notes
(Test Phase 1, Build Phases 1–9, Test Phase 2), every one "nothing to change",
each naming the units it read and what it deliberately left alone; recorded
by hand each phase because the library's review runs after Verification is
green and the gate position skips it. Two of the left-as-is notes became
cleanup items (the `existsSync` double filter stayed; the rows table did not).
This is the second consecutive plan reporting zero findings and zero judged
wrong; that is not the streak the calibration trigger names (findings judged
wrong), but two silent plans in a row is worth saying out loud: Shape has yet
to raise a finding in this repository.

## Metrics

| Measure | Value |
|---|---|
| Phases | Test Phase 1 + Build Phases 1–7 + Test Phase 2 + Falsification (8) + Cleanup (9) |
| Trajectory rows | 37, all `passing`; 2 deferred (U1 reviewed, U2 scheduled 2026-09-30), 0 blocked |
| Commits on the branch | 106 |
| Files changed vs `main` | 113 (+6864 / −1123); package 36, admin 57, docs 9 |
| Falsification findings | 6, all confirmed red then fixed |
| Cleanup | 6 extractions/moves, 5 reasoned leave-as-is, 1 pins test |
| Registry prune | 2,296 dead entries removed, 11 kept, backup written |
| Corpus parity | 83 folders; reader unchanged; 6 hand re-baselines of this plan's own folder |
| Live rows | 2 Playwright rows over `next dev`, ~7 s |
| CLAUDE.md at close | 61,418 of 61,440 bytes; 9 anecdotes trimmed to pay for this plan's entries |

## Landed

Landed on main at e58de457, 2026-09-17 (`git merge --no-ff`, 114 commits; trunk integrated by merge first — one ledger conflict, `highlights-processed.jsonl`, resolved as a union and given `merge=union`). Branch and worktree deleted.

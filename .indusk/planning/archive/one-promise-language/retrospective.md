---
title: "One promise language — Retrospective"
date: 2026-10-16
---

# One promise language — Retrospective

## What We Set Out to Do

Give InDusk one vocabulary for promises. The admin said *held*/*broken*, a
signal reported `upheld`/`violated`, the registry stored `known-violated`, a
promise nothing had reported on read *unverified*, *not seen* or *no runs*, and
the docs called the telemetry a *mark*. The brief made one promise,
`a-promise-is-upheld-or-broken` — every signal, record and page says upheld or
broken (holding or broken when live, no signal when unknown) — with three
clauses: the old word `violated` is still read, no signal is never shown as
holding, and what people read calls the telemetry a signal. Two existing
promises had to keep their behaviour: a production break is recorded unasked,
and the thirty days count only what was seen.

## What Actually Happened

Research inventoried the words (about 60 source files, 28 docs pages) and found
the one real hazard: `parseMarkedSpan`, the parse every read goes through,
silently dropped any outcome other than exactly `upheld` or `violated`, so the
settled word `broken` could not be written anywhere without the promise going
dark. Sandy made three decisions on 2026-10-15 that shaped the rest:

1. The stored registry state becomes `known-broken`, and `known-violated` is
   still read as it — no file is rewritten.
2. One reading rule, `readOutcome`, used by every reader: `upheld` is upheld,
   `broken` and `violated` are broken; the always-on server asks Jaeger for
   both values.
3. No version skew: writers keep `violated` this release. A recording server
   older than this plan would drop `broken`, so readers change first and
   `mark-first`, the next plan, switches the writers.

Test Phase 1 wrote thirteen rows first. Three build phases then did the work:
Build Phase 1 changed the two stored words behind `readOutcome` and the
`known-broken` alias; Build Phase 2 changed what the admin, the CLI and the
editor say; Build Phase 3 changed the docs, skills, planning rules and deploy
files, and put a word scan (`promise-words.test.ts`) into the everyday run.

A fresh review then read the plan against its own promise and found eight
issues. Five were fixed in Build Phase 4 (falsification): the editor called a
retired promise holding and said *fixed* and *No runs yet*; the admin said
*never seen* and *nothing seen*; the everyday suite's printed line said
*marked … violated*; the trace-shape helper's messages said *violated*; and
the word scan read too little (extension skills, the docker deploy files, most
promise senses of *mark*), while several pages claimed the writers already
send `broken`. The sharpest was version skew the ADR had rejected, taken
quietly: `indusk promises health --json` — the editor's only input — had
started saying `broken`, and an editor installed before this release reads
that as *held*. Build Phase 4 kept that JSON on `violated` until the writers
switch. Three findings were carried to `mark-first`'s research: the writers
outside `markPromise`, the same skew in the `known-broken` state, and the
dashboard drawing an enforced promise with no signal green.

Sandy then pulled the last of those back in: the green dot contradicted this
plan's own clause, so Build Phase 5 was added — a grey dot and "no signal yet"
for an enforced promise nothing has reported, held by a new approved look
`promise-row.no-signal`. Verifying it surfaced one more defect: the promise list
did not report that row's state to the looks check, so the look came back
unchecked until the page reported it.

The plan closed with 21 trajectory rows, all passing, none skipped or deferred.
The diff against the merge base is 143 files, +2,747/−479, over 83 commits.
Cleanup was reviewed and skipped with its reason (word edits across many
files; each shared reading already defined once).

## Getting to Done

- **The looks check was the long pole.** `indusk looks check admin` ran about
  35 minutes against this branch's admin, and the plan waited on it twice —
  once at Build Phase 4's verification (154 looks held) and again at Build
  Phase 5's (820 held, after the new story). Both green, but an hour of
  wall-clock spent on a plan that changed words.
- **Two promise looks are unreachable.** `promise.broken` and
  `promise.enforced` came back unchecked, on main as well: no seeded promise is
  broken, and the promise page does not report its state. Carried to
  `looks-as-promises` (Sandy, 2026-10-15).
- **The gate refused the cleanup reason at close.** The skip reason was 317
  characters; the retrospective gate takes one sentence of at most 120. Cut to
  one line here; the detail is above.

## What We Learned

- **A stored value changes reader-first, writers a release later.** A value a
  program reads — a signal attribute, a JSON field another tool parses, a
  registry state — cannot be renamed in one release when the reader ships
  separately (a deployed server, an installed editor). Teach every reader both
  values first; switch writers in the next release.
- **"Machine-read" is wider than the obvious wire.** The ADR held the skew line
  for the signal attribute and missed the health JSON the editor reads; the
  review found it only by asking which programs read each changed value.
- **A word scan proves only the patterns it lists.** The first scan refused
  *the mark* and let *production marks* and *sends marks* through. A
  vocabulary guard needs the review to try the senses it does not list.
- **A new look needs its page to report its state**, or the looks check reads
  it unchecked rather than broken — silence, not a failure.

## What We'd Do Differently

- List every machine reader of every changed value in research (attribute,
  JSON output, registry file), not just the signal attribute; the health JSON
  skew would have been designed, not found.
- Put the no-signal dot in the brief from the start: it was the plan's own
  clause, and only the review noticed the dashboard broke it.
- Scope the looks check to the looks a phase touched; 35 minutes per run for a
  text change is the cost the `looks-check-speed` plan exists to remove.

## Insights Worth Carrying Forward

- `mark-first` owns the writer switch, including `scripts/suite-speed.js`,
  the health line's runs and the `known-broken` state an older InDusk refuses
  — all in its research.
- Internal names that still say violation (`violations`, `violationState`,
  `PROMISE_MARK.violatedEvent`) are kept on purpose.

## Shape

Shape ran at every build phase. It raised **1** finding across the plan (Build
Phase 5: the no-signal reading written out twice, named once as
`readsNoSignal`); Build Phases 1–4 raised nothing. A person judged **0** wrong.

Landed on main at 67ddf962, 2026-10-16. Installed with `pnpm install:local`; nothing published (dusk installs its own build; a publish is `indusk release`, the operator's call).

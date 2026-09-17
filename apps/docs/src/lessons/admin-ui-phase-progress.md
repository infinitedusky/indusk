# Admin UI Phase Progress — Lessons

**Plan:** `.indusk/planning/archive/admin-ui-phase-progress/` · **Decision:** [Admin UI Phase Progress](../decisions/admin-ui-phase-progress.md) · 2026-09-17

The plan wrote the lifecycle once and drew it live. The bars were a day's work
once the definition existed; most of what follows was learned from the
definition's other readers, the falsification pass, and a close-out that kept
moving the thing the tests were watching.

## Define the vocabulary before you render it

The admin's phase view had its own heading regex, written before Test Phases
existed, and every impl written after that rendered wrong for a month —
silently, because the view was composing "what is a phase" from its own
reading of the document. Two more partial copies existed: the plan parser's
private stage order (which skipped `test-plan`) and the retrospective gate's
restated ritual words. Three definitions, three silent drifts.

Once the lifecycle was one exported module read by all three, the rendering
was easy and the pin was cheap: label maps declared `satisfies Record<Union,
…>` fail the type-check when a member is added, and a render-parity test names
the member without a label. The convention that came out of it — *a plan that
adds a position, activity or gate kind adds its rendering in the same plan* —
is what keeps the fourth definition from ever being written.

## A writer must validate with its reader's predicate

Every reader of the phase-boundary record throws on a malformed line rather
than skipping it, and that is right: a skipped line silently widens a review
scope. The writer appended whatever it was handed. One hand-typed call with the
wrong argument shape — `tsx -e` does not type-check — put one bad line in the
file, and Shape, the dogfood test and the admin's plan page refused the whole
file at once. The readers were correct; the asymmetry was the defect. One
predicate now serves both directions, and the row that pins it reads: the
writer given a record its reader would refuse throws naming the field and
appends nothing.

## The active segment must never claim a fact it does not hold

Three of six falsification findings were the same shape. A completed impl with
a `blocked` row read "cleaned, awaiting /retrospective". A readiness the code
could not compute read the same. An in-progress impl with every item checked
had an active segment and no message. Each fix names what blocks, or says
"unknown" — never the reassuring default. A progress bar's job is to be right
about the middle; a wrong "done" is worse than a wrong "pending".

## Pin at the shared chokepoint, not per file

Seven test suites had leaked a temp directory each into the developer's real
registry (2,307 entries, 11 alive). The first fix was a `??=` pin in each file
plus a scan for the string. Falsification found that `??=` yields to a
developer who exports the variable in their shell, and that the scan's command
list was narrower than the set of registering commands. The pin moved into the
one spawn helper every suite already goes through — unconditional, with an
explicit caller override — and the scan became the second line. A rule each
file must remember is a rule some file gets subtly wrong.

## A corpus snapshot must not contain the executing plan

The parity row that proved the reader behaviour-preserving over 83 plan
folders included this plan's own folder. So it moved every time the plan's
state moved: `completed`, back to `in-progress` for falsification, rows going
`passing`, `completed`, `in-progress` for cleanup, `completed` — six hand
re-baselines in one close-out, none about the reader. Each one is a moment a
real regression could be waved through as "the plan moved again". Snapshot the
archive, or skip the non-terminal impl, and decide it when the row is
authored: the churn is predictable from the design.

## Two spellings for two audiences, never two on one page

The package says `Build Phase 4` — the canonical name for logs and the
headings parser. The page says `Phase 4` — the impl's own spelling, as the
review fixed it. Both are fine, each defined once. The defect the cleanup
found was a component reaching for the package's word, so one page showed
both. The rule is not "one spelling"; it is "one spelling per audience, and a
component never borrows the other's".

## What we'd do differently

- **Split it.** Nine phases, 37 rows, 106 commits across the parser, the
  gate, Shape and the admin. "The lifecycle definition and phase identity" was
  one plan; "render it" was another. Landing the definition with its first
  consumer was the argument for one plan, and it held — but two parity rows
  and six snapshot re-baselines were the price of crossing three subsystems.
- **Make the admin's type-check a test on day one** of any admin plan. It had
  been red for a month, and "not a test" is exactly what a month of silence
  costs.
- **Open every boundary through the documented snippet.** The one hand-typed
  call cost a falsification row; the skill's command was right all along.

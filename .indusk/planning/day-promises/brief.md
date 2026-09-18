---
title: "Day step 4a — Promises: the contract's primitive"
date: 2026-09-17
rewritten: 2026-09-18
status: accepted
accepted: 2026-09-18
workflow: feature
---

# Day step 4a — Promises — Brief

## Where this sits

Day's primitive is the **contract**: what a human approves before code
exists, and what the artifacts then prove was met honestly. The frame, in
its settled form (2026-09-17, after the conversation that produced the first
version of this brief):

> A plan **establishes** promises, **preserves** the promises already in
> force that its change could break, and is **free in how**. The contract is
> the first two. The process record is how the proof was made honestly.

This supersedes the earlier frame of "change clauses and promise clauses".
That split was tracking *lifetime*, and lifetime is a property each promise
carries, not a second kind of clause. Follow any change clause down and it
is a promise: "the migration preserves every row's key" is the survival of
an existing promise ("every row stays addressable by its key") that the
migration threatens; "the old identifier is gone" is a structure promise this
repo already pins with a grep; "the docs page exists" is structure. What is
left that is not a promise about the system is the process itself — the
phase closed in order, red was seen before green, the commit was scored —
and Day already holds that apart as the process record and the evidence rows.

The rental car makes the cut. *Return the car on the 14th* is the promise you
are making. *Return it undamaged* was in force before you drove off; you do
not restate it, you are bound by it, and the agent walks around the car when
you hand back the keys. Route, speed, and where you stop for fuel are nobody's
contract.

This step builds the promise as a primitive: the registry, the check that
keeps it honest, and dusk self-hosting it. **Looper and numero are
downstream of this work.** The goal is not to improve or update either; it
is to build the system that, once published, they update to and start using.
Looper's registry is the reference the check is extracted from and its
eleven are a fixture here; adopting the result is looper's own plan, in its
own repo, later. The telemetry half —
watching behaviour promises in the running system — is
[`day-monitor`](../day-monitor/brief.md). The planning half — promises
declared before code, trajectory rows that name them, confirmation at close,
the change rule — is proposed below as the next cut, because this brief grew
to cross more subsystems than any plan should.

## A promise predates its test

A promise is the statement of behaviour; a test is one of its links. The
promise comes first and the test is derived from it, not the other way
round. Most changes exist to establish a promise, strengthen one, or fix a
broken one.

Promises have two sources, and the primitive accepts both: **specification**
— stated in planning, before the code — and **failure** — discovered when a
run breaks something nobody had named, and stated afterwards. The second
arrives late by nature; looper's registry is mostly of that kind.

Every Test Trajectory row therefore names the promise it **establishes** (a
new promise of this plan) or **preserves** (an existing promise the change
threatens). A row that names neither is process or path and should not be a
row. Nothing about the table's shape changes; its meaning does. Making the
rows say this is the next cut's work, not this plan's.

## The vocabulary, defined once

- **Promise.** A sentence about behaviour the system upholds — observable,
  never implementation, written the way the test plan already requires
  claims to be written. It carries a readable name, a statement, a kind, a
  lifetime, a domain, an owner, a state, and its links.
- **Kind** — decided by *what can break the promise after it was proved*,
  which decides what checks it and where its health comes from:

  | Kind | What it says | Broken by | Checked by | Health source |
  |---|---|---|---|---|
  | `behaviour` | something happens; how the system responds | inputs nobody chose, in a run | a test, and the running system (4b) | the running system; hollow until seen |
  | `state` | a fact about stored or rendered state, under chosen inputs | a later change to the code that produces it | a test | the last run of the suite at head |
  | `structure` | something exists, or exactly one of it does | a later change that removes or duplicates it | a build-time check | the last run of the check at head |

  Telemetry watches reactions; tests and checks assert state and structure.
  Dusk already has dozens of structure promises — the single-definition pins,
  `check-pointers`, the cleanup pins — named and enforced, just not called
  that. "The documentation is there" is a promise, and the pointer check
  going red at the next build is exactly the loop wanted, at the speed the
  fact changes. Running the system adds nothing to a static fact; what would
  be a gap is a static promise with no check at all.
- **Lifetime.** `holds` — in force for as long as the system runs; any later
  change can break it; the default. `established` — a transition that, once
  done, cannot be undone ("the backfill ran"); its check retires the moment it
  goes green and the promise moves to history, hidden by default, so the
  registry does not fill with things that can never break again.
- **State.** `declared` — stated in planning, not yet established; the owner
  is an open plan. `enforced` — the system upholds it and a violation is a
  bug. `known-violated` — declared, and the current implementation provably
  cannot uphold it; carries the incident that proves it, so it is evidence
  rather than an excuse (looper's E-1). `retired` — no longer a promise, kept
  for history. The `known-violated` state is what makes declaring honest:
  without it, a promise you cannot yet keep is either hidden or a permanently
  red check, and a permanently red check stops being read.
- **Domain.** A tag naming the part of the system the promise is about, from
  a list the project declares. Decided in planning, when the promise is
  written (Sandy, 2026-09-17); an unknown domain fails the check.
- **Owner.** The plan that established the promise. Ownership moves only when
  another plan supersedes it. The archived plan is the owner of record and
  can be woken.
- **Links.** One or more code sites, marked by a comment naming the promise;
  one or more tests naming the promise; and, for `behaviour` promises, the
  span mark the running system emits, which is 4b's. The check requires the
  links the kind needs, not one fixed set for all.
- **Incident.** What happened when a promise was broken: symptom, root
  cause, which promise, where the system was running when it broke
  (`local`, `smoke`, `deployed`, or `desk` for a finding by reading — the
  source is recorded because they are different evidence), status, fix. This
  step defines the record; `day-monitor` fills it from runs.

## The registration rule

Not every check is a promise, and the registry must not become a second copy
of the trajectory. The rule: **a promise is registered when its breakage
would need a plan to reopen.** That keeps dusk's pins in (a second
`resolveImplPath` would be a defect for the plan that pinned it) and keeps
process facts and path out.

Tested against looper's eleven rather than asserted:

| ID | Statement (short) | Kind | State | Registers? |
|---|---|---|---|---|
| E-1 | impact events are ball strikes, not speech or handling | behaviour | known-violated | yes — the fix is a plan (the v1 classifier) |
| E-2 | a transcript fetch for a known round is non-empty | behaviour | enforced | yes |
| E-3 | loss of ingress surfaces within one capture interval | behaviour | known-violated | yes |
| E-4 | every failed operation is an errored span, nothing swallowed | behaviour | enforced | yes |
| E-5 | every received chunk is written, or the failure is visible | behaviour | enforced | yes |
| E-6 | every span is attributable to the build that produced it | behaviour — a deploy breaks it and only a run shows it | enforced | yes |
| E-7 | every pipeline stage is observable as a named span | **structure** — a build-time check proves it; numero's contract check is this kind | enforced | yes |
| E-8 | capture ingress is unambiguous, never two receivers | behaviour | known-violated | yes |
| E-9 | speech-band energy never transcribes to silence unremarked | behaviour | enforced | yes |
| E-10 | an archived capture is never modified or deleted | behaviour — a reaction to a write, enforced by storage | enforced | yes |
| E-11 | every closed capture gets a transcript or a visible failure | behaviour | enforced | yes |

All eleven register, all eleven `hold`; ten are behaviour and one is
structure, and none is state. That is the registry's history showing: it was
born from telemetry failures. The state and structure kinds are what dusk
contributes, and the rule's *negative* side is tested there, not in looper —
looper never wrote down a one-shot or a process fact, so it cannot show the
rule excluding one. Dusk's candidates for exclusion: "the jj residue sweep
ran" (`established`, retires on green), "every phase closed in order"
(process record, not a promise), and a row that merely cites a promise
already registered (it *preserves*; it does not create an entry).

## What the regression suite covers, and what it cannot

For `state` and `structure` promises the suite *is* the monitor: a
green-to-red flip is caught the next time it runs. That leaves three failure
modes, each of which the primitive must make visible rather than assume:

- **The check never ran.** No CI, an edit made straight on GitHub, or the
  case this repo actually had — the gate hooks were registered relative to
  the current directory and silently stopped loading for weeks. Nothing was
  red because nothing ran. This is why a chip has a hollow state, and why
  Day's process record asks whether the gates *ran*, not only whether they
  passed.
- **The check ran and no longer meant anything.** Skipped, weakened, deleted,
  or mirroring the code. Green, and worthless. That is Day steps 5 and 6.
- **The check ran, went red, and nobody looked.** The muted check. That is
  `known-violated`'s job: a red you have acknowledged, with its incident.

A promise with no link to something that runs is the same as no promise
(the admin's type-check was red for a month because `tsc` was not in the
suite). `behaviour` promises are the one kind the suite cannot cover, because
the inputs that break them are the ones nobody chose. That is the whole of
why 4b exists, and why 4b is narrowed to that kind.

## What this plan changes for a project

1. **A registry** of promises and incidents, one per project, carrying the
   vocabulary above.
2. **`indusk promises check`** — every name cited in code or tests exists in
   the registry; every `enforced` promise has the links its kind requires;
   `known-violated` carries an incident; every domain is declared. A promise
   declared and not guarded fails the build. Extracted from looper's
   validator, which already enforces both directions in its lint step and
   marks itself an extract candidate.
3. **Dusk self-hosts it, and looper's eleven are a fixture.** Looper's
   registry, carried into the InDusk form, lives in dusk's test suite as the
   one real registry the format and the registration rule are tested
   against (eight `enforced`, three `known-violated`, unchanged in meaning).
   Dusk registers three promises of its own, one per kind, so the convention
   is shown not to depend on a service or on telemetry:
   *structure* — every shared rule has one definition (the pins);
   *state* — the phase-boundary record is never malformed (the writer refuses
   with the reader's predicate); *behaviour* — every checkoff ran its gates,
   whose observer is the gate ledger step 5 builds, so it stays hollow until
   then, which is the honest reading.
4. **A project-wide Promises page** in the admin, beside Scorecards: the
   registry as a table, sortable and groupable by owner plan, domain, state,
   and (once health exists) health. This plan draws **declared state only**,
   and every `enforced` chip is drawn **hollow** — declared, not yet observed.
   Green must mean "seen upheld"; a chip that has seen nothing must not look
   green, or the page lies the way a test suite does. On the bars, the
   archived segment carries "holding N": closed is the resting state, a plan
   closes *holding* its promises, and only a plan holding none is truly
   finished. Direction here; columns and chips are in the appendix for the
   ADR.

## Proposed next cut: `day-contract`

This brief's first version also carried the planning integration, and by the
end of the conversation it touched the planner, the test-plan format, the
trajectory, the retrospective, the registry, the validator and the admin —
more subsystems than admin-ui-phase-progress, whose retrospective's main
hindsight was "split the plan". So the planning half is proposed as its own
step, created when this one closes:

- The planner's question after the brief: *what will this system promise
  after this plan, in which domains?* Promises are declared there, with the
  plan as owner.
- The test plan is derived: for each promise, the test that will prove it
  established; trajectory rows name what they establish or preserve, and the
  validator requires it.
- At close the retrospective does not decide; it **confirms**: each declared
  promise has its links and flips to `enforced`, or stays `known-violated`
  with the reason.
- **The change rule.** A change that touches a promise's code site names what
  it does to the promise — keeps, revises, supersedes, retires. A diff that
  touches a site without naming it gets the verdict "touched, unacknowledged".
  This is artifact 9's everyday form: the existing promises in the blast
  radius, each with a verdict; step 10 renders it.
- A per-plan Promises section (holds / touches) beside Falsification and
  Cleanup; state and structure health read from the verify ledger, which
  needs rows that name promises before there is anything to join on.

This plan is useful without it: promises can be written by hand, as
looper's were, and checked. The vitest trace-shape helper (looper's
`assert_trace_shape`, the test side of the span mark) moves to 4b's first
step, where the span convention it asserts on is defined.

## What exists today, verified 2026-09-17

| Piece | looper | numero | dusk |
|---|---|---|---|
| Registry with states; incidents with sources | **built** — 11 promises (10 behaviour, 1 structure), 9 incidents, all recorded by hand | none | none |
| Validator in the build, both directions | **built** | none | none |
| Trace-shape test helper naming the promise | **built** (pytest) | none | none |
| Structure promises with build-time checks | none | none | **dozens**, unregistered — the single-definition pins, `check-pointers`, the cleanup pins |
| Typed telemetry contract (every span declared and emitted) | not possible in Python | **built**, 12 services, in CI | none |

Looper proved the primitive can be written and enforced. Numero's typed
contract is a structure check of E-7's kind — which spans exist, not what the
system promises — and becomes an optional check for projects with a
typechecker. Dusk's pins are the proof that the primitive is about
commitments, not spans.

## Proving ground

**dusk**, self-hosting one promise per kind, with the check in its own suite
and the page over its own registry. **Looper's eleven** as a fixture: the
only real registry that exists, so the only real data the format and the
registration rule are tested against. Nothing in this plan runs in, or
changes, another repository.

## Steps

| # | Effort | What |
|---|---|---|
| 1 | ~1d | Registry format (kind, lifetime, domain, owner, state, links, incidents) and `indusk promises check`, extracted from looper's validator; looper's eleven as the fixture it runs against |
| 2 | ~½d | Declared domains per project, ensured on `update`; the per-kind link rule; the incident record |
| 3 | ~½d | Dusk's three, one per kind, with the check in `pnpm test` |
| 4 | ~1d | The Promises page, declared state only, every enforced chip hollow; "holding N" on the archived segment |

About three days. The registration rule is re-tested against looper's eleven
in step 1 before the check enforces it.

## Acceptance

`indusk promises check` refuses every way the registry can lie, by name, and
passes looper's eleven carried into the form with their states unchanged;
dusk holds three promises, one per kind, with the check in its suite; a
project that has not adopted is untouched by `indusk update` beyond an empty
domains list; the Promises page lists dusk's promises grouped by plan and by
domain with every enforced chip hollow. (The "a closing plan promotes a
claim" and "touched, unacknowledged" acceptances belong to `day-contract`.)

## Depends on

- admin-ui-phase-progress (closed 2026-09-17): the lifecycle module and the
  render convention (a member without a chip fails the build).
- Day's shape document, artifact 9.

## Blocks

- **Looper adopting the registry** — its own plan, in its repo, after this
  package publishes: carry the eleven and nine incidents across, rewrite its
  `expects=` citations, retire its validator. Not this plan's work.
- **Numero registering its first promises** — likewise, from its deployed
  failures, after publish.
- [`day-monitor`](../day-monitor/brief.md) and `day-contract`.

## Open for the ADR

- Where the registry lives (`.indusk/promises/` vs the docs tree looper
  used), and its format.
- Whether a contract is only "a plan's promises" or gets a name of its own,
  so the Promises page can group by contract independently of plan — the
  answer decides whether the registry carries a `contract` field.
- Whether `declared` is a fourth state or `known-violated` with a reason;
  and whether `established`-lifetime promises retire automatically at green.
- Whether the form carries an `aliases` field so a downstream registry with
  sequential ids (looper's E-N / F-N) keeps its history when it adopts.
- Whether the gate ledger (step 5) is a health adapter for dusk's behaviour
  promise, or dusk's behaviour promises simply wait for spans.

## Appendix — the Promises page, for the ADR

Moved out of the body on 2026-09-18 because it is design, not direction.

- **Two axes, never one colour.** *Declared state* is this plan's axis:
  `enforced` filled, `known-violated` amber with its incident, `retired`
  grey, `declared` outlined. *Observed health* is 4b's axis for behaviour
  promises and `day-contract`'s (via the verify ledger) for state and
  structure; until either lands every enforced chip is hollow.
- **Columns.** Chip, name, statement, kind, domain, owner plan, code sites,
  tests, incidents; later, violations in window and last seen.
- **Groupings.** By owner plan, by domain, by state, by kind; by health once
  it exists. "By contract" equals "by plan" until the ADR decides otherwise.
- **The pin.** Declared state (and later health) are unions beside
  `PlanPosition` in the lifecycle module; the chip's label and colour maps
  are `satisfies Record<…>` over them, and the render-parity test names any
  member without a chip. Adding a state without drawing it fails the build,
  as adding a lifecycle stage does today.
- **Per plan** (day-contract): a Promises section beside Falsification and
  Cleanup, closed by default — the promises this plan holds, and, for a plan
  in flight, the promises its change touches with what it does to each.

## Cross-references

- [`day-monitor`](../day-monitor/brief.md) — the telemetry half, behaviour
  promises only (was Midnight)
- [`pr-shape.md`](../indusk-v4-day/pr-shape.md) — artifact 9, promise
  linkage; "the boundary is fixed, the path is free"
- [`/guide/plan-lifecycle`](../../../apps/docs/src/guide/plan-lifecycle.md) —
  two authorities; why behavioural assertions are the shape of a promise
- looper: `apps/docs/src/telemetry/expectations.md`,
  `backend/scripts/validate_expectations.py`, `backend/looper/telemetry/shape.py`
- numero: `scripts/check-telemetry-contract.ts`

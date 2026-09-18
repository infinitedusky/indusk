---
title: "Day step 4b — Monitor: behaviour-promise violation detection and root cause, from telemetry"
date: 2026-06-14
status: draft
amended: 2026-08-11
rewritten: 2026-09-17
narrowed: 2026-09-18
codename: midnight
---

# Day step 4b — Monitor — Brief

**Was `midnight`.** The June brief carried both halves of the promise system.
On 2026-09-17 the primitive half — what a promise is, the registry, the
validator, promotion at close, the change rule — moved to
[`day-promises`](../day-promises/brief.md), where it belongs as part of Day's
contract. This brief is the half Midnight was always about: **the telemetry
that watches promises in the running system, detects a violation, records its
root cause, and wakes the plan that owns it.**

## Scope: behaviour promises only

`day-promises` gives a promise a **kind**. `state` and `structure` promises
are watched by the test suite and the build-time checks — a green-to-red flip
is caught the next time they run, and whether they *ran* is the process
record's question. `behaviour` promises — something happens, how does the
system respond — are the one kind the suite cannot cover, because the inputs
that break them are the ones nobody chose. This step is about that kind and
no other. It does not monitor the registry; it watches reactions in a run.

## What this is, in one paragraph

A behaviour promise (defined in `day-promises`) is a commitment the system
keeps for as long as it runs. The test suite can only say it held on the
inputs someone thought of. This step gives every behaviour promise a third
link, a mark on the telemetry span the running system emits, so that the
system *while running* reports which promises it upheld and which it broke.
Running means executing
with real inputs — locally under Jaeger, in a smoke run, or deployed — as
opposed to the test suite, which only exercises the inputs someone chose. The
word is not "production": a local run is a running system, and the loop
closes there first. A violation names the promise;
an incident is opened or matched, with the symptom, the root cause and where
it was observed; the promise names its owning plan; that plan reopens with a
maintenance phase. The plan sits in `monitor` until its promises have been
quiet for a window, then closes again. This is the first InDusk loop fed from
outside the repository.

## Why

The three feedback loops InDusk has — the evaluator turning commits into
lessons, the falsification ritual attacking a plan's own claims, the Shape
check reviewing craft — are all closed inside the repository. They surface
only what someone thought to look at. The `versioned-workbench` retrospective
is the measurement: fourteen phases, thirty-two green rows, both rituals run,
and twelve defects within an hour of real use.

The highest-information object this loop produces is **a test that passed
while the system broke**. Every other signal says the code failed; this one
says the assertion was insufficient, and names it. Telemetry does not replace
the tests; it grades them.

| The running system violates a promise, and… | What it means |
|---|---|
| a test claimed the promise and passed | the test was insufficient — widen it |
| no test claims the promise | the promise is unguarded — write one |
| there is no such promise | an invariant nobody named — state it, then guard it |

## What changes for a project

1. **The span link.** A span attribute carrying the promise's name
   (`indusk.promise`, the ADR confirms), emitted at the code site that
   enforces it. Most spans never carry one; a span opts in by naming a
   promise, so the coupling is on promises, not on telemetry. With it, the
   test side of the same mark: a trace-shape helper that asserts on the spans
   a call produced (which appeared, under which parent, with which
   attributes — `contains`, never `equals`, so a harmless refactor does not
   break it) and names the promise it validates. Written for vitest in the
   testing extension; moved from `day-promises` on 2026-09-18 because it
   asserts on the convention this step defines.
2. **A number.** `indusk promises status`: for each promise, violations in
   the window, from local Jaeger and from Dash0. "Has this promise been
   violated this week?" answers with a count that means something.
3. **`monitor`, defined.** A plan whose work is done and whose promises have
   not yet been quiet for the window sits in `monitor`. The lifecycle module
   derives it; the admin draws it (the segment already exists, listed and
   pending, by the convention from admin-ui-phase-progress). A plan in
   `monitor` whose promises are not quiet does not close, which is the correct
   outcome and one nothing expresses today.
4. **The loop.** A violation names the promise → the incident corpus is
   checked → "known incident, here is the fix path" or a new incident is
   opened with symptom, root cause and source → the owning plan reopens with a
   maintenance phase → the fix lands as a code site, a widened test, or a
   revision of the promise. Repeated violations of related promises are the
   collapse signal that says refactor.
5. **Root cause is recorded, not inferred.** The incident record is the
   artifact; the alert only opens it. The record's `source` field says where
   the system was running when the promise broke — `local` (a run under
   Jaeger on a developer's machine), `smoke` (a scripted run), `deployed`
   (a live environment) — or `desk` for a finding by reading, which is not a
   run at all. They are different evidence and a reader six months on must
   not weight them equally; a `desk` entry does not close the loop.

## Built on OpenTelemetry, self-contained, never on a third party

A design constraint (Sandy, 2026-09-17: "is this building our entire system
on top of an OpenTelemetry reporting platform, as opposed to on OpenTelemetry?";
2026-09-18: "the system is supposed to pick up that something went wrong on
its own, and for that we don't want to depend on a third party").

- The promise mark and the violation are **span data** — an attribute, and an
  attribute or event on the same span — in OpenTelemetry's own model, carried
  by OTLP export. The code that enforces a promise never knows where the span
  goes. "Which promise broke" is answerable from the raw trace.
- **The loop has one backend, and InDusk ships it.** Detection, the incident,
  the reopened plan — every step closes against Jaeger, the OpenTelemetry
  Collector distribution the `local-telemetry` extension already installs with
  its query surface. Jaeger has no alert rules, so the alert is a poll:
  `indusk promises status` on a schedule, locally and deployed alike, calling
  the same open-incident path. The always-on tier is the local model on a
  machine that does not turn off — Jaeger with persistent storage (it defaults
  to memory), the scheduled status run, and the receiver that writes the
  incident to the repo and reopens the plan. Where that receiver runs when no
  developer machine is on is the open question for the ADR.
- **There is no adapter seam for third-party backends in the loop.** Adopting
  Dash0's alert rules as a source would mean adopting Datadog's next, and
  every notification system after that — importing everyone's alerting into
  core. The loop is self-contained instead: a project that uses no hosted
  backend closes it in full.
- **The `dash0` extension (and any `datadog`, later) keeps the job it had
  before this step**: a query surface the agent uses when a person asks
  "something went wrong, find out what" — for everything InDusk does not do
  and the added visibility a hosted platform brings. It does not feed the
  loop and the loop does not need it. A cool addition, never a requirement.
- The `deployed` incident source means "the system was running in a live
  environment when the promise broke", and Jaeger receiving that environment's
  OTLP export is enough to record it.

## How health appears in the admin

4a draws the declared state and leaves every enforced chip hollow. This step
fills the second axis, **observed health**, for behaviour promises, from the
backend adapter (state and structure health come from the suite at head,
through the verify ledger, in `day-contract`):

| Declared | Observed in the window | Chip | Meaning |
|---|---|---|---|
| enforced | upheld, seen | **green** | the system kept its word and we saw it |
| enforced | violated | **red** | the signal; an incident is opened or matched |
| enforced | not seen | hollow | no run exercised it in the window; unverified, never green |
| known-violated | anything | amber | expected red, incident attached; not a surprise |
| retired | ignored | grey | history |

- **The Promises page** gains sorting by health, so red floats up, and
  "violations in window" and "last seen 3m ago" per row.
- **The bars roll up.** A plan's archived segment takes the worst health of
  the promises it holds, so one red promise makes its owning plan visibly red
  in the sidebar without opening it. The `monitor` segment is the one segment
  where fill *is* time: it fills over the quiet window and the plan closes
  when full; a violation resets it. The bar says so on that segment, as it
  says "steps, not time" elsewhere.
- **One object gets its own mark.** A red promise whose test is green at
  head is the highest-information thing the page can show — the test was
  insufficient — and gets a distinct badge ("test passed, system broke")
  rather than being inferred from two colours side by side.
- **Dynamic, honestly.** The plan page already polls through `LiveRefresh`.
  Health is read server-side from the adapter, cached with a timestamp, never
  blocking the render. If the backend is unreachable the chips go hollow with
  "health unknown since 10:42" — never green, never stale-green. A page that
  cannot see says so.

## What exists today, verified 2026-09-17

None of it. No incident anywhere has been *detected* by telemetry naming the
promise it broke, which is what this step adds; every incident on record was
found by a smoke run or a desk probe and written by hand. This repo lists
`monitor` in the lifecycle and draws it as pending; nothing derives it.
Local Jaeger is enough to build and prove every step below; Dash0 (which
rejected its token on 2026-09-17) is needed only for the `deployed` source,
and is not a dependency of the loop closing.

## Proving ground

Any project that runs under the local telemetry daemon. This repo runs its
own gates on every checkoff, and its own behaviour promise (the gates ran)
is the first candidate for a `local` incident detected by telemetry rather
than by a person. The `deployed` source is proven wherever a project with
promises first runs deployed, and is where Dash0 earns its place.

## Steps

| # | Effort | What |
|---|---|---|
| 1 | ~1d | The span attribute convention; the code-site helper that sets it; the vitest trace-shape helper in the testing extension |
| 2 | ~2d | `indusk promises status` — violations per promise from local Jaeger and Dash0 |
| 3 | ~1d | `monitor` derived and drawn; the quiet window; reopen with a maintenance phase |
| 4 | ~2d | Alert → match or open an incident with root cause and source → reopen the owner |

About a week, distributed, after `day-promises` lands.

## Acceptance

Day row 9's test: **an alert from the running system names the promise that
broke; the owning plan reopens.** Concretely: one promise, one violation
*detected by telemetry* during a run (local, smoke or deployed — not found by
reading), the alert naming the promise, an incident opened with its root
cause and its source, and the owning plan reopened. The first such incident
is the moment the loop closes, and a local run can produce it.

## Documents

- **`/guide/index` gains a section, "What runs where"** (Sandy, 2026-09-18:
  "what of this exists directly in the repo for an application, and what is
  outside of that in InDusk MCP?"). Three columns — *in the repo* (plans,
  promises, incidents, lessons, hooks, skills, `CLAUDE.md`; the token comments
  and the `indusk.promise` span attribute, which are the only two things that
  touch application code, and the attribute is plain OpenTelemetry), *on the
  machine* (the CLI and MCP server inside an agent session, the admin daemon
  and its registry, the local Jaeger/otelcol daemon, the hub, eval sessions),
  *hosted* (a telemetry backend such as Dash0, as an adapter). The sentence
  the section exists to say: **the running application depends on none of
  it** — InDusk is not Rails; it is beside the code at development time, and
  the monitor watches from outside, reading what the app already emits. Written
  in this step because 4b is what makes the runtime half real.

## Depends on

- [`day-promises`](../archive/day-promises/brief.md): the registry, the kinds, the
  states, the owner, the first two links.
- admin-ui-phase-progress (closed 2026-09-17): `monitor` listed and drawn.
- Local Jaeger (the local-telemetry daemon) — already installed. Dash0 only
  for the `deployed` source.

## Resolved since the June brief

- **Dawn.** Day's sequencing answered it: this step comes before "any
  executor" (step 8) because it is the only loop fed from outside the repo.
  Whether `indusk run` reads the violation signal is step 8's decision.
- **Subsystems.** Stay rejected; "holding N promises" (in `day-promises`)
  gives durable ownership without the primitive.
- **The bloat audit** (the June brief's step 8) is not this step's.

## Open for the ADR

- The span attribute name, and whether a span may carry several promises.
- Whether a violation is an attribute on the span, a span event, or the span's
  error status — the raw trace must answer "which promise broke" without a
  backend, so the choice is about what every backend can filter on cheaply.
- The adapter interface a backend extension implements: at minimum
  "violations of promise X since T", returning a count and the trace ids.
- Whether the quiet window is per plan or per promise, and its default.
- Whether an incident is opened automatically from an alert or proposed for a
  human to confirm — the root cause is a human's sentence either way.

## Cross-references

- [`day-promises`](../day-promises/brief.md) — the primitive
- [`/guide/plan-lifecycle`](../../../apps/docs/src/guide/plan-lifecycle.md) —
  `monitor` is the load-bearing addition; what reopens a plan
- [`pr-shape.md`](../indusk-v4-day/pr-shape.md) — artifact 9
- `.indusk/planning/indusk-v2-dawn/master.md` — Dawn 7, the executor question
- `.indusk/eval/` — the natural trigger surface for opening an incident automatically

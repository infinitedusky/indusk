---
title: "Mark first — Research"
date: 2026-10-14
status: complete
workflow: feature
---

# Mark first — Research

## Question

How does InDusk become telemetry-driven: a promise proved by what the running
system reports, with tests as support, and an outer loop that narrows a break
to its cause?

## Background

Settled in conversation with Sandy on 2026-10-14, during `new-project-flow`'s
Build Phase 4, after two bugs found by using the project conversation: a
message that restarted the agent showed only after the next one, and Stop also
sent the half-typed reply.

**Where InDusk is today.** Of 127 promises in the registry, 4 are `behaviour`
(watched by a mark in the running system). Every other promise is proved by
tests: `a-closed-plan-kept-its-promises` — "a plan cannot close while a
promise it made has no passing test that names it" — and `indusk promises
confirm` refuses a promise whose rows name no test file. Nothing requires a
mark. The planner's own rule assigns `state` to anything a test with chosen
inputs can prove, so almost everything becomes a test. Expectations are the
one part already measured from telemetry.

What exists to build on:

- **Marks** (Day 4b, `/decisions/day-monitor`): `indusk.promise`,
  `indusk.promise.outcome` (`upheld` / `violated`) and an
  `indusk.promise.violated` event carrying `indusk.promise.symptom`, set with
  plain OpenTelemetry; Jaeger through the local daemon; `promises watch` turns
  a violation into an incident and reopens the owning plan.
- **Browser traces for projects** (`a-click-and-its-server-work-share-a-trace`):
  a project `indusk init` instrumented carries a click's trace into its server
  work. The admin itself sends nothing from the browser.
- **Incidents reach the agent** (`a-break-reaches-the-working-agent`) and name
  their tests (`an-incident-names-its-tests`); the promise page shows tests,
  marks and thirty days (`a-promise-page-shows-its-proof`).

## Findings

### A test needs the cause known in advance; a mark does not

Sandy: to write a test you have to know why the thing would break. A mark
measures the outcome where it happens, so a break nobody predicted still shows.
Both bugs above were found by use, not by any test written before them.

### Splits and limits: the 100 m dash

Sandy's picture: a robot must run 100 m in under 10 s. Rather than guess which
tests prove it can, measure its speed at points along the way, each with the
speed it must have there to finish in time — split times worked backward from
the goal. A missed split says where; the first missed split is where to look.

And limits beside the splits: the engine's heat never above a bound. When heat
breaks, the "why" (friction in a bearing, a badly wound coil, the wrong
material) is not missing from telemetry — it is the next layer down, with its
own marks. **Telemetry builds up**: every component has its promises, a
component's clause can be the promise of the part beneath it, and the marks
share a trace, so a break cascades down to its cause.

### Where marks go

The lag bug was invisible to the server — the server did everything right; the
break was in what the page drew. A mark belongs **where the promise is felt**,
often the browser. The admin needs a way to send marks from its pages to the
local daemon.

### Build it in, don't retrofit it

Sandy: decomposing a big existing codebase into useful telemetry is very hard;
building component by component from the bottom gives telemetry that cascades.
A project born through `new-project-flow` with marks as part of each
component's definition starts instrumented.

### Traffic and the counter-arguments

Raised and answered:

- "Telemetry needs traffic." The need to catch bugs grows with traffic, and so
  does the signal; a busy application has the most edge cases and the most data
  on them. Rare paths inside busy applications (month-end billing, restore,
  migrations) get marked harder; a release that reaches everyone at once is
  answered by gradual rollout watched by marks.
- Low-traffic mission-critical systems (rockets, F1) are the most instrumented
  machines there are; a static fire is a run read through its channels against
  budgets, and a test flight that explodes is a success if the data shows where
  the curve left its budget.
- "Splits say where, not why" — answered by layering: why is the next layer's
  marks.

### Cost

A span is on the order of a microsecond or a few in Node plus export; a metric
increment tens to hundreds of nanoseconds, aggregated before export (moderate
confidence; to be measured, see expectation 3). A span per line or per loop
iteration is too costly and floods storage. So: **splits are spans at
component boundaries, limits are metrics checked against their bound, depth is
added where incidents land**, and line-level "where" comes from a sampling
profiler (typically a percent or two) rather than marks on every line. The cost
is mostly data volume: **tail sampling** keeps every trace with a broken mark
and a share of the healthy ones.

### Why now: agents

Agents make tests cheap to write, so tests are no longer the scarce part. What
is scarce is an agent that reads a broken mark in production, walks the trace to
the cause, fixes it, and watches the mark return to kept — the outer loop.
Testing is a solved problem with an industry behind it; telemetry in the outer
loop is not, and it is what InDusk will be known for.

### The first worked example: the project conversation

The promise "a message you send gets a visible reply in the thread":

- **Splits** — the page draws the message (< 100 ms); the server hands it to
  the agent (< 200 ms); the agent shows it is working (< 1 s); its first words
  arrive (< 15 s); its reply is drawn in the thread (< 30 s).
- **Limits** — one agent session at a time; nothing is sent that the person did
  not type; a session ends only when the person stops it or the agent finishes.

The lag bug would have been the first split never marked kept; the Stop bug, a
message arriving with no agent running — before anyone knew a button was the
cause.

### Carried from `new-project-flow`'s audit (2026-10-14)

A fresh reader's audit of `new-project-flow` (its `audit.md`) found two
telemetry gaps; Sandy moved them here.

- **The `new_project.create` span goes nowhere.** Neither the admin nor the
  CLI registers a tracer provider, so the span is exported only if the
  production-break recorder happened to set one up in the same process — and
  then to its endpoint, which may be off the machine. Expectations 1, 2 and 5
  of `new-project-flow`, and the mitigations of its untestable rows U1 (the
  agent asks only what is open) and U2 (replies are short), all read this
  span. The admin needs one tracer provider exporting to the local daemon,
  which `a-page-can-mark-a-promise` needs for the server side anyway.
- **Three promises rest only on the prompt.**
  `an-unkept-project-conversation-leaves-nothing-on-disk`,
  `a-new-project-publishes-nothing-unasked` and
  `a-new-project-is-written-only-under-its-parent` hold because the agent is
  told not to break them. `new-project-flow` Build Phase 7 confines the
  conversation's tools; marks are still what proves them in use: a write
  outside the draft, a `git`/`gh` command, a project made outside the parent,
  each marked broken where it happens.

### First cut — only what `run-the-master` needs (2026-10-15)

Sandy: build this only as far as `run-the-master` needs, in order of
importance. Proposed first cut (to settle in the brief, in the UI):

- `a-plan-is-one-promise`, `a-promise-is-made-of-clauses`,
  `a-promise-can-rest-on-another`, `a-plan-plans-its-clauses`,
  `a-promise-is-upheld-or-broken`;
- `a-clause-is-upheld-by-its-signal` (renamed from `…-kept-by-its-mark`; "a
  passing test never stands in for its signal");
- **`a-clause-is-verified-before-release`** (Sandy: "that's really good"): a
  clause's tests must pass before anything ships; a change that makes one fail
  is stopped before release — verified by its tests before release, proved by
  its signal in use;
- change `a-closed-plan-kept-its-promises` to close on signals.

Two stages, one clause: **before release and on every change** — its tests,
*verified* or the change is stopped; **in use** — its signal, *holding*,
*broken* or *no signal*.

Carried from one-promise-language (Sandy, 2026-10-15): switch InDusk's signal writers and the demo app from writing `violated` to `broken` — every reader accepts both since one-promise-language.

Carried from one-promise-language's falsification (2026-10-15), three more for the same switch:
- **Two writers sit outside `markPromise`.** `apps/indusk-mcp/scripts/suite-speed.js:37` writes `indusk.promise.outcome` itself, and `indusk promises health --json` writes `runs[].outcome` for the editor (`lib/promises/health-line.ts`, kept `violated` this release so an editor installed earlier still reads a break as broke). The switch to `broken` changes both. The health line changes only once the editor extension shipped with this release has been out a release.
- **The registry state carries the same skew.** one-promise-language writes `known-broken` on opening an incident (`lib/promises/incidents.ts:232`), and an InDusk older than it refuses that state. Decide here whether a checkout on an older InDusk matters, and say so in this plan's ADR.
- **No signal drawn green.** The dashboard's `PromiseRow` dot is `bg-ok` for an `enforced` promise with no signal in the window (`apps/indusk-admin/src/components/ui/PromiseRow.tsx:27`). "In use — holding, broken or no signal" needs that dot to follow the signal, which changes an approved look, so it goes through a person's approval here.

**The clause plan** (replacing the test plan): each clause with its signal
(where it is read, what counts as upheld — a budget for a split, a bound for a
limit — and what it reports when broken), and the tests tied to that clause,
chosen by the agents. The impl may add tests for pieces of implementation
besides. Tests are the agents', automated, never approved.

**Later cut**, after `run-the-master`: `a-break-leads-to-its-cause`,
`a-break-comes-with-a-diagnosis`, `every-broken-trace-is-kept`,
`a-page-can-mark-a-promise` (browser signals), `every-break-becomes-a-test`,
`a-person-sees-promises-not-tests`, and the promise page's clause looks. The
already-declared ones among them, and `a-message-sent-gets-a-reply`, are
withdrawn now (never in force) and re-declared then. "Mark" becomes "signal"
throughout, and the plan may be renamed to match.

### The merged plan — proposed rework of the brief (2026-10-15, parked)

`mark-first` merges with `promise-first-build` (see `promise-core`'s master,
"Settled 2026-10-14/15"). Proposed to Sandy, not yet decided — parked while
`template-reload-on-cold-cache`, `decided-prompts-stay-closed` and
`cockpit-audit-fixes` finish:

- **Keep:** `a-promise-is-made-of-clauses`, `a-promise-can-rest-on-another`,
  `a-break-leads-to-its-cause`, `a-page-can-mark-a-promise`,
  `every-broken-trace-is-kept`, `a-break-comes-with-a-diagnosis`.
- **Rename:** `a-clause-is-kept-by-its-mark` → `a-clause-is-upheld-by-its-mark`.
- **Add:** `a-plan-is-one-promise` (done when every clause's mark has reported
  it upheld); `a-plan-plans-its-clauses` (the clause plan replaces the test
  plan: each clause with its mark, tests beside); `a-person-sees-promises-not-tests`
  (tests are the agents', never shown for approval);
  `every-break-becomes-a-test` (fixing a break adds a test on that clause);
  `a-promise-is-upheld-or-broken` (marks, registry and pages say
  upheld/broken/holding; an old `violated` is still read).
- **Drop:** `a-message-sent-gets-a-reply` — Homework Gate is its own project,
  so its promises live in its own registry; the proof there becomes an
  expectation: Homework Gate's first plan, written as one promise of clauses,
  has every clause marked and reporting.
- **Changes:** `a-closed-plan-kept-its-promises` closes on marks;
  `a-promise-page-shows-its-proof` shows clauses.
- **Looks:** unchanged; approval screens fold into `looks-as-promises`.
- **Task wording** (Sandy, 2026-10-15): an impl's tasks are written in the
  imperative — "Make the browser template's test project read the pre-bundle
  list from the root configuration" — so an unticked task reads as work to do;
  verification items stay as end states that must hold ("The two new tests
  pass…"). Today's end-state task wording read as already done. A change to the
  planner's phase-summary rule (`skills/planner.md`, the planning `CLAUDE.md`
  template), for new impls only.
- **Task tags — later, with `run-the-master`** (Sandy, 2026-10-15, "we don't
  have to do that right now"): each task says which files it will touch and what
  kind of change it is (state, refactor, new behaviour, …), so a person sees the
  shape of the work at a glance and the scheduler knows which phases can run in
  parallel.

## Decisions

- **Tests stay.** Sandy: "I don't want to remove tests." Marks become the
  definition of a kept promise; tests become support. Not a no-tests rule.
- **Mark first is the heuristic**: less tests, more telemetry as the direction
  of attention, not an absolute.
- **The Homework Gate no-tests challenge** (build it with marks only) waits on
  this plan: it is only a fair test once telemetry is serious.
- Each clause is defined by its mark; a clause with no mark is not finished.

## Open Questions

- How a clause is written in a brief, given the brief's one-sentence-per-promise
  shape (the ADR's question).
- Whether a `state` promise (one a test can prove) needs a mark too, or only
  promises about the running system. Leaning: every promise that has a running
  system to watch gets one; a build-time `structure` promise keeps its check.
- Where the automatic loop's diagnosis lives: in the incident, in the reopened
  plan, or both.

## Sources

- `/decisions/day-monitor`, `/decisions/watcher-heartbeat`,
  `/decisions/promise-sources`
- `.indusk/planning/new-project-flow/` Build Phase 4 — the two bugs found in use
- `.indusk/planning/promise-core/master.md` — the promise as the first primitive

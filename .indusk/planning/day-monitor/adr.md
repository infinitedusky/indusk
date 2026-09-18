---
title: "Day step 4b — Monitor"
date: 2026-09-18
status: proposed
---

# Day step 4b — Monitor

## Goal

**A behaviour promise broken in a local run is found by telemetry, recorded as an incident, and sends the plan that owns it back to work — with no hosted backend and no InDusk code inside the application.**

Today every incident on record was found by a person reading code; the
registry's enforced chips are hollow because nothing watches the running
system. After this step the running system marks each promise it upheld or
broke on its own spans, `indusk promises watch` reads those marks from the
local Jaeger, opens or extends an incident, and reopens the owning plan; a
closed plan waits in `monitor` until its promises have been quiet for a
window.

## Y-Statement

**In the context of:**
a promise registry (day-promises) whose behaviour promises — how the system responds when something happens — cannot be covered by the test suite, because the inputs that break them are the ones nobody chose, and a local telemetry daemon (Jaeger) that the local-telemetry extension already installs.

**Facing:**
the requirement that the running application depend on nothing from InDusk, that the loop close with no third-party backend, that "which promise broke" be readable from a raw trace, that an unreachable Jaeger never read as "no violations", and that every current behaviour promise is owned by an archived plan.

**We decided for:**
a mark in plain OpenTelemetry — the `indusk.promise` and `indusk.promise.outcome` span attributes plus an `indusk.promise.violated` event — set by the application with the OpenTelemetry API it already uses; a dev-time trace-shape test helper shipped as a subpath; one library that asks the local Jaeger's query API for marked spans; `indusk promises status` (read-only) and `indusk promises watch` (one pass that opens or extends incidents and reopens the owner in place by appending a Maintenance phase); `monitor` derived from files — the plan's close date and its incidents' last violation — never from a network call; and observed-health chips read server-side with a timeout.

**And against:**
a runtime helper package the application would import; the span's error status as the violation signal; a backend-neutral adapter interface; a stub of Jaeger's API in tests; deriving `monitor` by querying Jaeger during plan parsing; un-archiving an owner by moving its folder; opening a sibling maintenance plan; and writing the root cause automatically.

**To achieve:**
the Day row 9 acceptance on this repository — a violation detected from telemetry during a local run opens an incident with source `local` and reopens its owning plan — and enforced chips that finally mean "seen upheld", "seen broken", or honestly "not seen".

**Accepting:**
that `monitor` reflects what `watch` last recorded, not live telemetry, so a machine that never runs `watch` shows promises as quiet (the health chip, read live, says "not seen" beside it); that the always-on schedule and receiver wait for `day-always-on`; and that promises whose violation is an absence (a gate that did not run) stay unobserved until a ledger records presence (Day step 5).

**Because:**
the application must be able to delete InDusk and keep running, so its only obligation is OpenTelemetry it already speaks; plan parsing is read on every admin refresh and every tool call and must not wait on a socket; and an archived plan's path is cited by dozens of pointers that a folder move would break, while an appended phase is a plain document edit the person commits.

## Context

Brief: [brief.md](brief.md) (accepted 2026-09-18, the always-on tier split to
`day-always-on`). Test plan: [test-plan.md](test-plan.md), 24 assertions.

What exists: the registry, incidents and `indusk promises check`
(`lib/promises/`); the local telemetry daemon, whose Jaeger answers its query
API on the port `daemonStatus()` reports (`GET /api/services`,
`GET /api/traces?service=…&tags=…`); an opt-in OpenTelemetry setup for the
evaluator (`lib/eval/otel.ts`, `eval.otel.enabled`); and a lifecycle that lists
`monitor` as a reserved position the admin already draws as pending.

What does not: any span in this repository carrying a promise, and any
behaviour promise whose own code can observe its breach. The one behaviour
promise registered here, `gates-ran-at-every-checkoff`, is broken by a gate
that does not run — an absence no code on the path can report.

## Decision

### D1. The mark is plain OpenTelemetry

A code site that enforces a behaviour promise sets, on the span for the
operation that keeps it:

| Attribute | Value |
|---|---|
| `indusk.promise` | the promise's registry name |
| `indusk.promise.outcome` | `upheld` or `violated` |

On `violated` it also adds a span event `indusk.promise.violated` carrying
`indusk.promise.symptom` — one sentence, what was observed. A span names one
promise; a site enforcing two emits a child span for the second.

The mark is **not** the span's error status: refusing bad input is upholding a
promise, and an error unrelated to any promise is not a violation. Attributes
are what every OpenTelemetry backend indexes, so "which promise broke" is
answerable from the raw trace (A2) and filterable in Jaeger by tag.

### D2. Nothing from InDusk runs in the application

InDusk ships no runtime helper. The application sets the mark with the
OpenTelemetry API it already uses; the promise guide carries the two-line
snippet. Deleting InDusk leaves the application running and its spans intact.

### D3. The test side is a dev-time subpath

`@infinitedusky/indusk-mcp/testing/trace-shape` exports an in-memory span
capture and `expectPromiseUpheld(spans, "<name>", { parent? })` /
`expectPromiseViolated(spans, "<name>")`, matching by containment — extra
attributes and extra child spans never fail it (A5). A test calls it with the
promise's name in quotes, which the check's existing token rule ("directly
inside a quote") already counts, so a test using the helper is the promise's
test link with nothing new in the checker (A6). The testing extension's skill
carries the usage.

### D4. One library asks Jaeger

`lib/promises/telemetry.ts` is the only code that queries for marks:
`markedSpans(projectRoot, since)` reads the daemon's query port through
`lib/telemetry/daemon.ts`, lists services, and fetches traces tagged
`indusk.promise`. It returns per-promise upheld and violated spans with trace
ids and times, or throws a named error when Jaeger cannot be reached — never an
empty result that reads as zero (A10). There is no adapter interface; a hosted
backend is an extension's query surface for people, not a source for this loop.

### D5. Two commands

- `indusk promises status [--since <duration>]` — read-only. Each behaviour
  promise: violations in the window with trace ids, last seen upheld, or "not
  seen"; state and structure promises listed as watched by the suite (A7–A9).
  Exit 0 when Jaeger answered, 2 when it could not (A10). Default window: the
  quiet window (D8).
- `indusk promises watch [--source local|smoke|deployed]` — one pass: status,
  then D6 for each violated promise, then D7 for each incident opened. Writes
  plan documents; commits nothing. A scheduled run (`day-always-on`) calls this.

### D6. Incidents

An open incident of the violated promise is extended; otherwise one is opened
as `incidents/i-<date>-<promise>.md` (a suffix on collision):

```yaml
id: i-2026-09-19-every-commit-evaluated
promise: every-commit-evaluated
source: local
status: open
opened: 2026-09-19T10:02:11Z
last_seen: 2026-09-19T10:14:40Z
traces: [4bf92f35…, 00f067aa…]
```

The body carries `## Symptom` (from the span event), `## Root cause` with the
line `_Unwritten — a person writes this._`, and `## Fix`. Traces are
deduplicated by id and `last_seen` only moves forward, so a second pass over
the same violations changes nothing (A12, A13). `indusk promises check`
refuses an incident marked `fixed` whose root cause is still the unwritten
line, naming the file (A15).

### D7. Reopening is an appended phase, in place

The owning plan — archived or active — gains, at the end of its impl:

```markdown
### Build Phase N: Maintenance — i-2026-09-19-every-commit-evaluated
- [ ] Write the root cause in the incident
- [ ] Fix: a code site, a widened test, or a revised promise
#### Build Phase N Verification
- [ ] The promise is seen upheld after the fix (`indusk promises status`)
#### Build Phase N Context
- [ ] CLAUDE.md, if the fix changes a convention
#### Build Phase N Document
- [ ] The incident's Fix section
```

It passes the impl structure validator (a test runs the validator on it). An
archived plan with an unchecked Maintenance phase is **reopened**: `list_plans`
lists it as active and the admin shows it executing its maintenance phase
(A14). The folder does not move — dozens of pointers cite archive paths — and
the edit is a plan document the person commits.

### D8. `monitor` is derived from files

An archived plan that holds at least one behaviour promise is in `monitor`
while `now − max(closed, lastViolation) < window`, where `closed` is the date
on its retrospective's "Landed on main at …" line (else the retrospective's
`date`), `lastViolation` is the latest `last_seen` among its promises'
incidents, and `window` is `promises.quiet_window_days` (default 7, ensured on
`update`). The window is per plan. The admin's `monitor` segment fills with
elapsed quiet time and says so; a violation restarts it (A16–A18). A plan
holding no behaviour promise closes exactly as today (A19). Plan parsing
never opens a socket.

### D9. Observed health in the admin

The Promises page and the sidebar read D4 server-side with a two-second
timeout, cached for the admin's refresh interval. Chips: red (violated in the
window), green (seen upheld), hollow "unverified" (not seen), amber
(declared known-violated), grey (retired); red sorts first, each behaviour
row shows violations and last seen; a plan holding a red promise shows red in
the sidebar (A20–A23). When Jaeger cannot be reached every behaviour chip is
hollow with "health unknown since <last successful read>" — never green.

### D10. The acceptance promise

This repository registers `every-commit-evaluated` (behaviour, domain
`gates`): every commit the evaluator is asked to score is scored. Its site is
the evaluator run, instrumented through the existing `lib/eval/otel.ts` with
its endpoint set to the local collector: `upheld` when a scorecard is written,
`violated` with the failure as symptom when the evaluator exits non-zero. Its
owner is the archived plan that made commits evaluated (confirmed in the
impl). A24 runs it: point `eval.model` at a model that does not exist, commit,
run `indusk promises watch`, and see the incident open with source `local` and
the owner reopen.

## Alternatives Considered

### A runtime helper package
`markPromise(span, name)` from InDusk would put InDusk in the application's
dependency graph for two attribute writes. Rejected: the application must run
with InDusk deleted.

### The span's error status as the violation
Cheap to filter, but conflates "an error happened" with "a promise broke" in
both directions. Rejected (D1).

### A backend-neutral adapter
Settled in the brief: the loop has one backend, and InDusk ships it.

### A stub Jaeger in tests
It would test our reading of our own guess at Jaeger's API. Rejected: tests
start the real binary the extension ships.

### `monitor` from live telemetry
Correct in the moment, but puts a network call inside plan parsing, which
every admin refresh and tool call runs. Rejected (D8); live health lives on the
chips instead.

### Un-archiving by moving the folder
The natural reading of "reopen", but every pointer to the archive path breaks
and `check-pointers` fails. Rejected (D7).

### A sibling maintenance plan
Keeps the archive untouched, but splits one plan's history in two and leaves
the promise's owner pointing at the plan that is not doing the work. Rejected.

### Writing the root cause automatically
The span carries a symptom; a root cause is a person's finding. Rejected; the
incident says it is unwritten until someone writes it.

## Consequences

### Positive
- The first loop fed from outside the repository, provable on a laptop.
- Enforced chips stop being uniformly hollow for behaviour promises.
- Nothing in an application's runtime depends on InDusk.

### Negative
- `monitor` lags telemetry until `watch` runs; the chips carry the live view.
- Absence-type promises stay unobserved until Day step 5's ledger.
- Tests that start Jaeger are slower and need the platform binary.

### Risks
- A site that sets the mark wrongly (upheld when it broke) is invisible to the
  loop. Mitigation: the trace-shape helper lets the promise's own test assert
  the mark on both paths.
- `watch` writes into archived plans' impls. Mitigation: it writes only an
  appended phase that passes the validator, commits nothing, and the person
  reviews the diff.

## Documentation Plan

### Pages
- New: `reference/cli/promises.md` sections for `status` and `watch`.
- Update: `guide/promises.md` — the mark (with the two-line snippet), health,
  `monitor`, the loop.
- Update: `guide/index.md` — "What runs where" (brief's Documents section).
- Update: `reference/admin-ui/overview.md` — health chips, sidebar roll-up,
  the `monitor` segment.
- Update: the testing extension's skill — the trace-shape helper.

### Diagrams
- Mermaid sequence in `guide/promises.md`: run → span → Jaeger → `watch` →
  incident → Maintenance phase → quiet window → closed.

### Changelog
- Added: promise marks on spans, `indusk promises status` / `watch`, incidents
  from telemetry, reopening by Maintenance phase, `monitor`, observed health.

### ADR in Docs
- Yes: `decisions/day-monitor.md` at close.

## References
- [brief.md](brief.md), [test-plan.md](test-plan.md)
- [`day-promises` ADR](../archive/day-promises/adr.md)
- `apps/indusk-mcp/src/lib/telemetry/daemon.ts`, `apps/indusk-mcp/src/lib/eval/otel.ts`
- `.indusk/planning/indusk-v4-day/master.md` — row 4b, row 4b′ (`day-always-on`)

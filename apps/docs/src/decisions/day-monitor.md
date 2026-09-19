# Monitor — the promise loop on a laptop

**Status:** accepted (2026-09-18) · Day step 4b, "Monitor — behaviour-promise violation detection and root cause, from the running system's telemetry"
**Full ADR:** `.indusk/planning/archive/day-monitor/adr.md` · **Guide:** [Promises — the loop](../guide/promises.md#the-loop) · **Reference:** [`indusk promises`](../reference/cli/promises.md) · **Lessons:** [Monitor — Lessons](../lessons/day-monitor.md)

## What was decided

A behaviour promise broken in a run is found by telemetry, recorded as an incident, and sends the plan that owns it back to work — with no hosted backend and no InDusk code inside the application. The running system marks the promise with plain OpenTelemetry; the local-telemetry daemon's Jaeger is the one backend; `indusk promises watch` turns violations into incidents and reopens the owner by appending a Maintenance phase; a closed plan holding a behaviour promise waits in `monitor` until its promises have been quiet for a window.

| Question | Decision |
|---|---|
| How does the running system say a promise broke? | Two span attributes and an event, set by the application itself: `indusk.promise`, `indusk.promise.outcome` (`upheld` / `violated`), and `indusk.promise.violated` carrying `indusk.promise.symptom`. Never the span's error status — an error and a broken promise differ in both directions. **Rejected:** a runtime helper package (InDusk in the application's dependency graph for two attribute writes). |
| How does a test assert it? | `@infinitedusky/indusk-mcp/testing/trace-shape` — `captureSpans`, `expectPromiseUpheld`, `expectPromiseViolated` — containment, not snapshots, taking the promise as its token so the assertion is also the promise's test link. |
| Where does the loop read from? | The local telemetry daemon's Jaeger, through one query (`readPromiseMarks` over `markedSpans`). Unreachable is exit 2 and "health unknown", never a zero. **Rejected:** a backend-neutral adapter; a stub Jaeger in tests (it would test our reading of our own guess at the API). |
| What does a violation become? | An incident opened or extended per promise — traces deduplicated, `last_seen` only forward, the root cause left for a person (`promises check` refuses a fixed incident without one) — and a Maintenance phase appended to the owner's impl, in place, in its live copy. **Rejected:** moving the archived folder (dozens of pointers cite archive paths); a sibling maintenance plan (splits one plan's history); writing the root cause automatically. |
| When is a plan done? | An archived plan holding a behaviour promise is in `monitor` while `now − max(closed, lastViolation) < window` (`promises.quiet_window_days`, default 7), derived from files — never a network call inside plan parsing. The admin's chips carry the live view. |
| What proves it? | `every-commit-evaluated`, marked by every evaluator run, and `pnpm e2e`, which breaks it on purpose with a model that does not exist and watches the loop close. |

## Refined during the work

- The evaluator exports its mark to the local daemon whenever it runs (the ADR had planned a direct post from the hook; the evaluator already had an OpenTelemetry path, used only when configured by hand).
- Marks carry `indusk.project` where one service marks for many projects, from the main checkout — so a plan worktree and its trunk agree.
- In an impl with a Test Trajectory, the Maintenance phase appends a row for the test that reproduces the incident, rather than a new "no tests flip" reason.

## What this step does not do

Watching with no developer machine on — a persistent Jaeger, `watch` on a schedule, deployed runs (`day-always-on`, 4b′). Promises declared in planning and confirmed at close (`day-contract`, 4c). Absence-type promises, which need a ledger of what should have happened (Day step 5).

## Consequences accepted

`monitor` lags telemetry until `watch` runs. Violations older than the quiet window that nobody `watch`ed are not recorded, and the default in-memory Jaeger forgets on restart — both the always-on step's to close. A mark set wrongly by an application (upheld when it broke) is invisible to the loop.

# Promises

What the system commits to, written down, checked, and owned.

## Why it exists

A test that went green stays green until someone edits the code it tests. A commitment the system keeps — *a seat is never double-booked*, *every shared rule has exactly one definition* — can be broken months later by a change that never mentioned it. That difference is why a commitment needs three things a test row does not: an **owner** that outlives the plan that made it, a **state** rather than a verdict, and a **link** into whatever can observe it being broken.

InDusk calls such a commitment a **promise**. A plan's contract is the promises it **establishes**, the promises already in force that its change **preserves**, and nothing about *how* — the boundary is fixed, the path is free. The process record (phases closed in order, red seen before green, commits scored) is how the proof was made honestly; it is not a promise about the system.

## A promise predates its test

A promise is the statement of behaviour. A test is one of its links, derived from it, not the other way round. Promises arrive from two directions:

- **Specification** — stated in planning, before the code exists.
- **Failure** — discovered when a run breaks something nobody had named, and stated afterwards.

The primitive accepts both. A Test Trajectory row names the promise it establishes or preserves; a row that names neither is process or path, and should not be a row.

## The three kinds

A promise's **kind** is decided by *what can break it after it was proved*, which decides what checks it and where its health comes from.

| Kind | What it says | Broken by | Checked by | Health source |
|---|---|---|---|---|
| `behaviour` | something happens; how the system responds | inputs nobody chose, in a run | a test, and the running system | the running system; hollow until seen |
| `state` | a fact about stored or rendered state, under chosen inputs | a later change to the code that produces it | a test | the last run of the suite at head |
| `structure` | something exists, or exactly one of it does | a later change that removes or duplicates it | a build-time check | the last run of the check at head |

Telemetry watches reactions; tests and checks assert state and structure. *The documentation page exists* is a promise, and a pointer check going red at the next build is exactly the loop wanted, at the speed the fact changes. Running the system adds nothing to a static fact. What would be a gap is a static promise with no check at all.

For `state` and `structure` promises the regression suite *is* the monitor, on two conditions the system must make visible rather than assume: that the check **ran** at head, and that it still **binds** to the behaviour it names. `behaviour` promises are the one kind the suite cannot cover, because the inputs that break them are the ones nobody chose. That is what the monitor step (Day 4b) is for.

## Two lifetimes

- `holds` — in force for as long as the system runs; any later change can break it. The default.
- `established` — a transition that, once done, cannot be undone (*the backfill ran*). Its check retires the moment it goes green and the promise moves to history, hidden by default, so the registry does not fill with things that can never break again.

## Four states

| State | Meaning |
|---|---|
| `declared` | Stated in planning, not yet established. The owner is an open plan. |
| `enforced` | The system upholds it; a violation is a bug. |
| `known-violated` | Declared, and the current implementation provably cannot uphold it. Carries the incident that proves it, so it is evidence rather than an excuse. |
| `retired` | No longer a promise. Kept for history. |

`known-violated` is what makes declaring honest. Without it, a promise you cannot yet keep is either hidden or a permanently red check — and a permanently red check stops being read.

```mermaid
stateDiagram-v2
    [*] --> declared: stated in planning
    [*] --> enforced: stated after a failure, guarded
    declared --> enforced: confirmed when its plan closes
    declared --> known-violated: could not be established (incident)
    enforced --> known-violated: broken, incident opened
    known-violated --> enforced: fixed
    enforced --> retired: superseded or withdrawn, by a change that names it
    known-violated --> retired
```

## The registration rule

Not every check is a promise, and the registry must not become a second copy of the trajectory. **A promise is registered when its breakage would need a plan to reopen.** Applied to this repository's own candidates:

| Candidate | Kind | Lifetime | Registers? |
|---|---|---|---|
| every shared rule has exactly one definition (the pins) | structure | holds | yes — a second copy is a defect for the plan that pinned it |
| every pointer in CLAUDE.md resolves (`check-pointers`) | structure | holds | yes |
| the phase-boundary record is never malformed | state | holds | yes — one bad line blinds every reader |
| no test writes the machine-global registry | state | holds | yes — a leak reopens the plan that isolated it |
| every checkoff ran its gates | behaviour | holds | yes — the class `hook-cwd-independence` reopened for |
| the jj residue sweep ran | — | established | **no** — done once; what holds is the structure promise "no jj residue", already pinned |
| every phase closed in order; red seen before green | — | — | **no** — process record, not a promise about the system |
| "the migration preserves every key", as a trajectory row | — | — | **no** — a row that preserves a registered promise cites it; it does not create an entry |

## Three worked examples, one per kind

This repository holds three promises of its own, chosen so the convention is
shown not to depend on a service or on telemetry. Each is a file under
`.indusk/promises/`; `indusk promises check` runs over them in `pnpm test`.

| Promise | Kind | Where it is enforced | What checks it |
|---|---|---|---|
| `one-definition-per-shared-rule` — every rule two lanes must agree on has exactly one definition under `src/lib` | `structure` | nowhere in particular: it is a fact about the tree, so it lists no site | the eight `*-single-definition` pin tests, each carrying the token |
| `phase-boundary-record-never-malformed` — the writer refuses an append with the reader's own predicate | `state` | `lib/shape/boundary.ts` | the boundary tests |
| `gates-ran-at-every-checkoff` — a phase-transition edit is judged by the gate chain from any working directory | `behaviour` | `hooks/check-gates.js` | the hook-runner test that drives the chain from a subdirectory — and, when Day step 5's gate ledger exists, the running system |

The third is the interesting one. It is `enforced`, it has a site and a test,
and it carries a `fixed` incident from 2026-09-15 (the hooks were registered
relative to the session's cwd and silently stopped loading). Yet its chip on
the Promises page is **hollow**, because nothing yet observes a checkoff at
run time; the suite proves the behaviour on inputs someone chose. That hollow
chip is the honest reading, and it is what the monitor step will fill.

A fourth arrived with the monitor: `every-commit-evaluated` (`behaviour`),
marked by every evaluator run — the first promise here whose health the
running system reports. See [The loop](#the-loop).

## Who owns a promise

The plan that established it, until a later plan changes it: a plan that improves a promise's sentence takes the promise over. A plan closes *holding* its promises — closed is the resting state, and the archived plan is the owner of record that a violation wakes. Only a plan holding none is truly finished.

## A promise's life in plans

A promise comes from a planning conversation, and four commands carry it. Nobody types a registry file. The planner calls the tools of the same names.

| Moment | Command | What it does |
|---|---|---|
| The plan's [brief](/guide/briefs) is agreed | `indusk promises declare` | Writes the promise as `declared`, owned by the plan. |
| The plan closes | `indusk promises confirm <plan>` | Each promise the plan declared becomes `enforced`: its `tests:` are the files the plan's test rows name, its `sites:` the other files that carry its token. Refuses, and writes nothing, while a promise has no passing row that names it. |
| A later plan partly changes what it commits to | `indusk promises change` | The sentence is replaced and the later plan takes the promise over. Its name, its incidents and the marks in code stay; its History keeps the old sentence, the reason and the plan that owned it before. |
| Its name no longer describes it | `indusk promises replace` | A new promise is declared recording which it replaces. The old one stays in force while the plan builds and is retired when that plan is confirmed. |

A promise is proven by a row, not by a claim. Each row of a plan's [Test Trajectory](/guide/test-trajectory) says what it is for, and confirming reads those rows: every row that names the promise is `passing`, and the test files they name exist and carry `promise: <name>`. A `behaviour` or `state` promise also needs code that carries the token, because a promise about what the system does names the code that keeps it.

Prefer changing to replacing. A promise a new plan partly invalidates is usually the same commitment said better, and changing it keeps one name, one file and one history. If it breaks later, the plan that changed it is the one reopened.

```mermaid
flowchart LR
  B[Brief agreed] -->|declare| D[(declared)]
  D -->|rows pass; confirm at close| E[(enforced)]
  E -->|a later plan: change| E
  E -->|a later plan: replace, then its confirm| R[(retired)]
  E -->|it breaks| K[(known-violated)]
  K -->|fixed| E
```

## How to write one

In a plan, the planner does this from the conversation (above). By hand, for a
promise stated after a failure:

1. **Declare it**: `indusk promises declare <name> --plan <plan> --kind <kind>
   --domain <domain> --statement "<one sentence>"`. Kebab-case name; one
   sentence, observable, never implementation. A domain the project has not
   declared is refused, unless it declares none yet.
2. **Link it.** Put the token `promise: <name>` in a comment at the code
   site that keeps it and in the test that checks it. A `structure` promise
   needs only the test.
3. **Name it in a test row.** The plan's row for that test says
   `promise: <name>` in its `For` cell and the test file in its `Test` cell.
4. **Confirm it** when the plan closes: `indusk promises confirm <plan>`. It
   refuses by name until the rows and the links are in place.

The file shapes, every refusal and the exit codes are in the
[`indusk promises` reference](/reference/cli/promises).

## Marking a behaviour promise

A `behaviour` promise is broken by inputs nobody chose, so the running system
has to say when it upholds or breaks one. It says so with plain
OpenTelemetry, on the span that does the work:

```ts
span.setAttribute("indusk.promise", "seat-never-double-booked");
span.setAttribute("indusk.promise.outcome", "upheld");
```

and, when the promise breaks:

```ts
span.setAttribute("indusk.promise.outcome", "violated");
span.addEvent("indusk.promise.violated", {
  "indusk.promise.symptom": "seat 4 held by two players",
});
```

That is the whole convention: two attributes, and an event carrying what was
observed. The application imports nothing from InDusk and runs the same with
InDusk deleted. Anyone holding the raw trace — in Jaeger, in any
OpenTelemetry tool, or as exported JSON — can read which promise broke and
why. A violation is its own attribute, never the span's error status: an error
can happen while every promise holds, and a promise can break with no error at
all.

A test asserts the mark with the helper InDusk ships for tests only:

```ts
import {
  captureSpans,
  expectPromiseUpheld,
} from "@infinitedusky/indusk-mcp/testing/trace-shape";

const spans = await captureSpans(() => holdSeat(4));
expectPromiseUpheld(spans, "promise: seat-never-double-booked", {
  parent: "handle-request",
});
```

The helper takes the promise as its token, so the assertion is also the
promise's test link — `indusk promises check` counts it with no other comment.
It checks containment, not a snapshot: added attributes and extra child spans
never fail it; the marked span going missing does. `expectPromiseViolated`
asserts a violation and returns its symptom.

This repository's own example is `every-commit-evaluated`: every evaluator run
marks its root span, `upheld` when a scorecard is written and `violated` with
the reason when it is not. While the local telemetry daemon runs, that mark
lands in its Jaeger with nothing configured.

## The loop

A behaviour promise broken in a run finds its way back to the plan that owns
it without a person reading anything (Day step 4b):

```mermaid
flowchart LR
    Run["a run breaks the promise"] --> Span["span: indusk.promise<br/>outcome = violated"]
    Span --> Jaeger["local Jaeger<br/>(the telemetry daemon)"]
    Jaeger --> Watch["indusk promises watch"]
    Watch --> Incident["incident<br/>source: local<br/>root cause: unwritten"]
    Incident --> Phase["owner reopened:<br/>Build Phase N: Maintenance"]
    Phase --> Window["monitor:<br/>quiet window"]
    Window -->|quiet for the window| Closed["archived"]
    Window -->|violated again| Incident
```

- **status** reads the marks: `indusk promises status` shows each behaviour
  promise's violations and when it was last seen upheld, or *not seen*.
- **watch** records them: one incident per promise, extended rather than
  duplicated, and a Maintenance phase on the owner that cannot close until a
  test reproducing the incident passes.
- **The incident names its tests.** When it opens it lists, under
  `## Proven by`, every test row in any plan that names the broken promise:
  the plan, the row and whether it passes. A promise that broke beside a
  passing test tells you the test checks something else, so the fix starts
  with a test that fails the way the running system did.
- **A person** writes the root cause; `promises check` refuses to let the
  incident close without one.
- **`indusk promises fix <id>`** closes it once the fix holds: the incident
  records when it was fixed, and the promise returns to `enforced`.
- **monitor** waits: once the Maintenance phase is done, the plan stays in
  `monitor` until its promises have been quiet for `promises.quiet_window_days`
  (default 7), then rests as archived.

This repository runs the loop on itself: `every-commit-evaluated` is marked by
every evaluator run, and `pnpm e2e` breaks it on purpose (a model that does
not exist) to prove the whole path. The commands are in the
[`indusk promises` reference](/reference/cli/promises).

## Local and production

A project reads promise marks from one or two **sources**. `local` is the
telemetry daemon on the developer's machine, and every project has it.
`production` is the always-on server a project names in `promises.jaeger`.
Reading both side by side is the point: while building, the same promise can
be red on the laptop and green in production, and seeing both says what a
change has broken before it ships.

```mermaid
flowchart LR
    Laptop["your runs"] --> Local["local<br/>(the daemon)"]
    Deployed["the deployed app"] --> Production["production<br/>(promises.jaeger)"]
    Local --> Readers["status · promise_health · the admin"]
    Production --> Readers
    Production -->|alarm source| Alarm["needsAttention · sidebar red<br/>status exit · catchup raises"]
```

Every reader shows every source, each in its own section, chip or entry. Only
one source raises the alarm: production when there is one, otherwise local. A
break that appears only locally is work in progress. It is shown under
`local` and not raised. A source that cannot be read, or whose watcher is
blind, says so for that source, and the other source is still shown: one dead
source never hides another. `promises watch --source deployed` records
production's breaks; `--source local` records the laptop's.

A project that names no server has one source, `local`, and every reader
behaves exactly as it did before sources existed.

## Watcher blind

Every reader — `promises status`, `promises watch`, `promise_health`, the
admin's Promises page, and `/catchup` through `promise_health` — proves the
watcher can hear before it reports anything. It sends one span through the
Jaeger's intake and reads it back from the query API:

```mermaid
flowchart LR
    Reader["a reader asks for promise health"] --> Probe["send watcher.probe<br/>to the intake"]
    Probe --> Back{"comes back from<br/>the query API<br/>in time?"}
    Back -->|yes| Marks["read the marks<br/>as usual"]
    Back -->|no| Blind["watcher blind:<br/>no counts at all"]
    Probe -.->|nothing answers| Unreachable["cannot be reached:<br/>no counts at all"]
```

**Watcher blind** and **cannot be reached** are different answers:

- **Cannot be reached** means nothing answered — no daemon, a wrong URL, a
  refused credential. Start the daemon, or fix the address.
- **Watcher blind** means something answered and did not hear. That could be a
  process on the port that is not this project's Jaeger, an intake that drops
  what it is sent, or a broken pipeline between the two. Starting the daemon is
  the wrong advice; something is already there.

Neither one reports a count. On 2026-10-01 a test's leftover Jaeger answered on
the default ports, and every reader reported this repository's promises
healthy after seven silent days. A reader that only checks for an answer cannot
tell a quiet week from a deaf watcher.

"In time" is 5 seconds for the CLI and `promise_health`, and 2 seconds in the
admin, whose page must render within its health budget. A probe that came back
is trusted for 30 seconds per source, so the admin's five-second refresh does
not fill Jaeger with probes. The spans appear in
Jaeger under the service `indusk-watcher`.

## See also

- [Plan Lifecycle](./plan-lifecycle) — the two authorities a test can have, and why behavioural assertions are the shape of a promise
- [Test Trajectory](./test-trajectory) — the rows that will name what they establish or preserve

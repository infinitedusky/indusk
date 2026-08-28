---
title: "Midnight — expectations, incidents, and telemetry that grades the tests"
date: 2026-06-14
status: draft
amended: 2026-08-11
rewritten: 2026-08-28
---

# Brief — Midnight

**What this is:** a linkage mechanism. One shared name threads a **test**, a
**code site**, and a **span**, so that what the system promises to uphold is
enforceable in code, assertable in a test, and observable in production — and a
violation in production can name which promise broke.

That mechanism is the whole plan. Everything else here follows from it.

## Why

InDusk has three feedback loops today — the eval agent turning commits into
lessons, `/falsify` attacking a plan's own claims, and the Shape check reviewing
each phase's craft. **All three are closed inside the repository.** They can only
surface what someone already thought to look at.

The `versioned-workbench` retrospective is the evidence: fourteen phases, thirty-two
green trajectory rows, both closing rituals run — and twelve defects surfaced within
an hour of using the thing for real. The loops worked correctly and still could not
see what only running it revealed.

Midnight adds the first loop fed from **outside** the codebase.

## The core inversion

Telemetry does not replace tests. It **grades** them.

The highest-information object in the system is *a test that passed while
production broke*. It names your assertion as insufficient, rather than merely
reporting that code failed. Nothing inside the repo can produce that object.

## Two authorities

An earlier version of this brief claimed *"don't write a test until a failure in
production has earned it."* That is replaced. There are two kinds of test and they
answer different questions:

| | Written | Authority | Answers |
|---|---|---|---|
| **Trajectory test** | before the code | specification | did we build what the plan claimed? |
| **Expectation test** | after a failure | failure | does the system still uphold what it must? |

The original critique was right about its actual target — a unit test written
*after* the code, mirroring it, catches the developer typing. But a test written
*before*, derived from a stated commitment, constrains the implementation from an
angle the implementation did not choose.

Both are legitimate. Neither is speculative. What Midnight eliminates is the
**orphan**: an assertion that traces to neither a plan's claim nor a real failure.

## The three artifacts

**Promise** — a named invariant the system upholds. A statement, the code sites
that enforce it, the trace pattern that validates it, and the incidents that have
violated it.

```ts
// promise: seat-never-double-books
if (seat.occupied) throw new SeatTakenError();
```

```ts
expectTraceShape("seat-never-double-books", { … });
```

```
indusk.promise = "seat-never-double-books"     // span attribute
```

**Promise state** — a promise is `enforced`, `known-violated`, or `retired`.

| State | Meaning | Build |
|---|---|---|
| `enforced` | the system upholds it; a violation is a bug | fails |
| `known-violated` | declared, and the current implementation provably cannot uphold it yet | does not fail |
| `retired` | no longer a promise | ignored |

**The middle state is not a convenience, it is what makes declaring honest.** A
promise you cannot yet uphold leaves two options without it: do not declare it —
which hides a commitment you have actually made — or declare it and keep the build
red forever. A permanently red check stops being read, and then gets switched off.
That failure mode has already cost this project twice: a Doppler health check that
was red on every project that had no Doppler, and an audit that was green for seven
weeks because its scope was wrong.

`known-violated` carries the incident that proves it, so the state is evidence
rather than an excuse. Found by building it — looper's first promise is one its v0
detector cannot uphold.

**Incident** — what happened when a promise broke. Symptom, root cause, which
promise it violated, status, fix commit.

```
incident: 2026-08-27-double-seat
```

**The loop** —

```
production violates a trace pattern
  ↓
alert names the promise: "seat-never-double-books regressed"
  ↓
opens a new incident, or matches an existing one
  ↓
the owning plan reopens
  ↓
fix lands; the promise gains a code site, a test, or a revision
  ↓
repeated violations of related promises = the collapse signal → refactor
```

> **Vocabulary note.** These were `E-N` and `F-N`. Renamed to readable slugs so the
> identifier is self-describing in all three places it appears and needs no lookup
> table. Sequential numbering is lost; grep still works. The ADR confirms or
> overturns this.

## Promises belong to plans

Midnight originally proposed a fourth primitive — a **subsystem**, with append-only
phases, never archived — because plans close and a long-lived concern outlives them.
Numero's archive has four plans for one concern (`bulletproof-state`,
`-state-machine`, `-state-finishout`, `-pregame-ui`) which is the problem stated
plainly.

**That primitive is not being built.** The diagnosis is right and the fix is a
lifecycle change rather than a new noun: **plans become reopenable and gain a
`monitor` state.** Closed stays the resting state, so the active surface does not
grow without bound. Recorded in [`/guide/plan-lifecycle`](../../../apps/docs/src/guide/plan-lifecycle.md).

So: **a promise is owned by the plan that created it, and a violation reopens that
plan.** No parallel hierarchy, no second place to look.

**What would reverse this:** a promise that genuinely belongs to no plan, or one
created by plan A and violated by code from plan B where "which plan reopens?" has
no clean answer. If that happens **twice**, build subsystems then — with evidence,
not prediction.

## What this needs from a project

**Portable — required everywhere.** OTel spans with attributes. A test runner that
can assert over captured spans. A way to grep code comments. That is the whole
dependency list, and it is why this plan is small: **the spans already exist.**
Midnight adds a name that links them to a test and a code site.

**Not portable — do not assume it.** An earlier version of this section described
*Numero's* substrate and called it InDusk's: per-service `telemetry-contract.ts`
with typecheck-enforced span gates, and an in-process span buffer for vitest. Both
are TypeScript-specific and neither exists in looper, which this brief names as the
proving ground two sections later. The inventory and the proving ground pointed at
different projects.

**What InDusk itself supplies**, in any language: OTel wiring via the `otel`
extension, local Jaeger + MCP for dev-time query, Dash0 for production, the Test
Trajectory, `/falsify`, and the lessons registry — the last being prose curated by
hand, anchored to nothing that runs. Plans end in archive; the `monitor` state is
the missing piece.

### Already built in looper

Evidence, not projection — these exist and run today:

| Step | Status in looper |
|---|---|
| 2 — annotation + span attribute + "every promise has a site or test" | **built**; validator runs in `turbo lint`, enforced both directions |
| 4 — `expectTraceShape` | **built** as `assert_trace_shape` for pytest; requires naming the promise |
| 3 — telemetry contract | **not buildable** — no contract file, no typechecker over Python |

Step 4 being built twice, in two languages, is the evidence it is portable. Step 3
is the one that is not.

## Incremental path

Each step is independently useful. Stopping after any of them leaves something
working.

| # | Effort | What |
|---|---|---|
| 1 | ~3h | **Convention + one seeded promise.** The file shape, and one real promise in a live project with a real incident behind it. |
| 2 | ~1d | **Code annotation.** Greppable `promise:` comments at enforcement sites; the span-attribute convention. A check that every named promise has ≥1 code site or test. |
| 3 | ~1d | **Contract enforcement, where a contract exists.** *Optional and language-specific.* Where a project has a typed telemetry contract, its entries declare which promises they carry and the typechecker rejects a span claiming a promise that does not exist. Projects without one get the same guarantee at runtime from step 2's validator, more weakly. This step is **not** a prerequisite for any other. |
| 4 | ~2d | **`expectTraceShape`.** The trace-pattern assertion library. Each pattern names the promise it validates; CI failures reference it by name. |
| 5 | ~2d | **Collapse signal.** `indusk promises check` — violations in the last 24h from Dash0 + local telemetry. The signal becomes a number. |
| 6 | ~1d | **Lifecycle.** The `monitor` plan state; reopening on violation; `/retrospective` distinguishes archive-eligible from monitored. |
| 7 | ~2d | **Production-to-corpus loop.** Dash0 alert → check the incident corpus → "this is a known incident, here is the fix path" or open a new one. |
| 8 | ~2d | **Bloat audit.** Inventory every extension, skill, hook, tool. Mark each load-bearing / superseded / unused / unknown. Drop the first two categories of dead weight; instrument the unknowns for a week and drop what nothing queries. |

**~2 weeks**, distributed across normal feature work rather than taken as a block.

## Proving ground

**looper** — small, fresh, and being built now, so promises get written while the
code is written rather than reconstructed archaeologically. Numero was the original
candidate and remains the harder test: it has the archive sediment and the real
production failures.

## Success criteria

- **No orphan assertions.** Every test traces to a plan's claim or a real incident.
- A new session runs `/catchup` and can answer "what does this project promise?"
  without reading the archive.
- A production alert names the promise that broke, not just the stack that threw.
- "How often was this promise violated this week?" returns a number that means
  something.
- A test that passed while production broke is **detectable**, and is treated as a
  finding about the test.
- InDusk's installed surface fits on one screen, every entry used and maintained.

## What this is not

- **Not a rewrite.** Convention, glue, and a targeted drop of dead weight.
- **Not "more tests are better."** The opposite — it deletes the orphans.
- **Not a replacement for the Test Trajectory.** Trajectory tests keep their
  authority; telemetry grades them.

## Open question — the relationship to Dawn

This brief originally said *"Dawn comes later. Dawn is built on top of Midnight."*
That is no longer true as sequencing: Dawn was re-founded 2026-07-26 and has
components 1, 2, 3 and 6 shipped, and its master plan does not mention Midnight.

Neither document currently answers how they relate. Two readings, both plausible:

- **Midnight feeds Dawn.** Dawn runs plans without a human watching; a promise
  violated in production is exactly the signal an unattended loop needs to know it
  broke something. Under this reading Midnight is Dawn's missing feedback edge.
- **They are orthogonal.** Dawn is about *who executes*; Midnight is about *what
  authority a test has*. They meet only at the plan document.

**The ADR must pick one**, because it decides whether Midnight's collapse signal
needs to be readable by `indusk run`.

## Cross-references

- [`/guide/plan-lifecycle`](../../../apps/docs/src/guide/plan-lifecycle.md) — the
  `monitor` state this depends on
- `.indusk/planning/indusk-v2-dawn/master.md` — the open-question counterpart
- [`/decisions/tests-first-planning`](../../../apps/docs/src/decisions/tests-first-planning.md)
  — the trajectory's authority, which this does not disturb
- `.indusk/eval/` — the natural trigger surface for opening an incident automatically

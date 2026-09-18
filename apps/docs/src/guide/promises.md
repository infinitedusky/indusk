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
    declared --> enforced: links in place at close
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

## Who owns a promise

The plan that established it. Ownership moves only when another plan supersedes the promise. A plan closes *holding* its promises — closed is the resting state, and the archived plan is the owner of record that a violation wakes. Only a plan holding none is truly finished.

## How to write one

::: info Lands with Build Phase 1 of `day-promises`
The registry format, `indusk promises check`, and the per-kind link rule are documented here once they ship. Until then, see the plan's ADR at `.indusk/planning/day-promises/adr.md`.
:::

## See also

- [Plan Lifecycle](./plan-lifecycle) — the two authorities a test can have, and why behavioural assertions are the shape of a promise
- [Test Trajectory](./test-trajectory) — the rows that will name what they establish or preserve

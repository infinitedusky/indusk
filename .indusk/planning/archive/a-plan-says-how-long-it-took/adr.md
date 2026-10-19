---
title: "A plan says how long it took"
date: 2026-10-19
status: proposed
---

# A plan says how long it took

## Goal

**Every phase, unattended step and test run of a plan leaves a timed record, and one command prints them with a total from acceptance to landing.**

Today a phase's start is recorded but not its end, an unattended step's session record is deleted when it ends, and `indusk plans tests` records nothing. So "where did the time go" is answered by reading commit times by hand, and the decision about which tests run per phase has no data to stand on.

## Y-Statement

**In the context of:**
a plan whose phases open through `recordPhaseStart` (`lib/shape/boundary.ts`, `.indusk/phase-boundary.jsonl`), whose unattended steps run through `runBuild` and `runPlanning` (`lib/build/runner.ts`, `planning-runner.ts`) and whose tests run through `plansTests` (`bin/commands/plans.ts`).

**Facing:**
no end time on any of the three, no record at all for steps once their session is gone or for test runs, and a requirement that recording never stops the work it records; the existing phase-boundary reader throws on a corrupt line by design, which the view cannot do.

**We decided for:**
one new module, `lib/timing/`, holding a single append-only log per plan in machine state (`~/.indusk/projects/<id>-<hash>/timing/<plan>.jsonl`, found as `indusk eval home` finds it), with five event kinds (`phase-close`, `step-start`, `step-end`, `test-run`, and the phase opening read from the existing boundary file rather than copied). Every timestamp is UTC ISO-8601 from an injected clock. Every writer is wrapped by one `recordSafely` that catches, warns and returns. Steps are recorded by wrapping the `run` dependency at the two runner call sites, so the runners' logic does not change. A new reader skips any line it cannot parse. The view is `indusk plans time <name>`, a pure formatter over the three record sources plus the brief's `accepted_at` and the landing commit's time.

**And against:**
adding an end field to `phase-boundary.jsonl` records; one log file per kind; recording inside the repo's `.indusk/` and committing it; recording from OpenTelemetry spans read back out of Jaeger; deriving everything from git commit times; making the existing boundary reader tolerant; and a view in the admin now.

**To achieve:**
a duration for every phase, step and test run including the ones that failed or were killed, a record that is never the reason work stops, and no change to what the tests run or to the existing phase-start record.

**Accepting:**
that timing lives on one machine (a plan built on two machines has two partial logs), that a phase closed by a path nobody wired a close into has an open end until that path is found, and that a killed step shows as started and never ended instead of carrying an invented end time.

**Because:**
the time must be read where it is written, by the process that knows it, and survive the session being deleted; machine state is where this repo already keeps bookkeeping that is read by tools and not reviewed (`/decisions/bookkeeping-lives-where-it-is-read`), so it adds no commits to the plan's branch and cannot conflict between worktrees.

## Context

The brief (`brief.md`, accepted) promises `a-plan-says-how-long-it-took` with five clauses: `phases-are-timed`, `steps-are-timed`, `test-runs-are-recorded`, `one-view` and `a-record-never-blocks`. The test plan (`test-plan.md`, draft) gives 19 assertions, 18 unit and one live check. No `research.md` exists; the facts above come from reading the code on 2026-10-19. The test plan left two questions to this ADR: where the records live and the timestamp form. Both are decided below.

## Decision

1. **Where.** One log per plan in machine state, `timing/<plan>.jsonl` under the project's machine-state directory. Not in the repo. Reason: step and test-run records are high-volume machine output nobody reviews; the repo's rule is that such state lives where it is read. The phase opening stays where it is (`.indusk/phase-boundary.jsonl`) and is read from there; A1's "the record that already existed still reads the same" holds because nothing there is rewritten.
2. **Shape.** Each line is `{ v: 1, kind, plan, at, ... }`. `at` is UTC ISO-8601 (`Date#toISOString`). Fields by kind:
   - `phase-close`: `phase`, optional `kind` (test or build, absent meaning build, the same rule the boundary file states), `sha`.
   - `step-start` / `step-end`: `id` (a random id pairing the two), `step`, optional `phase`; the end adds `outcome` ∈ `finished | blocked | failed | stopped`.
   - `test-run`: `scope` (`{phase}` or `landing`), `files` (`{own, reached, mustNotBreak}` counts), `startedAt`, `durationMs`, `passed`.
3. **Durations are computed by the view from timestamps**, never stored (except the test run's, which the runner measures with a monotonic clock because it is the one fact the later decision depends on). The view parses to epoch milliseconds, so time zones and daylight-saving cannot change a duration (A19).
4. **Idempotence.** `phase-close` for a phase already closed, or for a phase never opened, writes nothing and warns (A3). The earliest close wins when duplicates exist, mirroring the boundary file's earliest-open rule.
5. **Steps.** `step-start` is written before the session runs, `step-end` after it returns or throws. A step with a start and no end is shown "started, never ended" with the time since start (A6). Mapping to outcome: runner `error === null` and the step advanced is `finished`; a blocker stop is `blocked`; `error` is `failed`; an interrupt or timeout is `stopped`. The wrap is a function `timed(run, deps)` applied where each runner is constructed, so `runBuild` and `runPlanning` keep their loops untouched.
6. **Test runs.** `plansTestsOutcome` already knows the files selected and the exit code. The command measures around it and appends one `test-run`. It reads the selection and never alters it, so A18 holds by construction; a test pins that the selected files are identical with the recorder on and off. Two runs append two lines (A9).
7. **Never blocks.** One `recordSafely(fn)` catches every error from a write, prints a one-line warning to stderr, and returns. Each writer is called only through it (A14 to A16). Readers skip unparseable lines and unknown `v` (A17); this is a new reader, the phase-boundary reader's throw-on-corrupt rule (guarded by `phase-boundary-record-never-malformed`) is untouched, and the view reads the boundary file with a tolerant wrapper that catches that throw and reports the file as unreadable.
8. **The view.** `indusk plans time <name>` prints three tables (phases, steps, test runs) in the order things happened, then a total. Total: the brief's `accepted_at` to the landing time; for an unlanded plan, to now, labelled "so far" (A11). Time not inside any listed item is printed as "between", so the parts plus between equal the total. Plans with only phase starts print what exists and name what has no record (A12). Landing time is the plan's landing commit, found as the other plan commands find it.
9. **Clock and files injected.** The recorders and the view take `now`, the home directory and reads as inputs, so every rule is a unit test (`lesson: code-that-decides-takes-its-clock-and-its-reads`). Nothing here waits on the wall clock.
10. **Not telemetry.** No span or `promise` level row: nothing leaves the machine and the records are machine state. The test plan records this (`(none needed — no production behavior to watch)`).

### Open decisions

- **Phase close site.** `recordPhaseStart` has a single writer, but the close of a phase happens at the gate that ticks the phase's last box or in `/work`'s boundary step; the code has not been read for which. Decided: the impl's first build phase finds the one site the phase-close gate passes through and calls the recorder there; if there are two, both call the same function. If none can be found without changing a gate's behaviour, the phase closes when the next phase opens, which is derivable by the view with no new writer, and `phases-are-timed` is amended by a person.
- **Landing time source.** Decided: the plan's landing commit time. If the plan archive records a landing timestamp, prefer it. The impl confirms which exists.

## Alternatives Considered

### An end time on the phase-boundary record
Rejected: the boundary file is read by the review scope and guarded to throw on any malformed line; changing its shape risks the "cannot scope the review" guarantee, and A1 requires existing records read the same.

### One log file per kind
Rejected: the view must interleave phases, steps and tests in the order they happened, and three files make that a merge; one file with a `kind` is one read.

### Recording inside the repo and committing it
Rejected: every phase and step would add a commit on the plan's branch, the log would conflict between worktrees, and nothing reviews it. Costs the loss of cross-machine history, accepted above.

### Reading Jaeger spans for the times
Rejected: the promise loop's backend is the local daemon, which can be down or have retention gaps, and the brief's `a-record-never-blocks` and A6 need a record that exists without it. Telemetry would also make the view depend on a service.

### Deriving everything from git commit times
Rejected: it is today's answer and it cannot see a test run, a step that ended without a commit, or a failed step.

### Making the existing boundary reader tolerant
Rejected: its throw is a guard other code relies on. A tolerant reader is added next to it, not instead of it.

### Showing it in the admin
Rejected for this plan: the brief's Not promised puts it on the activity page (`activity-and-graph`).

## Consequences

### Positive
- Durations for failed and killed steps, which git cannot give.
- The data the later per-phase test decision needs exists after the first plan.
- No new commits, no change to what runs.

### Negative
- A plan built on two machines has two partial logs.
- One more command and one more machine-state directory.

### Risks
- A runner's `run` throws before `step-end` is written: covered by writing the end in a `finally`; if the process dies, the start-without-end display (A6) is the fallback.
- The close site is not found (see Open decisions): the derived close from the next phase's opening keeps `phases-are-timed` true for all but the last phase.
- A record shape change later: `v: 1` lets readers skip unknown versions.

## Documentation Plan

### Pages
- New: `reference/cli/plans-time.md`, the command, its three tables, the total and "between".
- Update: the page for `indusk plans tests` to say each run is recorded.
- New: `decisions/plan-timing.md`, this ADR published.

### Diagrams
- None needed: a single log and one view; the three record sources fit one table in the reference page.

### Changelog
- Added `indusk plans time`: phases, unattended steps and test runs with their durations, and a plan's total.

### ADR in Docs
- Yes, `decisions/plan-timing.md`.

## References
- `brief.md`, `test-plan.md` in this plan folder
- `.indusk/planning/archive/a-brief-is-planned-unasked/` (the planning runner this wraps)
- `apps/indusk-mcp/src/lib/shape/boundary.ts`, `lib/build/runner.ts`, `lib/build/planning-runner.ts`, `bin/commands/plans.ts`
- `/decisions/bookkeeping-lives-where-it-is-read`, `/decisions/tests-never-make-us-wait`

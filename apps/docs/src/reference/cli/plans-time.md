# `indusk plans time`

How long a plan took, read from the records the build leaves on this machine.

```bash
indusk plans time <name>
```

It prints three tables in the order things happened, then a total.

| Table | One row per | Shows |
| --- | --- | --- |
| Phases | phase opened | the phase, how long it ran, and whether it is still open, closed, or ended when the next phase opened |
| Steps | unattended step | the step (`work`, `falsify`, `cleanup`, `audit`, a planning step), its phase, how long it ran and how it ended |
| Test runs | run of `indusk plans tests` | the phase or `landing`, how long it took, passed or failed, and how many files ran for each reason |

Durations print like `1h 04m`, `4m 12s` and `9s`.

## The total

`total` runs from the moment the brief was accepted (`accepted_at` in the brief) to the plan's landing, which is the time of the trunk's `Merge <branch>: <plan> landed` commit. A plan that has not landed shows the time so far and says `so far, not yet landed`.

`between` is the total less the phases' durations: the time no phase accounts for, such as the wait between acceptance and the first phase. It is printed so the parts and the gap are never hidden.

## How a step ends

| Outcome | Meaning |
| --- | --- |
| `finished` | the session ended normally and the plan carries no blocker |
| `blocked` | the step returned but the plan now has a `blocker:` line |
| `failed` | the session ended in an error after its retries, or threw |
| `stopped` | the session was ended by a signal |

A step with a start and no end (the daemon running it died) shows as `started, never ended` with the time since it started. No end time is invented.

## A plan recorded before this

The command never fails on missing records. It prints what exists and ends with `no record of: …`, naming each kind with none (phase openings, steps, test runs, acceptance time). A phase whose close was not recorded ends when the next phase opened; the last one reads `open`.

## Where the records are

One file per plan, `timing/<plan>.jsonl`, in the project's machine-state home (`indusk eval home` prints it). Nothing is committed. A phase's opening is read from `.indusk/phase-boundary.jsonl`, which is unchanged. A record that cannot be written only prints a warning: timing never stops the work it records.

See [the decision](/decisions/plan-timing).

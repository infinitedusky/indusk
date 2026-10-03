# Watch reopen collision — Lessons

`indusk promises watch` once opened an incident, reopened no plan, and exited
0. The fix is in the [`watch` reference](/reference/cli/promises#promises-watch);
these are the lessons that apply beyond it.

## A monitor fails every run while the bad state lasts

The first fix made the run that *opened* an unowned incident exit 1. The run
after it found no new violation, skipped the promise, printed "No new
violations" and exited 0 — with the incident still owned by no plan, and
nothing ever retrying the reopen. Falsification found it. Of any change whose
point is "never report success while X", ask what the **next** run says, and
put that run in the test plan.

## When a fix makes a failure unreachable, its test moves inward

Once the incident id allocator avoided ids the owner already names, `watch`
could no longer produce a collision through the CLI. Rather than drop that
assertion, the test moved to where a collision is decided (the reopen) and
where it is reported (the run's report), and the test plan recorded the move.

## Parallel tests change the load next door

Running one package's test files in parallel made the sibling package's
real-server tests time out when turbo ran both together. The root test command
now runs the packages one after the other. After changing how tests run,
run the whole suite, not only the package you changed.

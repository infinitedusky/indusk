# A suite's speed is a promise, not a gate — mark each run, fail nothing

The everyday suite grew from one minute to five, one reasonable file at a time, and nobody saw it happen: each run's time scrolled past and was gone. A failing time budget was considered and rejected — it treats the number, not the cause, and a noisy machine would fail good runs.

Why it matters: drift that nobody records is drift nobody acts on. A gate on duration fails the wrong runs (an evaluator's concurrent run doubles the time); no record at all lets the suite slide.

What to do: mark every run as a promise — held under a generous threshold, broken over it — into the telemetry the project already watches, never changing the exit code, and do not judge a run that overlapped another. The Promises page then shows the trend, and a break opens an incident that reopens the owning plan. Guarded by `apps/indusk-mcp/src/__tests__/suite-speed.test.ts` (test-kinds A16, A17).

# A window of marks is read through one query — every reader of promise marks calls `marksBetween`

Which marks count for a promise is decided where the Jaeger query is built: the project filter (a mark naming another project is dropped), an alias's marks renamed to the promise, and the query limit that says a result may be partial. `markedSpans` (the health read) and `readTimeline` (the timeline) both read through `marksBetween` in `lib/promises/telemetry.ts`.

Why it matters: a second reader that builds its own query applies its own version of those rules, and the chip and the timeline then disagree about the same promise — one counting an alias's marks, the other not; one marking a full window "at least", the other drawing it as complete. Disagreement between two surfaces is worse than either being wrong alone.

What to do: read marks through `marksBetween` (one service, one name, one time range) or a caller of it; never build an `indusk.promise` tag query elsewhere. Guarded by `promise-marks-one-query.test.ts`.

# "Each session hears it once" delivery tracking is not enough — a new session must still filter stale/resolved entries, or it gets the entire undelivered history at once

In the incident-recording plan, break-inbox delivery was designed as "each session hears each entry once" (A18). But a session starting a week after an incident was opened — one that already had several daily reminders — had delivered nothing yet, so it received every inbox entry ever written: the original break, every daily reminder, and even entries for incidents already fixed (A30, A31, Build Phase 8).

Why: per-session dedup (have I shown this session this entry?) is orthogonal to per-entry relevance (is this entry still true?). Solving only the first leaves a correctness hole the first long-lived gap between sessions will expose.

How to apply: when designing "deliver once per consumer" semantics for any accumulating log (inbox, notification queue, changelog), always add a second filter for current truth (is the thing this entry describes still open/valid?) and fold multiple entries about the same subject into one line — otherwise a cold-start consumer is flooded with stale noise instead of informed.

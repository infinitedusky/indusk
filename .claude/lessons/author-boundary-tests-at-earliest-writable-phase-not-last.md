# A test that uses foreign/real-client input belongs at the earliest writable phase, not deferred to "needs everything at once"

day-always-on's only end-to-end row (a real OpenTelemetry SDK process against the server) was deferred to the last build phase with the reasoning "needs everything at once." The bug it eventually caught — `deployment.environment` landing on Jaeger's process tags, not the span tags the reader checked — existed from Build Phase 3 and shipped through three phases of green unit tests because every fixture up to that point matched the reader's (wrong) assumption. See [[test-fixtures-can-agree-with-the-bug]].

A thinner version of that same test — one real-SDK process hitting the server, asserting almost nothing yet — was writable at Build Phase 1. It didn't need the whole feature; it needed the protocol boundary to exist.

**The rule:** when a trajectory row is the only one that constructs input with a real client library instead of a project fixture, don't defer it to the phase that "needs everything" — author a minimal version of it as early as the boundary it tests exists, then grow its assertions phase by phase. Deferring the one foreign-input test to the end means that boundary is unverified for the entire plan, not just the last phase.

Pointer: `.indusk/planning/archive/day-always-on/retrospective.md`.

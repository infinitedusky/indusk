# Tests first within each phase

Every impl document opens with a Test Trajectory table listing every test the plan commits to, with `Writable at` and `Passes at` columns.

At the start of a phase, commit any test whose `Writable at` equals this phase — as failing. Close the phase only when every test whose `Passes at` equals this phase is passing. If a test isn't writable yet, that's fine — but its `Writable at` must name a later phase, and the reason must be structural (the test's dependencies don't exist yet), not aspirational ("we'll get to it").

If a plan has items that are genuinely not testable — LLM quality, UX judgment, paid external integrations — put them in Deferred Verification with `reason:` (why not testable), `would require:` (what would unlock a proper test), and `mitigation:` (compensating control — alert, scheduled review, downstream plan, canary). If you cannot name a mitigation, that is itself a signal: reshape the plan so the capability becomes testable, or scope it out. Untestability is a declaration, not an omission.

The test suite's pass count across phases is the plan's progress bar. Read it to know where you are.

The `check-gates` hook blocks phase advancement when any `Passes at: Phase N` trajectory row is still in `planned`, `writable`, or `written` state. This is structural enforcement — deferral is impossible by construction. See `.indusk/planning/tests-first-planning/adr.md` for the full design.

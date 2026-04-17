# Tests first within each phase

Every impl document opens with a Test Trajectory table listing every test the plan commits to, with `Writable at` and `Passes at` columns.

At the start of a phase, commit any test whose `Writable at` equals this phase — as failing. Close the phase only when every test whose `Passes at` equals this phase is passing. If a test isn't writable yet, that's fine — but its `Writable at` must name a later phase, and the reason must be structural (the test's dependencies don't exist yet), not aspirational ("we'll get to it").

If a plan has items that are genuinely not testable — LLM quality, UX judgment, paid external integrations — put them in Deferred Verification with three required fields:

- `reason:` why this cannot be tested in this plan
- `would require:` what would unlock a proper test
- `mitigation:` compensating control — telemetry alert, scheduled review, downstream plan, canary procedure, feedback signal

If you cannot name a mitigation, that is itself a signal: reshape the plan so the capability becomes testable, or scope it out. Untestability is a declaration, not an omission.

The test suite's pass count across phases is the plan's progress bar. Read it to know where you are.

## Why this rule exists

Two consecutive retrospectives in the numero codebase (`room-state-persistence`, `chain-of-custody-2`) documented roughly a third of verification items closing without any runnable automated check. Items deferred to "manual check later" or "typecheck passes" and were then forgotten. The most valuable test — restart recovery — was deferred to the end and not completed.

This wasn't a discipline failure. It was a structural failure of the impl template. The old Verification sections were loose checklists of informal checks that the implementer could satisfy without actually running anything. The Test Trajectory fixes that structurally: the `check-gates` hook rejects phase close if any committed test isn't in `passing` state, and the trajectory's cross-phase visibility makes the plan's testing contract legible at a glance.

## Enforcement

The `check-gates` hook (Claude Code PreToolUse) blocks phase advancement when any `Passes at: Phase N` trajectory row is still in `planned`, `writable`, or `written` state. This is structural enforcement — deferral is impossible by construction.

The retrospective skill audits Deferred Verification rows at plan close. Vague mitigations become retrospective findings that must be resolved or promoted to a concrete commitment before archive.

See [`.indusk/planning/tests-first-planning/adr.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/tests-first-planning/adr.md) in the repo for the full design.

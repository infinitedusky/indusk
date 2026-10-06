# A leftover/leak check chained after tests with `&&` is skipped on exactly the runs most likely to leave leftovers — run it unconditionally, and give it a grace period or it cries wolf

Two compounding mistakes in one guard: (1) `tests && check-for-leftovers` only runs the check when the tests passed — but a failing or crashed test run is the most likely one to abandon a resource mid-cleanup, so the check is structurally blind to the cases it exists for. (2) a check that reads the process list at one instant can catch a process that is still in the middle of shutting down and report it as a leak that isn't one — a false positive like that gets the check switched off by a frustrated team, which is worse than not having it.

The fix: run the leftover guard after tests regardless of exit code (dusk's `with-daemon-guard.js`), and give it a grace period before declaring something a leak. A guard that can cry wolf will be silenced; a guard gated by `&&` will never see the failure it was meant to catch.

See the day-monitor plan's test-daemons-never-leak Maintenance work (dusk).

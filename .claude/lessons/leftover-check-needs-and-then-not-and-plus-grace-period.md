# A leftover-resource check chained with && after tests is skipped on exactly the crashed/failing runs most likely to leave leftovers — chain it after, not with, and give it a grace period

dusk's telemetry-daemon leak guard was wired as `run-tests && check-leftovers` — which means the check never runs on the failing or crashed test runs that are the most likely source of orphaned processes, since those are exactly the runs that exit non-zero before `&&` continues. Separately, a leftover check that reads the process list at one instant can report a daemon that is still in the middle of a graceful shutdown as a "leak" — a false positive that, once it fires enough, gets the check switched off entirely (the worst outcome: silence where there used to be a signal).

**How to apply:** wire any leftover/leak guard to run regardless of the main step's exit code (`;` or an explicit "always run this" construct, not `&&`), and give it a grace period (a short wait + recheck) before declaring something a leak. A guard that only watches the happy path, or that cries wolf on normal shutdown timing, earns distrust and gets removed — which is strictly worse than not having it.

See `.indusk/planning/test-daemons-never-leak/` (`with-daemon-guard.js`).

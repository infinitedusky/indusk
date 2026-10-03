# Test daemons never leak — Lessons

On 2026-10-03 this machine was running 860 telemetry processes that tests had
started and never stopped — the second time (2,058 on 2026-08-13). What
applies beyond the fix:

## A remembered convention fails silently

After August the rule was "every suite that runs the CLI against a temporary
home calls `stopTelemetryForHome`". It was followed until it was not, and
nothing said so. The fix that holds is a safe default — the everyday test
configs set `INDUSK_SKIP_TELEMETRY_AUTOSTART`, so tests never start a daemon —
plus a guard that names any daemon left running. See the
[telemetry CLI reference](/reference/telemetry/cli#environment-variables).

## A bare command name runs what is installed

The extension hook runs `indusk telemetry register`. In a test that resolved
to the globally installed `indusk`, not the code being tested — every test
that ran `init` exercised the developer's install. Pin the binary the tests
run (`INDUSK_BIN`).

## A leftover check must run after failure, and not cry wolf

Chained after the tests with `&&`, the guard was skipped on failing runs —
the runs most likely to leave something behind. And reading one instant of
the process list named a daemon a test had just stopped, still exiting. The
guard now always runs (`with-daemon-guard.js`) and waits five seconds before
naming anything.

## The evaluator shares your worktree

The evaluator, grading a branch's commits, runs that branch's tests in the
same worktree. Its dev server held the admin's `.next/` lock and turned 38
admin tests red in a concurrent run that was otherwise green. Before
re-running mass failures, look for the other process.

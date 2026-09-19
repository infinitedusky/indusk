# Every child_process spawn needs an `error` listener — a missing binary never fires `close`

When `spawn()` cannot start the binary (not installed, not executable), Node emits `error` with ENOENT and never emits `close`. A spawn wrapped in `new Promise(... child.on("close", resolve))` with no `error` listener raises an uncaught exception and the code after it never runs. In day-monitor the evaluator died this way before it could mark `every-commit-evaluated` violated — the one failure the promise existed to catch ("a CLI that is not installed"). Probed 2026-09-19: `close` does not fire first.

Do: register `child.on("error", …)` on every spawn, settle the promise exactly once from either `close` or `error`, and give `child.stdin` an `error` listener too — writing the prompt to a child that never started raises EPIPE. Treat a spawn failure as a failed run with a reason (`<cli> could not be started: <message>`), not a crash.

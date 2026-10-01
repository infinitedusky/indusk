# Kill a spawned dev/test server by its process tree, and check for an orphaned listener on its port before the next run — not after 43 failures look real

In admin-plan-type, `kill -9` on a test run's parent process left an orphaned `next dev` server holding the admin app's working directory and port. The next suite run's 43 HTTP smoke tests failed against the orphan, indistinguishable from real regressions, costing a full suite run (and the debugging time to realize the failures weren't real) twice before the orphan was found.

**Rule:** killing a parent process does not kill its children — a `kill -9` of a wrapper or test runner can leave a server it spawned still bound to a port and a working directory. Before trusting a batch of test failures that involve a spawned server (dev server, daemon, database), check whether a leftover process from a previous run is still listening on the expected port.

**How to apply:** kill spawned test servers by process group or process tree (e.g., negative PID to `kill`, or tracking and killing the full subtree), not just the immediate child. When a suite that boots a server produces a wide, uniform wave of failures (not a few related ones), check for a leftover listener on the server's port as the first hypothesis, before assuming the code regressed.

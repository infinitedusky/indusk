# Never stop a process you did not start — stop your own by PID, never by name pattern (`pkill -f "next dev"` kills the person's running dev server)

During cockpit-redraw a /work subagent cleared a test's teardown failure with `pkill -f "next dev"`. The pattern matched the person's own running worktree admin on :3940 and took it down, mid-session. The next subagent was told not to; nothing enforced it.

Why: a name pattern matches every process that looks like the one you started, including the person's long-running servers and other agents' work. A subagent has no way to tell whose a process is from its command line.

What to do: every subagent prompt that runs tests, servers or builds says: never stop a process you did not start; record the PID of what you start and stop that PID (or its process group) only. If a port or lock is held by something you did not start, report it and stop; do not clear it. For Next dev, tests build into `.next-tests` precisely so they do not collide with a person's admin; use that, do not kill.

See `.indusk/planning/cockpit-redraw/retrospective.md` (Getting to Done).

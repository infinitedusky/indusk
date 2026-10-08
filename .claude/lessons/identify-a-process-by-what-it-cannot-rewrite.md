# Identify a process by a fact it cannot rewrite — read it from the real process, never compose it from the spawn arguments

small-fixes Build Phase 3 judged the admin daemon by markers taken from how it was spawned — the `next` binary path and `--port N` — and its unit test fed `ps` a command line composed the same way. Every test passed. On the machine, `next start` rewrites its process title: `ps -o command=` read the live daemon as `next-server (v16.2.4)`, with neither marker, so `ui stop` would have deleted the record of its own daemon without signalling it, and `ui status` swept it. Every Next server on the machine read identically. The working directory was no better: an `npm install -g` over the package renames the old folder aside (`.indusk-mcp-<random>`), so a running daemon's cwd stops matching its record at every install.

What held: the process's start time (`ps -o lstart=`, in the C locale), which matched the record's `startedAt` to the second and differs for any process that took a recycled PID.

**How to apply:** before an identity rule ships, read the real process with the exact command the code uses (`ps`, `lsof`) and paste the output into the test as its fixture. Prefer facts no process or install can change — start time, the listening socket's owner — over argv, title, or cwd. A fixture built from the spawn arguments tests the author's model of the process, not the process.

Enforced by `lib/process-identity.ts` (`isOwnProcess(..., startedAt)`) and `lib/admin/daemon-stop.test.ts` A17, whose fixture is the `ps` line read on 2026-10-08.

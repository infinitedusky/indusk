# A read-modify-write record shared by processes loses writes in practice — run N concurrent writers against it before trusting it, and put the project's lock around read-to-write

The plan-worktree record was read, changed and written back with nothing held in between. Falsification ran twelve `indusk worktree assign` processes at once for twelve plans: the record kept six. A dropped assignment means that plan silently reads the trunk again — the exact bug the plan existed to fix. The project already had the primitive (`withLock` in `lib/agents/lock.ts`, the current.md lock); the record simply did not use it.

How to apply: any file written by a CLI command or a hook that two sessions can run at once is a shared record. Hold the project's file lock from the read to the write (keep slow work like git calls outside it), and pin it with a test that starts N real processes concurrently and counts what survived. "The window is microseconds" is not evidence; the count is.

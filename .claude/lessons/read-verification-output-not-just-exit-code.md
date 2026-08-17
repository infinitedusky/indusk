# Read a verification command's OUTPUT before checking off the item that ran it — an exit code alone can't distinguish "passed" from "did nothing"

A verification checklist item that only checks a command's exit code (0 = pass, non-zero = fail) is trusting that a zero exit code means the command actually verified something. It often doesn't: a missing task, a wrong working directory, or a skipped suite can all produce exit code 0 while doing nothing at all.

**What happened:** one plan (`jj-residue-rip-out`) accumulated five separate false green/red signals, all invisible to exit codes alone:

1. `turbo typecheck` was checked off as passing — but `typecheck` was never a registered task in this project's `turbo.json`, so the command silently did nothing for an entire phase while exiting 0.
2. A `vitest` run printed `"No test files found, exiting with code 0"` because the working directory had drifted — a genuine pass-shaped exit code for a suite that never ran.
3. A suite was `describe.skipIf`'d on a missing `dist/` build artifact — it reported "skipped," which reads as "authored and not yet due" rather than "did not run this time," on a checklist that expects green.
4. and 5. Two verification probes spawned a bare `sh` under a `PATH` the test had deliberately narrowed for an unrelated reason — `sh` itself was unresolvable, so the spawn failed with `ENOENT` before the probe's actual assertion ever executed, and the failure mode looked superficially like the assertion itself failing (or passing, depending on how the surrounding code handled the exception).

**Why it matters:** every one of these five is a case where "the command exited 0 (or predictably non-zero)" was treated as equivalent to "the command verified the thing it claims to verify." They are not the same claim, and the gap between them is exactly where false confidence accumulates — checklist items get checked off, retrospectives report clean, and the actual behavior was never exercised.

**The rule:** when checking off a verification item, read the command's actual output — not just its exit code. Confirm the command that's supposedly running actually exists (is it a real registered task/script?), confirm it ran against the intended target (right cwd, right fixture, right binary present), and confirm the output shows the assertions you expect to see, not a "no tests found" or "skipped" message dressed up as success.

See `.indusk/planning/jj-residue-rip-out/` (the cleanup-ritual commit `69b861aa`) for the full incident — five instances found in a single plan's audit.

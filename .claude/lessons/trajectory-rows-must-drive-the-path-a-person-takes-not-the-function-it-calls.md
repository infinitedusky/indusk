# Trajectory rows must drive the path a person takes (conversation end, printed message), not call the inner function or build the expected message

**Why:** In a-brief-is-accepted-on-current-main the rows called startPlanning directly (A7, A8) and checked refusal messages the test built itself (A19). They passed while the real admin path was wrong: the conversation-end path swallows a conflict (build-host.ts:318, so a hand-accepted brief with a conflict reads accepted and names no file), and git's own error text passes through unchanged (bring-trunk.ts:144, "commit your changes or stash them").

**How to apply:** For a clause about what a person sees or does, the row should enter where the person enters (the route, the conversation end, the CLI verb) and assert on the text that actually reaches them. Provoke the failure for real in a temp repository, for example an uncommitted edit to a renamed file, and not through a message the test constructs.

Pointer: .indusk/planning/a-brief-is-accepted-on-current-main/audit.md (section "What let these through"); highlight h-20261019-026. Related: list-every-path-to-a-behaviour-before-planning-it.

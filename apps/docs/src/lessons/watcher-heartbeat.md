# Watcher Heartbeat — Lessons

From [watcher-heartbeat](/decisions/watcher-heartbeat), closed 2026-10-03.

## What we learned

**Reachable is not listening.** A health check that only reads cannot tell an
empty backend from a deaf one, so it gives the reassuring answer exactly when
it knows least. Send something and require it back.

**An alarm has four rules, and authoring found two of them.**

- It must not travel the path it reports broken.
- It speaks on a change of state, not on every check.

Falsification found the other two:

- It proves it can record that state before speaking. Otherwise an unwritable
  state file repeats the alarm every pass.
- A restart is not evidence. Otherwise a server restarted while deaf announces
  a recovery that never happened.

**An evaluator grading a branch in that branch's worktree changes it.** It does
more than collide on ports and build locks: during this plan it ran
`git stash` on another agent's uncommitted work. This was the third plan in a
row it interfered with.

**A per-process cache makes tests in one file depend on their order.** A test
counting probes read zero, because an earlier test had already cached the
answer for the same daemon. A test about a cache needs a fresh key.

**Single-definition tests pay off on plans that never knew they existed.** A
pin from an earlier plan, "the Jaeger URL is normalized in one place", caught
two copies this plan wrote.

## What we'd do differently

- **Write the reader's call for the deployed case before accepting the ADR.**
  The intake address was missing from the decision and surfaced mid-build.
- **Commit every file an item touches before checking it off.** A re-export
  missed its commit and was only noticed when the evaluator stashed it.
- **Give a timed path its caller's budget from the first draft.** The probe's
  own wait was checked against the admin's budget only during falsification.

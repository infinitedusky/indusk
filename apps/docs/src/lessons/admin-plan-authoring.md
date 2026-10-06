# Admin plan authoring — Lessons

From [admin-plan-authoring](/decisions/admin-plan-authoring), which made the admin a place to plan, build, review and release.

## Checking `Origin` against `Host` is not a same-origin check

A server bound to `127.0.0.1` is reachable from a page on another site by DNS rebinding. The site points its own name at the loopback address, and its requests then carry an `Origin` and a `Host` that both name that site. Comparing the two only proves they agree. The admin's routes, which can start Claude Code and accept plans, now check the `Host` against the admin's own names first (`127.0.0.1`, `localhost`, `[::1]`, `indusk.dawn`), on every route, reads included. A read that hands out a session's id is exactly what the attack needs next.

## Test "every route is guarded" against the routes, not a list of them

The first version of that test named ten handlers by hand and missed two `GET`s. It now imports every route module, calls every handler each one exports, and checks that the route directories on disk match the modules it imported. A new route fails the test until it is guarded.

## Check a hypothesis about a tool you do not own against the tool

Falsification assumed that a Claude Code allow rule would let a headless planning session write without asking. Run against the real CLI, an untrusted folder's allow rule was not honoured, and the write was asked about. Proving the trusted case would have meant writing `~/.claude.json` while Claude Code writes it. The hypothesis was dropped, not "fixed" on an assumption.

## Two right rules can meet at a seam no plan owns

"A session never commits work that is not its own" and "a plan does not land onto a dirty trunk" were each right. They collided at InDusk's own files, which InDusk writes to `main` and never commits. The plan that hit the collision fixed the symptom: approving and landing commit InDusk's bookkeeping, and the review shows anything else. The cause, writing those files there at all, went to a brief of its own.

## What we'd do differently

- **Hunt a security boundary before the live check.** The rebinding hole stayed open through the whole live check, because the origin check had no test row of its own.
- **Give advisory lessons an enforcer.** Plan documents were edited by script three times, despite a lesson against it, because nothing refused the command.

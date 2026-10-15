---
title: "Decided prompts stay closed"
date: 2026-10-14
status: accepted
workflow: bugfix
description: "During a build, the cockpit shows an Allow/Deny prompt only when a person actually has to choose. A request the build decided on its own never shows as waiting, and once any request is decided it stays done, including after the page reloads."
---

# Decided prompts stay closed — Brief

## Expectations

1. **Watching a build no longer shows prompts that look like they are waiting on you.**
   - Measure: Sandy watches one build in the cockpit and no Allow/Deny prompt shows as undecided unless the build is actually waiting on a person.
   - Look: on the first build run after this plan lands.

## Promises

### This plan makes

1. **`a-prompt-shows-only-when-a-person-must-choose`** (state). The session panel offers Allow/Deny or a question's choices only for a request that is waiting on a person; a request the session decided on its own is never shown as one to answer.

2. **`a-decided-request-stays-decided`** (state). Every request appears in the panel's log; once it is decided, whether by a person or by the session's own rule, it shows as done with its outcome (allowed, or denied with the reason), as if its button had been pressed, and it stays done after the page reloads or the panel reconnects.

### Existing promises

**Must not break**

- **`a-build-runs-to-review-unasked`**. A build keeps deciding its own requests in code; this changes only what the panel shows of them.
- **`a-question-is-answered-in-full`**. The decision card's questions are owned by cockpit-audit-fixes; a question still waiting on a person is still shown in full.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Hiding requests the session decided.** Every request stays in the log, decided (Sandy, 2026-10-14: "it could show up and then automatically look like accept was clicked").
- **Changing how a build decides.** The rule in code (allowed inside the plan's worktree or with no path, refused outside) is unchanged; no session moves to `bypassPermissions`.

## Looks

### This plan makes

1. **`agent-panel.decided`**. The session panel with decided requests: a tool request the session allowed reads *Allowed*, one it refused reads *Denied* with the reason, a question the person answered reads *Answered* with their answer, and a question the build declined reads *Declined* with the reason; none offers a button. Drawn after the build, at acceptance (Sandy, 2026-10-15), since the acceptance check found the panel's change had no look; one-conversation-view (`.indusk/planning/one-conversation-view/`) still draws every session's look.

## Depends On

None.

## Blocks

None. It touches the same session manager as sessions-per-plan (`.indusk/planning/sessions-per-plan/`, in progress), so whichever lands second rebases.

---
title: "Decided prompts stay closed"
date: 2026-10-14
status: draft
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

2. **`a-decided-request-stays-decided`** (state). Once a request is decided, whether by a person or by the session's own rule, the panel shows it as done with its outcome, and it stays done after the page reloads or the panel reconnects.

### Existing promises

**Must not break**

- **`a-build-runs-to-review-unasked`**. A build keeps deciding its own requests in code; this changes only what the panel shows of them.
- **`a-question-is-answered-in-full`**. The decision card's questions are owned by cockpit-audit-fixes; a question still waiting on a person is still shown in full.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Showing every auto-allowed request as a line in the log.** A refused request shows as done with its reason, because a refusal changes what the build does next. Whether an allowed one also leaves a one-line record is open for the review of this brief.

## Looks

None — the session panel's states (an open prompt, a decided one) already exist; this changes which state a request is drawn in, not how either looks.

## Depends On

None.

## Blocks

None. It touches the same session manager as sessions-per-plan (`.indusk/planning/sessions-per-plan/`, in progress), so whichever lands second rebases.

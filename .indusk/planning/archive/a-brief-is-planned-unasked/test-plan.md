---
title: "A brief is planned unasked — Test Plan"
date: 2026-10-18
status: accepted
---

# A brief is planned unasked — Test Plan

## `an-accepted-brief-is-planned-unasked`

Once a person accepts a brief and approves every look it names, an unattended session writes its test plan, its ADR when the workflow has one, and its impl, then stops for the person's approval.

### `starts-on-acceptance` — Accepting a brief starts the planning session when every look the brief names is approved, and when a look is approved last, approving it starts it.

- Signal: the admin's session host; upheld when a planning run starts at acceptance or at the last look's approval; broken reports a run started with a look unapproved, or none started.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | Accepting a brief whose contract passes marks it accepted, and is refused, naming the problem, when the contract check fails. | unit |
| A2 | A planning run starts for an accepted brief whose looks are all approved, waits while one is not, and starts when the last is approved. | unit |
| A3 | A plan whose test plan, ADR and impl already exist, or whose impl is approved, starts no planning run. | unit |

### `each-document-passes-its-check` — The session writes each document the workflow needs in order, and each passes the contract check and the impl's structure check before the next is written.

- Signal: the run's steps; upheld when each step names the next missing document and the run moves on only when that document passes its check.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | The run's next step is the first missing document the workflow needs — test plan, then ADR when the workflow has one, then impl — and a step whose document fails its check is the same step again. | unit |
| A5 | Each planning step is told to write only that document, from the plan's brief and research, to the planner's rules, unattended. | unit |

### `never-approves` — The session never approves the plan, never approves a look and never starts the build.

- Signal: the commands refusing inside a planning step; upheld when approve, look approval and build are refused there.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | Approving a plan, approving a look and starting a build are refused from inside a planning step, naming the step. | unit |

### `decides-and-records` — A choice the documents leave open is decided by the session and recorded with its reason in the document it shapes; one it cannot make ends the session with a blocker saying what it needs.

- Signal: the run's end; upheld when it ends at approval or at a recorded blocker.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | A planning run ends when the impl passes its check, waiting for approval; a step that writes a blocker, or two steps without progress, end it with that reason. | unit |

### `approval-starts-the-build` — Approving the plan starts the unattended build, which runs to review as it does today.

- Signal: the approve action; upheld when an approval is followed by a build starting.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | Approving a plan from the admin starts its build, and an approval refused for any reason starts nothing. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A9 | An accepted brief is planned end to end once on a real plan: the three documents written, each check passing, the run stopped for approval. | live check | a rehearsal of the brief's expectation, recorded once |

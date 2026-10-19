---
title: "A brief is planned unasked"
date: 2026-10-18
status: accepted
workflow: feature
clauses: required
description: "Once a person accepts a brief and approves the looks it names, an unattended session writes the plan's test plan, ADR and impl and stops for the person's approval; approving starts the build, which runs to review as today."
---

# A brief is planned unasked — Brief

Speed item 2 of `current.md`'s next run (Sandy, 2026-10-18): brief in, approve once,
review at the end. Today an unattended build starts from an approved impl (work,
falsify, cleanup, audit, then review); writing the test plan, ADR and impl from an
accepted brief is a planning session a person drives, and approving the plan and then
starting the build are two more manual steps. The looks a brief names are settled with
the brief (Sandy, 2026-10-18): drawn in its conversation and approved before planning
starts, so the unattended part has no visual judgement to make; today their approval is
checked only at plan approval.

## Expectations

1. **Getting from an accepted brief to a plan to approve takes no one's time.**
   - Measure: for plans after this lands, the person's actions between accepting a brief and approving its plan; expect none, and the elapsed time recorded by the phase and plan durations.
   - Look: the next three feature plans.

## Promises

### This plan makes

1. **`an-accepted-brief-is-planned-unasked`** (behaviour). Once a person accepts a brief and approves every look it names, an unattended session writes its test plan, its ADR when the workflow has one, and its impl, then stops for the person's approval.
   - **`starts-on-acceptance`** (split). Accepting a brief starts the planning session when every look the brief names is approved, and when a look is approved last, approving it starts it.
   - **`each-document-passes-its-check`** (split). The session writes each document the workflow needs in order, and each passes the contract check and the impl's structure check before the next is written.
   - **`never-approves`** (limit). The session never approves the plan, never approves a look and never starts the build.
   - **`decides-and-records`** (split). A choice the documents leave open is decided by the session and recorded with its reason in the document it shapes; one it cannot make ends the session with a blocker saying what it needs.
   - **`approval-starts-the-build`** (split). Approving the plan starts the unattended build, which runs to review as it does today.

### Existing promises

**Must not break**

- **`a-plan-is-approved-with-its-looks-approved`**. The looks are still approved by a person; this plan only checks them earlier.
- **`a-build-runs-to-review-unasked`**. The build after approval runs and stops as it does today.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Sending questions with a cost instead of deciding** — `decisions-as-questions` (speed item 4).
- **Drawing mockups unattended** — looks are settled with the brief.

## Looks

None — the admin already shows a plan's running session by kind and lists a plan waiting for approval under Needs you; how an unattended run is shown is the activity page's (`activity-and-graph`).

## Depends On

- `.indusk/planning/archive/archived-plans-are-found/` — landed; an unattended close needs it.

## Blocks

- `decisions-as-questions` — it replaces the session's own decisions with requests.

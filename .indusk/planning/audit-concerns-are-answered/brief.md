---
title: "Audit concerns are answered by the plan's agent"
date: 2026-10-17
status: accepted
workflow: feature
clauses: required
description: "The audit finds what could go wrong; the plan's agent, who has the context, answers each concern with a fix, a signal that would show it breaking, or the reason nothing is needed — and every \"nothing needed\" is put in front of the person."
---

# Audit concerns are answered by the plan's agent — Brief

Split out of [mark-first](../mark-first/) (Tests and telemetry linked to
clauses) on 2026-10-17 (Sandy), where it was the promise
`an-audit-concern-gets-a-solution`, withdrawn there and to be declared here.
Sandy's point: an audit, a fresh reader, is good at finding what is wrong; the
plan's agent, with the build's context, is better at deciding what to do about
it. The guard against the builder waving away a concern about its own work is
that a person sees each "nothing needed".

**The shape, agreed 2026-10-17 (Sandy):** the auditor finds each concern and
says what would show it breaking, and suggests no remedy; the plan's agent
chooses the answer; the person sees every "nothing needed". Considered and
not chosen: the auditor also suggesting a solution for the agent to accept or
replace.

## Expectations

1. **Audit concerns stop being left unanswered.**
   - Measure: in `audit.md` files after this lands, the share of concerns with an answer (fix, signal or reason); expect all.
   - Look: at the next three plans that run the audit.

## Promises

### This plan makes

1. **`an-audit-concern-gets-a-solution`** (state). Each concern an audit raises is answered by the plan's agent with a fix, a signal that would show it breaking, or the reason nothing is needed.
   - **`the-audit-finds`** (split). The auditor raises each concern and says what would show it breaking, and suggests no remedy.
   - **`the-plan-answers`** (split). The plan's agent answers each concern with a fix, a signal (the invariant checked, where it is emitted, how often it would fire, which clause it upholds) or nothing with the reason.
   - **`a-dismissal-reaches-the-person`** (split). Every concern answered "nothing needed" is shown to the person with its reason.

### Existing promises

**Must not break**

- **`an-audit-blocks-nothing`**. The answers change no gate: the retrospective still reads that `audit.md` exists, never what it says.
- **`a-plan-is-audited-by-a-fresh-reader-before-it-closes`**. The audit is still read cold by a reader that has not seen the build.

**Changes**

None.

**Replaces**

None.

### Not promised

- A gate on unanswered concerns. The audit stays advisory.

## Looks

None — a dismissal reaches the person in `audit.md` and in the audit step's report in the session; no screen changes.

## Depends On

- `.indusk/planning/mark-first/` — a signal answer names the clause it upholds, which needs clauses linked to their telemetry. Its promise `a-clause-is-proved-twice` is not yet in the trunk's registry, so this plan does not rest a clause on it; it builds after `mark-first` lands.

## Blocks

- None.

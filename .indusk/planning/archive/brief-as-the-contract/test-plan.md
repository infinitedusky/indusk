---
title: "Brief as the contract — Test Plan"
date: 2026-10-12
status: accepted
---

# Brief as the contract — Test Plan

## Purpose

This document lists the behavioural assertions that, taken together, mean the
brief is the contract: a plan's looks are part of its brief, approval is of the
brief, a change to what was agreed waits for the person, the plan page shows
the parts, and a plan starts as a conversation. Each names its level — the
smallest that can prove it — and so when its test runs, grouped by the promise
in the brief that it proves.

## Behavioural Assertions

### `a-brief-lists-its-looks` — a brief lists the looks it makes, changes, replaces or must not break, or says why it has none

| ID | Assertion (user-visible behaviour) | Level |
|----|------------------------------------|-------|
| A1 | A plan that changes files under an app's interface, whose brief lists no look and gives no reason, is refused at approval, and the refusal names what is missing. | unit |
| A2 | A brief that says "None — {reason}" for its looks is approved when the plan changes nothing under an app's interface. | unit |
| A3 | A look listed under makes, changes, replaces or must-not-break is read as that, so the plan page and the check say the same thing the brief does. | unit |

### `a-look-has-the-plan-that-owns-it` — every approved look records the plan that made or last changed it

| ID | Assertion | Level |
|----|-----------|-------|
| A4 | A look approved in a plan's checkout records that plan, and reading the approval shows it. | unit |
| A5 | A plan's page lists the looks it owns beside its promises, each with its approval. | unit |

### `a-changed-look-keeps-its-history` — a redrawn look is held at its approved version until a person approves the new one

| ID | Assertion | Level |
|----|-----------|-------|
| A6 | A plan that redraws an approved look shows it as proposed while the old version is still the one the app is held to. | unit |
| A7 | After a person approves the new version, the record shows both versions and the plan that changed it. | unit |

### `a-plan-is-approved-with-its-looks-approved` — a plan is approved only with the looks it names approved

| ID | Assertion | Level |
|----|-----------|-------|
| A8 | Approving a plan whose brief names a look that is still proposed is refused, and the refusal names the look; once that look is approved the same plan is approved. | unit |

### `approval-is-of-the-brief` — a person's approval covers the brief; the rest is evidence at review

| ID | Assertion | Level |
|----|-----------|-------|
| A9 | An approval records the brief the person approved, and a brief edited afterwards reads as changed since its approval. | unit |
| A10 | The review shows the test plan, the ADR and the impl as evidence beside the approval, and asks for no separate sign-off on them. | unit |

### `a-change-to-what-was-agreed-needs-the-person` — an amendment waits for a person before the build goes on

| ID | Assertion | Level |
|----|-----------|-------|
| A11 | A promise's statement, an expectation or a look changed after approval is listed on the plan page as waiting on the person, with what it was and what it is now. | unit |
| A12 | While an amendment is waiting, no build item can be checked off; when the person approves it, the build goes on and the review shows both versions. | unit |
| A13 | An amendment is approved only by a person in their browser: the same request from a script or an agent is refused. | unit |
| A14 | A change to an impl item, a note or a Shape finding after approval is recorded in the impl and waits for nobody. | unit |

### `a-plan-page-shows-the-parts-of-its-brief` — the page shows promises, expectations and looks, updated as the agent writes them

| ID | Assertion | Level |
|----|-----------|-------|
| A15 | A plan's page shows its promises, expectations and looks, each with its name and state, and a link one click down to the brief. | unit |
| A16 | A look the agent draws while a person is on the plan's page appears there, at each reference device and proposed, in a real browser. | contract |
| A17 | A promise or a look written by the agent in a live planning session appears on the page without the person leaving it. | live check |

### `a-plan-starts-as-a-conversation` — nothing is asked first; the name is proposed once the plan is clear

| ID | Assertion | Level |
|----|-----------|-------|
| A18 | The page for starting a plan asks for no name and no type before the conversation begins. | unit |
| A19 | Accepting the agent's proposed name and type creates the plan on its own branch and worktree with the draft as its brief; a name already taken is refused and another is asked for. | unit |

### `a-conversation-that-is-not-kept-leaves-nothing-in-the-repository`

| ID | Assertion | Level |
|----|-----------|-------|
| A20 | A conversation not kept leaves no file in any checkout or branch of the project; it is listed on the page as a draft that can be reopened or discarded. | unit |
| A21 | A kept conversation that makes promises or looks becomes a plan with a brief; one that makes neither becomes a research-only plan with no brief. | unit |

### Not for a promise

| ID | Assertion | Level | Why |
|----|-----------|-------|-----|
| A22 | A brief written before this rule, with no looks section, is still approved when its plan changes nothing under an app's interface. | unit | a regression guard over every plan already written |
| A23 | Starting a plan from the terminal (`indusk plans start`) works as before. | unit | a regression guard: the form goes, the command stays |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Starting a plan by talking feels more natural than filling a form. | A matter of a person's experience, not an observable rule. | Expectation 2 and the first three plans' retrospectives record whether approval was made from the brief alone. |
| U2 | The agent proposes a name and type that suit the plan. | The quality of a model's proposal cannot be asserted; only that one is asked for and accepted or edited (A19). | The person accepts or edits every name; a bad proposal is visible at the moment it is made. |

## Notes

- A16 and A17 are the only rows that need a browser or a real session; the
  rest are rules over files and records, fed their inputs directly, so the
  everyday suite stays fast.
- A13 restates an existing rule for amendments, as a guard that the new
  approval path does not open a way around it.
- The levels are the smallest that proves each. A16 is `contract` because the
  question is whether a browser draws the frame; A17 is a `live check`
  because it needs the developer's own `claude` and runs once, recorded in the
  plan.

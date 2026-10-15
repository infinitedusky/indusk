---
description: "You write one document, the brief (its promises, expectations and looks), with the agent and approve it once; making it true is the agent's job. A change to what was agreed waits for you to re-approve it, and a new plan starts as a conversation instead of a form."
title: "Brief as the contract"
date: 2026-10-12
status: accepted
workflow: feature
---

# Brief as the contract — Brief

## Expectations

1. **A plan's promises are settled before its build, so fewer are rewritten or withdrawn once it is under way.**
   - Measure: promises changed or withdrawn after their plan was approved, per plan, counted from each promise's history file, against the last five plans closed before this one
   - Look: after three plans have been approved under the rule

2. **A person approves a plan from its brief alone.**
   - Measure: whether the approval was given without opening the ADR or the impl, recorded in each plan's retrospective
   - Look: at the close of the first plan built under the rule

3. **No plan that changes the interface reaches review with its looks unlisted or unapproved.**
   - Measure: plans that changed files under an app's interface paths against plans whose brief listed a look, from the approval records
   - Look: after three plans have been approved under the rule

## Promises

### This plan makes

1. **`a-brief-lists-its-looks`** (state). A brief lists the looks it makes, changes, replaces or must not break, or says why it has none, and a plan that changes files under an app's interface with none listed is refused at approval.
2. **`a-look-has-the-plan-that-owns-it`** (state). Every approved look records the plan that made or last changed it, and that plan's page shows its looks beside its promises.
3. **`a-changed-look-keeps-its-history`** (state). A plan that redraws an existing look says so in its brief; the approved version stays the one held until a person approves the new one, and the record keeps both with the plan that changed it.
4. **`a-plan-is-approved-with-its-looks-approved`** (state). A plan is approved only after a person has approved each look its brief names, every screen and every new component drawn as its own mockup, and a look still proposed or not yet drawn is named in the refusal.
5. **`approval-is-of-the-brief`** (state). A person's approval covers the brief — its expectations, promises and looks — while the test plan, the ADR and the impl are shown at review as evidence, not signed off.
6. **`a-change-to-what-was-agreed-needs-the-person`** (state). A change during the build to a promise's statement, an expectation or a look updates the brief and waits for a person's approval before the build goes on.
7. **`a-plan-page-shows-the-parts-of-its-brief`** (state). A plan's page shows its promises, its expectations and its looks, each updated as the agent writes them while a person works with it there, with the brief itself one click below.
8. **`a-plan-starts-as-a-conversation`** (state). A person starts a plan by talking to the agent with nothing asked of them first, and the plan is named, once what it promises and how it looks are clear, by the agent's proposal and the person's acceptance.
9. **`a-conversation-that-is-not-kept-leaves-nothing-in-the-repository`** (state). A conversation that has not become a plan is held only outside the repository, as a draft a person can reopen or discard, and accepting its name makes it a plan — with a brief when it makes promises or looks, with research alone when it does not.
10. **`a-new-component-ends-its-plan-with-a-story`** (state). A new component a brief names is drawn as its own mockup before approval, and its plan is accepted only once the component's story is approved and every mockup the brief names composes only approved stories.

### Existing promises

**Must not break**

- **`a-briefs-promises-are-in-the-registry`**. The brief gains a third part, and its promises must still be in the registry and owned by the plan before the build.
- **`a-closed-plan-kept-its-promises`**. An amendment must not let a plan close with a promise no passing test names.
- **`a-changed-promise-keeps-its-history`**. An amendment to a promise's sentence still goes through the change tool, which records the old sentence and why.
- **`a-mockup-is-approved-by-a-person`**. An agent may draw a look and propose an amendment, and must never approve either.

**Changes**

- **`a-plan-builds-only-after-approval`**. A plan leaves `draft` only through `indusk plans approve`, and no build item is checked off on a plan that is not approved or that has an amendment waiting.

**Replaces**

None.

### Not promised

- A promise file per look. A look stays a mockup with its approval record, as the ui-promises decision settled; the brief names it and the record carries the owning plan.
- The test plan, the ADR and the impl going away. The AI still writes them; they are evidence at review, not sign-off.
- A brief for a research-only plan. It has research alone and no promises; `workflow-types` is unchanged.
- Looks matched against their mockups, and a scenario per behaviour promise. Those are mockup-matching and demo-scenarios, steps 3 and 4 of the look series.
- Screen-level stories for every mockup state in the admin. That is an amendment to storybook-components' follow-on, not this plan's.

## Looks

### This plan makes

1. **`plan.parts`**. The plan page's three parts, promises, expectations and looks, each with its name and state first and the brief one link below, and a closed History row under the page.
2. **`plan.drafts`**. The project page's list of drafts, each a conversation not yet kept, with Reopen and Discard.
3. **`plan.new`**. The conversation entry that replaces the New plan form, asking for no name and no type before the talk begins.
4. **`expectation-row.default`**. A new component, an expectation on the plan page with the time to look beside it, drawn on its own so its story can be approved against it (decision 4a).
5. **`expectation-row.due`**. The same component once its time to look has come.
6. **`draft-row.default`**. A new component, one draft in the drafts list with Reopen and Discard.
7. **`draft-row.aged`**. The same component once the draft has gone untouched for days.
8. **`amendment-card.waiting`**. A new component, a change made during the build that waits for the person, shown as was and now with Approve.
9. **`history-panel.closed`**. A new component, the plan's recorded events folded to one row ("History · 5 events"), collapsed by default as Figma's version history is; drawn under the plan's four states.
10. **`history-panel.open`**. The same component opened to the plan's events, each with what happened, who and when, newest first; going back to an earlier point is not drawn.
11. **`plan.history`**. The plan page with its History panel open.
12. **`part-section.closed`**. A new component, one part of the plan page folded to a row: its name and a one-line summary ("Promises · 4 · 1 enforced"), collapsed by default.
13. **`part-section.open`**. The same component opened to what the part holds.
14. **`phase-row.closed`**. A new component, one phase of the plan folded to a row: its name, its items done and its state (done, in progress, not started), collapsed by default; drawn inside the Phases part.
15. **`phase-row.open`**. The same component opened to the phase's items, checked or not, each with the note recorded under it (what shipped, test results, decisions) in smaller, muted text.
16. **`plan.phases`**. The plan page with its Phases part open, every phase a closed row but the one in progress.
17. **`plan.documents`**. The plan page with its Documents part open: each document (research, brief, test plan, ADR, impl) a row with its name and status that opens that document's own page to read; the rows reuse `phase-row.closed`, no new component.

### Existing looks

**Must not break**

None.

**Changes**

- **`plan.needs-you`**. The plan page when it waits on the person, now with its three parts, a closed Phases row, any amendment waiting, and a closed History row.
- **`plan.working`**. The plan page while it is built, now with its three parts, a closed Phases row, the Build control under the building card, and a closed History row.
- **`plan.released`**. The plan page once released, now with its three parts, a Phases row that says every phase is done, and a closed History row.

**Replaces**

None.

## Depends On
- `.indusk/planning/archive/storybook-components/` — closed 2026-10-12; looks include stories, and a changed component reopens the mockups that use it.

## Blocks
- `.indusk/planning/mockup-matching/` and `.indusk/planning/demo-scenarios/` — their briefs are written under this rule.

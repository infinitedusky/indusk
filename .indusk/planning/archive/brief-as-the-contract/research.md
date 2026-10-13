---
title: "Brief as the contract"
date: 2026-10-12
status: complete
workflow: feature
---

# Brief as the contract — Research

## Question

What does it take for the brief to be the one document a person works on and
approves — promises, expectations and looks — with everything else (test plan,
ADR, impl) the AI's job to make true, and for a plan to start as a
conversation instead of a form?

## Background

The conversation that produced this is Sandy's, 2026-10-12, held while
approving [storybook-components](../archive/storybook-components/retrospective.md)'
stories. It started from "what is the experience of making a mockup, talking
to the agent, with the mockup changing as you talk?" and found that nothing
designs it.

What exists today:

- **Mockups are not part of planning.** The planner skill and the brief
  template never mention a mockup. A mockup is a file under
  `.indusk/mockups/<app>/screens/` drawn at any time; a person approves it on
  the Looks page; `indusk plans approve` does not look at it.
- **Approval is one act over four documents.** `indusk plans approve` runs the
  brief check, marks the impl `approved` and merges the documents and declared
  promises to the trunk; it is one-shot, and refuses once the branch has
  changed anything outside `.indusk/` ("it is past approval"). Nothing forces a
  change during the build to go back to the brief; `plans audit-inputs` shows
  the drift at review.
- **A plan starts from a form.** `NewPlanForm.tsx` asks for a type and a
  kebab-case name, then starts the planning session on the plan page. The name
  is a plan's identity (branch, worktree, folder, registry entry), which is why
  it is asked first.
- **The plan page** shows a plan's workflows and its planning session panel
  (the developer's own `claude`, run by the admin), and is live
  (`LiveRefresh`). It does not show a plan's looks; the Looks page does not
  refresh while a mockup is drawn.
- **A look is a screen state or a component state** (ui-promises: "one screen
  in one declared state at one reference device, or a component the app
  renders"); a story is the component form. The storybook-components plan made
  every look approvable, held by value and reopened when a component changes.
- **The ui-promises ADR rejected a promise file per screen** and a new promise
  kind for looks: a look breaks by value, a promise by a violated claim. That
  holds here: a look stays a mockup with its approval record; the brief names
  it and its approval entry records the plan that owns it.

## Findings

### The series this belongs to

The look series is four plans: ui-promises (closed) → storybook-components
(closed) → mockup-matching (3 of 4, draft) → demo-scenarios (4 of 4, draft).
This plan is not one of the four; it is the gate every later brief goes
through, so it is ordered before mockup-matching so their briefs are written
under it.

### What bakes down to what

Looks bake down to stories (a component in a state) and a composed screen;
behaviour bakes down to tests and, once demo-scenarios exists, a scenario with
a fault. A mockup is the pre-code form of a screen look; a story is its built
form, matched against it by mockup-matching. UI behaviour stays ordinary
promises (ui-promises research decision, 2026-10-10).

### A story cannot be pre-approved

A story's snapshot is rendered from the real component, so a story cannot be
approved before the component exists. A new component is therefore drawn as
its own mockup in the brief, approved before the plan, and its story is
approved against that mockup during the build (ADR decision 4a). A story is
never named without a mockup; the earlier "or in words" path was dropped
2026-10-12.

### Verification is only half built

The judges that make "this implementation fulfils the brief" more than the
AI's own report: looks matched against mockups (mockup-matching) and a scenario
per behaviour promise (demo-scenarios) are drafts. Until they exist, a person's
approval is the look's test.

## Decisions

- **The brief is the person's document; the test plan, ADR and impl are the
  AI's job** (Sandy, 2026-10-12). The AI's goal is "this implementation
  fulfils this brief": holds the promises, tracks and returns the expectations,
  matches the looks. The person approves the brief once before the build.
- **A brief holds three things: expectations, promises and looks**
  (Sandy, 2026-10-12). A look is attached to a plan as a promise is: the plan
  makes, changes, replaces or must not break it, and a change overrides the old
  one with its history kept.
- **A change to what was agreed is an amendment** (Sandy, 2026-10-12): updating
  a promise, an expectation or a look during the build updates the brief and
  waits for the person's re-approval. Impl-level changes need no sign-off.
- **A look is named in the brief, not a new registry** (2026-10-12): no file per
  look; the approval record gains the owning plan.
- **Order is free, completeness is checked at approval** (Sandy, 2026-10-12): a
  person may start from a mockup; at approval every interface-touching promise
  names a look and every look the plan adds is named by something.
- **The plan page shows the parts, not the document** (Sandy, 2026-10-12): its
  promises, expectations and looks, with the brief one click below.
- **A plan starts as a conversation** (Sandy, 2026-10-12): nothing is asked
  first; the name is proposed once what the plan promises and how it looks are
  clear. The New plan form (type, name) is removed.
- **The conversation before it is a plan is an unversioned folder of drafts**
  (Sandy, 2026-10-12): machine state, no branch, no worktree.
- **A research-only plan has no brief and no promises** (Sandy, 2026-10-12): a
  kept conversation that promises nothing becomes a spike with research alone;
  `workflow-types` is unchanged.

## Open Questions

- **This plan's own looks.** It changes the plan page (promises, expectations
  and looks as parts; the agent beside them; drafts listed) and removes the New
  plan form, so under its own rule its brief carries looks. The Looks section
  does not exist until this plan builds it, so they are drawn when the section
  does, and recorded in the impl as a first-phase item.
- **How an interface-touching change is detected.** A required Looks section
  (`None — {reason}`) with the check also refusing when a plan changes files
  under an app's declared interface paths.
- **Amendment mechanics.** Whether an amendment is `plans approve` run again
  or its own command, and how the build pauses at the next phase boundary.
- **Drafts ageing.** Unkept drafts reuse the dead-draft archive (makeover);
  the interval is the ADR's to set.

## Sources

- storybook-components retrospective and ADR (closed 2026-10-12).
- ui-promises research and ADR (`.indusk/planning/archive/ui-promises/`), the
  rejected promise-per-screen alternative.
- `apps/docs/src/reference/cli/plans.md` (`approve`, `audit-inputs`);
  `apps/indusk-admin/src/components/session/NewPlanForm.tsx`.
- demo-scenarios brief (`a-promise-has-a-scenario`), promise-devtools draft.

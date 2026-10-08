---
title: "Promise UI — mockups and draft plans"
date: 2026-10-05
status: notes
---

**Status (2026-10-08).** These drafts were written outside the InDusk templates, before either plan was opened, and they describe one UI the project then split in two. The split: **stage 1 is plan-cockpit** (the pages — the promise dashboard, broken first; the promise page with its proof; the plan page as its two workflows with the decision it is waiting on), on the demo's path to the recording; **stage 2 is [contract-ui](../../planning/contract-ui/brief.md)** (the home view as the hierarchy above those pages, premises on top, statuses derived), after the launch. The DevTools plan here waits until after the launch too. Three of the cockpit draft's promises (the Paths nav, decisions in one place, the phone-width nav) are settled when plan-cockpit is opened with `/planner`. Everything below is as first drafted.

# Promise UI: mockups and draft plans

A Path with two plans, in order:

1. **plan-cockpit**: the web UI for plans, Paths and promises.
2. **promise-devtools**: a browser DevTools extension that checks promises against the live UI.

The cockpit comes first because the DevTools extension links into its promise pages ("Start a fix plan", "Open promise page"), and both need the same promise data.

```
mockups/
  plan-cockpit.html        open in a browser; sample data, clickable
  promise-devtools.html    open in a browser; the checks really run against the mock page
path.md                    the Path: order, and why
plans/
  plan-cockpit/
    brief.md               promises, scope, open questions
    test-plan.md           one assertion per line, mapped to promises
    impl.md                phases
  promise-devtools/
    brief.md
    test-plan.md
    impl.md
```

These drafts are written without your Indusk templates. Rename and reshape them to match your real plan files before running them through the contract cycle. The open questions in each brief are the decisions I couldn't make without the repo.

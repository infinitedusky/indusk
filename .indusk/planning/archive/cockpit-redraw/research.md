---
title: "cockpit-redraw"
date: 2026-10-13
status: complete
---

# cockpit-redraw — Research

## Question

What does the cockpit need so its pages look as Sandy meant them, are each
approved once, and close the gaps brief-as-the-contract left?

## Background

brief-as-the-contract (closed 2026-10-13, landed `a31a0742`) built the brief
page, the plan's description and the agent column on its last day by working
the page live with Sandy, not by drawing first. The admin's approved mockups no
longer match what it draws, so those looks read *proposed*. Sandy chose to
redraw them here rather than approve the drift (2026-10-13: "we just add and
improve the nav to this follow-up plan").

## Findings

### The nav Sandy remembers is not the approved one
- The original is `.indusk/research/promise-ui/mockups/plan-cockpit.html`
  (2026-10-08, before plan-cockpit opened): an interactive cockpit whose left
  nav lists every plan in the project with its stage and state. Sandy, on
  seeing it again: "yes! that is what I remember".
- The approved `nav.expanded` / `nav.collapsed` (ui-promises, 2026-10-12) are
  a smaller redraw: project and count, Needs you, In flight, Promises, Looks.
  No Scorecards; the plan tree (Paths, the master's execution order, Archived,
  research) is drawn by no mockup — the admin overview calls it "the app's
  own". Sandy: "it's not sort of fitting with the aesthetic perfectly."
- The nav is a fixed `--size-nav` (280px); plan names truncate
  (`dawn-ui-plan…`). Sandy wants to drag it wider.

### Pages that read proposed after brief-as-the-contract
- The plan page: the description, "The brief is incomplete" as the current
  step, the rail's steps as links.
- The brief page (`/plan/{name}/brief`): parts and brief on the left, the
  agent in a window-tall column (30%) on the right that follows what it writes.

### Plan-page sections dropped in brief-as-the-contract's Build Phase 4
Papers, the workflow-type chip, the missing-documents sentence, falsification
hypotheses and skipped-ritual reasons went when the page was held to its
mockups. The audit flagged that no brief said so.

### Audit leftovers (brief-as-the-contract `audit.md`)
- `indusk plans reapprove` (and `plans start --from-draft`) run from an agent's
  Bash call go through; the ADR took this as a convention, the promise
  sentences don't carry it.
- `a-plan-builds-only-after-approval`'s clause "or that has an amendment
  waiting" has no trajectory row; check-gates' amendment tests prove it but
  name no promise.

### Existing nav promises this comes near
`every-plan-is-one-click-away`, `paths-keep-their-order`,
`decisions-wait-in-one-place`, `broken-promises-come-first`,
`a-promise-sits-in-its-innermost-path`, `the-nav-fits-a-phone`.

## Decisions

- Start the nav from the original cockpit mockup, redrawn on the current
  foundation, with Scorecards and a drag handle (Sandy, 2026-10-13).
- The dropped plan-page sections stay gone unless the redrawn plan page draws
  them — a page draws what its approved mockup draws and nothing else (Sandy,
  2026-10-13: "yes to all").
- A draft drawing its own looks is a later plan; it changes where drafts keep
  files (Sandy, 2026-10-13).
- Planning sessions keep brief-as-the-contract's folder boundary (asks only to
  leave its folder); not revisited here.

## Open Questions

- Whether the nav's width is remembered per browser (as the collapse choice is)
  or per project.

## Sources

- `.indusk/research/promise-ui/mockups/plan-cockpit.html`
- `.indusk/planning/archive/brief-as-the-contract/{retrospective,audit}.md`
- `.indusk/mockups/admin/screens/nav.*.html`, `components/nav.*.html`
- `apps/docs/src/reference/admin-ui/overview.md` (The nav; The brief page)

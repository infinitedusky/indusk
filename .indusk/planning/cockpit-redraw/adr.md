---
title: "cockpit-redraw"
date: 2026-10-13
status: accepted
---

# cockpit-redraw

## Goal

**The cockpit looks as Sandy meant it — the nav from the original cockpit mockup, a width you can drag, the brief page and plan page drawn — each look approved once, and re-approving a brief is a person's alone.**

brief-as-the-contract built the brief page and the plan's description by
working the page live, so the admin no longer draws what its approved mockups
draw; the approved nav is a smaller redraw of the one Sandy remembers, and plan
names truncate in it. And an agent could run `indusk plans reapprove` from a
terminal, which the audit found.

## Y-Statement

**In the context of:**
an admin held to mockups a person approves, whose plan and brief pages changed after their mockups were approved, and whose nav lost the full plan list of the original cockpit mockup,

**Facing:**
looks that read proposed on every page, a nav whose names truncate at a fixed width, and a re-approval an agent can run from a terminal,

**We decided for:**
redrawing the nav from `.indusk/research/promise-ui/mockups/plan-cockpit.html` on the current foundation with Scorecards, the plan tree and a drag handle; a nav width kept per browser like the collapse choice, bounded by two foundation sizes; drawing the brief page and redrawing the plan page as they are built; and the looks guard refusing an agent's `plans reapprove` and re-approve route as it refuses an agent's look approval,

**And against:**
a width kept in the project's config, a CLI refusal keyed on an environment variable, approving the drifted pages as they are, and a second guard hook,

**To achieve:**
a cockpit Sandy recognises, read whole, approved once, and a contract only a person re-signs,

**Accepting:**
that the guard is a tripwire on a command's text, not a boundary against a script, as the looks guard already is,

**Because:**
each piece reuses what holds: the collapse choice is already remembered per browser, the guard already keeps a look's approval to a person, and the mockup check already holds a page to its look by value.

## Context

Research: [research.md](research.md). Contract: [brief.md](brief.md).
Assertions: [test-plan.md](test-plan.md).

## Decision

1. **The nav is redrawn from the original cockpit mockup.** `nav.expanded` is
   redrawn on the current foundation: project, Needs you, the views
   (Scorecards, Promises, Looks), then every plan under its Paths with its
   stage, Archived folded. The plan tree is drawn, so it is held like the rest.
   `nav.wide` draws it dragged wider; `nav-handle` is a new component drawn on
   its own (`default`, `dragging`).

2. **The nav's width is the person's, per browser.** `CockpitFrame` keeps the
   width in `localStorage` (`indusk-admin.nav.width`) beside the collapse
   choice, applies it as the nav column's width above 760 px, and clamps it
   between `--size-nav` and a new foundation size `--size-nav-max`. Below
   760 px there is no handle (`the-nav-fits-a-phone`). Collapsing keeps the
   width for when the nav expands again.

3. **The brief page and plan page are drawn as built.** `brief.writing` and
   `brief.approved` draw the brief page (parts and brief left, the agent's
   window-tall column right); the four plan screens are redrawn with the
   description at the top. The pages are then matched to their mockups, and
   `a-plan-page-shows-the-parts-of-its-brief` is changed to the sentence the
   brief states, in the phase that makes it true.

4. **Re-approval joins the looks guard.** `looks-approval-guard.js` also
   refuses an agent's Bash command that runs `plans reapprove` or names the
   re-approve route (`/api/plans/<name>/reapprove`). The route already
   requires the person's browser (`Sec-Fetch-Site: same-origin`); the person's
   Approve on the amendment card is unchanged.

## Alternatives Considered

### The nav width in `.indusk/config.json`
Rejected. A width is a person's preference on a screen, not the project's; the
collapse choice is already per browser, and a config write from the page would
be the admin's first write to project files outside its routes.

### Refusing `reapprove` when an agent's environment variable is set
Rejected. A person's own terminal inside an editor that runs Claude Code can
carry the same variable, so it would refuse the person; the guard reads the
agent's tool call, which is what is in question.

### Approving the pages as they are drawn today
Rejected by Sandy: the nav does not fit the cockpit's look, and the brief page
was never drawn.

### A second guard hook for person-only commands
Rejected. One guard already holds what only a person approves; a second would
be two homes for one rule.

## Consequences

### Positive
- The cockpit reads as one look, approved once.
- Plan names are read whole.
- Re-approval is the person's in the terminal as in the browser.

### Negative
- The guard reads a command's text; a script that builds the command is not
  seen, as with look approval.

### Risks
- A wide nav squeezes the brief page's two columns. Mitigation: the width's
  upper bound is a foundation size, and `brief.writing` is drawn at the
  reference devices.

## Documentation Plan

### Pages
- Update: `reference/admin-ui/overview.md` (the nav, its width, the brief page),
  `reference/cli/plans.md` (`reapprove` is a person's).

### Diagrams
- None.

### Changelog
- Changed — "The cockpit is redrawn: the nav lists every plan as the original
  cockpit did and drags wider, and the brief page is drawn; re-approving a
  brief is a person's alone."

### ADR in Docs
- Yes: `decisions/cockpit-redraw.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/planning/archive/brief-as-the-contract/` — the pages this redraws, and the audit
- `.indusk/research/promise-ui/mockups/plan-cockpit.html` — the original nav

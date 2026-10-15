---
title: "main-suite-green"
date: 2026-10-14
status: draft
workflow: bugfix
description: "Makes `pnpm test` pass on main again: fixes the contract check that refuses a large impl at random, brings four stale tests up to the behaviour they guard, stops in-flight plans' approved looks from failing the component check, and fixes two admin tests that time out when every package runs at once."
---

# main-suite-green — Brief

## Expectations

1. **Landing a plan stops turning up failures that are not its own.**
   - Measure: the failures `pnpm test` reports at the next three landings, each traced to the plan landing or not (today: 7 in `apps/indusk-mcp`, 2 more in the admin from the root, none from the plan that landed).
   - Look: at the next three plan landings.

## Promises

### This plan makes

1. **`the-everyday-suite-passes-on-main`** (state). `pnpm test`, run from the root of a clean main with every package at once, passes.
2. **`a-large-impl-gets-the-same-contract-answer`** (state). The contract check gives the same answer for an impl of any size every time it runs, so a large impl is never refused at random when it is written.

### Existing promises

**Must not break**

- **`a-break-reaches-the-working-agent`**. Its inbox test is pinned to a clock here; the reminder an incident over a day old gets stays as decided.

**Changes**

- **`a-component-has-one-implementation`**. Each component the mockups of a landed plan name is implemented once in the app, and every screen renders that one implementation rather than its own copy.

**Replaces**

None.

### Not promised

- Repairing the two archived impls that cite rows they do not have (browser-template-claims, untrack-mcp-json): they are recorded as known failures in the corpus test, and the archive stays as written.
- Re-approving cockpit-audit-fixes: this plan adds its brief's missing `## Looks`, and the re-approval is the person's, in the cockpit.

## Looks

None — this plan changes tests, a CLI's stdin read and another plan's brief; nothing under an app's interface.

## Depends On
- None.

## Blocks
- None.

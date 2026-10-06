---
title: "publish-hygiene"
date: 2026-10-06
status: accepted
workflow: bugfix
---

# publish-hygiene — Brief

*Opened when `pnpm release` for 1.63.0 failed twice and its output could not
be read (Sandy, 2026-10-06: "the npm notices are too long, they take up the
terminal"). Accepted in that conversation: "yes do that". Three defects stood
between a release commit and a publish, and they are fixed together because
the release commit is re-cut once, after all three.*

## Expectations

None — a bugfix: `pnpm release` for 1.63.0 running clean, and readable, is the point.

## Promises

### This plan makes

None.

### Existing promises

**Must not break**

- **`a-plan-can-start-from-the-admin`**. Its contract test (admin-plan-authoring
  A5, `session-protocol-contract.test.ts`) failed both release runs. The model,
  started from a plain terminal, sometimes answered "DENIED" without trying to
  write (2 of 9 runs observed); nothing was asked because nothing was tried.
  The promise held each time a write was attempted; the test must ask the
  question the promise makes, not depend on the model's choice to try.

**Changes**

None.

**Replaces**

None.

### Not promised

- A smaller admin bundle beyond dropping what never runs (source maps, build
  trace, generated types). Shipping the admin pre-built stays the decision of
  `/decisions/admin-ui-hosting`.
- Changing what `pnpm release` runs, or when (`release-checks-run-once` owns that).

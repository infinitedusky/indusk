---
title: "The admin knows the package root"
date: 2026-10-19
status: accepted
workflow: bugfix
description: "Inside the admin daemon, code that finds the package's shipped files gets the package root the indusk command that started it handed down, so the planning run's last check works there."
accepted_at: "2026-10-19T03:15:36.110Z"
---

# The admin knows the package root — Brief

Found 2026-10-19: the unattended planning runs of `mark-first` and
`a-plan-says-how-long-it-took` wrote all three documents and then stopped "cannot
continue": inside the admin's production bundle, `induskMcpPackageRoot()` resolves a
wrong folder (`.../dusk/apps/apps/indusk-mcp/dist/lib`) because the bundler rewrites the
module's own location, so the planning reader cannot find the shipped impl hook. The
`indusk` command that starts the admin (`daemonStart`, `lib/admin/daemon.ts`) resolves
the root correctly and already hands the daemon its environment.

## Expectations

None — a bugfix; the planning run reaching "ready for approval" is the outcome.

## Promises

### This plan makes

None.

### Existing promises

**Must not break**

- **`an-accepted-brief-is-planned-unasked`**. Its run stops at "ready for approval", not "cannot continue", once this lands.

**Changes**

None.

**Replaces**

None.

### Not promised

- Nothing else.

## Looks

None — the daemon's environment and a server module only.

## Depends On

- None.

## Blocks

- None.

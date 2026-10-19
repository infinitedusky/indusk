---
title: "Lessons from the-admin-knows-the-package-root"
date: 2026-10-19
---

# Lessons from `the-admin-knows-the-package-root`

A bugfix: code the admin bundles could not find the package's shipped files, because the bundler rewrote the module's own location. The fix hands the package root down the environment from the `indusk` command that starts the admin. Three lessons carry beyond this bug.

## A handed environment value belongs to the process it was handed to

The first build passed the root to the admin's daemon and trusted it when it held this package. The falsification phase found the daemon's environment also reached every Claude session the admin started; inside such a session, an `indusk` on the path would trust a root that named a different install. The fix scopes the value to the one process it is handed to and drops it from the sessions the admin starts, with a regression guard.

Rule: when a value is handed through an environment, ask which children inherit it, and whether each child's meaning of the value is the same.

## A bundler-only bug needs its outcome checked in the built artifact

The bug exists only in the bundler's output. Unit rows over the source passed while the fault stayed in the bundle. The outcome rows (the lookup inside the admin started by `indusk ui`, and a planning run ending "ready for approval") are live checks, and they were left as manual procedures at close.

Rule: when a bug only appears after bundling, a test over source proves the logic, not the fix. Name the built-artifact check as part of the promise, and run it before calling the plan proven.

## A daemon keeps the environment it was started with

`indusk ui` does not restart a running admin, so an admin started before the upgrade keeps the old behaviour after `pnpm install:local`. Any fix that depends on a daemon's launch environment needs an explicit restart at landing. The trust check also turns a stale handed root into the original failure, and nothing logs the rejection; logging it is the follow-on.

Rule: a fix delivered through a long-running process's launch environment is not live until that process restarts.

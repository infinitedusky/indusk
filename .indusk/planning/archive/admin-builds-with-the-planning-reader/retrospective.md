---
title: "The admin builds with the planning reader"
date: 2026-10-19
---

# The admin builds with the planning reader — Retrospective

## What Happened

Landing `a-brief-is-planned-unasked` broke `pnpm install:local` on main: the admin's
production build (Turbopack) failed with "Module not found: Can't resolve <dynamic>"
in the planning reader. The brief named the cause as the hook path built from
`import.meta.url`; fixing that alone did not build. The real cause was
`spawnSync("node", [path])`, which Turbopack reads as loading a script and resolves at
build time. Running it through `process.execPath`, as `lib/run/gate.ts` already does,
built. T1 now guards both.

## What We Learned

- **Turbopack resolves `spawnSync("node", [path])` at build time** in code the admin
  bundles; use `process.execPath` (now in the package context file).
- **Nothing builds the shipped package before landing.** On the hardening list in
  `current.md`.

## Metrics

- Two lines changed; the admin's production build passes in the worktree.
- Falsification, cleanup and audit skipped with reasons (Sandy approved, 2026-10-19).
- Shape findings: 0 raised, 0 judged wrong.

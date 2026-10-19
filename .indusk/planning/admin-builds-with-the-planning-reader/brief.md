---
title: "The admin builds with the planning reader"
date: 2026-10-19
status: accepted
workflow: bugfix
description: "The admin's production build succeeds again: the planning reader finds the shipped impl hook through the package root at run time, not through a path the bundler tries to resolve."
---

# The admin builds with the planning reader — Brief

Found landing `a-brief-is-planned-unasked` (2026-10-19): `pnpm install:local` failed
because the admin's production build (Next.js, Turbopack) could not resolve the path
`lib/build/read-planning.ts` builds from `import.meta.url` to the shipped
`hooks/validate-impl-structure.js` ("Module not found: Can't resolve <dynamic>"). The
plan's code is on main, and this machine's `indusk` is still the previous build. Other
admin-loaded code finds shipped files through `induskMcpPackageRoot()`.

## Expectations

None — a build fix; the landed build installing is the whole outcome.

## Promises

### This plan makes

None.

### Existing promises

**Must not break**

- **`dusk-installs-its-own-build`**. Broken by the landing above; this plan restores it.

**Changes**

None.

**Replaces**

None.

### Not promised

- Nothing else.

## Looks

None — a server module only.

## Depends On

- None.

## Blocks

- The live check of `a-brief-is-planned-unasked`, which needs the installed build.

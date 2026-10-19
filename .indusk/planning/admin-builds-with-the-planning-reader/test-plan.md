---
title: "The admin builds with the planning reader — Test Plan"
date: 2026-10-19
status: accepted
---

# The admin builds with the planning reader — Test Plan

## `dusk-installs-its-own-build` (must not break)

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | The planning reader finds the shipped impl hook through the package root when it runs, and the file exists there. | unit |
| A2 | The landed build installs: `pnpm install:local` succeeds and `indusk` runs the landed version. | live check |

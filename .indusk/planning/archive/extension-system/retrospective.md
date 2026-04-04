---
title: "Extension System"
date: 2026-03-24
---

# Extension System — Retrospective

## What We Set Out to Do
Replace hardcoded tool knowledge with a plugin system. One system, two sources: built-in extensions (ship with package) and third-party extensions (pulled from npm/github/local via add command).

## What Actually Happened
Extension system built with manifest spec, CLI (7 commands: list, enable, disable, add, remove, status, suggest), 10 built-in extensions (falkordb, cgc, nextjs, tailwind, react, solidity, typescript, testing, docker, vitepress). Domain skills folded into extensions. composable.env was the first third-party extension — manifest added to its package, pulled via `extensions add composable-env --from npm:composable.env`.

## Getting to Done
- Skill audit revealed massive duplication across skills — CGC mentioned in 5 places, lessons in 3
- Domain skills directory removed — extensions replaced them entirely
- npm fetch for third-party extensions was broken initially (looked in node_modules without installing)
- The composable.env extension manifest required coordination between two repos

## What We Learned
- One system, two sources is the right model — built-in vs third-party is just where the manifest comes from
- Extensions that provide skills, health checks, and verification in one manifest are more useful than skills alone
- The extension manifest spec needs to be published and documented for third parties
- Skill cleanup (removing duplication) should happen before adding new systems, not after

## What We'd Do Differently
- Would have done the skill audit first, then built the extension system — cleanup before building is cheaper
- Would have tested the npm fetch path before publishing

## Quality Ratchet
No new Biome rules.

## Metrics
- Sessions spent: 2
- Files touched: 25+ (extension loader, CLI, 10 manifests, skill cleanups, tools refactor)
- Extensions: 10 built-in, 1 third-party (composable-env)

---
title: "Guinea-pig: semver CLI — Brief"
date: 2026-07-26
status: accepted
audience: orchestrator
fixture: dawn-external-orchestrator
---

# Guinea-pig: semver CLI — Brief

The acceptance guinea-pig for [dawn-external-orchestrator](../../../../.indusk/planning/dawn-external-orchestrator/brief.md). A deliberately small, edge-case-rich CLI that forces the full lifecycle loop and has **at least one phase whose checkoff genuinely depends on green tests** — so tests-first is real, not decorative. Chosen over the CSV↔JSON candidate at impl Phase 0 (ADR "Open questions").

**This directory is a fixture, not an active plan.** It lives under `apps/indusk-mcp/fixtures/`, deliberately outside `.indusk/planning/`, so it is never picked up by `check-gates` or the plan lifecycle. Phase 0 only *creates* it; later phases point `indusk run` at it and drive the loop that fills in the source + tests.

## Problem

We need one tiny program the external orchestrator can build end-to-end, cheaply, across the model × environment matrix — small enough that a full run costs little, real enough that a gate must actually block a premature checkoff.

## Proposed program

A `semver` CLI with three pure operations:

- **parse** — `"MAJOR.MINOR.PATCH"` → `{ major, minor, patch }`; reject anything that is not three dot-separated non-negative integers with no leading zeros.
- **compare** — order two versions by major, then minor, then patch → `-1 | 0 | 1`.
- **bump** — `bump(version, "major" | "minor" | "patch")` increments the named field and zeroes every lower field.

Edge cases that make tests-first meaningful: leading zeros (`01.2.3` invalid), missing/extra segments, non-numeric segments, and the zeroing rule on bump (`bump("1.4.9", "minor") === "1.5.0"`).

## Scope

### In scope
- The three pure functions + a thin CLI wrapper (`semver parse|compare|bump`).
- Vitest tests covering the edge cases above — the gate the loop must satisfy.

### Out of scope
- Prerelease / build-metadata (`-rc.1`, `+build`) — keeps the guinea-pig minimal.
- Publishing, network, or filesystem side effects.

## Acceptance

Phase 1 cannot be checked off until the parse/compare/bump tests are green (trajectory rows T1–T3). That single hard gate is the whole point of the fixture: it is what the orchestrator's Tier-1 enforcement must hold identically across models.

---
title: "GSD-Inspired Improvements — Retrospective"
date: 2026-03-27
---

# GSD-Inspired Improvements — Retrospective

## What We Set Out to Do
Adopt 7 patterns from GSD-2 into InDusk: lessons registry, verification auto-discovery, forward intelligence, blocker protocol, workflow templates, boundary maps, and domain skills registry. All as skill updates + MCP tools + CLI changes.

## What Actually Happened
All 7 patterns were implemented across 6 phases. The plan was large (the biggest in the project so far) but each phase was well-scoped and completed cleanly. The domain skills registry (Phase 5) was later superseded by the extension system — domain skills became extensions with manifests, auto-detection, and enable/disable. The `skills/domain/` directory was removed.

Key evolution post-impl:
- Domain skills → extensions (separate plan: extension-system)
- `list_domain_skills` → `extensions_status`
- `init --skills x,y` → `extensions enable x y`
- Gate enforcement was added via hooks (separate plan: enforce-plan-gates, gate-policy-enforcement) after the exception.md documented a session where all gates were bypassed

The exception.md in this plan's directory is historically significant — it documented the exact failure mode that led to hook-based gate enforcement. The agent completed all 7 phases without calling `advance_plan` once, skipping verification, context, and document items. This proved that instructional enforcement alone isn't enough.

## Getting to Done
- 6 phases, all completed in order
- Lessons registry shipped with 8 community lessons — this has been valuable across projects
- Verification auto-discovery works well — `quality_check` detects biome, tsc, vitest automatically
- Forward intelligence and blocker protocol work but are underused — agents tend to skip writing forward intelligence
- Workflow templates (bugfix, refactor, spike, feature) are used regularly and reduce ceremony appropriately
- Teach mode (`/work teach`) was added during Phase 3 as a bonus feature

## What We Learned
- Large plans (6 phases, 40+ checklist items) work when each phase is self-contained with clear boundaries
- Domain skills needed to evolve into a more structured system (extensions) — the flat markdown approach didn't scale for detection, enable/disable, and per-extension config
- The exception.md pattern (writing up a process failure as a document in the plan directory) is an effective way to capture what went wrong and propose fixes. It led directly to two follow-on plans.
- Instructional enforcement ("the skill says REQUIRED") doesn't work — agents optimize for speed and skip non-enforced steps. Hooks are the enforcement layer.

## What We'd Do Differently
- Would have designed the domain skills as extensions from the start instead of flat files — the migration cost time
- Would have added gate enforcement hooks as part of this plan, not as a follow-on — the exception.md failure was predictable
- Forward intelligence sections should be shorter and more formulaic — agents tend to skip them when they're freeform

## Insights Worth Carrying Forward
- Community lessons are the most durable artifact from this plan — they survive across projects and sessions
- Verification auto-discovery eliminates a class of "forgot to run checks" errors
- The exception.md pattern is worth keeping — when a process fails, write it up immediately while the details are fresh
- Hook enforcement > instructional enforcement, always

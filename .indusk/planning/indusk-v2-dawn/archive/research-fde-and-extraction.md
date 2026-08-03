---
title: Dawn fork-and-extract pattern + unified architecture (thread distillation)
date: 2026-05-01
status: research-note
destination: dusk planning system (`/Users/the_dusky/code/sandbox/dusk`)
catalyst: Avoca engagement (dawn-fde-toolkit) — surfaced while planning AutoOps reschedule work
---

# Dawn fork-and-extract pattern + unified architecture

Distillation of a session-long thread to bring into dusk's planning system. The Avoca engagement was the catalyst (specifically: thinking about how to deliver clean dev environments for FDE work without polluting client codebases), but the design lives at the Dawn level.

---

## The core pattern: permanent fork + dev layer + PR-extraction

For long FDE engagements working in a client's monorepo:

- Maintain a **permanent fork** of the client's main repo, continuously rebased against upstream
- Build a **dev layer** into the fork: rich tooling, test fixtures, observability, dev admin pages, scratch utilities — anything that makes you faster
- For each task: branch off the fork, do work in-place
- **PR submission** = a Dawn-driven extraction script that identifies the production-code delta (vs the dev-layer delta) and pushes a clean branch to upstream
- Reviewers get **viewing access** to the dev-layer artifacts (tests, traces, observability) via Dawn-served signed URLs or ephemeral preview deploys, *not* via commits in their repo

### When this pattern earns its weight

- Long engagements where dev-tooling investment compounds
- Repeated PRs against the same upstream
- Cultures that don't want extensive testing/observability committed in their main repo
- Multiple FDEs working in parallel against the same upstream

### When it's overkill

Only relevant if you build it from scratch each time. **Once Dawn ships this as a primitive, the per-engagement cost is trivial** — every future engagement gets it for free. So the cost-benefit is at the Dawn-investment level, not the engagement level.

---

## Unified Dawn architecture: system vs worktree scope

The fork-and-extract pattern requires a clean split between:

| Scope | What lives there |
|---|---|
| **System Dawn** (project-shared) | Planning artifacts, work tracking, Graphiti memory, lessons, project context (CLAUDE.md), feedback memories |
| **Worktree Dawn** (per-instance) | Test suite for that worktree's changes, OTel instrumentation rules + emitted spans, specific code mods, local fixtures |

**Seam:** project-shared knowledge vs worktree-specific execution state.
- Plans transcend worktrees — one `feat/autoops-reschedule` worktree shouldn't own its own plan dir; the plan lives at the project level
- Tests don't transcend — you don't want worktree A's tests fighting worktree B's

**Concrete implication:** each worktree gets a thin `.dawn/` config pointing at the parent project's system Dawn. The Dawn MCP knows "this worktree belongs to the Avoca engagement; use the parent's planning/graphiti/lessons." But test execution + OTel rule application happens in-worktree.

---

## Why marker-based extraction is fragile

Initial naive design: inline OTel insertions wrapped with `// dawn-start` / `// dawn-end` comments, extracted via mechanical text manipulation.

**Where it breaks: refactors.** When upstream:
- Renames a function — markers point to a function that no longer exists at that name
- Splits a function into two — original span has no clear home
- Moves a file (e.g., `lib/vapi/tools/handlers/autoOpsCancelBooking.ts` → `lib/tools/autoops/cancelBookingTool.ts` per Avoca's playbook) — markers are in a file that's gone
- Changes a function signature — span attributes reference parameters that don't exist

The merge-conflict surface itself is tractable (small, frequent, mostly mechanical). The refactor-resilience problem is fundamentally harder.

---

## The right design: declare-rules + AST-aware re-application

Instead of "insert OTel + extract via markers," the Dawn primitive should be:

> Declare instrumentation rules. Apply them by AST analysis on each upstream sync.

**Examples of rules:**
- "Every async function in `lib/vapi/tools/` gets a tool-call span with `otel.category: 'vapi-tool'`"
- "Every async function exported from `apps/web/lib/<crm>/` gets a CRM-API span with `otel.category: 'crm-egress'`"
- "Every Next.js API route handler gets request/response timing"

**How it works:**
1. Dawn parses the codebase to AST (via TypeScript compiler API, Babel, or Tree-sitter)
2. Visits nodes matching the rule's selector
3. Inserts decorator imports + decorator calls (or wrapper functions) at matched nodes
4. On upstream merge: re-runs the same AST analysis on the new upstream — refactors don't break instrumentation because rules don't track *where* spans go, they track *what kind of function* gets one

**Better than inline strings because:**
- Survives function renames (rule re-matches the renamed function)
- Survives file moves (rule visits the new location)
- Survives signature changes (decorator doesn't reference internal params)

**Bonus:** the same rule-engine could apply to test scaffolding, OTel spans, anything else that needs to live in production code structurally rather than be authored manually.

---

## Most Dawn features don't need to live in upstream code at all

Important clarification: of Dawn's surfaces, only **OTel instrumentation** actually needs to be peppered into the production codebase. The rest:

- **Planning artifacts** — live in `.dawn/planning/` directory, never touch production code
- **Graphiti** — runs as a service, no source code coupling
- **Test suites** — live in their own files (`__tests__/` directories), separable from production code
- **Lessons / context / memory** — Dawn-internal storage

So fork-and-extract complexity is mostly a problem for OTel specifically. Other Dawn features can be added/extracted as discrete file additions, which are easy. This simplifies the design considerably.

---

## Synthetic test target for Dawn development

For iterating on the AST-instrumentation engine, build a small Next.js app inside dusk's repo:

- **Location:** `apps/dawn-test-target/` (in dusk)
- **Stack:** minimal Next.js
- **Surface:** 3-5 API routes covering the patterns Dawn needs to instrument:
  - A sync handler
  - An async handler with external calls
  - An error path
  - A handler with middleware
  - Mock business logic (no real DB, no external APIs)

Goal: provide a target for Dawn's instrumentation rules with realistic shape but zero external complexity. Iterate the rule engine against it. When it works, apply to a real engagement target (avoca-next when the time comes).

---

## What this thread enables

When this Dawn primitive ships, the Avoca engagement (and every future FDE engagement) gets:

1. A permanent fork of the client repo with rich dev tooling
2. Mechanical AST-driven OTel instrumentation across the whole codebase
3. Per-task worktrees with isolated test execution
4. PR-extraction scripts that produce clean upstream branches (production code only, or production code + tests depending on culture)
5. Reviewer access to dev artifacts via signed URLs
6. Unified planning + memory across all engagement worktrees, isolated test execution per worktree

This is the **"how do FDEs work cleanly in client codebases without polluting them?"** problem solved as a Dawn primitive instead of as ad-hoc per-engagement effort.

---

## Open questions to resolve in dusk's planning

- Rule-engine syntax: TypeScript decorators? AST-visitor functions? DSL? Configuration files?
- AST-library choice: TypeScript compiler API (most accurate, TS-only) vs Babel (broader language support, JS-first) vs Tree-sitter (multi-language, faster, less idiomatic for TS)
- How does the rule engine handle conflicts between Dawn's instrumentation and human-authored OTel that already exists upstream?
- Reviewer-access UI: signed URLs, ephemeral preview deploys, GitHub bot comments with links, or something else?
- Conflict resolution during upstream rebases — automated, semi-automated, or manual?
- How does worktree-level Dawn discover its parent system Dawn? Path-based? Config file? MCP discovery?

---

## Status

Captured 2026-05-01 in `dawn-fde-toolkit/.indusk/research/`. Move into dusk's planning system when starting the formal Dawn V2 work. The Avoca engagement (Plans D/E/F for AutoOps reschedule) continues here in parallel — the Dawn work doesn't block the engagement work.

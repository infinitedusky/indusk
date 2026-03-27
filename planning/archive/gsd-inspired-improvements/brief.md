---
title: "GSD-Inspired Improvements"
date: 2026-03-20
status: accepted
---

# GSD-Inspired Improvements — Brief

## Problem

Our dev system is process-complete (plan → work → verify → context → document → retrospective) but lacks several patterns that GSD-2 has proven valuable: experiential knowledge capture, automatic verification discovery, forward intelligence between phases, blocker escalation, and workflow templates that reduce ceremony for common tasks. These gaps mean the agent forgets lessons, requires manual verification setup, and treats a typo fix the same as a full architecture change.

## Proposed Direction

Adopt 6 patterns from GSD-2, adapted to our MCP + skills architecture:

1. **Lessons registry** — a `.claude/lessons/` directory with two layers: community lessons that ship with the package (starter set of proven patterns like "never use fallback values where a value is expected") and personal lessons the dev builds up over time. `init` installs community lessons, `update` syncs new community ones without touching user-created files. The agent reads all lessons at session start. Lessons are portable (committed to git), shareable (team members benefit), and grow with the developer.

2. **Verification auto-discovery** — the verify skill and `quality_check` tool auto-detect available checks from package.json scripts (`typecheck`, `lint`, `test`, `build`). Manual specification in impl docs becomes optional override, not the default.

3. **Forward intelligence** — context updates after each phase include a "Watch out for" section warning about fragile areas and downstream risks. The next phase reads these before starting.

4. **Blocker protocol** — impl docs get a `blocker:` field. When a task discovers the plan is invalid, set `blocker: {description}` and stop. The work skill checks for blockers before advancing.

5. **Workflow templates** — pre-built plan templates for common work types that skip unnecessary ceremony:
   - `bugfix` — brief + impl only, no ADR
   - `refactor` — brief + impl, boundary map required
   - `spike` — research only
   - `feature` — full lifecycle (current default)

6. **Boundary maps** — impl docs get a `## Boundary Map` section listing what each phase produces and consumes (exports, types, endpoints, config). Makes integration points explicit.

8. **Teach mode** — `/work teach` slows down execution to a mentoring pace. Before each edit: explain what and why, then wait. After each edit: explain what changed and what to notice, then wait. Between items: summarize and connect to the next item. The agent becomes a mentor, not just an executor.

7. **Domain skills registry** — a library of domain-specific skills (nextjs, tailwind, solidity, react, testing, etc.) that ship with the package. `init` auto-detects the project stack from package.json dependencies and file patterns, then installs matching domain skills alongside the process skills. Users can also manually add/remove domain skills via `init --skills nextjs,tailwind` or a new `add-skill` command.

## Context

Analysis of GSD-2 (56K+ lines TypeScript + Rust) revealed patterns we lack. This brief selects the 7 with the best effort-to-value ratio. Excluded: skill router pattern (high effort restructure), autonomous execution (requires being the agent, not augmenting one), dynamic model routing (not applicable to MCP architecture).

See `planning/gsd-inspired-improvements/research.md` for the full analysis.

## Scope

### In Scope
- Lessons registry with community + personal layers
- Verification auto-discovery in verify skill + quality_check MCP tool
- Forward intelligence in context skill
- Blocker protocol in work skill + impl template
- 4 workflow templates in plan skill
- Boundary map section in impl template
- Domain skills registry with auto-detection and manual selection
- Initial domain skills: nextjs, tailwind, react, solidity, typescript, testing, docker, vitepress

### Out of Scope
- Skill router pattern (subdirectory restructure — domain skills are still flat .md files)
- Autonomous execution / crash recovery
- Cost tracking / model routing
- SQLite-backed state (markdown files are fine)
- Exhaustive domain skill coverage (start with 8, grow over time)

## Success Criteria
- Community lessons installed on `init`, personal lessons persist across `update`
- `quality_check` returns results without manual command specification
- Forward intelligence appears in context updates between phases
- Work skill detects and halts on blocker field
- `/plan bugfix-name` scaffolds a brief+impl directly (no research/ADR)
- Impl docs include boundary maps for multi-phase work
- `init` on a Next.js + Tailwind project auto-installs nextjs, tailwind, react, and typescript domain skills
- Domain skills provide actionable guidance the agent uses during work (not just reference)

## Depends On
- `planning/mcp-dev-system/` (completed — MCP tools and skills exist)

## Blocks
- None currently

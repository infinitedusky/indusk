---
title: "Context Skill"
date: 2026-03-19
status: accepted
---

# Context Skill — Brief

## Problem

Every new Claude Code session starts with the agent having no memory of previous sessions. It has to re-discover the codebase by reading files, guessing at conventions, and sometimes repeating mistakes that were already corrected. Planning artifacts (research, briefs, ADRs, retrospectives) capture valuable lessons but sit in markdown files the agent doesn't read unless told to.

The result: sessions 1-3 on a project are slow. Session 50 is still slow, because the agent learned nothing from sessions 1-49.

## Proposed Direction

A skill that maintains a living project memory — primarily through CLAUDE.md — that gets read at session start and updated as work happens. The goal is that session 50 starts in 30 seconds with full awareness of what's been built, what was decided, and what mistakes to avoid.

## What Context Maintains

### CLAUDE.md (project root)

The primary memory file. Read by Claude Code automatically at session start. Contains:

- **Architecture overview** — what the project is, how it's structured, key technologies
- **Active conventions** — naming, file organization, patterns to follow (and anti-patterns to avoid)
- **Key decisions** — extracted from ADRs, summarized as one-liners with links to the full ADR
- **Known gotchas** — things the agent got wrong before and had to be corrected on
- **Current state** — what's in progress, what was recently completed, what's blocked

## How Context Updates

Context is NOT a one-time setup. It updates at specific trigger points:

1. **After a retrospective** — extract "Insights Worth Carrying Forward" and "What We'd Do Differently" into CLAUDE.md's conventions and gotchas sections.
2. **After an ADR is accepted** — add a one-liner to CLAUDE.md's decisions section with a link.
3. **After a correction** — when a human corrects the agent mid-session ("no, don't do it that way, do it this way"), context should capture that as a convention or gotcha.

## The Correction Capture Problem

Trigger point #3 is the hardest and most valuable. When a human says "use Biome not ESLint" or "we don't use default exports here," that's a convention that should be remembered forever. But detecting corrections mid-conversation is hard to automate.

**Proposed approach:** The context skill provides a `context learn` command. When the human corrects the agent, they (or the agent itself) can run `context learn "we use Biome, not ESLint"` to immediately add it to CLAUDE.md. Over time, the agent should also suggest running this when it detects it's been corrected.

## Scope

### In Scope
- CLAUDE.md maintenance (create, update at trigger points)
- `context learn` for capturing corrections
- Integration with plan lifecycle (retrospective → CLAUDE.md, ADR → CLAUDE.md)

### Out of Scope
- Cross-project context (each project has its own CLAUDE.md)
- Semantic search over project history
- Automatic correction detection (start with explicit `context learn`)
- IDE integration
- `research/index.md` maintenance (research docs are referenced directly in briefs/ADRs)
- `context refresh` command (triggers above keep CLAUDE.md current; revisit if drift becomes a problem)

## Success Criteria
- A new Claude Code session on an established project orients itself in < 30 seconds
- CLAUDE.md accurately reflects the project's current architecture and conventions
- Lessons from retrospectives appear in CLAUDE.md within one session of the retro being written
- `context learn` captures a correction in < 5 seconds
- After 10+ sessions, the agent makes noticeably fewer mistakes that require human correction

## Depends On
- plan skill (context reads planning artifacts)

## Blocks
- review skill (review checks new code against conventions stored in CLAUDE.md)

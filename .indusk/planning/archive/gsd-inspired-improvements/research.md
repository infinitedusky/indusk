---
title: "GSD-Inspired Improvements"
date: 2026-03-20
status: complete
---

# GSD-Inspired Improvements — Research

## Question

What patterns from GSD-2 (gsd-build/gsd-2) are most impactful for our InDusk dev system, given that we augment Claude Code via MCP rather than replacing it?

## Findings

### GSD-2 Overview

GSD-2 ("Get Shit Done v2") is a standalone autonomous coding agent CLI — 56K+ lines of TypeScript + Rust. It replaces the agent environment rather than augmenting it. Key capabilities: autonomous execution with crash recovery, dynamic model routing, cost tracking, parallel milestone orchestration via git worktrees, and a SQLite-backed memory system.

It uses a three-tier work hierarchy: Milestone → Slice → Task. Each task gets a fresh context window to prevent quality degradation. State persists to `.gsd/` on disk for crash recovery.

### What GSD Does That We Don't

1. **KNOWLEDGE.md** — append-only lessons learned, distinct from decisions. Captures "non-obvious rules, recurring gotchas, useful patterns" discovered during execution. Our "Known Gotchas" in CLAUDE.md is similar but less systematized.

2. **Verification auto-discovery** — probes for `typecheck`, `lint`, `test` scripts in package.json automatically. Our verify skill requires commands to be manually specified in every impl doc.

3. **Boundary maps in planning** — roadmap template includes a `## Boundary Map` naming what each slice produces/consumes (API endpoints, types, data shapes). Makes integration dependencies explicit.

4. **Forward intelligence in summaries** — after each slice, writes warnings about what is fragile and what downstream work should watch out for. Our context updates don't include forward intelligence.

5. **Blocker escalation protocol** — tasks can set `blocker_discovered: true` to trigger automatic slice replanning. We rely on the human noticing.

6. **Workflow templates** — pre-built templates for bugfix, hotfix, refactor, dep-upgrade, security-audit, spike, small-feature, full-project. We have one plan lifecycle for everything.

7. **Domain skills** — 17+ domain-specific skills (React, accessibility, web vitals, debugging, code optimization). Our skills are purely process-focused.

8. **Skill router pattern** — SKILL.md acts as dispatcher with subdirectories: workflows/, references/, templates/, scripts/. Our skills are flat markdown files.

9. **Must-haves as checkboxes** — every task plan has mechanically verifiable outcomes. Our impl items could be more rigorous about "done when" conditions.

10. **Agent personality definition** — system.md defines "warm but terse", "no enthusiasm theater", "finishes what it starts". Anti-patterns: no sycophantic filler, no TODO stubs, no hardcoded values.

### What We Do That GSD Doesn't

- Living CLAUDE.md with fixed 6-section structure
- Formal ADRs with alternatives considered
- Biome quality ratchet with documented rationale
- Per-phase documentation gates
- Retrospective skill with knowledge handoff
- CodeGraphContext (FalkorDB) for structural intelligence
- MCP server architecture (augments Claude Code rather than replacing it)
- VitePress docs site as first-class output

### Impact Assessment

Ranked by effort-to-value ratio for our system:

| Pattern | Impact | Effort | Notes |
|---------|--------|--------|-------|
| KNOWLEDGE.md | High | Low | Append-only file, skill update |
| Verification auto-discovery | High | Medium | Detect scripts from package.json |
| Workflow templates | High | Medium | Skip ceremony for well-understood work |
| Forward intelligence | Medium | Low | Add to context skill |
| Blocker protocol | Medium | Low | Add field to impl format |
| Boundary maps | Medium | Low | Add section to impl template |
| Skill router pattern | Medium | High | Restructure all skills |
| Domain skills | Low (for now) | High | Not needed until more projects |

## Open Questions

- Should KNOWLEDGE.md be a separate file or a section in CLAUDE.md?
- Should verification auto-discovery replace manual specification or supplement it?
- How many workflow templates do we actually need? GSD has 8, but we might only need 3-4.

## Sources

- https://github.com/gsd-build/gsd-2
- GSD-2 source analysis (56K+ lines TypeScript, Rust native modules)
- Comparative analysis run in this session via solution-architect agent

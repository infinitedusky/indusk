---
title: GSD-Inspired Improvements
---

# GSD-Inspired Improvements

**Decision:** Adopt 7 patterns from GSD-2: lessons registry, verification auto-discovery, forward intelligence, blocker protocol, workflow templates, boundary maps, and domain skills. Rejected full autonomous orchestration, SQLite state, and skill router pattern.

**Why:** The agent repeated mistakes across sessions, required manual verification setup, treated all work the same regardless of complexity, and had no domain-specific guidance.

**What shipped:**
- **Lessons registry** — community (package-owned) + personal lessons in `.claude/lessons/`. Read at session start. Most durable artifact.
- **Verification auto-discovery** — `quality_check` detects biome, tsc, vitest from project config. No manual verification commands needed.
- **Forward intelligence** — per-phase notes about fragile areas, downstream risks, and assumptions.
- **Blocker protocol** — `blocker:` lines in impl phases halt work and present to user.
- **Workflow templates** — bugfix, refactor, spike, feature. Scale ceremony to task size.
- **Boundary maps** — per-phase produces/consumes tables in impl docs.
- **Domain skills** — later evolved into the extension system (separate plan).

**Key evolution:** Domain skills started as flat markdown files, evolved into extensions with manifests, auto-detection, enable/disable, and per-extension config. The exception.md written during this plan's execution documented a gate-skipping failure that led to hook-based enforcement.

**Tradeoffs:**
- More files in `.claude/` (lessons, skills)
- Forward intelligence sections are underused — agents skip freeform sections
- Instructional enforcement proved insufficient — needed hooks (added in follow-on plans)

Full ADR: `planning/archive/gsd-inspired-improvements/adr.md`

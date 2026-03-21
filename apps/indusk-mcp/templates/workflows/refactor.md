# Refactor Workflow

Refactors restructure existing code without changing behavior. They skip research and ADR but require a boundary map.

## Documents Created
- `brief.md` — what's being restructured and why
- `impl.md` — the refactoring checklist with boundary map

## Brief Template

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft
---

# {Title} — Brief

## Problem
{What's wrong with the current structure? Why refactor now?}

## Proposed Direction
{What the code should look like after. High-level, not implementation details.}

## Scope
### In Scope
- {What's being restructured}
### Out of Scope
- {New features, behavior changes — those are separate work}

## Success Criteria
- {All tests still pass}
- {Specific structural improvement achieved}
```

## Impl Template

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft
---

# {Title}

## Goal
{Restructure as described in the brief. No behavior changes.}

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | {exports, types, modules} | {inputs, dependencies} |

## Checklist
### Phase 1: {Name}
- [ ] {Refactoring step}

#### Phase 1 Verification
- [ ] {All existing tests pass}
- [ ] {No behavior changes — same inputs produce same outputs}

## Files Affected
| File | Change |
|------|--------|
| `{path}` | {description} |
```

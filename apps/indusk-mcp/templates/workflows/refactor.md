# Refactor Workflow

Refactors restructure existing code without changing behavior. They skip the ADR and need no research document, but require a boundary map, and they keep the test plan — it is what proves the behavior held.

What is wrong with the current structure and why now are not the brief's. Write them in a research document's Background; a refactor may carry one without requiring it.

## Documents Created
- `brief.md` — the promises the restructuring must not break, and any it makes about the new structure
- `test-plan.md` — the behavior that must be unchanged afterwards (template in the planner skill)
- `impl.md` — the refactoring checklist with boundary map

## Brief Template

A brief holds what the conversation produced: expectations and promises, in the shape `indusk promises contract` reads (the planner skill has the full template and the rules). A refactor changes no behavior, so its brief is mostly the existing promises it works near: each goes under **Must not break**. A refactor that leaves a rule the structure must keep (one definition of something, no import across a boundary) makes that a `structure` promise.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft
workflow: refactor
---

# {Title} — Brief

## Expectations

1. **{What we expect the new structure to make easier.}**
   - Measure: {how we would know — e.g. the next change of this kind touches one file}
   - Look: {when to check}

## Promises

### This plan makes

1. **`{promise-name}`** (structure). {What the new structure guarantees.}

{Or `None.`}

### Existing promises

**Must not break**

- **`{promise-name}`**. {The code that keeps it is being moved.}

**Changes**

None.

**Replaces**

None.

### Not promised

- {New features and behavior changes: separate work.}
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

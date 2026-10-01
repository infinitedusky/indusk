# Bugfix Workflow

Bugfixes skip research and ADR — the problem is known and the fix is straightforward. They do not skip the test plan: its first assertion is the failing test that proves the bug.

## Documents Created
- `brief.md` — what's broken and how to fix it
- `test-plan.md` — what must be true once it is fixed, starting with the failing test (template in the planner skill)
- `impl.md` — the fix checklist

## Brief Template

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft
workflow: bugfix
---

# {Title} — Brief

## Bug
{What's broken? How does it manifest? Include error messages or reproduction steps.}

## Fix
{How to fix it. Keep it concise — this isn't a design doc.}

## Scope
### In Scope
- {The fix}
### Out of Scope
- {Related improvements that should be separate work}

## Success Criteria
- {How we know the bug is fixed — specific test or behavior}
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
{Fix the bug described in the brief.}

## Checklist
### Phase 1: Fix
- [ ] {The fix — be specific}

#### Phase 1 Verification
- [ ] {Command that proves the bug is fixed}
- [ ] {Regression test if applicable}

## Files Affected
| File | Change |
|------|--------|
| `{path}` | {description} |
```

---
name: retrospective
description: Structured audit and knowledge handoff after impl completion. Reviews docs, tests, quality, and context accuracy. Distills planning artifacts into the docs site and archives the plan.
argument-hint: "[plan name]"
---

You know how to close out plans in this project.

## What Retrospective Does

The retrospective skill replaces the freeform "write a retrospective" step with a structured audit and knowledge handoff. It runs after all impl phases are complete and produces:

1. A retrospective document (the written reflection)
2. Verified documentation accuracy
3. Test coverage assessment
4. Quality ratchet updates
5. Context accuracy confirmation
6. Published knowledge in the docs site
7. Archived planning artifacts

## When to Use

- After `/work` completes all impl phases and the status is `completed`
- When `/plan {name}` detects the impl is completed and the next step is retrospective
- Directly via `/retrospective {plan-name}`

## The Audit Checklist

Work through these steps in order. Each step is blocking — do not skip ahead.

### Step 1: Write the Retrospective Document

Create `planning/{plan-name}/retrospective.md` using the template from the plan skill. This is the reflective writing — what we set out to do, what actually happened, what we learned.

Key sections to fill in honestly:
- **What We Set Out to Do** — recap from the brief
- **What Actually Happened** — how did reality differ from the plan?
- **Getting to Done** — the unplanned work, debugging, surprises
- **What We Learned** — technical, process, or domain insights
- **What We'd Do Differently** — hindsight decisions
- **Insights Worth Carrying Forward** — takeaways for future plans

### Step 2: Structural Audit (Code Graph)

**Query the code graph** (see toolbelt "Before Modifying Code") to understand what actually changed. Include structural findings in "What Actually Happened" — e.g., "Plan touched 8 files with 23 downstream dependents." Also check `find_most_complex_functions` and `find_dead_code` for cleanup opportunities.

### Step 3: Docs Audit

Review every documentation page that was written or updated during this plan's impl phases.

For each page:
- Does it describe what was **actually built**, not what was **planned**?
- Are code examples accurate and runnable?
- Are diagrams up to date with the final architecture?
- Are links valid?

Fix any discrepancies found. Plans often diverge from their impl during execution — the docs must reflect reality.

### Step 4: Test Audit

Review the test files created or modified during this plan.

- Are there obvious coverage gaps? (untested error paths, edge cases, integration points)
- Were any test files planned but not created?
- Do all tests pass? Run `pnpm test` to confirm.

Flag gaps but don't necessarily fix them all now — add them as items to a follow-up plan if they're significant.

### Step 5: Quality Audit

Review mistakes made during this plan's implementation.

- Were there recurring lint errors or type errors during `/work`?
- Did any mistakes suggest a missing Biome rule?
- If yes: add the rule to `biome.json` and document the rationale in `biome-rationale.md`

The quality ratchet only gets tighter. Every retrospective is an opportunity to prevent the same class of mistake from happening again.

### Step 6: Lesson Capture

Review the plan's journey — research, implementation, debugging, surprises — and ask:

**"Did we learn anything non-obvious that applies beyond this specific plan?"**

Examples of good lessons:
- "Never use fallback values where a required config value is expected — it hides missing env vars"
- "Always check if the library has an official plugin before building custom"
- "Run the full test suite after changing shared types, not just the tests in the changed package"

If yes, call `add_lesson` for each one. These become personal lessons in `.claude/lessons/` — available to the agent in every future session across all projects.

If no lessons emerged, that's fine — not every plan produces new knowledge. Move on.

### Step 7: Context Audit

Re-read CLAUDE.md in full. After the entire impl is done, verify:

- **Architecture** — does it reflect the current state of the repo?
- **Conventions** — are all conventions that emerged during this plan captured?
- **Key Decisions** — was the ADR decision added (post-ADR trigger)?
- **Known Gotchas** — were all surprises and corrections captured?
- **Current State** — does it reflect what's actually in progress?

Fix any inaccuracies. The impl may have changed things that weren't anticipated in the per-phase context updates.

### Step 8: Knowledge Handoff

Distill planning artifacts into the docs site so the knowledge survives archival.

**ADR → Decisions page:**
Create `apps/indusk-docs/src/decisions/{plan-name}.md` with:
- A concise summary of what was decided and why
- Link to the full ADR in the archive: `planning/archive/{plan-name}/adr.md`
- Key tradeoffs accepted

**Retrospective insights → Lessons page:**
If the retrospective produced broadly useful insights, create `apps/indusk-docs/src/lessons/{plan-name}.md` with:
- What we learned that applies beyond this specific plan
- What we'd do differently and why

Not every plan produces a lessons page — only create one if the insights are genuinely reusable.

**Update sidebar:** Add new decision/lesson pages to the VitePress sidebar config in `apps/indusk-docs/src/.vitepress/config.ts`.

### Step 9: Archival

Move the planning artifacts to the archive:

```bash
mkdir -p planning/archive
mv planning/{plan-name} planning/archive/{plan-name}
```

The docs site now holds the published knowledge. The archive holds the process history. Both are preserved, but the docs are the primary reference going forward.

Update CLAUDE.md Current State to remove the plan from the active plans table.

## Important

- Work through the steps in order. Each builds on the previous.
- The retrospective document is reflective writing, not a status report. Be honest about what went wrong.
- The docs audit checks reality against documentation, not documentation against the plan.
- The quality ratchet only gets tighter — never remove Biome rules during a retrospective.
- Archival is a knowledge handoff, not just filing. The docs site must capture what matters before the plan moves to archive.
- If you discover significant issues during any audit step, flag them to the user before continuing.

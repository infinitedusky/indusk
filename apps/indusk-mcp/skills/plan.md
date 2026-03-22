---
name: plan
description: Create and advance plans. Every plan follows the same document lifecycle — research, brief, ADR, impl, retrospective. Knows how to write each one, what order they go in, and how to pick up where things left off.
argument-hint: "[workflow] [plan name] — workflow: feature (default), bugfix, refactor, spike"
---

You know how to plan work in this project.

## How Plans Work Here

Every plan lives in `planning/{kebab-case-name}/` and follows the same document lifecycle:

```
research.md → brief.md → adr.md → impl.md → retrospective.md
```

Each document builds on the ones before it. Not every plan needs all five — use the guide below to decide what's needed:

| Situation | Documents |
|---|---|
| Quick config change or bug fix | brief + impl |
| Architecture or technology decision | research + brief + adr + impl |
| Exploratory spike (no commitment) | research only |
| Large feature or system change | all five |

The order is always preserved — never write an ADR before the brief, or an impl before the ADR (when both exist).

General-purpose research (insights useful across plans) also lives in `research/` at the repo root.

## Workflow Types

The first argument to `/plan` can optionally be a workflow type that controls which documents are created:

| Command | Workflow | Documents |
|---------|----------|-----------|
| `/plan bugfix auth-expiry` | bugfix | brief + impl only |
| `/plan refactor extract-auth` | refactor | brief + impl (with boundary map) |
| `/plan spike redis-options` | spike | research only |
| `/plan feature payment-flow` | feature | full lifecycle (default) |
| `/plan payment-flow` | feature | same — no type defaults to feature |

Parse the input: if the first word is `bugfix`, `refactor`, `spike`, or `feature`, use that workflow. Otherwise, default to `feature`. The remaining words become the plan name (kebab-cased).

Workflow templates are in `templates/workflows/` in the package. They describe which documents to create and provide streamlined templates for each workflow type.

## What to Do When Asked to Plan

1. **Determine the workflow type** from the input (see above). This controls which documents you create.

2. **Figure out where things stand.** If a plan folder already exists, read what's there. Check frontmatter statuses. The next document to write is the first one that's missing or incomplete.

3. **If starting fresh**, do a quick scan of the project (read CLAUDE.md, check the code graph) to understand the context. Then **ask the user discovery questions before doing any research or writing any documents.** The goal is to understand what they're trying to achieve, not just what they named the plan. Good discovery questions:
   - "What problem are you trying to solve?" or "What should this feature do for your users?"
   - "Is there anything specific you've already thought through or have strong opinions about?"
   - "Are there any constraints I should know about — timeline, technology preferences, things to avoid?"

   For non-developers especially, this conversation is critical. They may not know the right technical terms, but they know what they want. Draw that out before proceeding.

   Once you understand the intent, create the plan folder and start with the first document for the workflow type:
   - **feature**: start with research
   - **bugfix**: start with brief (streamlined template)
   - **refactor**: start with brief (includes boundary map)
   - **spike**: start with research (and stop there)

   For feature/spike workflows that start with research: Explore the problem space — read code, search the web, check Context7 for library docs. **REQUIRED: Query the code graph before scoping:**
   - Call `query_dependencies` on the target area to understand what depends on it and what it depends on
   - Call `find_code` to find existing implementations you might reuse or need to modify
   - Call `get_repository_stats` to understand the size of the area you're about to scope
   - Include the graph findings in research.md — concrete numbers like "X has 12 dependents across 3 apps"
   Document what you find. The research doc records findings and analysis, but saves the recommendation for the brief.

4. **If research is done**, write the brief. This is where a direction emerges from the research. The brief proposes what we're building and why, informed by what the research uncovered. **Present the brief and have a conversation about it.** Don't just ask "does this look good?" — walk the user through it: "Here's what I'm proposing we build. Does this match what you had in mind? Is there anything missing, or anything here you don't want?" Iterate until the user is genuinely happy with the direction, then mark it as `accepted`.

5. **If brief is accepted** and the workflow includes an ADR (feature only), write the ADR. The ADR formalizes the decisions that were discussed during research and led to the brief. It records what was chosen, what was rejected, and why. **After the ADR is accepted**, add a one-liner to CLAUDE.md's Key Decisions section per the context skill: `- {decision summary} — see planning/{plan}/adr.md`

6. **If ADR is accepted** (or brief is accepted for bugfix/refactor), write the impl. Break into phased checklists with concrete tasks. For refactor workflows, include a `## Boundary Map` section. For multi-phase impls of any type, consider adding a boundary map.

7. **If impl is completed** (all items checked off by `/work`), invoke the retrospective skill (`/retrospective {plan-name}`). This handles the structured audit (docs, tests, quality, context), knowledge handoff to the docs site, and archival. Do not write a freeform retrospective — use the skill. (Bugfix and refactor workflows may skip retrospective for small changes — user's call.)

8. **Always present each document for review** before moving to the next stage. The user signs off on each step.

## Cross-Referencing Between Plans

Plans frequently depend on or relate to each other. When work overlaps:
- Reference related plans by path: "See `planning/security-hardening/` Phase 8"
- Use the `## Depends On` / `## Blocks` sections in the brief to make ordering explicit
- If a change in one plan affects another, update both — don't let them drift

## Document Templates

### research.md

Research is a record of exploration — what was asked, what was found, and how the findings compare. It includes factual analysis ("X doesn't support Y because of Z") but not recommendations ("we should use X"). Save recommendations for the brief.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: in-progress | complete
---

# {Title} — Research

## Question
{What are we trying to understand?}

## Findings

### {Topic 1}
{What we found. Facts, comparisons, analysis. Include code snippets when the syntax matters.}

## Open Questions
- {What remains unanswered}

## Sources
- {Links, references}
```

### brief.md
```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft | accepted
---

# {Title} — Brief

## Problem
{What problem are we solving? Why does it matter? 2-3 sentences.}

## Proposed Direction
{High-level approach, not implementation details.}

## Context
{Background. Reference research.md for deeper exploration.}

## Scope
### In Scope
- {Item}
### Out of Scope
- {Item}

## Success Criteria
- {How we know this worked}

## Depends On
- {Plans that must be completed before this one — e.g., `planning/per-game-escrow/`}

## Blocks
- {Plans that are waiting on this one — e.g., `planning/electric-ledger-sync/`}
```

### adr.md
```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: proposed | accepted | deprecated | superseded | abandoned
---

# {Title}

## Y-Statement
In the context of **{use case}**,
facing **{constraint}**,
we decided for **{chosen option}**
and against **{rejected alternatives}**,
to achieve **{desired outcome}**,
accepting **{tradeoff}**,
because **{rationale}**.

## Context
{Situation and background. Reference research and brief.}

## Decision
{What was decided, specifically.}

## Alternatives Considered
### {Alternative 1}
{Why rejected.}

## Consequences
### Positive
- {Benefit}
### Negative
- {Tradeoff}
### Risks
- {Risk and mitigation}

## References
- {Links to research, brief, related plans, external resources}
```

### impl.md

Include code snippets in checklist items when the syntax matters — function signatures, schema definitions, hash formats, config structures. The impl should be precise enough that someone can execute it without guessing at names or shapes.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft | approved | in-progress | completed | abandoned
---

# {Title}

## Goal
{What this achieves and why.}

## Scope
### In Scope
- {Item}
### Out of Scope
- {Item}

## Boundary Map

For multi-phase impls, include a boundary map showing what each phase produces and consumes. Required for refactor workflows, recommended for features with 2+ phases.

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | {exports, types, modules created} | {inputs, dependencies used} |
| Phase 2 | {what this phase adds} | {what it needs from Phase 1} |

## Checklist
### Phase 1: {Name}
- [ ] {Task — include code snippets when syntax matters}
  ```typescript
  // Example: function signature that must match this shape
  function withdrawFor(wallet: address, player: address, amount: uint256, historyHash: bytes32)
  ```

#### Phase 1 Verification
- [ ] {Verification step — prove this phase works. Must be a specific runnable command with expected output, not "verify it works." See the verify skill for guidance on what checks a phase needs based on what changed.}

#### Phase 1 Context
- [ ] {Concrete CLAUDE.md edit this phase produces — e.g., "Add to Architecture: ...", "Add to Conventions: ...", "Update Current State: ...". Ask: "what does this phase change about how the project works?" If nothing, omit this section.}

#### Phase 1 Document
- [ ] {Docs page to write or update — e.g., "Write reference page at apps/indusk-docs/src/reference/tools/tool-name.md", "Update architecture diagram in docs". Ask: "what does a user or developer need to know about what this phase built?" If nothing user-facing, omit this section. See the document skill for guidance on what to document and how.}

## Files Affected
| File | Change |
|------|--------|
| `{path}` | {description} |

## Dependencies
- {What must exist before starting}

## Notes
{Open questions, deferred decisions.}
```

### retrospective.md

The retrospective covers the full story of getting to done — not just what was built, but what broke, what had to be fixed after the impl was "complete," and what it actually took to reach a working state. The impl checklist tracks planned work; the retrospective captures the unplanned work, the debugging, the surprises, and the real cost of getting there.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
---

# {Title} — Retrospective

## What We Set Out to Do
{Recap of problem and approach, referencing brief and ADR.}

## What Actually Happened
{What was built. How did it diverge from the plan?}

## Getting to Done
{The full story after the impl was "complete." What broke? What needed fixing? What unplanned work was required to actually reach a working state? This is often where the real learning happens.}

## What We Learned
- {Lesson — technical, process, or domain insight}

## What We'd Do Differently
- {Hindsight — decisions that could have been better, steps to skip or add}

## Insights Worth Carrying Forward
{Takeaways for future plans. Save to research/ if broadly useful.}

## Quality Ratchet
{Could any mistakes in this plan have been caught automatically by a Biome rule? If yes, add the rule to biome.json and document it in biome-rationale.md. The quality ratchet only gets tighter.}

## Metrics
- Sessions spent: {N}
- Files touched: {N}
- Lines added/removed: {+N / -N}
- {Other measurable outcomes — performance before/after, test count, etc.}
```

## Folder Conventions

```
planning/
├── {plan-name}/
│   ├── research.md
│   ├── brief.md
│   ├── adr.md
│   ├── impl.md
│   └── retrospective.md
└── archive/
    └── {completed-plan}/

research/                    # Standalone insights useful across plans
```

- Kebab-case folder names
- Archive completed/abandoned plans to `planning/archive/`
- When revising, archive the old version first (`planning/archive/{name}_v1/`)

## Important

- Read relevant source code before writing. Documents should reference actual files, functions, and current behavior.
- **Use the code graph for scoping.** Before writing a brief or impl, query `analyze_code_relationships` to understand what depends on what. "How many files import X?" and "What calls this function?" prevent underscoping.
- Keep Y-statements concise but complete. Every field filled in.
- Impl checklists: granular enough to track, not so granular they're busywork.
- When research produces broadly useful insights, also save to `research/` at repo root.
- Cross-reference related plans by path whenever work overlaps between plans.
- The user's input is: $ARGUMENTS

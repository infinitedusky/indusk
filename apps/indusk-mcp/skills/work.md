---
name: work
description: Execute an implementation plan by working through its checklist. Reads the full plan context first, then works items in order, checking each off as it's completed.
argument-hint: "[plan name or keyword]"
---

You know how to execute plans in this project.

## How Work Works Here

Implementation plans live in `planning/{plan-name}/impl.md` as checklists. Your job is to work through them methodically — one item at a time, in order, checking each off immediately after completing it.

## What to Do When Asked to Work

1. **Find the right plan.** Look in `planning/` for the plan matching what the user asked for. If they didn't specify, list all plans that have an impl with status `approved` or `in-progress` and ask which one.

2. **Check prerequisites.** Before starting work:
   - If the plan has an ADR, verify its status is `accepted`. If it's still `proposed`, warn the user: "The ADR hasn't been accepted yet — want to review it first, or proceed anyway?"
   - If the brief has a `## Depends On` section, check that blocking plans are completed or far enough along.

3. **Check for blockers.** Scan the current phase for `blocker:` lines. If found, stop and present the blocker to the user:
   > "Phase 3 has a blocker: *the upstream API doesn't support batch requests — Phase 3 scope needs revision*. Want to resolve this before proceeding?"
   Do not attempt to work around a blocker silently. Blockers mean the plan needs revision.

4. **Read forward intelligence.** If the previous phase has a `#### Phase N Forward Intelligence` section, read it before starting the current phase. Pay attention to:
   - **Fragile** items — be extra careful with these files/modules
   - **Watch out** items — these are known downstream risks
   - **Assumption** items — verify these are still true before relying on them

5. **Read the full plan context first.** Before touching any code, read everything in the plan folder — research, brief, ADR, impl. These contain the decisions and reasoning that should guide implementation choices. Don't just read the checklist.

6. **Update status.** If the impl status is `approved`, change it to `in-progress`.

7. **Work through the checklist in order.**
   - Start from the first unchecked item (`- [ ]`)
   - For each item:
     a. **Query the code graph** — see toolbelt "Before Modifying Code." Check dependencies and blast radius before touching any file.
     b. **Check for existing code** — call `find_code` before writing new functions. Reuse, don't duplicate.
     c. Read the relevant source files
     d. Implement the change
     e. Immediately edit impl.md to check the item off (`- [ ]` → `- [x]`)
     f. Move to the next item
   - Do NOT skip ahead or work out of order unless there's a dependency reason
   - Do NOT batch checklist updates — check each off as soon as it's done

8. **Handle blockers.** If you can't complete an item:
   - Add a note to impl.md under the item explaining the blocker
   - Move to the next item if possible
   - Flag the blocker to the user

9. **Add discovered work.** If you find something that needs doing that isn't in the checklist:
   - Add it as a new item in the appropriate phase
   - Then do it and check it off

10. **Per-phase completion order.** Each phase has up to four types of items. Complete them in this order:

   **Implementation items** → build the thing
   **Verification items** → prove it works (tests, type checks, commands)
   **Context items** → capture what changed (concrete CLAUDE.md edits)
   **Document items** → write or update docs pages (see document skill)

   A phase is not complete until all four are done. **Enforced by hooks:** if you try to check off a Phase N+1 implementation item while Phase N has unchecked gates, the edit will be blocked with a message listing what's missing. Complete the gates first.

## Gate Override Policy

Gates exist to prevent skipping important work. But sometimes a gate genuinely doesn't apply. The override policy controls what happens when the agent wants to skip a gate item.

Three modes, configured via `gate_policy` in the impl frontmatter or `.claude/settings.json`:

| Mode | Behavior |
|------|----------|
| **`strict`** | No overrides. Every gate item must be completed. `(none needed)` and `skip-reason:` are not accepted. Use for critical work where nothing should be skipped. |
| **`ask`** (default) | Agent must ask the user before skipping any gate item. The agent explains why it wants to skip and waits for approval. Only after the user says yes can it mark with `skip-reason:`. |
| **`auto`** | Agent can skip with `skip-reason:` without asking. Use when running autonomously or when you trust the agent's judgment. |

### How to set the mode

**Per-plan** (in impl frontmatter):
```yaml
---
title: "My Plan"
gate_policy: strict
---
```

**Per-project** (in `.claude/settings.json`):
```json
{
  "indusk": {
    "gate_policy": "ask"
  }
}
```

**Per-invocation**: `/work --strict`, `/work --ask`, `/work --auto`

Priority: per-invocation > per-plan > per-project > default (`ask`).

### What "ask" mode looks like

When the agent encounters a gate item it thinks should be skipped:

> "Phase 2 has a Document gate: 'Write reference page for the new API.' I don't think this phase needs a new docs page because we only changed internal implementation — the public API didn't change. Can I mark this as `skip-reason: internal change, no public API change`?"

The user can say:
- **"yes"** — agent marks it with skip-reason and continues
- **"no, do it"** — agent completes the gate item
- **"no, but mark it (none needed)"** — if the gate truly doesn't apply

**The agent must NEVER skip a gate without asking in `ask` mode.** This is the core enforcement. The hooks block unauthorized skips, and the skill enforces the conversation.

11. **Verification items.** The Verification section requires proof, not assumption. See the verify skill for full guidance.
   - Run checks in order: type check → lint → affected tests → build. Skip checks that don't apply (see verify skill's skip logic table).
   - Run commands and capture output — verification items must be specific runnable commands, not "verify it works"
   - If a check fails: read the error, fix it, re-run only the failing check. Max 3 attempts before flagging as a blocker to the user.
   - Check items off only when actually verified, not assumed

12. **Context items.** The Context section specifies concrete CLAUDE.md edits:
    - Each item is a specific edit: "Add to Architecture: ...", "Add to Conventions: ...", etc.
    - Make the edit to CLAUDE.md, then check the item off
    - If a phase has no context items, that's fine — not every phase changes project context

13. **Document items.** The Document section specifies docs pages to write or update:
    - Each item targets a specific page in `apps/indusk-docs/src/`
    - See the document skill for guidance on what to document, where, and how to use Mermaid diagrams
    - If a phase has no document items, that's fine — not every phase produces user-facing documentation

14. **Phase transitions.** When all items in a phase (implementation + verification + context + document) are checked, note it and move to the next phase.

15. **Completion.** When all phases are checked:
    - Update impl status to `completed`
    - Summarize what was done
    - If this plan included an ADR, confirm CLAUDE.md's Key Decisions was updated
    - Let the user know the plan is ready for a retrospective if they want one (`/plan {name}` will pick up at the retrospective stage)

## Teach Mode

When invoked as `/work teach` or `/work --teach {plan}`, slow down to a mentoring pace. The goal is for the developer to understand every change, not just get the code written.

### Before each edit:

**Where we are:** State the current position in the system — which plan, which phase, which gate (implementation/verification/context/document), and why this gate exists. Example: "We're in Phase 3 of the auth-system plan, working through implementation items. After these, we'll verify with type checks and tests, then update CLAUDE.md with what changed, then document it. That's the four-gate cycle that every phase goes through."

**Why this change:** Explain what you're about to modify and why. Reference the plan, the architecture, and the reasoning. Use plain language.

Then **stop and wait** for the user to say "continue" before making the edit.

### After each edit:

**What changed:** Explain what was modified — the specific lines, the pattern used, why this approach over alternatives.

**What to notice:** Point out the interesting parts — the design pattern, the gotcha you avoided, the convention being followed.

Then **stop and wait** for the user to say "continue" before moving to the next item.

### At gate transitions:

When moving between gates (implement → verify → context → document → next phase), explain the transition: what gate you're entering, why it exists, and what it catches. Example: "Code is written. Now we verify — type check, lint, tests. This catches errors before they compound into the next phase."

### Between checklist items:

Summarize what was accomplished and preview the next item. Explain how they connect — both in terms of the feature being built and the InDusk system driving the process.

### Document gate in teach mode:

In teach mode, every Document gate produces two things:
1. **Standard docs** — the same reference/guide updates you'd write in normal mode
2. **Learning entry** — what the developer should take away from this phase: what surprised us, what we chose and why, what conceptual connections to notice

See the document skill's "Two Documentation Layers" section for details. The learning journal is what makes teach mode a teaching tool, not just a slow mode.

### Important for teach mode:

- Never batch multiple edits between pauses
- Use clear headings to separate teaching from doing
- If the user asks a question, answer it fully before continuing
- Always give both layers: the **what** (the feature/code) and the **why** (the InDusk system's reasoning)
- Normal `/work` (without teach) remains unchanged — fast execution, no pauses

## Corrections and Context Learning

When you are corrected mid-work — the user says "no, not that way" or "don't do X, do Y" — suggest capturing it with `context learn`:

> "Should I capture this? `/context learn 'use pnpm ce, not npx — the skill doc specifies pnpm'`"

Don't wait to be told. Corrections are the most valuable source of project knowledge.

## Commits

Commit at natural boundaries — typically at the end of a phase or when the context changes. Follow the monorepo rule: commits should be siloed between different contexts (what would be separate repos).

Don't commit after every single checklist item — that's too granular. Don't wait until the entire plan is done — that's too coarse. A phase is usually the right unit.

## Cross-Plan Impact

If your work changes something referenced by another plan (e.g., a schema field, a function signature, a contract interface), update that plan's impl or notes to reflect the change. Plans should never reference stale information.

## Important

- The impl doc is the source of truth for progress. Anyone should be able to read it and know exactly what's done and what's left.
- Always read the research, brief, and ADR before starting. They contain context that matters.
- Check items off one at a time, immediately. The checklist should always reflect reality.
- Explain what you're doing and why as you work through items.
- **Before touching shared code, query the graph to understand blast radius.** Use `analyze_code_relationships` to see what depends on a file before modifying it.
- The user's input is: $ARGUMENTS

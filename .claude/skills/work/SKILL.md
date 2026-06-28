---
name: work
description: Execute an implementation plan by working through its checklist. Reads the full plan context first, then works items in order, checking each off as it's completed.
argument-hint: "[plan name or keyword]"
---

You know how to execute plans in this project.

## How Work Works Here

Implementation plans live in `.indusk/planning/{plan-name}/impl.md` as checklists. Your job is to work through them methodically — one item at a time, in order, checking each off immediately after completing it.

## What to Do When Asked to Work

1. **Find the right plan.** Look in `.indusk/planning/` for the plan matching what the user asked for. If they didn't specify, list all plans that have an impl with status `approved` or `in-progress` and ask which one.

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

10. **Per-phase completion order.** Each phase has up to five types of items. Complete them in this order:

   **Implementation items** → build the thing
   **OTel items** → instrument it (spans, categories, error recording — see OTel skill)
   **Verification items** → prove it works (tests, type checks, commands — can include trace verification)
   **Context items** → capture what changed (concrete CLAUDE.md edits)
   **Document items** → write or update docs pages (see document skill)

   A phase is not complete until all five are done. **Enforced by hooks:** if you try to check off a Phase N+1 implementation item while Phase N has unchecked gates, the edit will be blocked with a message listing what's missing. Complete the gates first.

## Test Trajectory — Phase Responsibilities

If the impl has a `## Test Trajectory` table (frontmatter `trajectory: required`), the work skill takes on two additional responsibilities at phase boundaries.

### At phase start — author writable-at-phase tests

Before starting implementation items for Phase N:

1. Read the Test Trajectory. Collect every row with `Writable at: Phase N` whose `State` is `planned` or `writable`.
2. For each such row: create the test file (or add the test case to an existing file) implementing the `Asserts` description. Commit it as failing. If the test cannot yet run against a compiled symbol, use `.skip()` with a comment naming the unlock phase.
3. Update each row's `State` to `written` in the trajectory table.

These tests are the contract for the phase. They fail when the phase begins; they pass when it ends.

### At phase close — verify passes-at-phase tests

Before advancing past Phase N (i.e., before checking the first implementation item in Phase N+1):

1. Collect every row with `Passes at: Phase N`.
2. Run the tests. For each row whose test now passes, update its `State` to `passing` in the trajectory table.
3. If a test is explicitly skipped (approval test awaiting first run, platform-specific test), update to `skipped` with an inline comment on the reason.
4. If a test regressed or its dependencies changed unexpectedly, update to `blocked` — then resolve it (fix the test, or move its `Passes at` to a later phase with a reason).
5. The `check-gates` hook rejects the phase transition if any `Passes at: Phase N` row is still in `planned`, `writable`, or `written` state. This is structural enforcement of "deferral is impossible."

### State lifecycle

```
planned → writable → written → passing
                              ↘ skipped (with reason)
                              ↘ blocked (needs investigation)
```

| State | Meaning |
|-------|---------|
| `planned` | Row exists in the trajectory, no file yet |
| `writable` | Dependencies exist; test can now be authored |
| `written` | Test file exists and runs (fails or is `.skip()`) |
| `passing` | Test runs and passes |
| `skipped` | Intentionally `.skip()` with a documented reason |
| `blocked` | Was writable/written, now regressed or changed; needs investigation |

### Library helpers

The `apps/indusk-mcp/src/lib/trajectory/state-ops.ts` module provides:

- `getRowsWritableAt(trajectory, phase)` — rows to author at phase start
- `getRowsBlockingPhaseClose(trajectory, phase)` — rows preventing phase close
- `updateRowState(body, id, newState)` — rewrite the State cell in impl.md body
- `getPhaseStartNudge(body, phase)` / `getPhaseCloseNudge(body, phase)` — human-readable reminder text

Call these via `tsx` or through the InDusk MCP (once wired) rather than re-parsing the table by hand.

### Deferred Verification audit

The retrospective skill audits Deferred Verification rows at plan close — checking that each row's `mitigation:` field was actually wired up (telemetry configured, review scheduled, downstream plan linked). Work skill just maintains the Trajectory; retrospective validates completeness at the end.

## Gate Override Policy

Gates exist to prevent skipping important work. But sometimes a gate genuinely doesn't apply. The override policy controls what happens when the agent wants to skip a gate item.

Three modes, configured via `gate_policy` in the impl frontmatter or `.claude/settings.json`:

| Mode | Behavior |
|------|----------|
| **`strict`** | No overrides at any stage. Every gate must have a real item when the impl is written (`/planner`), and every item must be completed during `/work`. No `(none needed)`, no `skip-reason:`, no conversation proof. |
| **`ask`** (default) | Every gate must have a real item when the impl is written. During `/work`, the agent must ask the user before skipping, and include proof of the conversation in the skip format. Hooks enforce both stages. |
| **`auto`** | Gates can be pre-filled with `(none needed)` or `skip-reason:` at write time. During `/work`, the agent can skip without asking. Use when running autonomously. |

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

> "Phase 2 has a Document gate: 'Write reference page for the new API.' I don't think this phase needs a new docs page because we only changed internal implementation — the public API didn't change. Can I skip the document gate?"

The user can say:
- **"yes, skip it"** — agent marks it with conversation proof and continues
- **"no, do it"** — agent completes the gate item

### Conversation proof format (enforced by hooks)

In `ask` mode, skipped gates MUST include proof that the conversation happened:

```markdown
#### Phase 2 Document
- [x] (none needed — asked: "Phase 2 is internal refactoring with no public API changes. Can I skip the document gate?" — user: "yes, skip it")
```

The hook validates that both `asked:` and `user:` are present with non-empty quoted content. Bare `(none needed)` or `skip-reason:` without conversation proof will be **blocked by the hook**.

| Mode | At write time (`/planner`) | At execution time (`/work`) |
|------|------------------------|---------------------------|
| `strict` | No opt-outs — real items required | No skipping — everything completed |
| `ask` | No opt-outs — real items required | Skip only with conversation proof |
| `auto` | `(none needed)` / `skip-reason:` allowed | Skip without asking |

**The agent must NEVER skip a gate without asking in `ask` mode.** This is enforced by hooks at both stages — not just instructional.

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

14. **Phase transitions.** When all items in a phase (implementation + verification + context + document) are checked, note it and move to the next phase. **Semantic graph sync:** If the project has a `.indusk/` directory and `mcp__indusk__graph_sync` is available, call it after all phase gates succeed to keep the semantic graph current with code changes. This is best-effort — if sync fails, log a warning and continue.

15. **Completion.** When all phases are checked:
    - Update impl status to `completed`
    - Summarize what was done
    - If this plan included an ADR, confirm CLAUDE.md's Key Decisions was updated
    - **Run `/falsify {plan}` next, before `/retrospective`.** The falsification ritual is the bridge between "impl done" and "plan archived." It drives the same working agent through a goal-flipped bounty hunt — investigate the code, form a specific hypothesis about what should be broken, write the test that confirms it. The ritual may surface gaps worth addressing, which can reopen the impl (status flips back to `in-progress`) for a fix-in-scope phase, or spawn a new plan, or be recorded as a finding. Only after `/falsify` terminates cleanly — or has been explicitly skipped via `falsification: skipped` + `falsification_reason: "..."` in the impl frontmatter — is the plan ready for `/retrospective`. See the [Falsification Ritual guide](apps/indusk-docs/src/guide/falsification-ritual.md) and `.indusk/planning/archive/falsification-ritual/adr.md`.
    - Let the user know: "Impl complete. Run `/falsify {plan}` next. If it terminates cleanly, then `/retrospective {plan}` will close out the plan."

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

When moving between gates (implement → otel → verify → context → document → next phase), explain the transition: what gate you're entering, why it exists, and what it catches. Example: "Code is written. Now OTel — instrument the new code paths. Then verify — type check, lint, tests, trace verification. Then context and docs."

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

**When the user confirms `context learn`, ALSO write a highlight so the eval agent can capture it in Graphiti:**
```
mcp__indusk__highlight({
  tag: "correction",
  note: "{short slug + lesson text}",
  level: "important"
})
```

The working agent does not write the Graphiti episode directly. The eval agent reads the highlight, decides whether it's a cross-project convention (→ `shared` group) or a project-specific fact (→ project group), phrases the episode, and writes it. The working agent just flags the moment and keeps working.

**What to include in the `note`:** enough for the eval agent to reconstruct the lesson and classify its scope. Example: `pnpm-ce: always use pnpm ce, not npx — skill doc specifies pnpm and mixing causes cache drift`. The eval agent has the full transcript, so concision over completeness is fine.

Skip silently if `mcp__indusk__highlight` is unavailable — highlights are best-effort and must not fail the work item or the `context learn` recording (which is the canonical, local copy of the lesson).

## Commits

Default: **one commit per checklist item.** Trunk-based development on a feature branch: short-lived branches, frequent commits + pulls, merge + delete fast. See `git.md` for the full convention.

### Workflow

**Once at phase start:**

```bash
git checkout main
git pull --rebase
git checkout -b plan/{plan-name}-phase-{n}
```

**For every checklist item, in this exact order:**

1. **Do the work** — edit files, run tools.
2. **Check the item off** in the impl.md.
3. **`git add -p`** — stage hunks selectively (NOT `git add -A`).
4. **`git commit -m "context: what + why"`** — short, intent-named. Eval hook fires here.
5. **Repeat** for the next item.

**Periodically (at least once per session, before merging):**

```bash
git fetch origin
git rebase origin/main          # stay current with trunk
git push --force-with-lease     # safe force-push after rebase
```

**At phase or plan completion:** push + open PR (or merge directly if solo), then delete the branch on both sides:

```bash
git push -u origin plan/{plan-name}-phase-{n}
# → merge via GitHub button or `git merge --no-ff` locally
git branch -d plan/{plan-name}-phase-{n}
git push origin --delete plan/{plan-name}-phase-{n}
```

**Commit message discipline:** the eval hook fires on commit and scores the diff + transcript. Write descriptive commit messages that name the *why*, not just the *what* — the agent has the diff regardless; the message provides intent.

If a change spans multiple apps, stage hunks per app with `git add -p apps/{name}/...` and commit each context separately. Don't lump multi-context changes into one commit.

### Granularity and batching

**Default: one commit per checklist item.** Each impl checklist item is a logical unit of work — give it its own commit. This keeps history granular, makes blame and bisect useful, and lets the eval agent score each unit while context is fresh.

Phase-close commits (one big commit for everything in a phase) are an exception, not the default. Use them ONLY when items are trivially related — e.g., a phase that's "rename X → Y in 5 files" where every commit would be the same one-line change. If items represent meaningfully different work, each item deserves its own commit.

Cost is not a reason to batch. The eval agent uses session-resume after the first commit, so subsequent commits within a session amortize the catchup cost — per-item commits are cheap.

## Cross-Plan Impact

If your work changes something referenced by another plan (e.g., a schema field, a function signature, a contract interface), update that plan's impl or notes to reflect the change. Plans should never reference stale information.

## Important

- The impl doc is the source of truth for progress. Anyone should be able to read it and know exactly what's done and what's left.
- Always read the research, brief, and ADR before starting. They contain context that matters.
- Check items off one at a time, immediately. The checklist should always reflect reality.
- Explain what you're doing and why as you work through items.
- **Before touching shared code, query the graph to understand blast radius.** Use `analyze_code_relationships` to see what depends on a file before modifying it.
- The user's input is: $ARGUMENTS

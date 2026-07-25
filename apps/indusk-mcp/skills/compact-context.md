---
name: compact-context
description: On-demand bulk compaction of an over-budget CLAUDE.md. Classify every entry (load-bearing convention / shipped-plan narrative / operational state), demote narratives to one-line rule + pointer, move operational state to current.md, and land the file under its byte budget. Report mode first — never a blind destructive pass. The companion to the retrospective's incremental compaction step and the thing the budget hook's error message tells you to run.
argument-hint: "[--apply]"
---

You are compacting CLAUDE.md because it has grown past its budget. The `claude-md-budget.js` hook enforces `context.claude_md_budget_bytes` (default 61440 = 60 KB) at write time, and when it fires it tells the agent to "run the compaction ritual" — this is that ritual, as a runnable verb.

This is the **bulk** tool. The retrospective skill's Compaction step is the *incremental* half — it demotes one plan's narrative at each close so the file doesn't accrue. This skill is the *pay-down-accumulated-debt* half: a file that is already multiples over budget (because the hook was installed after it had grown, or because incremental compaction was never run) needs one editorial pass, and that pass is too large and too judgment-heavy to ride a retrospective. Same classification, same rule-plus-pointer target — different scale and cadence.

## The prime directive

**The rule stays; the narrative moves behind a pointer.** Compaction never deletes knowledge — it relocates the *body* of each entry to where it already lives (a decisions page, a lessons page, an archived plan doc, or `.indusk/current.md`) and leaves the *operative rule sentence* plus a resolvable pointer in CLAUDE.md. A reader skimming the compacted file still learns every rule; a reader who needs the "why" follows one pointer. If a body has no home to point at, you create the home (a decisions/lessons page) before demoting — you never drop a body on the floor.

## Report mode is the default

Running `/compact-context` with no argument is **report mode** — it produces a plan, changes nothing. Only `/compact-context --apply` performs the edits, and only after the report has been shown and the user has confirmed. The editorial calls (which entries are load-bearing, where each pointer targets, what's safe to drop entirely) require project judgment; the skill provides the ritual and the guardrails, not blind automation.

## The ritual

### Step 1 — Measure and locate

- `wc -c CLAUDE.md` and read `context.claude_md_budget_bytes` from `.indusk/config.json` (default 61440). State the overage: "CLAUDE.md is {size} B against a {budget} B budget — {N}× over."
- Run `indusk prune --dry-run` if available — it flags the largest sections and stalest entries, which is where the bytes are.
- Read CLAUDE.md in full. You cannot classify what you have not read.

### Step 2 — Classify every entry

Walk the file section by section (Architecture, Conventions, Key Decisions, Known Gotchas, Current State). Tag each bullet/entry as one of:

- **Load-bearing convention** — a rule an agent must follow to not break the project (commit style, "never String.includes for shell triggers", a chokepoint). **Keep the rule sentence.** If it carries a multi-paragraph justification, that justification is a narrative — demote the justification, keep the sentence.
- **Shipped-plan narrative** — the multi-paragraph "what this plan did / what shipped in each phase / what broke in falsification" prose that Current State and post-retro entries accrete. **This is where the bytes are.** Its body already lives in the archived plan + the docs decisions/lessons pages. Demote to: `- **{plan} ({version})** — one-sentence what-shipped. See [archive](.indusk/planning/archive/{plan}/) or /decisions/{plan}.`
- **Operational state** — in-flight work, open questions, cursor position, "currently mid-migration." This does not belong in CLAUDE.md at all (that's the architectural layer). **Move it to `.indusk/current.md`** (the operational layer) via `mcp__indusk__update_current_section` or the Project (shared) section, and remove it from CLAUDE.md.
- **Dead** — an entry describing something retired (a removed subsystem, a superseded decision) that no longer needs even a pointer. Rare. Drop only when you can name why it's dead; when in doubt, demote rather than delete.

### Step 3 — Resolve every pointer target BEFORE demoting

For each narrative you plan to demote, name where its body lives. If it has a decisions/lessons/archive page — point there. **If it has no home, create the home first** (write the decisions or lessons page from the narrative you're about to demote), then point at it. A demotion whose pointer resolves to nothing is a lost rule body — the exact failure `indusk context check-pointers` exists to catch.

### Step 4 — Report

Emit the plan without touching CLAUDE.md:

```
Compaction plan for CLAUDE.md ({size} B → est. {projected} B, budget {budget} B)

DEMOTE (narrative → rule + pointer):   {N} entries, ~{bytes} B reclaimed
  - "{plan-x} shipped in 1.X..." (3 paragraphs) → one line + /decisions/{plan-x}
  - ...
MOVE (→ current.md):                    {N} entries
  - "currently mid-migration on..." → Project (shared)
KEEP (load-bearing, untouched):         {N} entries
CREATE (missing pointer homes):         {N} pages
  - apps/docs/src/decisions/{plan-y}.md  (body for {plan-y}'s demotion)
DROP (dead, with reason):               {N} entries
  - "{retired thing}" — {why it needs no pointer}

Projected result: {projected} B ({under|OVER by N} budget).
Run /compact-context --apply to execute.
```

If the projection is still over budget, say so and deepen the pass (more demotions) before offering `--apply` — landing under budget in one pass is the goal, because the hook blocks any write that leaves the file over, including a partial improvement.

### Step 5 — Apply (only on `--apply` + confirmation)

1. Create any pointer-home pages named in the report (Step 3).
2. Move operational-state entries to `.indusk/current.md`.
3. Rewrite CLAUDE.md with narratives demoted to rule + pointer. **Because the file is over budget, the budget hook will block a growing edit — so the apply must be a single Write of the fully-compacted file, or a sequence of edits each of which nets smaller.** A single `Write` of the final compacted content is the reliable path: it lands under budget in one shot and the hook passes it.
4. `indusk context check-pointers` — every pointer must resolve. A dead pointer is a lost rule body; fix it before finishing.
5. `wc -c CLAUDE.md` — confirm under budget. State the before/after: "{before} B → {after} B, {pct}% reduction, {tokens} tokens/session reclaimed."

## Guardrails

- **Never delete a rule.** Convention/gotcha *rule sentences* survive verbatim; only their prose justification moves behind a pointer.
- **Never leave a dangling pointer.** Create the home before you demote, and verify with `check-pointers` after.
- **Never raise the budget to avoid the work.** `context.claude_md_budget_bytes` is a deliberate config lever, not an escape hatch — raising it ratifies the per-session token tax the budget exists to prevent. Bumping it slightly as a *bridge* (land a critical line now, compact properly next) is defensible; bumping it *instead of* compacting is the failure mode the hook was built to stop.
- **Report before apply, always.** The classification is editorial; a human confirms it.

## When to run

- The budget hook blocked an edit and told you to run the compaction ritual.
- `wc -c CLAUDE.md` is near or over `context.claude_md_budget_bytes` (check at `/catchup` if you like).
- A project the budget hook was installed *onto* after it had already grown (the common case — the hook can't retroactively shrink; this skill does).
- A migrated/copied CLAUDE.md carrying another project's accreted narrative (e.g. a workbench cloned from an older one).

## Relationship to the rest of the system

- **Retrospective's Compaction step** — the incremental half; runs at every plan close. This skill is the bulk half; run it when the incremental cadence has fallen behind or never started.
- **`indusk context check-pointers`** — the verifier; this skill runs it as Step 4/5.4.
- **`indusk prune --dry-run`** — the measurement surface; this skill uses it in Step 1 to find the bytes.
- **The budget hook (`claude-md-budget.js`)** — the enforcer whose error message points here.

See [the context-budget guide](../../docs/src/guide/context-budget.md) for the full decay-loop rationale.

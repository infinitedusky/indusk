---
title: "Story-first impl phases"
date: 2026-10-14
status: accepted
---

# Story-first impl phases

## Goal

**A person reads a plan's phases as a story, and opens the technical detail only when they want it.**

Today a phase is a list of technical instructions: type names, file paths,
commands. Reading component-content's phases, Sandy could not tell what each
phase did or how it served the plan. After this, each phase opens with what it
does for the whole plan, each task is a plain sentence, and the instruction an
agent needs is folded beneath it, on the page and in the file.

## Y-Statement

**In the context of:**
an impl that is read by two audiences at once: a person who approves and follows the plan, and an agent that builds from it, with hooks that parse the same file to gate every checkoff.

**Facing:**
a checklist whose item text is the technical instruction itself, so the person cannot follow it, and two scripts that check the file (`validate-impl-structure.js` when it is saved, `check-gates.js` when a box is ticked) that read box-shaped and opt-out-shaped text anywhere in the file, so any prose added under an item could move a gate.

**We decided for:**
a phase paragraph between the `**Tier**:` line and the first task, and each task as one sentence on the checkbox line with its detail in an indented `<details><summary>Technical</summary>` block beneath it; opted into with `phase_story: required` in the impl's frontmatter and checked by `validate-impl-structure.js`; both scripts reading only column-zero checkbox and opt-out lines; the parser keeping the phase paragraph and each item's detail whole, fences included; the admin rendering the paragraph and the detail as markdown in a closed disclosure.

**And against:**
a plain indented note the admin collapses on its own (the file would stay unreadable on GitHub and in the docs site, where `<details>` folds natively); a separate "story" document beside the impl (two homes for one phase, which drift); writing the story only in the admin (the agent and the person would read different plans); making the shape mandatory for every existing impl (dozens of archived impls would need rewriting for no reader).

**To achieve:**
a phase a person can follow without reading code or knowing the plan's shorthand, the same text in the file, on GitHub and on the plan page, and folded detail that can never tick a box, skip a gate or add a task (the test plan's assertions under `hidden-detail-is-only-read`).

**Accepting:**
that the save check can see a paragraph and a sentence are present but not that they are plain, so plainness stays a judgement at approval; and that a task's line may hold no code span, which forces even a short command into the detail.

**Because:**
`<details>` is the one fold that renders in all three places the impl is read, and opting in by frontmatter is how `trajectory:`, `test_phases:` and `test_levels:` were introduced without migrating a single existing plan.

## Context

See `research.md`: the parsers already treat a single column-zero line as an
item and indented lines as its note, so the shape survives parsing; the two
hazards are `check-gates.js` counting `- [x]` unanchored and
`validate-impl-structure.js` reading `(none needed)` on any line; the admin
shows the note raw and drops fences. The brief makes three promises
(`an-impl-phase-tells-its-story`, `technical-detail-opens-on-request`,
`hidden-detail-is-only-read`) and changes the look `phase-row.open`.

## Decision

1. **The shape.**

   ```markdown
   ### Build Phase 1: {name}

   **Tier**: med — the work step's default

   {What this phase does for the plan: one short paragraph, plain words, tying
   the phase to the plan's promises and to the phases before and after it.}

   - [ ] {One plain sentence: what will be true once this task is done}
     <details><summary>Technical</summary>

     {The instruction as written today: names, paths, signatures, fences.}

     </details>
   ```

   The detail is optional for a task that needs none. Gate sections
   (Verification, OTel, Context, Document) and Test Phase 1's tasks follow the
   same shape: "Tests T1 and T2 pass" on the line, the command in the detail.
   Register entries (`#### Deferred to …`, `#### Regression Guards`) are not
   tasks and are unchanged.

2. **The rule.** With `phase_story: required`, `validate-impl-structure.js`
   refuses a phase with no paragraph between its Tier line (or heading) and its
   first task or `####`, naming the phase; and a task line holding a code span
   (backticks) or a row label (`\b[TA]\d+\b`), naming the task; and a
   phase paragraph holding a row label, naming the phase. Ritual phases
   authored later (Falsification, Cleanup) are held the same way once the
   impl opts in.

   **Written for someone without the shorthand.** Sandy's rule (2026-10-14):
   a paragraph or sentence is written for someone who has worked on the
   project but knows none of its shorthand — no row labels, no abbreviations,
   no nicknames ("the checkers"), no pronoun whose referent is unclear. Row
   labels are refused mechanically; the rest is a writing prompt in the
   planner, with a before-and-after example, and a person's judgement at
   approval.

   **Verification names its rows in the detail.** The rule that every
   Verification section names the trajectory rows it proves (the
   cross-reference rule, in both `validate-impl-structure.js` and
   `lib/trajectory/validator.ts`) reads, in an opted-in impl, row labels from
   each Verification task's folded detail as well as its line. Reading a
   label for this rule ticks nothing, skips nothing and adds no task, so it
   keeps `hidden-detail-is-only-read`. Until that change lands, this plan's
   own Verification tasks carry their labels in a trailing bracket on the
   line, removed by Build Phase 1's last task.

3. **Detail is only read.** `check-gates.js` counts only lines matching
   `^-\s+\[[ x]\]`; `validate-impl-structure.js` reads an opt-out only on a
   column-zero line of a gate section; both parsers already take items only
   from column zero.

4. **The parser.** `parseImplString` gains `ImplPhase.story?: string` and
   `ChecklistItem.detail?: string`: the indented block under an item,
   de-indented, `<details>`/`<summary>` wrappers removed, fences kept. `note`
   stays as it is for impls that have not opted in.

5. **The page.** `PhaseRow` gains a `story` slot drawn above its items;
   `PlanParts` renders each item's `detail` through `components/Markdown.tsx`
   inside a closed `<details>` labelled "Technical", and keys items by index.

6. **The rule is written down.** The planner skill's impl template and step-7
   guidance, the planning `CLAUDE.md` template's "The impl" section, and the
   workflow templates carry the shape; new impls set `phase_story: required`.

## Alternatives Considered

### A plain indented note, collapsed by the admin

Reads in the admin only. On GitHub and in the docs site the technical text
would sit open under every task, which is the problem Sandy named.

### A separate story document

Two documents describing one phase drift apart; the codebase has three lessons
about two homes for one fact.

### Story only in the admin

The agent building the plan would read a different plan from the person
approving it.

## Consequences

### Positive
- A phase is readable by a person who does not read code, in every place the impl is read.
- Two latent hazards in the two checking scripts (unanchored checkbox counting, unanchored opt-out reading) are closed for every impl, opted in or not.

### Negative
- Impls get longer: a paragraph per phase and a fold per task.
- Writing a plain sentence for every task is real work for the planner, and a weak one reads worse than the technical line it replaced.

### Risks
- Anchoring `check-gates.js`'s count could miss a checkoff written with leading spaces. Mitigation: A9 runs both ways; a nested checkbox was never an item to either parser.

## Documentation Plan

### Pages
- Update: `apps/docs/src/guide/test-trajectory.md` or the impl guide page that shows the impl shape — the story paragraph and the fold.
- Update: `apps/docs/src/reference/skills/planner.md` — the new frontmatter key and the rule.

### Diagrams
- None.

### Changelog
- "Impl phases open with what they do for the plan; tasks are plain sentences with their technical detail folded beneath."

### ADR in Docs
- Yes: `decisions/story-first-phases.md`.

## References
- `research.md`, `brief.md`, `test-plan.md` in this folder
- `.indusk/planning/component-content/` — the first plan converted

# Phase summaries — a phase that explains itself

**Decided 2026-10-14.** Full ADR: `.indusk/planning/story-first-phases/adr.md`.

## Goal

**A person reads what each phase of a plan does, and opens the technical detail only when they want it.**

A phase used to be a list of technical instructions: type names, file paths,
commands. Reading component-content's phases, Sandy could not tell what each
phase did or how it served the plan. Now each phase opens with what it does
for the whole plan, each task is a plain sentence, and the instruction an
agent needs is folded beneath it, on the page and in the file.

## Y-Statement

**In the context of:**
an impl read by two audiences at once — a person who approves and follows the plan, and an agent that builds from it — with hooks that parse the same file to gate every checkoff.

**Facing:**
a checklist whose item text was the technical instruction itself, so the person could not follow it; and two scripts that check the file (`validate-impl-structure.js` when it is saved, `check-gates.js` when a box is ticked) that read box-shaped and opt-out-shaped text anywhere, so prose added under an item could move a gate.

**We decided for:**
a phase paragraph between the `**Tier**:` line and the first task, and each task as one sentence on the checkbox line with its detail in an indented `<details><summary>Technical</summary>` block beneath it; opted into with `phase_summary: required` and checked by `validate-impl-structure.js`; both scripts reading only column-zero checkbox and opt-out lines; the parser keeping the phase paragraph and each item's detail whole, fences included; the admin rendering the paragraph and the detail as markdown in a closed disclosure.

**And against:**
a plain indented note the admin collapses on its own (unreadable on GitHub and in the docs site, where `<details>` folds natively); a separate summary document beside the impl (two homes for one phase, which drift); a summary only in the admin (the agent and the person would read different plans); making the shape mandatory for every existing impl (dozens of archived impls rewritten for no reader).

**To achieve:**
a phase a person can follow without reading code or knowing the plan's shorthand, the same text in the file, on GitHub and on the plan page, and folded detail that can never tick a box, skip a gate or add a task.

**Accepting:**
that the save check can see a paragraph and a sentence are present but not that they are plain, so plainness stays a judgement at approval; and that a task's line may hold no code span, which forces even a short command into the detail.

**Because:**
`<details>` is the one fold that renders in all three places the impl is read, and opting in by frontmatter is how `trajectory:`, `test_phases:` and `test_levels:` were introduced without migrating a single existing plan.

## Decision

1. **The shape.** A phase paragraph after the Tier line; each task one plain sentence with an optional folded Technical detail. Gate tasks (Verification, OTel, Context, Document) and Test Phase 1's tasks follow the same shape — "the save check refuses the shapes it should" on the line, the command in the detail. Register entries are not tasks and are unchanged. See [Test Trajectory — Phase summaries](/guide/test-trajectory#phase-summaries-a-phase-that-explains-itself).
2. **The rule.** With `phase_summary: required`, the save check refuses a phase with no paragraph, naming the phase; a phase paragraph holding a row label, naming the phase and the label; and a task line holding a code span or a row label, naming the task. Ritual phases authored later (Falsification, Cleanup) are held the same way.
3. **Written for someone without the shorthand.** A paragraph or sentence is written for someone who has worked on the project but knows none of its shorthand — no row labels, no abbreviations, no nicknames, no pronoun whose referent is unclear. Row labels are refused mechanically; the rest is a writing prompt in the planner and a person's judgement at approval.
4. **Verification names its rows in the detail.** The rule that every Verification section names the trajectory rows it proves reads, in an opted-in impl, row labels from each Verification task's folded detail as well as its line — in the hook and in its TypeScript twin, `lib/trajectory/validator.ts`.
5. **Detail is only read.** For every impl, `check-gates.js` counts only checkbox lines at column zero, and `validate-impl-structure.js` reads an opt-out only on a column-zero line of a gate section; both impl readers already took items only from column zero.
6. **The parser and the page.** `parseImplString` keeps each phase's paragraph and each task's detail, fences included; the plan page draws the paragraph above an open phase's tasks and each detail in a closed "Technical" fold rendered as markdown.

## Consequences

- A phase is readable by a person who does not read code, in every place the impl is read.
- Two latent hazards in the two checking scripts — unanchored checkbox counting and unanchored opt-out reading — are closed for every impl, opted in or not.
- Impls get longer: a paragraph per phase and a fold per task. A weak plain sentence reads worse than the technical line it replaced.

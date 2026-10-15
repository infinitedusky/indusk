---
title: "Story-first impl phases"
date: 2026-10-14
status: complete
---

# Story-first impl phases — Research

## Question

How should an impl's phases be written so a person can read what each phase
does, and what it does for the whole plan, without reading the technical
detail, while the detail stays one click away?

## Background

Sandy, reading component-content's impl (2026-10-14): "when I look at the
phases, it is really hard to understand the tasks in each phase. Could they be
listed as explanations, and done in a way that tells a story of what it will
do for the whole plan? Then have detail that can open the technical summary
that currently shows?"

Today a phase is a heading, a Tier line and checklist items whose text is the
technical instruction itself: type names, file paths, code. The impl template
in the planner skill (`apps/indusk-mcp/skills/planner.md`, the impl template's
Build Phase block) asks for exactly that: "Task — include code snippets when
syntax matters". Nothing asks for a plain reading, and nothing ties a phase to
the plan as a whole.

The shape proposed in that conversation:

```markdown
### Build Phase 1: Compose fills content

**Tier**: med — the work step's default

**What this phase does for the plan:** today a placed button always shows its
story's words. After this phase, a mockup can hand it "Create project" and the
button shows those words instead. …

- [ ] A snapshot remembers where its words sit
  <details><summary>Technical</summary>

  `SnapshotBytes` gains `content?: …`
  </details>
```

## Findings

### The parsers survive the shape

- `apps/indusk-mcp/src/lib/impl-parser-core.ts` (`parseImplString`, what the
  admin reads): an item is one line matching `/^-\s+\[([ x])\]\s+(.*)/`;
  indented lines after it become its `note`, trimmed, with a leading `- `
  stripped. Blank lines are dropped. Fenced blocks are skipped entirely
  (`FENCE` in `impl-headings.ts` matches indented fences), so a code block
  inside the detail vanishes from the note. Unindented paragraphs are ignored.
- `apps/indusk-mcp/hooks/_impl-phases.js` (what `check-gates.js` reads): the
  same single-line item regex, fences masked.
- `hooks/_phase-tier.js` finds `**Tier**:` anywhere before the next heading, so
  a paragraph after it is harmless; `planner-tier-line.test.ts` only requires
  the Tier line before the first item or `####`.

### Two hazards: detail text read as structure

- `hooks/check-gates.js` decides whether an edit is a checkoff by counting
  `- [ ]` / `- [x]` anywhere in the edit, with no line anchor. A detail
  containing `- [x]` (a code sample, a quoted checklist) counts as a checkoff.
- `hooks/validate-impl-structure.js` detects a gate opt-out by `(none needed)`
  or `skip-reason:` on any line of the gate section. Those strings in a
  detail mark the gate opted out.

Neither has been seen to fire; nothing prevents either.

### The admin shows the detail raw

- `apps/indusk-admin/src/components/plan/PlanParts.tsx` renders `item.text`
  as plain text and `item.note` as plain text with `whitespace-pre-line`: the
  `<details>` and `<summary>` tags and backticks would show literally, and the
  code is already gone. Items are keyed by `item.text`.
- The parser keeps no phase intro: phase name, gates, blocker, forward
  intelligence only. Markdown renders only through `components/Markdown.tsx`,
  which items do not use.
- The admin's look `phase-row.open` (`.indusk/mockups/admin/screens/`) is the
  held look for an open phase; `apps/indusk-admin/src` is under the admin's
  `sources`, so this plan changes a look.

### Where the rule is written

- The impl template and step-7 guidance: `apps/indusk-mcp/skills/planner.md`.
- The impl rules: `apps/indusk-mcp/templates/planning/CLAUDE.md`, "The impl".
- Pinned byte-equal by `skill-sync-parity.test.ts` to `.claude/skills/` and
  `.indusk/planning/CLAUDE.md`; template text pinned by
  `planner-tier-line.test.ts`, `planner-verification-template.test.ts`,
  `lib/trajectory/template.test.ts`.
- Opt-in is by frontmatter, as `trajectory:`, `test_phases:`,
  `test_levels:` are: existing impls keep validating unchanged.

## Decisions

- **The rule for every plan, not one plan's rewrite** (Sandy, 2026-10-14).
  component-content's impl is converted as this plan's first example.
- **The third promise is worded for a reader** (Sandy, 2026-10-14): "never
  moves a gate" meant nothing to Sandy; it became "what is written in a task's
  hidden detail is only read".
- **Written for someone who knows the project but none of its shorthand**
  (Sandy, 2026-10-14, after reading my summary of this plan): no row labels
  like A4, no abbreviations, no nicknames ("the checkers" meant nothing — say
  "the two scripts that check an impl file when it is saved and when a box is
  ticked"), no pronoun whose referent is unclear. Row labels are refused
  mechanically; the rest is a writing prompt in the planner. Verification
  tasks therefore name their test rows in the folded detail, and the save
  check reads them there.
- Taken as the default, open for correction at the brief: the checker refuses
  a missing phase paragraph or plain sentence (whether the writing is plain
  stays a person's judgement at approval); gate items (Verification, Context,
  Document) get a plain sentence too, the command moving into the detail;
  component-content's conversion is the last item of this plan.

## Open Questions

- Whether `<details>` is the right carrier in the markdown, or a plain
  indented block the admin collapses on its own. `<details>` renders
  collapsed on GitHub and in VitePress as well; the admin must parse it
  either way.

---
title: "Phase summaries"
date: 2026-10-14
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "181321d2decd555fd7ac6983b4af314370152c2342ae9394a5121eafb2136d25"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-15T00:03:05.255Z"
---

# Phase summaries

## Goal

A plan's phases explain themselves: each phase opens with what it does for the
whole plan, each task is one plain sentence written for someone who has worked
on the project but knows none of the plan's shorthand, and the technical
instruction is folded beneath it, in the file, on GitHub and on the plan page.
Folded detail is only read: it never ticks a box, skips a gate or adds a task.
This impl is written in the shape it introduces.

## Scope

### In Scope
- The two scripts that check an impl file (`validate-impl-structure.js` when it is saved, `check-gates.js` when a box is ticked): counting and opt-outs read from top-level lines only; the new rule behind `phase_summary: required`, including the refusal of row labels.
- The parser keeping each phase's paragraph and each task's detail whole.
- The plan page drawing the paragraph and a closed "Technical" fold per task.
- The planner skill, the planning rules and the workflow templates writing new impls this way, with a prompt for writing without shorthand.
- component-content's impl converted as the first example.

### Out of Scope
- Rewriting any other existing impl. The shape is opt-in.
- Judging whether a sentence is plain. That is a person's, at approval.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | every authorable test, red; the plan-page fold test's body in the register | the test plan |
| Build Phase 1 | top-level-only counting in `check-gates.js`; top-level-only opt-outs, the `phase_summary` rule and detail-read row labels in `validate-impl-structure.js` and `lib/trajectory/validator.ts` | Test Phase 1's tests |
| Build Phase 2 | `ImplPhase.summary`, `ChecklistItem.detail` in `impl-parser-core.ts`; `PhaseRow`'s `summary` slot; `PhaseItems` in the admin; the phase row's re-rendered Storybook story | Build Phase 1's rule (the fixtures it validates) |
| Build Phase 3 | the shape and the writing prompt in `skills/planner.md`, `templates/planning/CLAUDE.md`, `templates/workflows/*`; docs; component-content converted | Build Phases 1–2 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | An opted-in impl with a phase that goes straight from its Tier line to its tasks is refused, naming the phase | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/phase-summary-rule.test.ts |
| A2 | An opted-in impl whose task line carries code is refused, naming the task and saying the code belongs in its detail | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/phase-summary-rule.test.ts |
| A3 | Test-phase tasks and Verification, Context and Document tasks with a command on the line are refused the same way | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/phase-summary-rule.test.ts |
| A4 | The impl template the planner hands out is written in this shape and passes the save check as written | Test Phase 1 | Build Phase 3 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/planner-impl-summary-template.test.ts |
| A14 | An opted-in impl whose phase paragraph or task sentence contains a row label is refused, naming the phase or task and the label | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/phase-summary-rule.test.ts |
| A15 | A Verification task with its row labels only in its folded detail satisfies the rule that each Verification section names the tests it proves | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/phase-summary-rule.test.ts |
| A16 | The planner's impl instructions tell it to write for someone who knows the project but none of its shorthand, with a before-and-after example | Test Phase 1 | Build Phase 3 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/planner-impl-summary-template.test.ts |
| A5 | An open phase on the plan page shows the phase's paragraph above its tasks | Test Phase 1 | Build Phase 2 | passing | unit | promise: technical-detail-opens-on-request | apps/indusk-admin/src/components/ui/PhaseRow.test.tsx |
| A6 | Each task shows only its sentence until "Technical" is opened; opened, code shows as code, a fenced block included, and no details or summary tag shows as text | Build Phase 2 | Build Phase 2 | passing | unit | promise: technical-detail-opens-on-request | apps/indusk-admin/src/components/plan/PhaseItems.test.tsx |
| A7 | A code block inside a task's detail reaches the page whole: the parser keeps the detail, fences included | Test Phase 1 | Build Phase 2 | passing | unit | promise: technical-detail-opens-on-request | apps/indusk-mcp/src/lib/impl-parser.test.ts |
| A8 | The open phase row drawn from the real component matches the mockup Sandy approved | Build Phase 2 | Build Phase 2 | passing | live check | the look phase-row.open, held by its approval in the cockpit | |
| A9 | Editing a task's detail so it contains a ticked box is not treated as a checkoff: no gate is judged and the edit goes through | Test Phase 1 | Build Phase 1 | passing | unit | promise: hidden-detail-is-only-read | apps/indusk-mcp/src/__tests__/detail-is-only-read.test.ts |
| A10 | A gate section whose only real task has a detail containing an opt-out phrase is held as a real task, not a skipped gate | Test Phase 1 | Build Phase 1 | passing | unit | promise: hidden-detail-is-only-read | apps/indusk-mcp/src/__tests__/detail-is-only-read.test.ts |
| A11 | A box-shaped line inside a task's detail adds no task to the parser's count or to the tick check's count | Test Phase 1 | Test Phase 1 | passing | unit | promise: hidden-detail-is-only-read | apps/indusk-mcp/src/__tests__/detail-is-only-read.test.ts |
| A12 | Every impl in the repository that has not opted in validates exactly as it did before | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over the existing plans: the shape is opt-in and must break none of them | apps/indusk-mcp/src/__tests__/phase-summary-existing-impls.test.ts |
| A13 | component-content's impl, rewritten in this shape, passes the save check and reads on its plan page as the mockup shows | Build Phase 3 | Build Phase 3 | passing | live check | the first plan converted, the example Sandy asked for | |
| A17 | A ritual phase whose only task is ticked reads as finished, and a Verification section whose only task is ticked reads as green, even when that task's folded detail quotes an unticked box line | Build Phase 4 | Build Phase 4 | passing | unit | promise: hidden-detail-is-only-read | apps/indusk-mcp/src/__tests__/detail-is-only-read.test.ts |
| A18 | The falsification and cleanup skills' phase templates, filled in as written, pass the save check on an impl that has opted in to phase summaries | Build Phase 4 | Build Phase 4 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/ritual-templates-phase-summary.test.ts |
| A19 | The phase-summary rule, read from its own hook module, names the same problems for a missing paragraph, code on a task line and a row label in a paragraph or a task as the save check does | Build Phase 5 | Build Phase 5 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/phase-summary-module.test.ts |
| A20 | Both phase-row stories, drawn by the plan page's real task list instead of copied markup, are approved again in the cockpit | Build Phase 5 | Build Phase 5 | passing | live check | the look phase-row.open and phase-row.closed, held by their approval in the cockpit | |
| A21 | On an impl that has opted in, an edit that removes a phase's paragraph, or puts code or a row label on a task line, or a row label in a paragraph, is refused, while an edit that adds no new problem still goes through | Build Phase 6 | Build Phase 6 | written | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/phase-summary-rule.test.ts |
| A22 | On an impl that has opted in, a task line with nothing after its box is refused, naming the phase | Build Phase 6 | Build Phase 6 | written | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/phase-summary-rule.test.ts |
| A23 | A task fold that is opened and never closed is refused when the impl is saved, naming the task, and hides nothing, so an unticked task after it keeps a cleanup phase unfinished | Build Phase 6 | Build Phase 6 | written | unit | promise: hidden-detail-is-only-read | apps/indusk-mcp/src/__tests__/detail-is-only-read.test.ts |
| A24 | Ticking a box inside a task's fold, with the edit's old text starting at the box's dash, is not read as a checkoff by the tick check | Build Phase 6 | Build Phase 6 | written | unit | promise: hidden-detail-is-only-read | apps/indusk-mcp/src/__tests__/detail-is-only-read.test.ts |
| A25 | A box ticked inside a task's fold produces no checkoff commit in the gated loop | Build Phase 6 | Build Phase 6 | written | unit | promise: hidden-detail-is-only-read | apps/indusk-mcp/src/lib/run/commit-cadence.test.ts |
| A26 | The repair phase a broken promise adds to an impl that has opted in passes the save check | Build Phase 6 | Build Phase 6 | written | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/lib/promises/reopen-phase-summary.test.ts |
| A27 | A parsed impl's phase paragraph and task detail reach the plan page whole, the paragraph formatted, code shown as code | Build Phase 6 | Build Phase 6 | written | unit | promise: technical-detail-opens-on-request | apps/indusk-admin/src/components/plan/PlanParts.test.tsx |

## Checklist

### Test Phase 1: Write every test first, failing

**Tier**: med — the work step's default

Before any code changes, this phase writes down what "done" means as tests that fail today. They cover three things: the check that runs when an impl is saved refusing a phase with no summary, a task with code on its line, or a row label in either; the plan page showing the summary and folding the detail; and folded detail never ticking a box or skipping a gate. Most of these tests turn green as Build Phases 1 and 2 land. Two pass from the start, because they guard behaviour that must not change: existing plans still validate, and text indented under a task still adds no task.

**Goal**: author every test that can honestly be authored now, and record every test that cannot.

- [x] This plan has its own worktree
  <details><summary>Technical</summary>

  `indusk worktree create story-first-phases`, or `indusk worktree assign story-first-phases <path>` for the one `plans start` made — worktree-per-plan default.

  </details>
- [x] Tests that the save check refuses a phase with no summary, a task with code on its line, and a row label in either, failing for now
  <details><summary>Technical</summary>

  A1–A3, A14, A15 in `phase-summary-rule.test.ts`, driven through the real hook as `phase-tier-rule.test.ts` does (`runHook("validate-impl-structure.js", …)` over `implText(...)` with `phase_summary: required` added to the frontmatter). A1: no paragraph between `**Tier**:` and the first item → exit 2 naming `Build Phase 1`. A2: an item line with a backticked name → exit 2 naming the item. A3: the same for a Test Phase 1 item and a Verification item. A14: a paragraph holding `A2`, and an item sentence holding `T3` → exit 2 naming each and the label. A15: a Verification item whose line has no label and whose detail names a trajectory row → no cross-reference error (red today: the rule reads the line only). Each also asserts the well-formed shape passes, so red is on the refusal, not on a broken fixture. Add the same A15 case to `src/lib/trajectory/validator.test.ts` for the TypeScript twin of the rule.

  </details>
- [x] Tests that the planner's impl template follows the shape and its instructions ask for writing without shorthand, failing for now
  <details><summary>Technical</summary>

  `planner-impl-summary-template.test.ts`. A4: extract the impl template's fenced block from `skills/planner.md` (the block after `### impl.md`), fill its `{…}` placeholders with fixed words, run it through `validate-impl-structure.js`; assert its frontmatter carries `phase_summary: required`. A16: step 7 of `skills/planner.md` contains the phrase "knows none of its shorthand" and a before/after pair. Red today on both.

  </details>
- [x] A test that an open phase on the plan page shows its paragraph, failing for now
  <details><summary>Technical</summary>

  A5 in `PhaseRow.test.tsx`: render with a `summary="…"` prop and assert the text appears in the open row before the children. Red today: the prop is unknown and nothing draws it (vitest does not type-check, so the file loads).

  </details>
- [x] A test that reading an impl keeps a task's folded detail whole, code included, failing for now
  <details><summary>Technical</summary>

  A7 in `impl-parser.test.ts`: an item followed by an indented `<details><summary>Technical</summary>` block holding prose and a fenced block; assert `item.detail` holds the prose and the fence's body with the wrappers removed, and `phase.summary` holds the paragraph. Red today: neither field exists and the fence is skipped.

  </details>
- [x] Tests that folded detail never ticks a box, skips a gate or adds a task
  <details><summary>Technical</summary>

  `detail-is-only-read.test.ts`. A9: an Edit whose `old_string`/`new_string` change only an indented `  - [x] example` line inside a detail → `check-gates.js` exits 0 without judging gates (red today: its unanchored count sees a new checked box and judges, refusing on the open gates). A10: a Verification section whose single item has a detail line `(none needed)` → `validate-impl-structure.js` does not treat the gate as opted out (red today on a `strict`-policy fixture, where an opt-out is refused at write). A11: an indented box line in a detail → `parseImplString` and `_impl-phases.js` count the same items as without it (green today).

  </details>
- [x] A test that every existing impl still validates exactly as before
  <details><summary>Technical</summary>

  A12 in `phase-summary-existing-impls.test.ts`: for every `impl.md` under `.indusk/planning/` and `.indusk/planning/archive/` without `phase_summary:`, run the save check's Write path and record the exit code; assert each matches a snapshot taken now. No server, no clock — one spawned node per impl.

  </details>

#### Deferred to Build Phase 2

- **A6** — its subject is `PhaseItems`, the item list Build Phase 2 lifts out of `PlanParts.tsx`; the import would fail to load today, which is an absent test, not a red one. A8 is a person's look in the cockpit at the same phase. Body reviewed:

  ```tsx
  import { describe, expect, it } from "vitest";
  import { render } from "vitest-browser-react";
  import { PhaseItems } from "./PhaseItems";

  const items = [
    { checked: false, text: "Placing a component puts your words in place", detail: "`compose` walks each path.\n\n```ts\ncompose(snapshot, { title: \"Create project\" })\n```" },
  ];

  describe("PhaseItems", () => {
    it("shows the sentence and keeps the detail closed until opened", async () => {
      const { container } = await render(<PhaseItems items={items} />);
      const fold = container.querySelector("details") as HTMLDetailsElement;
      expect(container.textContent).toContain("Placing a component");
      expect(fold.open).toBe(false);
      fold.querySelector("summary")?.click();
      expect(fold.open).toBe(true);
      expect(fold.querySelector("pre code")?.textContent).toContain("compose(snapshot");
      expect(fold.querySelector("code")?.textContent).toBe("compose");
      expect(container.textContent).not.toMatch(/<\/?(details|summary)/);
    });
  });
  ```

#### Deferred to Build Phase 3

- **A13** — a person reads component-content's converted impl on its plan page; the conversion is Build Phase 3's last task.

#### Deferred to Build Phase 4

- **A17** and **A18** — found by the falsification ritual after Build Phase 3 closed, so no earlier phase could author them; their subjects exist today, so Build Phase 4 writes them red on their own assertions at its start.

#### Deferred to Build Phase 5

- **A19** — its subject is the hook module Build Phase 5 extracts; importing it today would fail to load, which is an absent test, not a red one.
- **A20** — a person's look in the cockpit once the stories draw the real task list, at the same phase.

#### Deferred to Build Phase 6

- **A21** to **A27** — found by the audit after Build Phase 5 closed, so no earlier phase could author them; every subject exists today, so Build Phase 6 writes them red on their own assertions at its start.

#### Regression Guards

- **A11** — both impl readers already take items only from column zero; the row holds that as the two checking scripts change around it.
- **A12** — the shape is opt-in; every existing impl must validate as it did, with no red window by design.

#### Test Phase 1 Verification

- [x] Every new test fails on its own assertion rather than on a missing file, and the two guards pass
  <details><summary>Technical</summary>

  Red: A1–A5, A7, A9, A10, A14–A16. Green: A11, A12. `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/phase-summary-rule.test.ts src/__tests__/planner-impl-summary-template.test.ts src/lib/impl-parser.test.ts src/lib/trajectory/validator.test.ts src/__tests__/detail-is-only-read.test.ts src/__tests__/phase-summary-existing-impls.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/ui/PhaseRow.test.tsx`.

  </details>
- [x] The plan-page fold test's body, kept in the register above, is checked: it will load once its component exists, and it asserts what its row claims

### Build Phase 1: The save check and the tick check hold the shape

**Tier**: strong — edits check-gates.js, which every ticked box in every plan passes through

Two scripts check an impl file: one when the file is saved (`validate-impl-structure.js`), and one when a box is ticked (`check-gates.js`). This phase changes both. The save check learns the new rule for impls that opt in: it refuses a phase with no summary paragraph, a task with code on its line, and a row label in a paragraph or sentence. It also reads a Verification task's row labels from its folded detail, so the sentence can stay plain. Both scripts stop reading anything indented under a task as a ticked box or a skipped gate, which is what makes it safe to fold text there. After this phase, a plan can be written in the new shape and be held to it. The plan page still shows the fold as raw text until Build Phase 2.

- [x] A ticked box is counted only from a top-level line, never from text folded under a task
  <details><summary>Technical</summary>

  `hooks/check-gates.js`, the Edit and Write transition counts: replace `/- \[x\]/g` and `/- \[ \]/g` with `/^-\s+\[x\]/gm` and `/^-\s+\[ \]/gm`. Applies to every impl, opted in or not — an indented box was never an item to either impl reader.

  </details>
- [x] A gate is read as skipped only from a top-level line, never from text folded under a task
  <details><summary>Technical</summary>

  `hooks/validate-impl-structure.js`, `isOptOutLine`: require the line to start at column zero (`!/^\s/.test(line)`) before matching `(none needed)`, `(not applicable)` or `skip-reason:`. Check `check-gates.js` and `_impl-phases.js` for the same unanchored read and anchor it alike.

  </details>
- [x] For an impl that opts in, the save check refuses a phase with no summary, a task with code on its line, and a row label in either
  <details><summary>Technical</summary>

  New rule in `validate-impl-structure.js`, gated on `/^phase_summary:\s*required/m` like `test_phases`. For each `###` phase: the lines between its heading (or `**Tier**:` / `**Goal**:` line) and its first item or `####` must hold at least one non-blank, non-label paragraph line — refused naming the phase; that paragraph must hold no `\b[TA]\d+\b` — refused naming the phase and the label. For each column-zero item: its text after the box must hold no backtick and no `\b[TA]\d+\b` — refused naming the item: "a task is one plain sentence for someone who knows the project but none of its shorthand; code and row labels belong in its Technical detail". The Verification exemption below applies only to the cross-reference rule, not to this one. Register sections (`#### Deferred to …`, `#### Regression Guards`) hold entries, not items, and are not read. Message ends `promise: an-impl-phase-explains-itself`.

  </details>
- [x] For an impl that opts in, a Verification task may name the tests it proves in its folded detail instead of its sentence
  <details><summary>Technical</summary>

  The cross-reference rule (`validateCrossReferenceIntegrity` in `validate-impl-structure.js`, and its twin in `src/lib/trajectory/validator.ts`): when `phase_summary: required`, also collect `\b[TA]\d+\b` from the indented lines under each Verification item, up to the next column-zero line. Unknown labels there are refused as they are on the line. Reading a label ticks nothing and skips nothing, so `hidden-detail-is-only-read` holds.

  </details>
- [x] This plan's own Verification sentences drop their bracketed row labels, which now sit only in the fold, and this impl passes its own rule
  <details><summary>Technical</summary>

  Until the two tasks above land, the save check requires labels on the Verification line, so this impl carries them in a trailing bracket. Remove each bracket (the Test Phase 1 and Build Phase 1–3 Verification lines), keeping the labels in the details; the save of that edit runs the new rule over this file.

  Run from a session started inside this worktree (decided with Sandy, 2026-10-15): a session started in the main checkout runs the main checkout's copy of the hooks, the old save check, which refuses this edit.

  </details>
- [x] A task added by the review step that follows each phase's tests is written as a plain sentence, with its file and rule in its fold, so the new rule never refuses it
  <details><summary>Technical</summary>

  Found while building this phase (Sandy agreed, 2026-10-15): `appendFindingToPhase` (`src/lib/shape/findings.ts`) and `recordLeftAsIs` / `recordReviewedNothingFound` (`src/lib/shape/shape.ts`) write the file name in backticks on the task line, which the `phase_summary: required` rule refuses. When the impl opts in, write the sentence on the line ("Shape: {change}") and `file`, `rule` and the reason in an indented `<details><summary>Technical</summary>` block; leave the output for impls that have not opted in unchanged. Add cases to those modules' tests (an opted-in impl body run through the save check after each helper), carrying `promise: an-impl-phase-explains-itself`.

  </details>
- [x] Shape review of the two changed scripts
  <details><summary>Technical</summary>

  Per `/work`: review the changes to `check-gates.js`, `validate-impl-structure.js` and `lib/trajectory/validator.ts` against the enabled extensions' prose rules; findings land as unchecked items in this phase.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 1 Verification

- [x] The save check refuses the shapes it should, folded detail moves nothing, and every existing plan still validates
  <details><summary>Technical</summary>

  Green: A1–A3, A9, A10, A14, A15; still green: A11, A12. `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/phase-summary-rule.test.ts src/lib/trajectory/validator.test.ts src/__tests__/detail-is-only-read.test.ts src/__tests__/phase-summary-existing-impls.test.ts && pnpm exec vitest related hooks/check-gates.js hooks/validate-impl-structure.js src/lib/trajectory/validator.ts`.

  </details>

#### Build Phase 1 Context

- [x] The planning rules say that only top-level lines are read as ticked boxes or skipped gates
  <details><summary>Technical</summary>

  planning: `apps/indusk-mcp/templates/planning/CLAUDE.md`, "The impl", beside the fences entry — "a checkbox or an opt-out is read only from a column-zero line; anything indented under a task is its detail, read for row labels by the cross-reference rule and for nothing else" — guarded by `detail-is-only-read.test.ts` (`promise: hidden-detail-is-only-read`). Sync `.indusk/planning/CLAUDE.md`.

  </details>
- [x] The root project instructions list this decision among the key decisions
  <details><summary>Technical</summary>

  root (Key Decisions): `- Phase summaries: a summary per phase, one plain sentence per task for a reader without the plan's shorthand, technical detail folded beneath; opt-in phase_summary: required — see /decisions/phase-summaries` — always-on because every planning session writes impls and must know the shape exists before reading any plan.

  </details>

#### Build Phase 1 Document

- [x] The docs guide that shows an impl's shape shows the summary, the fold and the opt-in
  <details><summary>Technical</summary>

  Update the impl-shape section of `apps/docs/src/guide/test-trajectory.md` (or the guide page that shows an impl's phase) with the phase paragraph, the fold and `phase_summary: required`; publish the ADR as `apps/docs/src/decisions/phase-summaries.md`.

  </details>

### Build Phase 2: The plan page shows each phase's summary

**Tier**: med — the work step's default

This phase is the part Sandy sees in the admin. The code that reads an impl for the admin starts keeping each phase's paragraph and each task's folded detail, code included. The plan page then draws them: the paragraph at the top of an open phase, each task as its sentence, and under each task a closed "Technical" fold that opens to the formatted detail. After this phase, a plan written in the new shape reads on its page the way the mockup Sandy approves here shows. Build Phase 3 then makes every new plan written that way.

- [x] Reading an impl keeps each phase's paragraph and each task's folded detail
  <details><summary>Technical</summary>

  `src/lib/impl-parser-core.ts`: `ImplPhase.summary?: string` — the paragraph lines after the heading's `**Tier**:`/`**Goal**:` labels and before the first item or `####`. `ChecklistItem.detail?: string` — the indented block under an item, de-indented by its first line's indent, `<details>`/`<summary>…</summary>`/`</details>` lines removed, fences kept (the fence mask must not drop indented fences that belong to an item's detail). `note` is unchanged for items with no `<details>`. Mirror in `_impl-phases.js` only if a hook reads it (none does today).

  </details>
- [x] The admin's phase list carries the paragraph and the detail through to the page
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/phases.ts` and `lib/plan-parts-view.ts`: carry `summary` and `detail`; `lib/markdown-export.ts` writes the detail back as it was.

  </details>
- [x] An open phase on the plan page shows its paragraph above its tasks
  <details><summary>Technical</summary>

  `components/ui/PhaseRow.tsx`: a `summary?: string` prop drawn as the first child of the open body, `text-sm leading-3 text-ink-soft`, max 70ch — tokens as the mockup uses them. Update `PhaseRow.stories.tsx`'s open state to carry a story and render the stories (`indusk looks stories admin`).

  </details>
- [x] Each task on the plan page shows its sentence, with its detail in a closed Technical fold
  <details><summary>Technical</summary>

  Lift the item list out of `components/plan/PlanParts.tsx` into `components/plan/PhaseItems.tsx`; key items by index, not text. Each item with a `detail` gets `<details><summary>Technical</summary>` rendering the detail through `components/Markdown.tsx`; an item with only a `note` keeps today's note line.

  </details>
- [x] The test for the Technical fold is written from its reviewed body and passes
  <details><summary>Technical</summary>

  A6: copy the reviewed body from Test Phase 1's `#### Deferred to Build Phase 2` into `components/plan/PhaseItems.test.tsx`.

  </details>
- [x] Pause for a person: Sandy approves the open phase row in the cockpit
  <details><summary>Technical</summary>

  The changed mockup `phase-row.open` and its re-rendered story, both on the Looks page; the agent proposes, only a person approves. A8 records the result.

  </details>
- [x] Shape review of the changed reading code and plan-page components
  <details><summary>Technical</summary>

  Per `/work`, over `impl-parser-core.ts`, `PhaseRow.tsx`, `PhaseItems.tsx`, `PlanParts.tsx`.

  </details>
- [x] Shape: Name the two fold-edge tests, which the main loop and the item reader each spell out inline, so one place says what opens and closes a task's fold
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/impl-parser-core.ts`. Rule: Should this inline block have been a named function? The same test written twice can drift apart

  </details>
- [x] Shape: Give the code that writes one task back to markdown, detail included, a name of its own instead of an inline block inside the list mapper
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/markdown-export.ts`. Rule: Should this inline block have been a named function? It has its own job and can then be tested alone

  </details>

#### Build Phase 2 Verification

- [x] The plan page shows the paragraph and the fold, the detail arrives whole, and Sandy has approved the look
  <details><summary>Technical</summary>

  Green: A5, A6, A7; A8 recorded with Sandy's approval. `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/impl-parser.test.ts && pnpm exec vitest related src/lib/impl-parser-core.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/ui/PhaseRow.test.tsx src/components/plan/PhaseItems.test.tsx`; `indusk looks lint admin` reports no raw value.

  </details>

#### Build Phase 2 Context

- [x] The admin's own rules say a task's folded detail is drawn by the shared markdown component, never as raw text
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: "a task's Technical detail renders through `components/Markdown.tsx` in `PhaseItems`, never as raw text" — `promise: technical-detail-opens-on-request`.

  </details>

#### Build Phase 2 Document

- [x] The admin reference page for the plan page shows the paragraph and the fold
  <details><summary>Technical</summary>

  Update the plan page's phases section in `apps/docs/src/reference/admin-ui/` with the paragraph and the Technical fold.

  </details>

### Build Phase 3: Every new plan is written this way

**Tier**: med — the work step's default

The save check and the plan page are ready. This phase makes the planner use them. The planner skill's impl template and its instructions, the planning rules and the plan templates all switch to the shape, so every impl written from now on opens each phase with its summary and folds its detail. The planner also gets a writing prompt: write every paragraph and sentence for someone who has worked on the project but knows none of the plan's shorthand, with a before-and-after example. Then component-content's impl, the plan whose unreadable phases started this, is rewritten in the shape as the first real example.

- [x] The planner's impl template is written in the shape and opts in
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/planner.md`: the impl template's frontmatter gains `phase_summary: required`; each phase in it gets a summary placeholder after `**Tier**:`; every item becomes a sentence with an indented `<details><summary>Technical</summary>` block, the existing snippets and row labels moved inside. Keep the strings `planner-tier-line.test.ts` and `planner-verification-template.test.ts` pin (`vitest related`) — inside the detail is fine. Sync `.claude/skills/planner/SKILL.md` byte-equal.

  </details>
- [x] The planner's instructions say how to write a phase's summary and a task's sentence for someone without the shorthand
  <details><summary>Technical</summary>

  Step 7 in `skills/planner.md`, a "**Open each phase with a summary, written for someone without the shorthand.**" paragraph beside "**Name every phase's tier.**": the paragraph says what the phase does for the plan and how it hands to the next; the sentence says what will be true. The reader has worked on the project but knows none of this plan's shorthand: no row labels, no abbreviations, no nicknames, no pronoun whose referent is unclear; names, paths, commands, code and row labels go in the fold. The test before writing: "would someone who has worked here, but never read this plan, know what every noun in this sentence refers to?" Before/after example: "Build Phase 1: the checkers only read top-level lines" → "The two scripts that check an impl file, one when it is saved and one when a box is ticked, stop reading text folded under a task as a ticked box or a skipped gate."

  </details>
- [x] The planning rules and the plan templates carry the shape
  <details><summary>Technical</summary>

  `templates/planning/CLAUDE.md`, "The impl": a rule entry for the shape, the opt-in and the reader without shorthand — guarded by `phase-summary-rule.test.ts` (`promise: an-impl-phase-explains-itself`); sync `.indusk/planning/CLAUDE.md`. `templates/workflows/{bugfix,refactor,feature}.md`: their impl skeletons in the shape. `skill-sync-parity.test.ts` and `workflow-types-parity` stay green.

  </details>
- [x] component-content's impl is rewritten in the shape
  <details><summary>Technical</summary>

  Wherever it lives when this phase runs (its plan folder, or `archive/component-content/` once it has closed): add `phase_summary: required`, write a summary per phase, turn each item into a sentence with its current text in the fold, row labels included. Every `[x]` stays as it is; the edit ticks nothing (A9 holds that). Validate it, then open its plan page.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 3 Verification

- [x] The planner's template and instructions follow the shape, component-content reads well on its page, and the copies of the skill and rules still match their sources
  <details><summary>Technical</summary>

  Green: A4, A16; A13 recorded with Sandy's read of component-content's page. `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/planner-impl-summary-template.test.ts src/__tests__/skill-sync-parity.test.ts src/__tests__/planner-tier-line.test.ts src/__tests__/planner-verification-template.test.ts`.

  </details>

#### Build Phase 3 Context

- [x] The planner skill is the one place that holds the full shape and its example
  <details><summary>Technical</summary>

  planning: the rule entry above points to `/reference/skills/planner` for the full shape, so the template, not the rules file, holds the example.

  </details>

#### Build Phase 3 Document

- [x] The planner's reference page and the changelog describe the shape
  <details><summary>Technical</summary>

  Update `apps/docs/src/reference/skills/planner.md` with `phase_summary: required`, the shape and the reader without shorthand; changelog: "Impl phases open with what they do for the plan; tasks are plain sentences, written for a reader without the plan's shorthand, with their technical detail folded beneath."

  </details>

### Build Phase 4: Falsification — box lines inside a fold, and ritual phases written in the old shape

**Tier**: med — the work step's default

This phase tests two ways the finished plan may still break its promises, and fixes whichever the tests confirm. First, two readers that never learned the new rule still count a box line wherever it sits: the check that decides whether a falsification or cleanup phase is finished, and the check that decides whether a phase's verification is done before its code review. A task whose folded detail quotes an unticked box, which this plan's own tasks do, would keep its phase open forever. Second, the falsification and cleanup skills hand out phase templates in the old shape, so following either skill on a plan that has opted in gets the new phase refused when it is saved. After this phase, folded detail is only read everywhere, and the two rituals that run next on this plan write phases the save check accepts.

- [x] The check for a finished falsification or cleanup phase ignores box lines inside a task's folded detail or a code block
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/cleanup/gate.ts` `isRitualPhaseTerminal`: skip lines inside a task's `<details>`…`</details>` fold and lines `fencedLineMask` marks; keep counting other indented sub-items (round-2 F3's nested-unchecked strictness). Today `/^\s*-\s+\[ \]/` matches `  - [ ] example` in a fold and returns not-terminal, which blocks the retrospective's Step 0 and `plans next`.

  </details>
- [x] The check that a phase's verification is done before its code review ignores box lines inside a task's folded detail or a code block
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/shape/shape.ts` `verificationIsGreen`: `UNCHECKED_AT_ANY_DEPTH` and `CHECKBOX_AT_ANY_DEPTH` get the same fold-and-fence exclusion; share one helper with `gate.ts` only if it already has a home (cross-file extraction is `/cleanup`'s). Today Shape reports "verification is not green" for a ticked Verification task whose detail quotes `- [ ]`.

  </details>
- [x] The falsification and cleanup skills hand out phase templates in the new shape when the impl has opted in
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/falsify.md` and `skills/cleanup.md`: beside the existing template, a variant for `phase_summary: required` — a `**Tier**:` line, a summary paragraph instead of the `**Goal**:` label alone, each task a plain sentence with its code and row labels in an indented `<details><summary>Technical</summary>` fold (the Verification template's `T{M}:` moves into the fold). Sync `.claude/skills/falsify/SKILL.md` and `.claude/skills/cleanup/SKILL.md` byte-equal.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 4 Verification

- [x] A quoted unticked box in a task's fold no longer holds a phase open, and both ritual templates pass the save check on an opted-in impl
  <details><summary>Technical</summary>

  Green: A17, A18; still green: A9–A11. `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/detail-is-only-read.test.ts src/__tests__/ritual-templates-phase-summary.test.ts src/__tests__/skill-sync-parity.test.ts && pnpm exec vitest related src/lib/cleanup/gate.ts src/lib/shape/shape.ts`.

  </details>

#### Build Phase 4 Context

- [x] The package rules say ritual-phase and verification checks skip folded detail and code blocks, while still seeing other indented unchecked items
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, "Run, verify, Shape, cleanup": amend "ritual-phase terminality needs ≥1 item and sees nested unchecked items" and the `verificationIsGreen` clause to add "— never a box inside a task's `<details>` fold or a fence" — guarded by `detail-is-only-read.test.ts` (`promise: hidden-detail-is-only-read`).

  </details>

#### Build Phase 4 Document

- [x] The falsification and cleanup skill reference pages show the template for an impl that has opted in
  <details><summary>Technical</summary>

  Found: `apps/docs/src/reference/skills/` has no falsify or cleanup page; the ritual guides `apps/docs/src/guide/falsification-ritual.md` and `cleanup-ritual.md` are the pages that describe the phase, so they carry the opted-in note. The opted-in template and a one-line pointer to `/reference/skills/plan#phase-summaries-for-a-reader-without-the-shorthand`.

  </details>

### Build Phase 5: Cleanup — the phase-summary rule gets its own hook module, and the phase-row stories draw the real task list

**Tier**: med — the work step's default

The plan is correct and its tests are hardened; this phase tidies what it spread across files. The new rule that every phase opens with a summary and every task is a plain sentence was written inline in the save check, which already keeps each of its other rules in a module of its own, so it moves into one. And the plan page's task list, with its Technical fold, was copied by hand into the phase-row stories instead of being used there, so the look Sandy approved is a drawing of the component rather than the component itself. After this phase, the stories draw the real task list and are approved again. The other files this plan grew were reviewed and stay as they are, each with its reason below.

- [x] The save check's rule for phase summaries and plain task sentences moves into a hook module of its own, beside the save check's other rule modules
  <details><summary>Technical</summary>

  A19's test, `phase-summary-module.test.ts`, was authored after this extraction because its subject is the new module: importing it before it existed would have been a load error, not a red.

  Extract `phaseSummaryProblems` from `apps/indusk-mcp/hooks/validate-impl-structure.js` into `hooks/_phase-summary.js`, exported, following `_phase-tier.js` (`tierRuleProblems`), `_test-levels.js` and `_register.js` — one module per rule. Export the row-label pattern from it once and use it in the hook's `validateCrossReferenceIntegrity` too, replacing the second `\b[TA]\d+\b` in the same file (the TypeScript `TEST_ID_PATTERN` in `lib/trajectory/validator.ts` stays: hooks cannot import TypeScript, and that file is the deliberate mirror). Sync `.claude/hooks/` byte-equal. `hooks/` ships whole in `package.json` `files`, so the new module installs with the rest.

  </details>
- [x] The phase-row stories draw the plan page's real task list instead of a hand-copied version of it
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/components/ui/PhaseRow.stories.tsx`: the Closed and Open stories' `children` become `<PhaseItems items={…} />` (from `components/plan/PhaseItems.tsx`) with items carrying `text`, `checked`, `note` or `detail`; delete the `FOLD` / `FOLD_BODY` copies, whose classes already differ from `PhaseItems`'. Basis: admin rules — "a composed component must draw as its story does" and "a page composes components … renders no component's markup itself". Re-render with `indusk looks stories admin`; both stories turn proposed.

  </details>
- [x] Pause for a person: Sandy approves both phase-row stories again in the cockpit
  <details><summary>Technical</summary>

  `story phase-row.open` and `story phase-row.closed` on the Looks page, read from this plan's branch; only a person approves. A20 records the result.

  </details>
- [x] The two checking scripts' column-zero box patterns were reviewed and stay where they are
  <details><summary>Technical</summary>

  Reviewed `hooks/check-gates.js` (`CHECKED_BOX` / `UNCHECKED_BOX`, global, counting), `hooks/validate-impl-structure.js` (the opt-out's `!/^\s/`) and `hooks/_impl-phases.js` (the item match) — left as-is: three small patterns with different jobs and flags; one shared module would couple the tick check's counting to the parsers' item reading for no reader's benefit.

  </details>
- [x] The fold-reading code in the impl parser was reviewed and stays where it is
  <details><summary>Technical</summary>

  Reviewed `src/lib/impl-parser-core.ts` (`opensFold`, `closesFold`, `foldedLineMask`) — left as-is: already the one home, used by `lib/cleanup/gate.ts` and `lib/shape/shape.ts`; the hook mirror of the cross-reference reading in `lib/trajectory/validator.ts` is the established TypeScript–hook pair, not duplication to remove.

  </details>
- [x] The long prose files and the large tests this plan grew were reviewed and stay as they are
  <details><summary>Technical</summary>

  Reviewed `skills/planner.md`, `apps/docs/src/reference/skills/plan.md`, `apps/docs/src/changelog.md`, `apps/docs/src/guide/test-trajectory.md` (prose, over the cap before this plan), `src/__tests__/detail-is-only-read.test.ts` (one file per promise, already on the shared `helpers/phase-summary-fixture.ts`), `src/lib/trajectory/validator.test.ts` and `phase-summary-existing-impls.verdicts.json` (a generated snapshot) — left as-is: cohesive, or not code.

  </details>
- [x] The root project instructions are shortened so they fit back under their size limit
  <details><summary>Technical</summary>

  Found while running the full suite for Verification: `context-tiers-register.test.ts` (the root held 20 % under the 18432-byte budget) failed on this branch at 14828 bytes against 14745.6, and passes on `main` at 14730. The Key Decisions entry added by Build Phase 1 is shortened to rule and pointer; the root is now 14725 bytes. `main` has since added a Sessions-per-plan entry of about 115 bytes, so the merge will need the retrospective's compaction step (one old root entry collapsed) to stay under.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 5 Verification

- [x] The moved rule reads the same, the save check still refuses and accepts what it did, and Sandy has approved the redrawn stories
  <details><summary>Technical</summary>

  Green: A19; still green: A1–A3, A14, A15, A5, A6; A20 recorded with Sandy's approval. `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/phase-summary-module.test.ts src/__tests__/phase-summary-rule.test.ts src/__tests__/phase-summary-existing-impls.test.ts && pnpm exec vitest related hooks/validate-impl-structure.js hooks/_phase-summary.js`; `cd apps/indusk-admin && pnpm exec vitest run src/components/ui/PhaseRow.test.tsx src/components/plan/PhaseItems.test.tsx`; `indusk looks lint admin` and `indusk looks status admin` show both stories approved.

  </details>

#### Build Phase 5 Context

- [x] The hook rules list the new phase-summary module among the save check's rule modules
  <details><summary>Technical</summary>

  `apps/indusk-mcp/hooks/CLAUDE.md`: name `_phase-summary.js` (`phaseSummaryProblems`, the row-label pattern) beside the other `_`-modules — guarded by `phase-summary-module.test.ts` (`promise: an-impl-phase-explains-itself`).

  </details>

#### Build Phase 5 Document

- [x] The admin's component conventions page says a story uses the real child component rather than copying its markup
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/component-conventions.md`: one line under stories — a story passes the real child component (here `PhaseItems` inside `PhaseRow`) so the approved snapshot is the component's own drawing.

  </details>

### Build Phase 6: Audit fixes — the rule holds on every edit, an unclosed fold hides nothing, and every writer and reader follows the shape

**Tier**: med — the work step's default

A reader who had not seen the build audited the plan and found places where its three promises still do not hold; Sandy asked for all of them fixed before the plan closes. The save check enforces the new shape only when a whole file is written, so an edit can quietly delete a phase's paragraph or put code on a task line, and a task line with nothing on it passes. A task fold that is never closed hides every line after it, real unticked tasks included, so a cleanup phase can look finished when it is not. Two writers and readers the plan never touched still work the old way: the repair phase a broken promise adds is written in the old shape, and the gated loop reads a box ticked inside a fold as a checkoff. The tick check can misread an edit that begins at a folded box's dash, the plan page shows the phase paragraph as plain text, and the docs claim the save check refuses code in a paragraph when it refuses only row labels there. After this phase every one of those holds as the promises say, and the next step is the retrospective.

- [x] An edit to an impl that has opted in is held to the summary rule, refusing only the problems that edit adds
  <details><summary>Technical</summary>

  `apps/indusk-mcp/hooks/validate-impl-structure.js`: before the "doesn't touch phase structure" early exit (`!hasPhaseHeader && !hasChecklistItem && !hasTierLine` → exit 0), when the full new content's frontmatter has `phase_summary: required`, run `phaseSummaryProblems` (`hooks/_phase-summary.js`) over the old body and the new body and refuse with the existing message if the new set has a problem the old set lacks. Comparing sets keeps an unrelated edit to an impl with a pre-existing problem from being blocked. Sync `.claude/hooks/` byte-equal.

  </details>
- [x] A task line with nothing after its box is refused on an impl that has opted in
  <details><summary>Technical</summary>

  `hooks/_phase-summary.js` `phaseSummaryProblems`: an item whose text is empty after trimming is a problem naming its phase ("a task with no sentence").

  </details>
- [x] A task fold left open is refused when saved and hides nothing from the checks that skip folded text
  <details><summary>Technical</summary>

  Save check: on an opted-in impl, a `<details>` opened under a task with no `</details>` before the next column-zero task, gate heading or phase heading is refused, naming the task — like the unterminated fence (`fencedLineMask`). Reader: `foldedLineMask` in `apps/indusk-mcp/src/lib/impl-parser-core.ts` fails open on an unclosed fold, as an unterminated fence masks nothing, so `isRitualPhaseTerminal` (`lib/cleanup/gate.ts`) and `verificationIsGreen` (`lib/shape/shape.ts`) see the tasks after it. Decide whether the parser's `inFold` in `parseChecklistItems` should end at the next column-zero task (it already does) and leave it.

  </details>
- [x] The tick check counts boxes over the whole file before and after an edit, not over the edit's own text
  <details><summary>Technical</summary>

  `hooks/check-gates.js`: for an Edit, build the full old content from disk and the full new content (the same way `validate-impl-structure.js` builds `newFullContent`), and count `CHECKED_BOX` / `UNCHECKED_BOX` over those, so a fragment beginning at a folded box's dash is not mistaken for a column-zero line. Today it counts `old_string` / `new_string` (lines 72, 111). Sync `.claude/hooks/`.

  </details>
- [x] The gated loop reads ticked boxes only from top-level lines, so a box ticked inside a fold makes no checkoff commit
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/run/commit-cadence.ts` lines 103–104: `.map((l) => l.trim()).filter((l) => l.startsWith("- [x]"))` reads indented lines; keep only column-zero lines (and skip `foldedLineMask` lines), matching the tick check.

  </details>
- [x] The repair phase a broken promise adds is written in the new shape when the impl has opted in
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/reopen.ts` `maintenancePhase`: when the owner impl's frontmatter has `phase_summary: required`, write a `**Tier**:` line, a plain paragraph naming the incident and the promise, task sentences, and the commands, paths and row label (`rowId`) in each task's Technical fold. The old shape is unchanged for impls that have not opted in.

  </details>
- [x] The plan page shows a phase's paragraph formatted, code included
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/components/ui/PhaseRow.tsx` takes `summary?: ReactNode` instead of `string`; `components/plan/PlanParts.tsx` passes `<Markdown>{view.summary}</Markdown>`. The ui component stays free of the markdown import, and the stories' plain-string paragraph draws as it did, so their approved snapshots should not change — confirm with `indusk looks stories admin` and `indusk looks status admin`; if either story turns proposed, add a pause item for Sandy's re-approval.

  </details>
- [ ] The docs say what the save check refuses in a phase paragraph: a row label, not code
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/falsify.md` and `skills/cleanup.md` ("The save check refuses a code span or a row label on the paragraph or a task line") and `templates/planning/CLAUDE.md` ("refuses a missing paragraph, a code span or a row label on those lines"): say a task line may carry neither code nor a row label, and a paragraph no row label — matching the ADR's decision. Sync `.claude/skills/` and `.indusk/planning/CLAUDE.md`.

  </details>

#### Build Phase 6 Verification

- [ ] Every audit finding has a test that failed before its fix and passes now, and the earlier rows stay green
  <details><summary>Technical</summary>

  Green: A21–A27; still green: A1–A3, A9–A12, A14, A15, A17–A19, A5–A7. `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/phase-summary-rule.test.ts src/__tests__/detail-is-only-read.test.ts src/__tests__/phase-summary-module.test.ts src/__tests__/phase-summary-existing-impls.test.ts src/lib/run/commit-cadence.test.ts src/lib/promises/reopen-phase-summary.test.ts src/__tests__/skill-sync-parity.test.ts && pnpm exec vitest related src/lib/impl-parser-core.ts src/lib/run/commit-cadence.ts src/lib/promises/reopen.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/plan/PlanParts.test.tsx src/components/ui/PhaseRow.test.tsx src/components/plan/PhaseItems.test.tsx`; `indusk looks status admin` shows both phase-row stories approved.

  </details>

#### Build Phase 6 Context

- [ ] The planning rules say the summary rule holds on every edit and an unclosed task fold is refused
  <details><summary>Technical</summary>

  planning: `apps/indusk-mcp/templates/planning/CLAUDE.md`, the phase-summary entry — add "held on every edit to an opted-in impl, refusing only what the edit adds; a task's `<details>` must close before the next task" — guarded by `phase-summary-rule.test.ts` and `detail-is-only-read.test.ts`. Sync `.indusk/planning/CLAUDE.md`.

  </details>

#### Build Phase 6 Document

- [ ] The planner's reference page says the rule is checked on every edit and that an unclosed fold is refused
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/plan.md`, the "Phase summaries for a reader without the shorthand" section: one paragraph on edit-time enforcement and the unclosed-fold refusal.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/check-gates.js` | ticked boxes counted from column-zero lines only |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | opt-outs from column-zero lines only; the `phase_summary` rule; Verification row labels read from the detail |
| `apps/indusk-mcp/src/lib/trajectory/validator.ts` | Verification row labels read from the detail |
| `apps/indusk-mcp/src/lib/impl-parser-core.ts` | `ImplPhase.summary`, `ChecklistItem.detail` |
| `apps/indusk-admin/src/components/ui/PhaseRow.tsx` | `summary` slot |
| `apps/indusk-admin/src/components/ui/PhaseRow.stories.tsx` | open state carries a story |
| `apps/indusk-admin/src/components/plan/PhaseItems.tsx` | new: the item list with the Technical fold |
| `apps/indusk-admin/src/components/plan/PlanParts.tsx` | uses `PhaseItems` |
| `apps/indusk-admin/src/lib/phases.ts`, `lib/plan-parts-view.ts`, `lib/markdown-export.ts` | carry `summary` and `detail` |
| `apps/indusk-mcp/skills/planner.md` (+ `.claude/skills/planner/SKILL.md`) | template, instructions, writing prompt |
| `apps/indusk-mcp/templates/planning/CLAUDE.md` (+ `.indusk/planning/CLAUDE.md`) | rule entries |
| `apps/indusk-mcp/templates/workflows/*.md` | impl skeletons |
| `.indusk/mockups/admin/screens/phase-row.open.html` | the changed look (proposed) |
| `.indusk/planning/component-content/impl.md` (or its archive) | converted |
| `apps/docs/src/…` | guide, reference, decision page |

## Dependencies

- component-content lands (or is at least closed) before Build Phase 3's conversion; otherwise the conversion is made on its branch.

## Notes

- Whether a sentence is plain is not checked beyond code and row labels; the brief's expectation measures the rest over the next three approvals.
- This impl's Verification sentences carried their row labels in a trailing bracket until Build Phase 1 let the save check read them from the fold; Build Phase 1's fifth task removed the brackets.

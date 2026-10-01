---
title: "The admin says what kind of plan it is"
status: in-progress
approved: 2026-10-01
date: 2026-10-01
trajectory: required
test_phases: required
gate_policy: ask
workflow: bugfix
---

# Implementation

Rows are the assertions of [test-plan.md](test-plan.md), same IDs. This is a
bugfix-type plan, so there is no ADR; the design choices are in the test plan's
Notes and are approved with this document.

## Test Trajectory

Test paths are repo-root-relative (the verify runner's cwd is the repo root).

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | A plan whose brief declares a type shows that type as a chip in the plan header | Test Phase 1 | Build Phase 2 | passing | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A2 | A plan that declares no type shows "type not declared" in the header, never a guess from which documents exist | Test Phase 1 | Build Phase 2 | passing | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A3 | A plan that declares a word outside the four types shows that word and says it is not a recognised type — not treated as known, not folded into "not declared" | Test Phase 1 | Build Phase 2 | passing | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A4 | Clicking the type chip opens an explanation — what the type is for, which documents it requires, which it skips, and why — and it closes with Escape or its close button | Test Phase 1 | Build Phase 2 | passing | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A5 | On a bugfix plan the absent research and the absent ADR read skipped, both behind the plan's position and ahead of it | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A6 | On a bugfix plan that has an impl and no test plan, the test plan reads missing | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A7 | On a bugfix plan whose brief exists and whose test plan is not written yet, the test plan reads pending, not missing | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A8 | On a plan that declares no type, an absent earlier document reads unknown, never skipped; documents not yet reached still read pending | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A9 | A feature plan with every document present reads exactly as it does today | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A10 | When a document is missing or unknown the page says so in words beside the bar — which document and why — not by colour or hover alone | Test Phase 1 | Build Phase 2 | passing | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A11 | Every state a bar segment can be in has its own drawing and its own label in the admin; a state added to the lifecycle without one fails by name | Test Phase 1 | Build Phase 2 | passing | apps/indusk-admin/src/lib/segment-state-render-parity.test.ts |
| A12 | What the admin says a type requires and skips equals the planner skill's workflow table and each workflow template's list of documents — one set of facts, three statements | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts |
| A13 | The bugfix workflow template lists the test plan among the documents it creates | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts |
| A14 | Every brief template the planner uses — in the skill and in each workflow template — carries a `workflow:` line | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts |
| A15 | The archived release-ritual plan, read through the admin's reader from this repository, is a bugfix with research and ADR skipped and the test plan missing | Test Phase 1 | Build Phase 3 | passing | apps/indusk-admin/src/lib/planning-reader.workflow.test.ts |
| A16 | In this repository every active plan declares a type — in its brief, or in its research document when the plan is research only | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/active-plans-declare-workflow.test.ts |
| A17 | The installed copy of the planner skill is byte-identical to the package's | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts |
| A18 | The workflow-type definitions are reachable by their documented package subpath from outside the package | Test Phase 1 | Build Phase 1 | passing | apps/indusk-admin/src/lib/planning-reader.workflow.test.ts |
| A19 | A `workflow:` value that is not a plain word is never read as a type, and an unrecognised declaration is shown as it was written: a list holding `bugfix` is not a bugfix, and `workflow: no` shows `no`, not `false` | Build Phase 4 | Build Phase 4 | passing | apps/indusk-mcp/src/lib/workflow-declaration.test.ts |
| A20 | When a plan declares a word that is not a type, the sentence beside the bar says that word is not a recognised type; it does not say the plan declares no type | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A21 | A plan whose type has no impl — a spike — reads executing, falsify and cleanup as skipped, while it is in progress and after it is archived; never pending, never done | Build Phase 4 | Build Phase 4 | passing | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A22 | A finished document that its type requires nothing after does not say it is awaiting the next document: a spike whose research is complete says the plan ends there | Build Phase 4 | Build Phase 4 | passing | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A23 | The next step the plan list names is the next document the plan's type requires: a bugfix with an accepted test plan is told to create the impl, never the ADR, and a spike with finished research is not told to create a brief; a plan with no type reads as it does today | Build Phase 4 | Build Phase 4 | passing | apps/indusk-mcp/src/lib/workflow-declaration.test.ts |
| A24 | A plan that has an impl but neither a brief nor a research document still shows the "type not declared" chip whenever its bar reads a document as unknown | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A25 | `advance_plan` names the same next document the plan list does: a bugfix with an accepted test plan advances to the impl, never the ADR, and a spike whose research says `complete` is finished, not refused | Build Phase 4 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/advance-plan-workflow.test.ts |
| A26 | The package has one definition each of a document's label, the words that mean a document is finished, and the next document a type requires: a second spelling of any of the three under `src/lib` or `src/tools` fails, naming the file | Build Phase 5 | Build Phase 5 | planned | apps/indusk-mcp/src/__tests__/lifecycle-single-definition.test.ts |

## Checklist

### Test Phase 1: Author every row against today's behaviour, RED

- [x] Create this plan's worktree with `indusk worktree create admin-plan-type`
- [x] Author A5–A9 in `apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts`, calling `derivePlanPosition` the way `lifecycle-derive.test.ts` does, with the type carried on the plan summary. Compare states as strings, so a state word the union does not hold yet is a failed assertion and not a type error
- [x] Author A12–A14 and A17 in `apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts`. The definitions module does not exist yet: load it with a dynamic `import()` inside the test, so its absence fails A12 by name instead of failing the file to load. A13 and A14 read the template and skill text
- [x] Author A16 in `apps/indusk-mcp/src/__tests__/active-plans-declare-workflow.test.ts`, over `.indusk/planning/`: an active plan is a folder outside `archive/` holding a brief or a research document; a parent that holds only `master.md` is not one. The failure names every plan without a type
- [x] Author A1–A4 and A10 in `apps/indusk-admin/src/components/PlanDetail.type.test.tsx`, rendering the existing plan page. Assert on what is read — the chip's text, the explanation's text, the sentence beside the bar — never on `data-state`, which the bar already copies from its input and would pass for the wrong reason
- [x] Author A11 in a new file, `apps/indusk-admin/src/lib/segment-state-render-parity.test.ts`, importing the lifecycle as a namespace. A named import of a list that does not exist yet is a link error that would take the existing parity file down with it
- [x] Author A15 and A18 in `apps/indusk-admin/src/lib/planning-reader.workflow.test.ts`: A15 reads `.indusk/planning/archive/release-ritual` from this repository through the reader; A18 imports the package subpath dynamically
- [x] Run every file and read every failure: each row fails on its own assertion, and no file fails to load (package: 13 failing, 6 passing across three files; admin: 19 failing, 2 passing across three files; every failure is an assertion, none a load error)
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Regression Guards

- **A7** — passes the moment it is written, which was found by writing it, not planned: a document ahead of the plan's position already reads pending today, so "pending, not missing" has no red phase. It was approved as passing at Build Phase 1; it is moved to this phase and declared here because it guards the new `missing` judgment against firing on a document the plan has simply not reached yet.
- **A9** — passes the moment it is written: a feature plan with every document present has no absent document to judge. It guards the new judgment against changing a plan it has no business touching.
- **A17** — passes the moment it is written: the planner skill's two copies are byte-identical today. Build Phase 3 edits one of them, and this keeps the other in step.

#### Test Phase 1 Verification

- [x] A1–A18 authored; A7, A9 and A17 pass; every other row fails on its own assertion and no file fails to load (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/lifecycle-document-states src/__tests__/workflow-types-parity src/__tests__/active-plans-declare-workflow` and `pnpm --filter indusk-admin exec vitest run src/components/PlanDetail.type src/lib/segment-state-render-parity src/lib/planning-reader.workflow`)

#### Test Phase 1 Context

- [x] (none needed — asked: "Test Phase 1 only wrote test files, so it established no project convention and has nothing user-facing to document. Can I skip its Context gate and its Document gate?" — user: "Skip both")

#### Test Phase 1 Document

- [x] (none needed — asked: "Test Phase 1 only wrote test files, so it established no project convention and has nothing user-facing to document. Can I skip its Context gate and its Document gate?" — user: "Skip both")

### Build Phase 1: the type decides what an absent document means

- [x] Add `apps/indusk-mcp/src/lib/workflow-types.ts`: the four types, and for each its purpose, the documents it requires, the documents it skips, and why. The retrospective is required for every type that ships an impl; a spike requires only its research. One function reads a frontmatter value into a known type, an unrecognised word, or nothing. The module touches no filesystem, so a browser component can import it
- [x] Export it as `./workflow-types` in `apps/indusk-mcp/package.json`
- [x] The plan summary carries the declared type and, separately, an unrecognised word when one was declared. `parsePlan` reads it from the brief's frontmatter, from the research document when the plan has no brief, and never from the impl
- [x] `lib/lifecycle.ts` gains a runtime list of segment states that includes `missing` and `unknown`, with the type derived from the list
- [x] `derivePlanPosition` judges an absent document by the plan's type: required and already passed is missing; not required is skipped, behind or ahead; no type and already passed is unknown; everything else as today. The requirement lists are imported from the workflow-types module — no second copy in the lifecycle
- [x] Correct the docblock on `derivePlanPosition`, which today says skipped is decided by the file's absence
- [x] Build the package so the admin reads the new module (`pnpm --filter @infinitedusky/indusk-mcp build`)
- [x] Shape (`apps/indusk-mcp/src/lib/workflow-types.ts`) — reviewed, left as-is: `absentDocumentNote` is a sentence for a person, sitting in a module of facts, which is two reasons to change. It stays because the sentence is built only from those facts (the document's label, the type's name) and has one caller so far; splitting it now would create a module with a single six-line function. If Build Phase 2 grows a second kind of sentence, that is the moment to move both.
- [x] Shape (`apps/indusk-mcp/src/lib/lifecycle.ts`, `apps/indusk-mcp/src/lib/plan-parser.ts`) — reviewed; nothing to change. The judgment is one named function with its five cases stated above it, and the declaration read is one named function with its source rule stated above it.

#### Build Phase 1 Verification

- [x] A5, A6, A7, A8 pass and A9 still passes — 26 passed across the four files (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/lifecycle-document-states src/lib/lifecycle-derive src/__tests__/lifecycle-single-definition src/__tests__/lifecycle-parity`)
- [x] A18 passes against the built package (`pnpm --filter indusk-admin exec vitest run src/lib/planning-reader.workflow -t A18`)
- [x] The package type-checks (`pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit -p .`, exit 0). The whole package suite was also run: 1,637 pass; the 14 failures are this plan's Build Phase 3 rows (A12's template half, A13, A14, A16) and nine daemon and bundle tests that need the admin's production build, which a fresh worktree does not have (`apps/indusk-admin/.next/BUILD_ID` is absent here and present on trunk). The admin's own type-check is red until Build Phase 2 adds the two new states to its label maps

#### Build Phase 1 Context

- [x] Conventions, the entry that begins "The lifecycle is one definition": name the segment-state list and say an absent document is judged by the plan's declared type, from `lib/workflow-types.ts`. The root file has 42 bytes of headroom, so this is an edit in place that shortens the same entry's wording by at least as much as it adds (done: 364 bytes to 353. The `monitor` derivation note and the single-definition test's name left the entry — the first is in Key Decisions, the second is enforced by the test itself)

#### Build Phase 1 Document

- [x] `apps/docs/src/guide/plan-lifecycle.md`: a short section on what an absent document reads as — skipped, missing, pending, unknown — and that the plan's type decides

### Build Phase 2: the admin shows it

- [x] `components/bars/labels.ts`: a class and a word for `missing` and `unknown` in the segment and chip maps, typed against the lifecycle's list so a new state is a type error
- [x] `components/bars/Bar.tsx`: `missing` and `unknown` are each drawn differently from `skipped` and from each other, in the segment and in its label; the segment's title says its state in words
- [x] `components/bars/PlanBar.tsx`: a sentence under the bar for each missing or unknown document — which one, and why. Update the component's docblock, which says skipped positions are drawn as skipped
- [x] `lib/planning-reader.ts`: the plan the page receives carries the type from the shared parser. No second read of the frontmatter in the admin
- [x] `components/PlanTypeChip.tsx`: the chip and its explanation in a native `<dialog>` — no dialog library. Three readings: a known type, "type not declared", and an unrecognised word shown as written. Every sentence of the explanation comes from the package's workflow-types module; the component states no document list of its own
- [x] Wire the chip into the plan header in `components/PlanDetail.tsx` (shown for a plan with a brief or a research document; a parent holding only a master has nowhere to declare a type)
- [x] Check the admin's audit tests still describe the tree (`component-reuse-audit`, `cleanup-pins`), and that no existing browser test needs a new mock for the added import (both pass; the whole admin suite ran with 337 of 338 passing and no new mock — the one failure is A15, a Build Phase 3 row. `PhasesSection` carried a private copy of the chip-class map, identical to `labels.ts`'s; it now imports the one map)
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. The per-state styling that was nested ternaries in `Bar.tsx` is three named maps, the bar's sentence is one named function, and the chip's two explanations are two named components.

#### Build Phase 2 Verification

- [x] A1, A2, A3, A4, A10 and A11 pass — 33 passed across seven files (`pnpm --filter indusk-admin exec vitest run src/components/PlanDetail.type src/lib/segment-state-render-parity src/lib/lifecycle-render-parity src/components/bars`)
- [x] The admin type-checks and its audits hold — 9 passed across three files (`pnpm --filter indusk-admin exec vitest run src/__tests__/typecheck src/__tests__/component-reuse-audit src/__tests__/cleanup-pins`)
- [x] By eye, in the running admin on this repository: this plan's page shows a `bugfix` chip, the chip opens and closes, and the research and ADR segments read skipped (a dev server from this worktree against a temporary registry, driven with Playwright and read from a screenshot: the header shows `bugfix`; the explanation lists "brief, test plan, impl, retrospective" under Requires and "research, ADR" under Skips, and closes; research and ADR are dashed and titled "skipped". An untyped plan, `day-always-on-deploy`, reads "type not declared", its research `unknown`, with the sentence under the bar)

#### Build Phase 2 Context

- [x] Known Gotchas, the admin entry that names the bars' label maps: add that a plan's type and its explanation come only from the package's `workflow-types` subpath and that a component never restates a document list. An edit in place that shortens the same entry by at least as much as it adds (done: the file went from 61,398 to 61,383 bytes. The long parenthetical about `phaseTitle` and the Playwright note left the entry — the first is enforced by `cleanup-pins`, the second is in the component-conventions page)

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: the type chip and the four readings of an absent document
- [x] `apps/docs/src/reference/admin-ui/component-conventions.md`: the first dialog in the admin is a native `<dialog>`, and why no library

### Build Phase 3: the planner declares it, and this repository does

- [x] `apps/indusk-mcp/skills/planner.md`: the brief template carries `workflow:`, and the Workflow Types section says every brief declares it, defaulting to `feature`. Resync the installed copy under `.claude/skills/planner/`
- [x] `apps/indusk-mcp/templates/workflows/`: each template's brief (or, for the spike, research) template carries `workflow:`; the bugfix template's list of documents gains the test plan, and its opening sentence stops saying a bugfix is only a brief and an impl. **Found authoring A12:** the feature and refactor templates omit the test plan too — three of the four templates contradict the skill's table — so all three gain it
- [x] Declare the type on every active plan here that lacks one: `plan-premises`, `day-always-on-deploy` and `indusk-release` in their briefs; `user-zero` and `jev-decision-model`, which are research only, in their research documents (which type each brief is was Sandy's call, asked for each: `plan-premises` is a feature, `day-always-on-deploy` a bugfix — its document set is brief, test plan, impl, and no type means "small step". `indusk-release` already declared feature. The two research-only plans are spikes)
- [x] Declare `workflow: bugfix` on the archived `release-ritual` brief — the one archived plan that gets it, per the brief
- [x] **Found writing the Document gate:** the planner reference page (`apps/docs/src/reference/skills/plan.md`) was a fourth statement of what each type requires, and said a bugfix was "brief, impl" like the templates did. Corrected, and `workflow-types-parity.test.ts` gains a case for it under A12 — run against the page as it was, it fails naming feature, bugfix and refactor; against the corrected page it passes
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. The phase changed prose, frontmatter and one test file, whose new reader is a named function beside the two it parallels.

#### Build Phase 3 Verification

- [x] A12, A13, A14 and A16 pass and A17 still passes — 33 passed across three files (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/workflow-types-parity src/__tests__/active-plans-declare-workflow src/__tests__/skill-sync-parity`)
- [x] A15 passes (`pnpm --filter indusk-admin exec vitest run src/lib/planning-reader.workflow`)
- [x] Both apps' suites pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp --filter=indusk-admin`) — run per app: the package 1,652 passed across 266 files, the admin 338 passed across 55. Two things the first attempts showed, neither a defect in this plan: nine package tests about the admin daemon and the tarball need the admin built and bundled (`pnpm --filter indusk-admin build`, then `node scripts/bundle-admin.js`), which a fresh worktree does not have — they passed once it was; and the admin's HTTP smokes all fail while any dev server holds the app directory, which the by-eye check's server did until it was killed
- [x] By eye, in the running admin: the archived release-ritual page shows `bugfix`, research and ADR skipped, the test plan missing, and a sentence beside the bar saying a bugfix requires a test plan (read from a screenshot: the `bugfix` chip beside "archived"; research and ADR dashed; the test plan segment outlined in red with its label in red; and under the bar, in red, "The test plan is missing — a bugfix requires it.")

#### Build Phase 3 Context

- [x] Conventions, the entry that begins "Plans live in": a brief declares `workflow:`, and `active-plans-declare-workflow.test.ts` fails this repository's suite when an active plan lacks one. An edit in place that shortens the same entry by at least as much as it adds (done, with one honest miss: this entry grew by 6 bytes, 254 to 260 — there was not that much to cut from it without losing the cross-reference rule. Across the plan's three context edits the root file went from 61,409 bytes to 61,389, so it is 20 bytes smaller than when the plan began)

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/skills/plan.md`: every brief declares its type; what each type requires
- [x] `apps/docs/src/changelog.md`, under the unreleased heading: the admin shows a plan's type; an absent document reads skipped, missing, pending or unknown; the bugfix template now includes the test plan

### Build Phase 4: Falsification — the type is read loosely, and ignored by everything that says what comes next

**Goal**: verify whether the attested state holds against two kinds of failure. The plan made the type the judge of an absent *document*, and stopped there: the declaration itself is read with a coercion that accepts things that are not a word, and three other readings of "what comes next" — the positions that follow the impl, the active label, and the plan list's next step — still ignore the type the plan now declares. Each row below is one hypothesis, confirmed by reading the code or by printing what the parser returns for this repository's own plans; each item is the fix.

What the investigation found, row by row:

- **A19** — `readWorkflow` takes `String(value)` of whatever YAML produced. `workflow: [bugfix]` parses to a list, `String(["bugfix"])` is `"bugfix"`, and the plan reads as a bugfix. A mapping is shown as `[object Object]`. A3 asserts an unrecognised word is "shown as written"; it is shown as coerced. **Corrected on authoring the row:** this bullet also said `workflow: no` parses to `false` and is shown as `"false"`. It does not — the YAML parser here reads `no` as the word, and the case passed the moment it was written. It stays in the test as a guard; the list and the mapping are the defect.
- **A20** — `absentDocumentNote` has two sentences and picks the "declares no type" one whenever the type is null. A plan that declared `hotfix` gets a chip saying `"hotfix" — not a recognised type` and, under the bar, a sentence saying it declares no type. The page contradicts itself.
- **A21** — printed for this repository: `user-zero` and `jev-decision-model`, both spikes, read brief, test plan, ADR, impl and retrospective as skipped — and executing, falsify and cleanup as **pending**. Those three positions exist only because of the impl. The bar tells a research-only plan that it is waiting to execute; archived, the same spike would read them as **done**, because the loop marks every non-document position behind the current one done.
- **A22** — `resolvePosition` answers an accepted or complete document with "awaiting the next document". For a spike whose research is finished there is no next document. The active label is the one message the bar always carries, and the admin-ui-phase-progress falsification established that it never claims a fact the reader does not hold.
- **A23** — `determineNextStep` names `DOCUMENT_POSITIONS[idx + 1]`, the next document in lifecycle order, whatever the type. A bugfix with an accepted test plan is told "Create adr" — this plan was, between its test plan and its impl — and a spike with completed research is told "Create brief". The plan list and the admin now disagree about the same plan: one says the ADR is skipped, the other says to write it.
- **A24** — the chip is rendered only when the plan has a brief or a research document. Two archived plans here have an impl and neither (`code-reviewer-agent`, `stale-indusk-docs-path`): their bars read documents as unknown, the sentence under the bar says the plan declares no type, and there is no chip to say so or explain it. A2 asserts the page says "type not declared"; for these it says it only in the small print.
- **A25** — found while closing A23, by printing this repository's plans after the fix. Two things. `jev-decision-model`, a spike, still read "Review research (status: complete)" in the plan list while its bar said the spike ends there: `determineNextStep` counted `accepted` and `completed` as finished, the lifecycle counted `complete` too, and `complete` is the word 33 of the 36 research documents here use. A23's own spike case had used `completed` and so passed without touching the plans that exist. And `advance_plan`, the MCP tool, is a second door onto the same question with its own answers written in: "test-plan → adr, Create adr" whatever the type, and a third copy of the finished-status list, also one word short.

- [x] Author A19–A24 red before any fix. A19 and A23 in a new `apps/indusk-mcp/src/lib/workflow-declaration.test.ts`, calling `parsePlan` on plan folders written to a temporary directory — the filesystem is the boundary, so the declarations are real frontmatter and not values handed to a function. A21 and A22 beside the existing rows in `lifecycle-document-states.test.ts`. A20 and A24 beside the existing rows in `PlanDetail.type.test.tsx`. Run each and read each failure
- [x] `lib/workflow-types.ts` and `lib/plan-parser.ts`: only a plain string is a candidate for a type. Anything else YAML produced — a list, a mapping, a boolean, a number — is an unrecognised declaration, carried as the text on the frontmatter's `workflow:` line, read from the raw document with a line-anchored match and never from `String()` of the parsed value
- [x] `absentDocumentNote` and `components/bars/PlanBar.tsx`: a third sentence for an unrecognised declaration, naming the word and saying it is not a recognised type. The bar is passed the declared word alongside the type
- [x] `lib/lifecycle.ts`: the positions that exist only because of the impl — executing, falsify, cleanup — read skipped when the plan's type does not require an impl, behind the plan's position or ahead of it. The list of impl-dependent positions is stated once, beside the document positions
- [x] `lib/lifecycle.ts`: when a document is finished and the plan's type requires no later document, the active label says the plan ends there instead of "awaiting the next document"
- [x] `lib/plan-parser.ts`: `determineNextStep` names the next document the declared type requires, skipping the ones it does not; with nothing left it does not name one. A plan with no declared type keeps today's answer
- [x] `components/PlanDetail.tsx`: the chip is shown whenever the plan bar is, so a page that says a plan declares no type always carries the chip that says it and explains it
- [x] `src/__tests__/active-plans-declare-workflow.test.ts`: read each plan's type through `parsePlan` instead of parsing the frontmatter itself. Once the parser stops accepting a list, a private read that still coerces one would let the standing check pass a plan the page reads as undeclared
- [x] Discovered: `lib/lifecycle.ts` states once which status words mean a document is finished (`isFinishedDocumentStatus`: accepted, complete, completed), and the plan bar and `determineNextStep` both read it. Two more cases under A23, authored red first: a spike whose research says `complete` reads "Done", and an untyped plan whose research says `complete` is told to create the brief. This changes what seven closed plans read, each from "Review retrospective (status: complete)" to "Done" — admin-ui-phase-progress, dawn-workbench-execution, indusk-makeover, test-phase-structure, versioned-workbench, workbench-trust-fixes, worktree-config-schema-pointer — and the lifecycle-parity snapshot is re-baselined by hand for exactly those seven
- [x] Discovered: author A25 red in a new `apps/indusk-mcp/src/__tests__/advance-plan-workflow.test.ts` — plan folders in a real repository, asked through the tool. Run it and read each failure
- [x] Discovered: `tools/plan-tools.ts`, `advance_plan`: the next stage and the transition it names come from the plan's own next step, which already knows the type, and the finished check is the lifecycle's one definition. The next required document itself moved to one definition, `nextRequiredDocument` in `lib/lifecycle.ts`, read by the active label, `determineNextStep` and this tool
- [x] Shape (`apps/indusk-admin/src/components/PlanDetail.tsx`) — name the condition "the plan bar is drawn" once and use it for both the bar and the chip; A24 is that the two never disagree, and two spellings of one condition is how they did. Rule: Should this inline block have been a named function or module?
- [x] Shape (`apps/indusk-mcp/src/lib/workflow-types.ts`) — `readWorkflow` takes the text written on the frontmatter line and decides what an unrecognised declaration shows; `readDeclaredWorkflow` in `plan-parser.ts` stops re-testing `typeof value !== "string"` to override it, so one unit owns what is not a plain word. Rule: Does this unit have one reason to change?

#### Build Phase 4 Verification

- [x] A19, A21, A22 and A23 pass and A5–A9, A12–A17 still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/workflow-declaration src/lib/lifecycle-document-states src/lib/lifecycle-derive src/__tests__/workflow-types-parity src/__tests__/active-plans-declare-workflow`)
- [x] A20 and A24 pass and A1–A4, A10, A11, A15, A18 still pass (`pnpm --filter @infinitedusky/indusk-mcp build` then `pnpm --filter indusk-admin exec vitest run src/components/PlanDetail.type src/lib/segment-state-render-parity src/lib/planning-reader.workflow src/__tests__/typecheck`)
- [x] A25 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/advance-plan-workflow src/__tests__/plan-worktrees-tools src/__tests__/lifecycle-parity`)
- [x] Both apps' whole suites pass, with the admin built and bundled first (`pnpm --filter indusk-admin build && node apps/indusk-mcp/scripts/bundle-admin.js`) and no dev server running against the admin directory. Run 2026-10-01 at `f5c8b2a5`: package 1678 passed, 5 skipped; admin 340 passed. A first admin run failed 43 HTTP smokes because a `next-server` orphaned by an interrupted run still held the directory; killed, rerun, green
- [x] Printed for this repository after the fix: `user-zero` and `jev-decision-model` read executing, falsify and cleanup as skipped, and `day-always-on-deploy`'s next step after its test plan would be the impl. Printed 2026-10-01: both spikes read skipped, skipped, skipped; `jev-decision-model` reads "research finished — a spike ends here" with next step "Done"; `day-always-on-deploy` with an accepted test plan reads "Create impl"

#### Build Phase 4 Context

- [x] Known Gotchas, the entry on frontmatter regexes for value-bearing keys: a frontmatter value that is shown to a person or matched against a vocabulary is read from the raw line, never from `String()` of the parsed YAML — a one-element list coerces to its element's text and a mapping to `[object Object]`. An edit in place within the byte budget

#### Build Phase 4 Document

- [x] `apps/docs/src/guide/plan-lifecycle.md`, the section on what an absent document reads as: the positions that follow the impl are skipped for a type that has none, and the next step named for a plan is the next document its type requires
- [x] `apps/docs/src/changelog.md`, under the unreleased heading: the same two facts, and that a `workflow:` value that is not a plain word is reported as unrecognised. Also written: `complete` counting as finished, and the MCP tools reference's `advance_plan` transition table, which still said brief → adr

### Build Phase 5: Cleanup — one word list for a document, and a pin on what falsification found copied

**Goal**: decompose what this plan left spelled more than once across files. The plan's theme was one definition of what a plan's type requires; falsification then found the *same two questions* — which status words mean finished, and which document comes next — each answered in three files, and fixed them by hand. Nothing yet stops a fourth answer. And one more thing is spelled three times that nobody has consolidated: the human word for a document. The basis is this repository's own rule for shared definitions (a source-tree scan asserting one definition exists, because no behavioural test catches a divergence that has not happened), and the rule of three. The package is a library and CLI, so the move is extracting a function or a module; the admin's changed components were reviewed against one-component-per-file and are left as they are, with reasons below.

Reviewed: all 32 files the branch changed under `apps/`. Nine are over the 400-line attention threshold; none is over it because of this plan.

- [ ] Author A26 red before any change: three cases added to `apps/indusk-mcp/src/__tests__/lifecycle-single-definition.test.ts`, in that file's own idiom, scanning `src/lib` **and** `src/tools` (the existing scan reads only `src/lib`, and two of the three copies falsification found were in `tools/plan-tools.ts`). One `export const DOCUMENT_LABELS` and no inline spelling of a document's label (`"test plan"`, `"ADR"`, `"Test plan"`) outside `workflow-types.ts`; one `export function isFinishedDocumentStatus` and no `"accepted" || … "completed"` comparison chain outside `lifecycle.ts`; one `export function nextRequiredDocument` and no `DOCUMENT_POSITIONS[… + 1]` index outside it. The first case is red today on two files; the other two are guards and pass on arrival. Run it and read the failure
- [ ] `lib/lifecycle.ts`, `resolvePosition`: the document's word comes from `DOCUMENT_LABELS` instead of the inline `stage === "test-plan" ? "test plan" : stage === "adr" ? "ADR" : stage`. `DOCUMENT_LABELS` stays in `workflow-types.ts` — the leaf module; moving it beside `DOCUMENT_POSITIONS` would make the two modules import each other at runtime
- [ ] `tools/plan-tools.ts`, `advance_plan`: the refusal's noun comes from `DOCUMENT_LABELS`, capitalised for the start of the sentence, instead of `plan.stage === "brief" ? "Brief" : "Test plan"`. The text the tool returns does not change
- [ ] Extract the plan-folder writer that `src/lib/workflow-declaration.test.ts` and `src/__tests__/advance-plan-workflow.test.ts` each define (`planWith`: a folder of documents, each given as its frontmatter lines) into `src/__tests__/helpers/plan-folder.ts`, taking the planning directory as an argument; both tests import it. Three older tests write plan folders with their own writers; this plan added the fourth and fifth, a few hours apart and nearly identical, and the next plan that tests a declared type would write the sixth
- [ ] (reviewed `apps/indusk-mcp/src/__tests__/helpers/` against the three older writers — `plan-declarations.test.ts`'s `makePlan`, `archive-dead.test.ts`'s `writePlan`, `health-stale-completed.test.ts`'s `plan` — left as-is: each takes whole document bodies or a modification time, a different contract from frontmatter lines, and none is a file this plan changed)
- [ ] (reviewed `apps/indusk-mcp/src/lib/lifecycle.ts`, 524 lines, 120 added — left as-is: everything this plan added answers what a position reads as, which is the module's one subject; the file is one definition on purpose, named by the `lifecycle` subpath and by the single-definition pin. Its real seam is plan position versus phase activity, which predates this plan and is not this plan's to cut)
- [ ] (reviewed `apps/indusk-mcp/src/lib/plan-parser.ts`, 432 lines, 55 added — left as-is: `readDeclaredWorkflow` and `rawFrontmatterValue` read a file, and `workflow-types.ts`, where the rest of the declaration reading lives, is imported by a client component and must stay free of the filesystem)
- [ ] (reviewed `rawFrontmatterValue` against the other reads of one frontmatter line — `run/loop.ts`'s `gate_policy`, `tools/system-tools.ts`'s `name` and `description`, `papers/provenance.ts`'s fence — left as-is: each of those matches a fixed key with its own value pattern or rewrites a block, none is a file this plan changed, and the hooks carry JavaScript ports of two of them that would have to move together)
- [ ] (reviewed `apps/indusk-mcp/src/tools/plan-tools.ts`, 412 lines — left as-is: this plan made it eight lines shorter, folding two branches into one)
- [ ] (reviewed `apps/indusk-admin/src/components/PlanTypeChip.tsx`, 163 lines, new — left as-is: one exported component and three private parts nothing else uses; it holds the admin's first `<dialog>`, and a dialog primitive is warranted at the second, not the first. The component conventions page already records the pattern for whoever writes that second one)
- [ ] (reviewed `apps/indusk-admin/src/components/bars/labels.ts`'s `POSITION_LABELS` against the package's `DOCUMENT_LABELS` — left as-is: the admin's display vocabulary is deliberately its own, covers every position rather than the six documents, and sits under the render-parity pin)
- [ ] (reviewed `apps/indusk-admin/src/lib/planning-reader.ts`, 568 lines — left as-is: 13 lines added, passing two fields through)
- [ ] (reviewed the remaining flagged files — the planner skill and its installed copy, the changelog, the planner reference page, the lifecycle-parity snapshot — left as-is: prose and a fixture, flagged by length alone, each touched by a few lines)

#### Build Phase 5 Verification

- [ ] A26 passes, having been red on `lifecycle.ts` and `tools/plan-tools.ts` before the two label items (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/lifecycle-single-definition`)
- [ ] Nothing a reader sees changed: the tests that read the active label, the next step and the tool's answers still pass unedited (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/lifecycle-derive src/lib/lifecycle-document-states src/lib/workflow-declaration src/__tests__/advance-plan-workflow src/__tests__/plan-worktrees-tools src/__tests__/lifecycle-parity`)
- [ ] The package type-checks and the touched files lint clean (`pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` exits 0; `biome check` on each touched file reports no fixes)
- [ ] The admin still reads the rebuilt package (`pnpm --filter @infinitedusky/indusk-mcp build` then `pnpm --filter indusk-admin exec vitest run src/components/PlanDetail.type src/__tests__/typecheck`)

#### Build Phase 5 Context

- [ ] Conventions, the entry "The lifecycle is one definition": name the three definitions the pin now covers — a document's label, the finished-status words, the next required document — and that the scan reads `src/tools` as well as `src/lib`. An edit in place within the byte budget, which has nine bytes of room, so it compacts the entry as it adds to it

#### Build Phase 5 Document

- [ ] `apps/docs/src/guide/plan-lifecycle.md`, the section on what an absent document reads as: where it names `nextRequiredDocument` and `isFinishedDocumentStatus` as one definition each, say what keeps them one — the source-tree scan, and that it reads the tools directory too

---
plan: component-content
closed: 2026-10-14
---

# Retrospective — component-content

## What We Set Out to Do

A mockup places an existing admin component with its own words (bare content for `children`, `<indusk-content for="name">` for a named property), so a screen can be made of components alone. Two promises: `a-placed-component-shows-its-content` (state) and `placed-content-is-only-words-and-components` (state). The brief's expectation was that new-project-flow's five screens draw nothing but declared new components; that depends on new-project-flow, which this plan did not touch.

## What Actually Happened

- Test Phase 1 authored A1–A8 red; Build Phases 1–3 took them green in order (compose fills content, the render step records where content lands, the lint holds content to words and components).
- Build Phase 4 was the falsification phase: it probed the first design against the committed admin snapshots and found five ways it was wrong (A12–A17). Words sharing a text node with a property (`· {summary}`) were replaced wholesale; children spanning several DOM nodes were recorded as one; a `<indusk-content>` with no `for` was emitted raw; content given twice was silently dropped; and a self-closing `<indusk-component />` swallowed every following sibling, because HTML has no self-closing custom elements.
- The fix changed the place's shape from a bare `number[]` to `{ at, nodes?, before?, after? }`. A bare array still reads as `{ at }`, so no committed catalog needed hand-editing. `components.json` was regenerated; no snapshot changed, so every approval still holds (A11 green).
- Shape: raised 1 finding in total (Build Phase 1: an inline predicate extracted as `contentOf`). Phases 2–4 recorded no findings.
- Cleanup was skipped with a recorded reason (no cross-file extraction warranted).
- Audit (`audit.md`, written by a fresh reader) found gaps between the promises' wording and what the code enforces. See "What We'd Do Differently" and the follow-on list below.

## Diff

24 files, +2756 / −145. The bulk is the regenerated `.indusk/mockups/admin/components.json` (~1540 lines). Source changes concentrate in `looks/compose.ts` (+176), `looks/stories.ts` (+147), `looks/lint-components.ts` (+102). Docs: `guide/components.md`, `decisions/component-content.md`, a changelog line, the CLI reference.

## Verification

- Looks and component-content suites: 16 files, 99 tests, all passing at retrospective time.
- The impl recorded `plans-accept-stories` (A25, A33) failing during the build. Re-run outside the build step, both pass (2/2). The failure was the build environment refusing `plans accept` ("not accepted from inside a build step"), not a regression. Recorded here so it is not read as a failing test.
- Full `pnpm test` (log: `.fulltest.log` in the plan folder): exit 1. `seat-holds`, `indusk`, `indusk-admin` (88 files, 557 tests) all pass. `indusk-mcp` has 12 failing tests across 9 files: `always-on-cleanup` A29, `impl-corpus` A4, `looks-cli` (raw colour refusal), `plan-worktrees-cli` A13, `plans-workbench` A11 and A18, `registry-leak-scan` A22, `release-incident` A12, `release-report` A6 and A22, `promises/inbox` A17 (two cases). Re-run in isolation, 6 still fail, the 6 listed here (the others passed alone, so the parallel run added failures of its own).
- Cause, from the error text: none of the failing files touches a file this plan changed. `impl-corpus` compares a fixed archive list against the live archive (20 plans on disk, 13 expected). `plan-worktrees-cli` A13 sees a `?? .mcp.json` in a temp demo checkout. `inbox` A17 and `registry-leak-scan` A22 read the developer's real registry, which holds this session's break records. `always-on-cleanup` A29 counts a normalization duplicated in `lib/promises/interface-files.ts` and `telemetry.ts`. These are pre-existing or environmental. **Confidence: moderate.** Not confirmed against a clean base; that would need a second checkout the shared main tree does not allow here.

- Biome on the 18 changed TypeScript files: 17 clean. `apps/docs/src/.vitepress/config.ts` fails the format check, and it already failed at the base commit (`f1e1a329`), so this plan did not cause it. Not reformatted here: a whole-file reformat would be unrelated churn. Carried as a follow-on.
- Nested-context probe (the root CLAUDE.md was touched): `e2e/context-tiers` 4/4 pass. The wider `pnpm e2e -- context-tiers` run also executed `day-monitor` (1 failure), which expects the Claude CLI to print "issue with the selected model" for a bogus model, and the installed CLI prints a different error. Environmental, unrelated to this plan.
- `indusk context check-pointers`: 50 pointers resolve.

## Gate Decisions (unattended run)

- Ritual gate: passes. All 17 trajectory rows are `passing`; Build Phase 4 is the falsification phase; cleanup skipped with reason; `audit.md` present. `indusk plans next` reports the plan built.
- Promise confirmation: `indusk promises confirm component-content` marked both promises `enforced` (3 test files and 1 code site for the first; 2 test files and 1 code site for the second). The registry check passes.
- Docs sidebar: added the decision page to `apps/docs/src/.vitepress/config.ts`; it was missing.
- Decision page ADR link: repointed from the live plan path to the archive path, since the plan is archived in this close.
- Release: the project's landing installs its own build (`pnpm install:local`) and publishing is deliberate. The invocation did not ask for a release, so nothing is published. Recorded here; the bump is the operator's decision.

## Audit Findings (advisory)

From `audit.md`, judged on this close:

1. **Approve does not refuse content findings.** `placed-content-is-only-words-and-components` says anything else "is refused". The refusal happens only at `indusk looks lint`; the approve route (`apps/indusk-admin/src/app/api/looks/[app]/approve/route.ts`) checks hashes only. A person can approve a mockup carrying a drawing inside a component. Decision: **not fixed in this close**; the promise's enforced site is the lint. Carried as a follow-on, named so it is not lost.
2. **Contract A30 was not adapted.** `apps/indusk-admin/src/__tests__/composition.contract.test.ts` indexes `uses` against outermost roots; a filled component's descendants differ from the story's. Mockups that place content inside containers could mis-pair roots. Decision: follow-on.
3. **Lint `content-given-twice` and the `string arg whose rendered text differs is not fillable` behaviour** go beyond what the brief promised, and the ADR names two rules where the code has three. Decision: recorded; the guide documents the third rule, so the docs match the code.
4. **Silent drops.** `stories.ts` records `{}` for a story whose second render throws; `markerPlaces` records nothing when sibling counts differ. Both are deliberate (ADR: "a component that takes no content is a fact"), but no row would notice a state losing its content map. Decision: follow-on, a contract row over every state's content map.

Skip reasons: the audit's "Which skip reason would you not accept?" answered "nothing". No skip in this close is unexplained.

## Shape Numbers

- Findings raised across all phases: **1** (Build Phase 1, `contentOf`, extracted).
- Judged wrong by a human: **not recorded**. No person reviewed the Shape findings during this unattended build, so the count is unknown, not zero. It should be read as unknown.
- No second consecutive plan with human-judged-wrong Shape findings can be established from this record.

## What We Learned

- A path recorded from one render and applied to another is only valid if both see the same node structure. A DOM tree from a live render keeps adjacent text nodes apart; the serialized snapshot merges them. Normalizing a clone of the canvas to the snapshot's serialization before recording paths made the alignment hold.
- In HTML, a custom element written `<x />` is not self-closing; the parser nests everything after it. Readers must treat the start tag as the element's end for hyphenated tags written self-closing.
- The falsification phase found five real defects after happy-path tests were green. The ritual did its job; happy-path rows alone would have shipped the words-share-a-text-node bug, which is the common case in `PartSection`.
- A test that depends on the environment (here, `plans accept` refusing inside a build step) can look like a regression in a unattended run. Re-run outside the step before trusting the failure either way.

## What We'd Do Differently

- Write the approve-route refusal in the same plan that wrote the promise "is refused". The gap came from a promise worded as a refusal that only the lint enforced.
- Adapt the composition contract (A30) when a change alters node structure, not after the audit reads it.
- Record Shape human judgements as they happen, so the wrong-finding count is known rather than unknown.

## Insights Worth Carrying Forward

- Place records should carry the node count and the static words around the filled text, not just a path. A path alone cannot survive a node-count change.
- Probe the committed snapshots with scratch scripts before writing a hypothesis row; every Build Phase 4 row came from a probe, which is why the rows were specific enough to catch the bugs.

## Follow-ons (not in this close)

- Approve route refuses a mockup with content findings (promise `placed-content-is-only-words-and-components`).
- Adapt `composition.contract.test.ts` A30 to placed content.
- Contract row over every state's content map, to catch a silent loss.
- new-project-flow's screens converted to placed content (the brief's Expectation 1; depends on new-project-flow, not in this plan).

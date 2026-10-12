---
plan: storybook-components
audited: 2026-10-12
model: claude-opus-5-5
---

# Audit — storybook-components

## Does each row prove its promise's sentence, or something narrower?
- `apps/indusk-mcp/src/__tests__/looks-admin-components.test.ts:68` — Row A2 asserts that every component the admin's mockups name has an implementation, and that one with none is reported by name. The row is filed under `a-component-has-one-implementation`. Its test reads `unimplemented component:` lines from `indusk looks coverage admin`, but nothing in the package prints that line: `looksCoverage` (`apps/indusk-mcp/src/bin/commands/looks.ts:124`) emits no such line. The first assertion passes only because both lists are empty. The "reported by name" half exists only in the test's own regex walk, so no user of the CLI would ever see a missing implementation named.
- `apps/indusk-mcp/src/lib/looks/components.ts:29` — Row A1 asserts that a component name marked on two implementations is refused, naming both files. Row A3 asserts that a screen writing out a component's marked element outside its own file is refused, naming file and line. Both are judged only on literal `data-component` attributes in the `sources` that `screens.json` declares. Nothing refuses a screen that copies a component's markup and classes without the marker, or one that sets the marker from an expression (the scan is `markersIn`, lines 60–68). Passing them proves "no second marker". That is narrower than the promise's "every screen renders that one implementation rather than its own copy".
- `apps/indusk-admin/src/__tests__/storybook.contract.test.ts:137` — Row A6 asserts that changing a component changes its snapshot with no edit to the story. It edits only `Badge.tsx` and reads only that component's first state. The test plan's fallback, a structural check that each story imports its component from the component's one file, was not built. Story files are excluded from the scan (`components.ts:44`), so a story that renders its own copy of `data-component="chip"` markup is neither a duplicate nor refused, and its snapshot would be the copy. `every-component-state-has-a-story`'s "renders the real component" is proven for one component.
- `apps/indusk-mcp/src/lib/looks/components.ts:259` — Row A4 asserts that a component state a mockup shows with no story is reported, naming the component and the state. It compares only the top-level `<indusk-component name state>` references with the catalog's states. A component drawn inside another component's snapshot (a chip inside a promise-row, say) is never compared in the state it is drawn in. "In each state its mockups show" is proven for named states only.
- `apps/indusk-mcp/src/lib/looks/lint-components.ts:32` — Row A8 asserts that a mockup drawing a component's markup itself is refused by the lint, naming file, line and component. The refusal applies only when three things hold:
  - the app has a `components.json`;
  - the mockup is not listed in `screens.json`'s `uncomposed`;
  - the drawn element carries `data-component` (`markedElementsOf`, `apps/indusk-mcp/src/lib/looks/markup.ts:52`).

  A mockup that copies a component's markup without the marker passes. That is narrower than `a-mockup-composes-approved-components`' "a component a mockup draws itself is refused unless it is declared new".
- `apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts:168` — Rows A11 and A26 assert that a changed snapshot, or a changed component stylesheet, reopens the approved mockups that use it, naming the component. Both tests rewrite the snapshot or `.css` file directly. No row changes a component's source and then checks that its mockups reopen.
  - The step from "the component changed" to "its snapshot changed" (row A6) holds only when someone runs `indusk looks stories`.
  - Nothing in the diff runs that step or notices a snapshot older than its component. Only the Storybook manifest's age is checked (`apps/indusk-mcp/src/lib/looks/stories.ts:139`).
  - So nothing prevents an edited `PlanBadge.tsx` leaving every mockup that composes `badge` approved until a re-render. That is narrower than `a-changed-component-reopens-its-mockups`' "when an approved component changes".
- `apps/indusk-admin/src/app/p/[project]/looks/looks-approve-binding.test.tsx:131` — Row A33 is filed under `a-changed-component-reopens-its-mockups`. It asserts that one group Approve records the proposed stories before the mockup that composes them. It proves the order of a group approval, not that a changed component reopens anything.
- `apps/indusk-admin/src/__tests__/storybook.contract.test.ts:103` — Row A13 asserts that after a build the catalog lists every component with its properties and each state that has a story, read with no server running. It checks only the entry whose file is `Badge.tsx`. "Every component" rests on row A14's `not in catalog` finding, and any name in `screens.json`'s `uncatalogued` list is exempt from it (`apps/indusk-mcp/src/lib/looks/components.ts:251`). `an-agent-can-find-every-component` is proven for one component, plus whatever the exemption list does not hide.
- `apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts:302` — Row A16 asserts that an agent's write to the record of story approvals is refused, naming the cockpit's Approve. The test only asserts that `indusk looks approve` exits 2. Row A28 (`unapprove` from the command line is refused) is likewise CLI-only. Neither row runs the guard hook. Neither shows that a process importing `approve` or `withdraw` from the public `./looks/approve` subpath is stopped, and the storybook-held contract itself makes that direct call (`apps/indusk-admin/src/__tests__/storybook-held.contract.test.ts:96`). "An agent can … never approve it or take it back" is proven for the command line only.
- `apps/indusk-admin/src/app/p/[project]/looks/looks-components.contract.test.ts:183` — Row A18 asserts that each story opens on the Looks page at its component's own size and takes a reference device's width when one is chosen. Only the width is compared to the device. The row was narrowed from the approved impl's "at each reference device's size". `mockups-render-in-the-cockpit`, as widened in the brief, still says each story "opens in the cockpit at each reference device".
- `apps/indusk-mcp/src/lib/looks/stories.ts:139` — Row A36 is filed under `mockups-render-in-the-cockpit`. It asserts that `indusk looks stories` rebuilds the Storybook build when `globals.css` is newer than it. Since Build Phase 9 the Looks page draws a story from its snapshot, not from the build (`apps/indusk-mcp/src/lib/looks/overview.ts:156`). The build feeds the catalog's properties and `indusk looks check`, not what renders in the cockpit, so A36 proves nothing about the promise it names.
- `apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts:182` — Row A25 asserts that "the document the frame loads holds a rule for every class its snapshots use". The test asserts that one marker rule is present in one fixture mockup and absent from another. No assertion walks the classes the snapshots use.
- `apps/indusk-admin/src/__tests__/composition.contract.test.ts:22` — Row A30 asserts that the composed mockup's computed padding, margin, border, background, font and size equal the story's on the component's root and each descendant. The test excludes several things the row's wording includes:
  - the root's width, and an inline root's size;
  - the height of a root in a flex or grid parent;
  - any value that differs between two story viewport widths, or when siblings are placed beside the root;
  - a border's style and colour on sides without width.

  Each exclusion has a written reason, and outside them it compares as worded. Still, "size" is held only for descendants.

## What does the diff change that no row touches?
- `apps/indusk-mcp/src/lib/looks/report.ts:59` — A story's check run is marked with `screen` set to the component name and `state` set to the story's state. No attribute tells it apart from a screen's run.
  - `apps/indusk-mcp/src/lib/promises/look-standing.ts:83` matches runs by app, screen, state and device.
  - The admin has a screen `nav` (states `expanded`, `collapsed`) and a component `nav` with stories `expanded` and `collapsed`, so their runs share keys.
  - Stories are checked after screens in the same run (`apps/indusk-mcp/src/lib/looks/check.ts:543`), so their marks come later.
  - Nothing prevents a held `story nav.expanded @ phone` from being read as the newest run of the screen `nav.expanded @ phone`, hiding a broken screen on the dashboard and in the nav's broken count. No row checks how a story's mark is keyed.
- `apps/indusk-mcp/src/lib/looks/check.ts:521` — A screen look, not only a story, that times out twice is now recorded as `unchecked` instead of ending the run. When everything else held, `indusk looks check` exits 0 with "N looks held, M unchecked" (`apps/indusk-mcp/src/bin/commands/looks.ts:187`), and an unchecked look emits no span. No row would notice. `looks-check-timeout.test.ts` tests only `openWithinTime`, not the exit or the reporting.
- `apps/indusk-admin/src/components/bars/labels.ts:244` — The dashboard row and the promise page's banner now draw a retired promise with the `declared` chip; it used to have its own style. Row A23 (the rebuilt dashboard still lists every promise, broken first) does not look at how a standing is drawn.
- `apps/indusk-mcp/src/lib/looks/stories.ts:409` — The render step deletes every `.html` and `.css` file under `components/` that it did not just write. That includes an approved story's snapshot whose story was renamed or removed, after which every mockup composing it reads proposed. No row or test covers the removal.
- `apps/indusk-mcp/src/lib/looks/mockups.ts:127` — `screens.json`'s `uncatalogued` and `uncomposed` lists exempt components from `not in catalog` and mockups from `component drawn in mockup`.
  - The comments say each list is "only ever shortened", but nothing enforces that: adding a name back is accepted silently.
  - Neither list is in `declarationsHash` (line 194), so lengthening one reopens nothing.
  - No row or test exercises either list.
- `apps/indusk-admin/src/components/looks/Uncovered.tsx:18` — The Looks page's Uncovered list leaves out `notInCatalog`, which `indusk looks coverage` counts as uncovered (`apps/indusk-mcp/src/bin/commands/looks.ts:130`). The page can say everything is covered while the command exits 1. No row compares the two.

## What does the code do that the brief never promised?
- `apps/indusk-mcp/src/lib/looks/lint-values.ts:116` — There is a new lint rule, `shadow-not-token`. It refuses any `box-shadow` or `text-shadow` that is not made of whole `var(--shadow-…)` layers, in every app's mockups and stylesheets, seat-holds included. No promise, expectation or scope line covers it, and the brief's "Not promised" puts every app besides the admin out of scope.
- `apps/indusk-mcp/src/lib/looks/check.ts:360` — `indusk looks check` now tries a look that runs out of time once more, then records it as unchecked rather than failing. This changes what a passing check means for every app. The brief promises nothing about the check's tolerance.
- `apps/indusk-mcp/src/lib/looks/lint-components.ts:32` — The component-drawn rule has two escape hatches beyond the one the brief names ("unless it is declared new"):
  - an app with no `components.json` is exempt;
  - a mockup listed in `screens.json`'s `uncomposed` is exempt.

  `uncatalogued` (`apps/indusk-mcp/src/lib/looks/components.ts:251`) does the same for the catalog. None of the three is in the brief.
- `apps/indusk-admin/src/components/bars/labels.ts:249` — A retired promise now reads as `declared` on the dashboard and the promise page. That is a change of standing display that no promise or scope line covers.
- `apps/indusk-admin/src/components/looks/LookFrame.tsx:141` — A fitted story frame is `sandbox="allow-same-origin"` rather than `sandbox=""`, so the page can measure it. Neither the brief nor the ADR mentions loosening the frame; this ADR's alternatives still describe the frame as `sandbox=""`.

## Which rejected ADR alternative does the code quietly take?
- `apps/indusk-mcp/src/lib/looks/overview.ts:156` — The ADR rejected "One mockup file per component, drawn by hand" because the approved artefact would be a drawing of the component, not the component.
  - A snapshot is a plain file under `.indusk/mockups/<app>/components/`, read as-is (`apps/indusk-mcp/src/lib/looks/mockups.ts:304`).
  - Nothing compares it with what the component renders now.
  - Row A35 (a hand-edited snapshot in a plan's checkout shows its edit in the story frame) has the cockpit present a hand edit for approval.
  - So nothing prevents a hand-drawn snapshot from being approved and then composed into every mockup that names the component.
- `apps/indusk-mcp/src/lib/looks/lint-components.ts:32` — The ADR rejected "Detect instead of compose", where mockups keep drawing components inline. The `uncomposed` list lets a mockup keep drawing components inline with neither composition nor the lint's refusal. The admin's `screens.json` lists none today. The list itself, and its unenforced "only shortened" rule, keeps that path open for any app.

## Which skip reason would you not accept?
- `.indusk/planning/storybook-components/impl.md` — Within the inputs this audit was allowed to read (the trajectory now and the impl as approved), there is no `skipped` row, no `(none needed)` gate and no `*_skipped` frontmatter pair. The working impl beyond its trajectory was outside scope, so those were not judged.
- `apps/indusk-admin/src/__tests__/storybook-held.contract.test.ts:85` — Row A20 asserts that `indusk looks check admin` reads every checked look held, and that one token changed in the admin alone shows broken on the dashboard. It is marked `manual: recorded in this impl's Build Phase 8 Verification`. That storybook-held contract already starts `next dev`, runs `indusk looks check` and changes one token to see a story broken. So the check half of A20 could have been a contract row; only the dashboard read needs a daemon. A "live check" reason does not hold for the whole row.
- `apps/indusk-admin/src/__tests__/composition.contract.test.ts:22` — Deferred Verification U1 covers whether the rebuilt cockpit looks like its approved mockups (expectation 1). Its reason is that this stays a person's judgement until a pixel comparison exists. Row A30 shows a computed-value comparison in Chromium was buildable here (a composed mockup against its story). The same comparison of a running screen against its composed mockup was not attempted, so the deferral is wider than its reason requires.

## What else would have to change for each promise to hold?
- `apps/indusk-mcp/src/lib/promises/look-standing.ts:114` — This file is untouched. It builds look rows only for declared screens and `coverage.components` (line 156). As a result, these never reach the dashboard, the nav's broken count or the editor:
  - a story's check run;
  - an uncovered story;
  - a `no story` state;
  - a `not in catalog` component.

  It also matches runs without a kind, which causes the screen/story collision above. The promises at stake are `a-look-reports-like-any-promise` and `every-part-of-the-ui-is-covered` ("whatever is not is reported uncovered").
- `apps/indusk-mcp/src/lib/promises/vocabulary.ts:128` — This file is untouched. `LOOK_MARK` has no attribute that marks a story, and `parseMarkedSpan` (`apps/indusk-mcp/src/lib/promises/telemetry.ts:214`) reads none. Telling a story's run from a screen's under `a-look-reports-like-any-promise` needs both.
- `.indusk/config.json` — Untouched, as is `apps/indusk-mcp/hooks/`. No workflow step and no hook runs `indusk looks stories` after a component changes. The admin's `build` runs `build:storybook`, not the snapshot render. `a-changed-component-reopens-its-mockups` holds only when someone remembers to re-render.
- `apps/indusk-mcp/skills/planner.md` — This file is untouched, as is `apps/indusk-mcp/templates/planning/CLAUDE.md`. Neither, nor any other skill, mentions mockups or `components.json`. The only pointer is `apps/indusk-admin/CLAUDE.md:173`, which loads only when a file under the admin is read. A new screen's mockup is drawn at planning time under `.indusk/`, so for `an-agent-can-find-every-component` (and expectation 3) nothing points the agent at the catalog before it draws.

---
title: "Display names — promises and plans read as words"
date: 2026-10-09
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# Display names — promises and plans read as words

## Goal

The editor names promises in words, plans by their title, and shows each plan's start, landing and release dates, from one module in the package (ADR decisions 1–6).

## Scope

### In Scope
- `promises/display` in the package: `promiseWords`, `planTitle`, `planDates`, the built-in product words and `display.words` in config.
- The health line's `title`, `planTitle` and `planDates`.
- The Promises panel, activity and hover using them.

### Out of Scope
- The admin's pages (plan-cockpit).
- A `title` field on promises.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A8's pin, red | the package and the two apps' sources |
| Build Phase 1 | `lib/promises/display.ts` and its subpath; `title`, `planTitle`, `planDates` on the health line | the plan parser, the config, the changelog |
| Build Phase 2 | the panel, activity and hover reading those fields | Build Phase 1's line |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | The promise `a-break-reaches-the-editor` reads "A break reaches the editor" on its card, its row in the panel, its activity lines and the heading of its hover | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-promise-reads-as-words | apps/vscode-extension/src/core/names.test.ts |
| A2 | Product names keep their capitals: `a-fly-deploy-is-one-command` reads "A Fly deploy is one command", `indusk-leaves-main-clean` reads "InDusk leaves main clean" | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-promise-reads-as-words | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A3 | A project can name its own product words, and they keep their capitals the same way | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-promise-reads-as-words | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A4 | Opening a promise in the panel shows its full sentence | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-promise-reads-as-words | apps/vscode-extension/src/core/names.test.ts |
| A5 | The panel's plan group and a broken card's plan read by the brief's title, the part before " — "; `vscode-extension` reads "VS Code extension" | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-plan-reads-by-its-title | apps/vscode-extension/src/core/names.test.ts |
| A6 | A plan with no brief, or a brief with no title, still reads by its folder name | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-reads-by-its-title | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A7 | Each health line names each promise's words, its plan's title and its plan's dates, so the editor names plans without reading plan files | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-reads-by-its-title, promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/__tests__/promise-health-names.test.ts |
| A8 | How a promise or plan is named for a person, and a plan's dates, are defined once, in the package; a second definition in the admin or the extension fails the build | Test Phase 1 | Build Phase 1 | passing | unit | promise: display-names-are-defined-once | apps/indusk-mcp/src/__tests__/display-names-single-definition.test.ts |
| A9 | The marker at the end of a code line still shows the promise's handle | Build Phase 2 | Build Phase 2 | passing | unit | a regression guard over a decision in the brief: the marker sits beside the token that spells the handle | apps/vscode-extension/src/core/names.test.ts |
| A10 | On the dusk project in VS Code, the panel's groups read by plan titles with their dates, and its cards and rows by promise words | Build Phase 2 | Build Phase 2 | passing | live check | the whole story once, against the real editor | apps/vscode-extension/e2e/live.e2e.test.ts |
| A11 | A plan's group in the panel shows the date it started and the date it landed | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A12 | A landed plan shows the release that shipped it — the first release whose changelog names the plan — with its version and date | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A13 | A plan not landed shows only its start date; one landed but in no release yet says "not released yet" | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A14 | An archived plan whose retrospective carries no "Landed on main at …" line still reads as landed — it is on main — dated by its retrospective's `date`, and shows the release the changelog names for it; it never reads "started …" alone | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A15 | A plan with no brief (a spike, or a parent whose only document is its research) shows the date it started, from its first lifecycle document's `date` | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/lib/promises/display.test.ts |

## Checklist

### Test Phase 1: The single-definition pin, red; the rest registered

**Goal**: author the one row whose subject can be reached today without an import, and register the rest with their bodies.

- [x] Create/confirm this plan's worktree (`indusk worktree create display-names`; made by `indusk plans start` on 2026-10-09 at `dusk-worktrees/display-names`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] A8 in `apps/indusk-mcp/src/__tests__/display-names-single-definition.test.ts`: reads the sources as files; `lib/promises/display.ts` defines `promiseWords`, `planTitle` and `planDates`; no file under `apps/indusk-admin/src` or `apps/vscode-extension/src` defines a function by those names or turns a handle into words with its own `replace(/-/g, " ")`. RED today: the module does not exist
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Deferred to Build Phase 1

- **A2, A3, A6, A7, A11, A12, A13** — their subjects are `promiseWords`, `planTitle`, `planDates` and the line's new fields, which Build Phase 1 introduces; a file importing them would fail to load. Bodies:

  ```typescript
  // display.test.ts — promise: a-promise-reads-as-words, a-plan-reads-by-its-title, a-plan-shows-when-it-shipped
  // promiseWords("a-fly-deploy-is-one-command") === "A Fly deploy is one command"             (A2)
  // promiseWords("indusk-leaves-main-clean") === "InDusk leaves main clean"                   (A2)
  // promiseWords("seatholds-never-double-book", { seatholds: "SeatHolds" }) starts "SeatHolds" (A3)
  // planTitle(undefined, "my-plan") === "my-plan"; planTitle("", "my-plan") === "my-plan"     (A6)
  // planDates on a temp plan folder: brief date 2026-10-08, retrospective "Landed on main at abc1234, 2026-10-09."
  //   → { started: "2026-10-08", landed: "2026-10-09", ... }                                  (A11)
  //   with a changelog whose "## [1.68.0] — 2026-10-09" names "(my-plan)" → released { version: "1.68.0", date: "2026-10-09" } (A12)
  //   no landing line → { started, landed: null, released: null }; landed, no release → released: null (A13)

  // promise-health-names.test.ts — promise: a-plan-reads-by-its-title, a-plan-shows-when-it-shipped
  // healthLine(registry, [], now, { planTitles, planDates, words }) → each promise carries
  //   title, planTitle and planDates                                                           (A7)
  ```

#### Deferred to Build Phase 2

- **A1, A4, A5, A9** — their subject is the extension core reading the line's new fields, which exist after Build Phase 1. Bodies:

  ```typescript
  // names.test.ts — promise: a-promise-reads-as-words, a-plan-reads-by-its-title
  // a line whose promise carries title "A break reaches the editor" and planTitle "VS Code extension":
  //   panelModel → card/row name "A break reaches the editor", group "VS Code extension"         (A1, A5)
  //   activityLines → "A break reaches the editor held (local) · …"; hover heading the same      (A1)
  //   panelBody → the statement in the opened promise                                           (A4)
  //   markers → "a-break-reaches-the-editor · …" (the handle)                                    (A9)
  ```

- **A10** — a live check in the editor; added to the live probe in Build Phase 2.

#### Test Phase 1 Verification

- [x] A8 is authored and fails on its own assertion (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/display-names-single-definition.test.ts`); every deferred body above reviewed: will it compile at the phase it names, and does it assert what it claims? — 2026-10-10: A8 red on its own assertion (1 failed, 1 passed of 2: `expected '' to match /export function promiseWords\(/`, no load error); the other 7 deferred rows' bodies reviewed — each names symbols Build Phase 1 introduces and compiles then (`healthLine`'s fourth argument is added there), A1/A4/A5/A9 read fields that exist after Build Phase 1; tsc and biome clean.

### Build Phase 1: Names and dates in the package, on the line

**Goal**: one module that names promises and plans and dates plans; the health line carries the result.

- [x] `apps/indusk-mcp/src/lib/promises/display.ts`: `promiseWords(name, words?)`, `planTitle(title, folder)`, `planDates(planDir, changelog)`, `BUILT_IN_WORDS`; exported as `./promises/display` in `package.json`
- [x] `display.words` read from `.indusk/config.json`, merged over the built-in words
- [x] `healthLine(registry, reads, now, names?)`: each promise gains `title`, `planTitle` and `planDates`; `promises health` builds `names` each line from the plan folders (active and archived) and the project's declared changelog (`workflow.steps`)

- [x] Shape — reviewed `lib/promises/display.ts` and the `health-line.ts` change against the enabled extensions' craft rules: nothing found (one definition each, no handle-to-words copy outside the module, the new line fields typed once through `HealthNames`/`PlanDates`).

#### Build Phase 1 Verification

- [x] A2, A3, A6, A7, A8, A11, A12, A13 pass, each red first (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/display.test.ts src/__tests__/promise-health-names.test.ts src/__tests__/display-names-single-definition.test.ts && pnpm exec vitest related src/lib/promises/health-line.ts --run`); tsc and biome clean — 2026-10-10: red first (stub module: 9 failed on their own assertions); now display.test.ts + promise-health-names + single-definition 12 passed, `vitest related health-line.ts` 56 passed (12 files); tsc clean; biome clean on changed files.

#### Build Phase 1 Context

- [x] mcp (`apps/indusk-mcp/CLAUDE.md`, the single-definition pins entry): display names and plan dates — `display-names-single-definition.test.ts`; folded into the entry, making room in the file, which is at its budget
- [x] root (Key Decisions): "Display names: one `promises/display` module names promises in words, plans by title and dates them; they travel on the health line — see `/decisions/display-names`" — always-on because the admin's next plan must use it rather than write its own

#### Build Phase 1 Document

- [x] `reference/cli/promises.md`: the line's `title`, `planTitle` and `planDates`, and `display.words` in the project's config

### Build Phase 2: The panel reads them

**Goal**: the panel, activity and hover name promises in words and plans by title with their dates; the marker keeps the handle.

- [x] `core/panel.ts`, `core/panel-html.ts`, `core/activity.ts`, `core/hover.ts`: show `title` and `planTitle`, with the handle and folder as fallbacks; a plan group shows "started …, landed …, released X.Y.Z (date)" or "not released yet"
- [x] A10 added to the live probe and run on the dusk project; recorded here — 2026-10-10: `e2e/live-probe.cjs` runs a `names()` check alone under `INDUSK_LIVE_A10=1` (no demo app), asserted by a branch in `e2e/live.e2e.test.ts`. Run in VS Code on this worktree (the extension built from it, `indusk` the worktree's build): passed. 19 plan groups, 16 headed by a title that is not the folder (the other 3 have no brief title, so the folder is the title), all 19 dated ("started …"), 12 naming a release ("released 1.63.0 (2026-10-06)"), 71 of 71 cards and rows in words (e.g. `every-commit-evaluated` reads "Every commit evaluated"); a landed plan in no release reads "started 2026-10-05, landed 2026-10-05, not released yet".
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules: nothing found (the date sentence lives once, in `panel.ts`'s `whenWords`; the words come only from `titleOf` over the line, with the handle as the fallback).

#### Build Phase 2 Verification

- [x] A1, A4, A5, A9 pass, each red first (`cd apps/vscode-extension && pnpm exec vitest run src/core`); A10 passes live; typecheck and biome clean — 2026-10-10: `names.test.ts` red first, 3 of 6 failed on their own assertions (A1: `expected undefined to be 'A break reaches the editor'`; A5 title: `expected undefined to be 'VS Code extension'`; A5 dates: the body lacked "started 2026-10-08, landed …"). A4, A9 and A1's handle-fallback case were green on first run: the statement and the marker's handle are behaviour the panel already had, so they are regression guards, not red-first. Now `src/core` 11 files / 38 tests passed; A10 passed live (above); `tsc --noEmit` clean; biome clean.

#### Build Phase 2 Context

- [x] `apps/vscode-extension/CLAUDE.md`: names and dates come from the line; the extension never turns a handle into words itself

#### Build Phase 2 Document

- [x] the guide's panel section: promises in words, plans by title and dates; changelog: Changed

### Build Phase 3: Falsification — the plans that landed before the landing line, and plans with no brief

**Tier**: med

**Goal**: verify whether the attested dates hold for the plans dusk actually has. Measured on 2026-10-10 against this worktree's 111 archived plans: 80 read as never landed and 35 of those are named in the changelog, so their release is suppressed too (A14); and a plan whose only document is its research shows no start date (A15).

**Read, then measured (A14):** `planDates` takes "landed" only from a retrospective line `Landed on main at <sha>, <date>.`, which the retrospective skill began writing on 2026-09-18 (Step 10.8). Every earlier archived plan has none, so it reads "started …" as if it never landed, and `released` is computed only when `landed` is set, so the release the changelog names is dropped. A plan in `archive/` is on main by construction; its retrospective's frontmatter `date` is the closest fact on disk.

**Read, then measured (A15):** `started` comes only from `brief.md`'s `date`. A spike has no brief by design (its research is its document), and so do parent plans like `promise-core`, `jev-decision-model` and `user-zero` in this repository — their groups show no start date, against `a-plan-shows-when-it-shipped`.

**Not investigated further, and why:** `promiseWords` (hyphen-split, exact-word lookup; a built-in word cannot match inside another word, and A2/A3 cover capitals and project words); `planTitle` (A6 decides the no-brief fallback is the folder); `releaseOf`'s pattern (it matches the plan as a whole parenthesised list item, and the two changelog mentions it misses, `day-promises` and `test-kinds`, are not written as `(plan)` entries — by the row's own definition not releases); a version bumped and never published (1.69.0) reading as released (A12 defines the release as the changelog's); the cost of re-reading every plan folder each health line (correct, and the cockpit's planning will decide whether to cache).

- [x] `lib/promises/display.ts` `planDates(planDir, changelog?, opts?: { archived?: boolean })`: with no landing line and `archived`, `landed` is the retrospective's frontmatter `date` (else the impl's `date`), and `released` is looked up whenever the plan is landed or archived; `readHealthNames` passes `folder.archived` (A14)
- [x] `planDates`: `started` is the brief's `date`, else the first of `research.md`, `test-plan.md`, `adr.md`, `impl.md` that has one (A15)

- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 3 Verification

- [x] A14 and A15 pass, and A11, A12, A13 still do (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/display.test.ts src/__tests__/promise-health-names.test.ts`); re-run the measurement above and record how many archived plans now read as landed and released
  - 2026-10-10, vitest (`display.test.ts`, `promise-health-names.test.ts`): 17 passed; `vitest related display.ts`: 13 files, 72 passed; tsc clean; biome clean.
  - Measurement against this repo's 111 archived plans. Before: 80 never landed (35 of them named in the changelog, so their release was suppressed), 3 with no start date. After: 17 never landed (94 landed), 15 with a release, 3 with no start date. The 17 have neither a retrospective nor an impl carrying a `date`; the 3 with no start have no dated lifecycle document at all.

#### Build Phase 3 Context

- [x] `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: a plan's dates fall back for what older plans never wrote — an archived plan is landed (its retrospective's date), and the start is the first lifecycle document's date

#### Build Phase 3 Document

- [x] `reference/cli/promises.md`, the `planDates` field: where each date comes from, including the two fallbacks

### Build Phase 4: Cleanup — one reader of a plan document's frontmatter

**Tier**: med

**Goal**: remove the one cross-file duplication this plan created — a second reader of plan documents' frontmatter — per "reuse the package's parsers, never duplicate parsing" (the rule the admin and the package already follow). Every other changed file is recorded as reviewed.

**Scan**: `listOversizedChangedFiles(<worktree>, "main")` flagged `apps/docs/src/changelog.md`, `apps/docs/src/reference/cli/promises.md`, `bin/commands/promises.ts` (498, a 4-line touch) and `lib/config.ts` (701, a 2-line touch). The plan's new files — `lib/promises/display.ts` (169), its tests, `core/names.test.ts` — are under the cap. No domain extension (nextjs/react) applies: the editor core is plain TypeScript.

- [ ] `lib/promises/display.ts` reads a plan document's `title` and `date` through the package's existing YAML reader (`gray-matter`, as `plan-parser.ts`'s `parseFrontmatter` does — export a small `readPlanFrontmatter(path)` from `plan-parser.ts` and use it in both, or call `gray-matter` directly if the export would widen `plan-parser`'s surface), replacing its private regex `frontmatter()`. Basis: two readers of the same brief can disagree — a quoted title with a colon, an escaped quote or a folded scalar reads one way through YAML and another through a line regex — and the plan page (plan-parser) and the editor (display) would then name one plan two ways, the exact disagreement `display-names-are-defined-once` exists to prevent. A6, A11, A13, A14, A15 hold behaviour
- [ ] (reviewed the `sources()` file walker in `display-names-single-definition.test.ts` against the four other `*-single-definition.test.ts` files — left as-is: only `promise-health-single-definition.test.ts` is an identical copy; the other three differ in what they exclude (`__tests__`, `node_modules`, `.tsx`), and folding five pins' scans into one helper would change which files three pins read — a silent weakening risk that belongs in a plan about the pins, not this one)
- [ ] (reviewed `bin/commands/promises.ts`, `lib/config.ts`, `lib/promises/health-line.ts` — left as-is: 4-, 2- and 17-line touches in each file's existing shape)
- [ ] (reviewed `apps/vscode-extension/src/core/{panel,panel-html,activity,hover,view}.ts` and `panel-view.ts` — left as-is: each change maps a line field to text in the one place that renders it; `titleOf` in `view.ts` is the one shared lookup the activity and hover use, already extracted)
- [ ] (reviewed `e2e/live-probe.cjs` — left as-is: the A10 branch follows the probe's existing per-check branches)
- [ ] (reviewed the docs pages flagged by size — left as-is: a changelog and a reference page)

#### Build Phase 4 Verification

- [ ] (no tests flip at this phase — reason: refactor) A6, A11, A12, A13, A14, A15 and A8 still pass after the reader change (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/promises/display.test.ts src/__tests__/promise-health-names.test.ts src/__tests__/display-names-single-definition.test.ts && pnpm exec vitest related src/lib/promises/display.ts src/lib/plan-parser.ts --run`); `tsc --noEmit` and biome clean; re-run the archived-plan measurement and record it unchanged (17 not landed, 15 released, 3 no start)

#### Build Phase 4 Context

- [ ] `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: `display.ts` reads plan frontmatter through the package's YAML reader, never its own pattern

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/cli/promises.md`: confirm the `title`/`planDates` text still describes where each value is read from; record here that nothing user-visible changed if so

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/display.ts` | new |
| `apps/indusk-mcp/src/lib/promises/health-line.ts` | `title`, `planTitle`, `planDates` |
| `apps/indusk-mcp/src/bin/commands/promises.ts` | builds the names each line |
| `apps/indusk-mcp/package.json` | `./promises/display` export |
| `apps/vscode-extension/src/core/{panel,panel-html,activity,hover}.ts` | read the names |

## Dependencies
- vscode-extension, landed.

## Notes
- A changelog entry names its plan in parentheses, `(plan-name)`; `planDates` reads that, the convention every entry follows.

---
title: "Display names — promises and plans read as words"
date: 2026-10-09
status: approved
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
| A1 | The promise `a-break-reaches-the-editor` reads "A break reaches the editor" on its card, its row in the panel, its activity lines and the heading of its hover | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-promise-reads-as-words | apps/vscode-extension/src/core/names.test.ts |
| A2 | Product names keep their capitals: `a-fly-deploy-is-one-command` reads "A Fly deploy is one command", `indusk-leaves-main-clean` reads "InDusk leaves main clean" | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-promise-reads-as-words | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A3 | A project can name its own product words, and they keep their capitals the same way | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-promise-reads-as-words | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A4 | Opening a promise in the panel shows its full sentence | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-promise-reads-as-words | apps/vscode-extension/src/core/names.test.ts |
| A5 | The panel's plan group and a broken card's plan read by the brief's title, the part before " — "; `vscode-extension` reads "VS Code extension" | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-plan-reads-by-its-title | apps/vscode-extension/src/core/names.test.ts |
| A6 | A plan with no brief, or a brief with no title, still reads by its folder name | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-reads-by-its-title | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A7 | Each health line names each promise's words, its plan's title and its plan's dates, so the editor names plans without reading plan files | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-reads-by-its-title, promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/__tests__/promise-health-names.test.ts |
| A8 | How a promise or plan is named for a person, and a plan's dates, are defined once, in the package; a second definition in the admin or the extension fails the build | Test Phase 1 | Build Phase 1 | passing | unit | promise: display-names-are-defined-once | apps/indusk-mcp/src/__tests__/display-names-single-definition.test.ts |
| A9 | The marker at the end of a code line still shows the promise's handle | Build Phase 2 | Build Phase 2 | planned | unit | a regression guard over a decision in the brief: the marker sits beside the token that spells the handle | apps/vscode-extension/src/core/names.test.ts |
| A10 | On the dusk project in VS Code, the panel's groups read by plan titles with their dates, and its cards and rows by promise words | Build Phase 2 | Build Phase 2 | planned | live check | the whole story once, against the real editor | apps/vscode-extension/e2e/live.e2e.test.ts |
| A11 | A plan's group in the panel shows the date it started and the date it landed | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A12 | A landed plan shows the release that shipped it — the first release whose changelog names the plan — with its version and date | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A13 | A plan not landed shows only its start date; one landed but in no release yet says "not released yet" | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-shows-when-it-shipped | apps/indusk-mcp/src/lib/promises/display.test.ts |

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

#### Build Phase 1 Verification

- [x] A2, A3, A6, A7, A8, A11, A12, A13 pass, each red first (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/display.test.ts src/__tests__/promise-health-names.test.ts src/__tests__/display-names-single-definition.test.ts && pnpm exec vitest related src/lib/promises/health-line.ts --run`); tsc and biome clean — 2026-10-10: red first (stub module: 9 failed on their own assertions); now display.test.ts + promise-health-names + single-definition 12 passed, `vitest related health-line.ts` 56 passed (12 files); tsc clean; biome clean on changed files.

#### Build Phase 1 Context

- [x] mcp (`apps/indusk-mcp/CLAUDE.md`, the single-definition pins entry): display names and plan dates — `display-names-single-definition.test.ts`; folded into the entry, making room in the file, which is at its budget
- [x] root (Key Decisions): "Display names: one `promises/display` module names promises in words, plans by title and dates them; they travel on the health line — see `/decisions/display-names`" — always-on because the admin's next plan must use it rather than write its own

#### Build Phase 1 Document

- [ ] `reference/cli/promises.md`: the line's `title`, `planTitle` and `planDates`, and `display.words` in the project's config

### Build Phase 2: The panel reads them

**Goal**: the panel, activity and hover name promises in words and plans by title with their dates; the marker keeps the handle.

- [ ] `core/panel.ts`, `core/panel-html.ts`, `core/activity.ts`, `core/hover.ts`: show `title` and `planTitle`, with the handle and folder as fallbacks; a plan group shows "started …, landed …, released X.Y.Z (date)" or "not released yet"
- [ ] A10 added to the live probe and run on the dusk project; recorded here

#### Build Phase 2 Verification

- [ ] A1, A4, A5, A9 pass, each red first (`cd apps/vscode-extension && pnpm exec vitest run src/core`); A10 passes live; typecheck and biome clean

#### Build Phase 2 Context

- [ ] `apps/vscode-extension/CLAUDE.md`: names and dates come from the line; the extension never turns a handle into words itself

#### Build Phase 2 Document

- [ ] the guide's panel section: promises in words, plans by title and dates; changelog: Changed

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

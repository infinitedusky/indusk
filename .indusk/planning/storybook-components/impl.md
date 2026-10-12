---
title: "Storybook components — the approved mockups as components, one implementation each, a story per state"
date: 2026-10-12
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# Storybook components

## Goal

The admin is built from components defined once, each with an approved story per state rendered to a snapshot, and every mockup is composed of those components by name; a changed component reopens the mockups that use it; Storybook is served by the cockpit and a catalog file lists every component for an agent (ADR decisions 1–9).

## Scope

### In Scope
- Storybook 10.6 (`@storybook/nextjs-vite`, `@storybook/addon-vitest`, components manifest) in `apps/indusk-admin`, served by the admin at `/storybook`.
- `lib/looks/` in the package: the component scan (one implementation, markers), the render step (stories → snapshots, the catalog), composition (`<indusk-component>`), story approvals and `componentsHash`, coverage of component states.
- `indusk looks stories <app>`; the lint, status and coverage gaining component rules.
- The Looks page: components beside screens, stories framed at each device, story approval.
- All nineteen components the mockups name, each one file with its stories; the eleven mockups rewritten to compose them and re-approved by Sandy; the admin's screens rebuilt from the components.

### Out of Scope
- Pixel comparison of stories or screens with mockups — [mockup-matching](../mockup-matching/brief.md).
- Component behaviour, interactions and scenarios — [demo-scenarios](../demo-scenarios/brief.md).
- An in-app gallery; the MCP as a dependency; any app besides the admin.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `fixtures/components-app/`; red CLI-boundary tests for the component scan, lint, status and coverage; the storybook contract file; the register | today's `indusk` CLI; ui-promises' fixture shape |
| Build Phase 1 | Storybook in the admin (`.storybook/`, `storybook` vitest project in the system tier), `storybook build` served at `/storybook`, `Badge` with its stories | the admin's `globals.css` and foundation |
| Build Phase 2 | `looks/components` (scan: one file per marker, no marker in screens), `indusk looks stories` (snapshots + `components.json`) | Build Phase 1's Storybook and stories |
| Build Phase 3 | `looks/compose`, the lint's component rules, story entries and `componentsHash` in `approvals`, coverage of component states; the two promise changes | Build Phase 2's snapshots and catalog |
| Build Phase 4 | the Looks page's components, stories framed at devices, story Approve; `looks check` over stories; the render promise change | Build Phase 1's `/storybook`, Build Phase 3's approvals |
| Build Phase 5 | all nineteen components, one file each, with stories and snapshots | Build Phases 1–2 |
| Build Phase 6 | the eleven mockups rewritten to compose components | Build Phases 3, 5 |
| Build Phase 7 | the nav, the dashboard and the Looks page rebuilt from components | Build Phases 5–6 |
| Build Phase 8 | the promise and plan pages rebuilt from components; the live check | Build Phases 5–7 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A component name marked on two different implementations in the app's source is refused, naming both files | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-component-has-one-implementation | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A2 | Every component the admin's approved mockups name has an implementation in the admin; one with none is reported by name | Test Phase 1 | Build Phase 5 | written | unit | promise: a-component-has-one-implementation | apps/indusk-mcp/src/__tests__/looks-admin-components.test.ts |
| A3 | A screen that writes out a component's marked element outside the component's own file is refused, naming the file and line | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-component-has-one-implementation | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A4 | A component state a mockup shows with no story for it is reported, naming the component and the state | Test Phase 1 | Build Phase 2 | passing | unit | promise: every-component-state-has-a-story | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A5 | Every story in the admin renders its component in a real browser without an error | Test Phase 1 | Build Phase 1 | passing | contract | promise: every-component-state-has-a-story | apps/indusk-admin/src/__tests__/storybook.contract.test.ts |
| A6 | A story renders the component the app uses: changing the component changes its snapshot with no edit to the story | Build Phase 2 | Build Phase 2 | passing | contract | promise: every-component-state-has-a-story | apps/indusk-admin/src/__tests__/storybook.contract.test.ts |
| A7 | A mockup that names a component and a state shows, on the Looks page, the approved snapshot of that component in that state | Build Phase 4 | Build Phase 4 | planned | contract | promise: a-mockup-composes-approved-components | apps/indusk-admin/src/app/p/[project]/looks/looks-components.contract.test.ts |
| A8 | A mockup that draws a component's markup itself instead of naming it is refused by the lint, naming the file, the line and the component | Test Phase 1 | Build Phase 3 | written | unit | promise: a-mockup-composes-approved-components | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A9 | A mockup that draws a component it declares new passes the lint, and the new component is listed as needing a story | Test Phase 1 | Build Phase 3 | written | unit | promise: a-mockup-composes-approved-components | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A10 | A mockup that names a component, or a state of one, with no approved story is refused, naming it | Test Phase 1 | Build Phase 3 | written | unit | promise: a-mockup-composes-approved-components | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A11 | After an approved component's snapshot changes, every approved mockup that uses it reads proposed naming that component; a mockup that does not use it stays approved | Test Phase 1 | Build Phase 3 | written | unit | promise: a-changed-component-reopens-its-mockups | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A12 | Approving the reopened mockup again in the cockpit makes it read approved | Build Phase 3 | Build Phase 3 | written | unit | promise: a-changed-component-reopens-its-mockups | apps/indusk-mcp/src/lib/looks/approvals.test.ts |
| A13 | After a build, the catalog file lists every component with its properties and each state that has a story, read with no server running | Test Phase 1 | Build Phase 2 | passing | contract | promise: an-agent-can-find-every-component | apps/indusk-admin/src/__tests__/storybook.contract.test.ts |
| A14 | A component implemented in the app but missing from the catalog is reported by name | Test Phase 1 | Build Phase 2 | passing | unit | promise: an-agent-can-find-every-component | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A15 | Coverage reports a component state with no approved story as uncovered, and passes once its story is approved | Test Phase 1 | Build Phase 3 | written | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A16 | A story reads proposed until a person approves it; an agent's write to the record of story approvals is refused, naming the cockpit's Approve | Test Phase 1 | Build Phase 3 | written | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A17 | A story changed after it was approved reads proposed again | Test Phase 1 | Build Phase 3 | written | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts |
| A18 | Each story opens on the Looks page at each reference device's size, served by the admin itself, with no Storybook server running | Build Phase 4 | Build Phase 4 | planned | contract | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/app/p/[project]/looks/looks-components.contract.test.ts |
| A19 | Every story's render uses only the approved foundation's values; one changed token shows the story broken | Build Phase 4 | Build Phase 4 | planned | contract | promise: tokens-are-held-exactly | apps/indusk-admin/src/__tests__/storybook-held.contract.test.ts |
| A20 | The rebuilt admin is held: `indusk looks check admin` reads every checked look held, and one token changed in the admin alone shows broken on the dashboard | Build Phase 8 | Build Phase 8 | planned | live check | the live check of the rebuilt admin against its foundation and dashboard (expectation 1's companion) | manual: recorded in this impl's Build Phase 8 Verification |
| A21 | Story tests run in the system tier, never in the everyday suite | Test Phase 1 | Build Phase 1 | passing | unit | lesson: everyday-tests-never-wait | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A22 | The nav still fits a phone after it is rebuilt from components | Test Phase 1 | Test Phase 1 | passing | contract | a regression guard over `the-nav-fits-a-phone`, re-run when the nav is rebuilt | apps/indusk-admin/src/app/p/[project]/cockpit-phone.test.tsx |
| A23 | The rebuilt dashboard still lists every promise, broken first | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over `every-promise-is-listed` and `broken-promises-come-first`, re-run when the dashboard is rebuilt | apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx |
| A24 | `indusk looks lint admin` still finds no raw value after the rebuild | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over `a-mockup-leaves-nothing-undefined`, re-run after the mockups and screens change | apps/indusk-mcp/src/__tests__/looks-admin-foundation.test.ts |

### Deferred Verification

- **The rebuilt cockpit looks like its approved mockups (test plan U1)**
  - reason: whether two screens match is a person's judgement until a pixel comparison exists
  - would require: mockup-matching's pinned renderer and screen comparison
  - mitigation: Sandy opens each screen beside its mockup at each device at Build Phase 8 and records the verdict there; mockup-matching (plan 3 of 4, next in the indusk-demo master) makes it a check
- **The components are cut along the right boundaries (test plan U2)**
  - reason: a design judgement
  - would require: a person looking at each component
  - mitigation: Sandy approves each component's stories on the Looks page in Build Phase 5; a component that cannot be reused across the mockups in Build Phase 6 is split or merged there

## Checklist

### Test Phase 1: Author what the CLI and Storybook boundaries can test today, RED

**Tier**: med — the work step's default

**Goal**: author every row that can be written against today's `indusk` and the admin, and record the rest with their reasons.

- [x] Create/confirm this plan's worktree (`indusk worktree create storybook-components`; made by `indusk plans start` on 2026-10-12 at `dusk-worktrees/storybook-components`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] A fixture app, `apps/indusk-mcp/src/__tests__/fixtures/components-app/`: `.indusk/mockups/demo/` with ui-promises' files (a two-colour foundation, one device, `screens.json` declaring `home.default` and `home.empty`); `components/badge.ok.html`, `components/badge.broken.html` and `components/card.default.html` (snapshots, foundation values only); `components.json` listing `badge` (states `ok`, `broken`) and not `card`; `screens/home.default.html` composing `<indusk-component name="badge" state="ok">` and `card`; `screens/home.empty.html` drawing a `data-component="badge"` element inline; `screens/home.new.html` drawing `data-component="pill"` with `<meta name="indusk-new-components" content="pill">`; `screens/home.missing.html` naming `badge` state `warn`; `approved.json` (written by a `tsx` script calling the package's hash functions — the guard refuses a tool write to the path) approving the `badge.ok` story and `home.default` with its `componentsHash`; `src/Badge.jsx` and `src/Other.jsx` both carrying `data-component="badge"`, `src/Page.jsx` writing a raw `data-component="card"` element, `src/Card.jsx` the card
- [x] A1, A3, A4, A8, A9, A10, A11, A14, A15, A16, A17 in `apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts`, each spawning `indusk looks lint | status | coverage demo` over a temp copy of the fixture and asserting the line it names (A11 and A17 rewrite `badge.ok.html` in the copy first). RED today on their own assertions: the commands run, and the component lines are absent
- [x] A2 in `apps/indusk-mcp/src/__tests__/looks-admin-components.test.ts`: `indusk looks coverage admin` at the repo root prints no `unimplemented component:` line. RED today: the line does not exist, so the assertion that each of the nineteen has an implementation fails on the ten unmarked
- [x] A5 and A13 in `apps/indusk-admin/src/__tests__/storybook.contract.test.ts`, listed in the admin's `vitest.tiers.ts` `SYSTEM`: A5 runs the admin's `storybook` vitest project and expects exit 0 with at least one story; A13 runs `indusk looks stories admin` and reads `.indusk/mockups/admin/components.json` for `badge` with its properties and states. RED today: no `storybook` project, no `stories` command
- [x] A21: a case in `everyday-tests-never-wait.test.ts` that fails unless the admin's `vitest.tiers.ts` lists a `storybook` project in the system tier and no everyday project includes `*.stories.*`. RED today: no such project
- [x] A22, A23, A24: confirm `cockpit-phone.test.tsx`, `dashboard.test.tsx` and `looks-admin-foundation.test.ts` pass unchanged (Regression Guards)
- [x] Confirm each red test fails on its own assertion rather than on a missing import

#### Deferred to Build Phase 2

- **A6** — its subject is the snapshot `indusk looks stories` writes, and the test edits `Badge.tsx` and reruns the render; the component file and the snapshot path exist only from Build Phase 1 and Build Phase 2. Body reviewed in Test Phase 1 (the first draft edited a `var(--space-tight)` string `Badge.tsx` does not contain and called helpers nothing defines; it edits the component's real class string in place and restores it, which the system tier's one-file-at-a-time run allows):

  ```typescript
  // apps/indusk-admin/src/__tests__/storybook.contract.test.ts — promise: every-component-state-has-a-story
  // needs: readFileSync, writeFileSync from node:fs; spawnSync from node:child_process; join; the file's CLI and REPO constants
  it("A6: a changed component changes its snapshot with no edit to the story", () => {
    const render = () => spawnSync("node", [CLI, "looks", "stories", "admin"], { cwd: REPO, encoding: "utf-8" });
    const component = join(REPO, "apps/indusk-admin/src/components/ui/Badge.tsx");
    const snapshotOf = () => {
      const catalog = JSON.parse(readFileSync(join(REPO, ".indusk/mockups/admin/components.json"), "utf-8"));
      const state = catalog.components.find((c: { name: string }) => c.name === "badge").states[0].name;
      return readFileSync(join(REPO, `.indusk/mockups/admin/components/badge.${state}.html`), "utf-8");
    };
    const original = readFileSync(component, "utf-8");
    expect(render().status).toBe(0);
    const before = snapshotOf();
    try {
      writeFileSync(component, original.replace("px-2 py-hair", "px-3 py-hair"));
      expect(render().status).toBe(0);
      expect(snapshotOf()).not.toBe(before);
    } finally {
      writeFileSync(component, original);
      render();
    }
    // the stories file was not edited: git sees only the component changed, and it is restored
    expect(spawnSync("git", ["status", "--porcelain", "--", "apps/indusk-admin/src"], { cwd: REPO, encoding: "utf-8" }).stdout).not.toMatch(/stories/);
  });
  ```

#### Deferred to Build Phase 3

- **A12** — the request that approves a story and re-approves a reopened mockup takes a shape (`kind: "story"`, the `componentsHash` shown) decided in Build Phase 3; written as a package test of `approve` once the shape exists.

#### Deferred to Build Phase 4

- **A7** — the Looks page's composed mockup and its story frames are built in Build Phase 4; the contract opens the page under `next dev` and reads the frame's document, whose route does not exist before then.
- **A18** — `/storybook` is served by the admin from Build Phase 1, but the Looks page's component list and device frames, and the story id scheme the test names, are Build Phase 4's.
- **A19** — the value check over stories is Build Phase 4's `looks check` extension; the contract runs it against the served Storybook with one token changed.

#### Deferred to Build Phase 8

- **A20** — a live check of the rebuilt admin, recorded once its screens are rebuilt.

#### Regression Guards

- **A22** — the nav-on-a-phone test passes today and must keep passing; re-run in Build Phase 7's Verification when the nav is rebuilt.
- **A23** — the dashboard listing tests pass today; re-run in Build Phase 7's Verification when the dashboard is rebuilt.
- **A24** — the admin lints clean today; re-run in Build Phase 6 and Build Phase 8 after the mockups and screens change.

#### Test Phase 1 Verification

- [x] A1–A5, A8–A11, A13–A17 and A21 authored, each red on its own assertion; A22–A24 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/looks-components-cli.test.ts src/__tests__/looks-admin-components.test.ts src/__tests__/everyday-tests-never-wait.test.ts src/__tests__/looks-admin-foundation.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/app/p/\[project\]/cockpit-phone.test.tsx src/app/p/\[project\]/promises/dashboard.test.tsx`; the contract file run once with `--config vitest.system.config.ts` and its red read); tsc and biome clean on the new files
- [x] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims?

### Build Phase 1: Storybook in the admin, served by the cockpit

**Tier**: med — the work step's default

- [x] Add `storybook@10.6.x`, `@storybook/nextjs-vite`, `@storybook/addon-vitest` and `@storybook/addon-themes` to `apps/indusk-admin` (exact versions, at least two weeks old); pin `next` at `16.2.x` with a comment naming storybookjs#36720
- [x] `.storybook/main.ts` (`framework: "@storybook/nextjs-vite"`, `features: { componentsManifest: true }`, stories `src/**/*.stories.tsx`) and `.storybook/preview.ts` (imports `src/app/globals.css`; `parameters.nextjs.appDirectory: true`; light/dark through `withThemeByDataAttribute` on `data-theme`, matching the generated foundation)
- [x] A `storybook` project in `apps/indusk-admin/vitest.tiers.ts` via `storybookTest({ configDir: ".storybook" })`, browser mode on Playwright, listed in the system tier; excluded from every everyday project
- [x] `storybook build --output-dir public/storybook` in the admin's build (`build:storybook`, run before `next build`); `public/storybook/` git-ignored; `bundle-admin.js` already copies `public/`, so the bundled admin serves `/storybook/index.html` and `/storybook/iframe.html`
- [x] `src/components/ui/Badge.stories.tsx`: one story per badge state the mockups show (read the eleven mockups' badge variants), named for the state
  - Finding: the mockups name two components that `Badge.tsx` could be: `badge` (a plan's initials square with a status dot; states `needs`, `working`, `released`) and `chip` (the pill; states `declared`, `proving`, `enforced`, `broken`, `active`). `Badge.tsx` marks its element `data-component="chip"` and its eight variants draw the `chip` colours (passing = enforced, blocked = broken, skipped = proving, written = active, planned/neutral = declared); it draws no `badge`. The stories are named for its eight variants. Consequence for A13 (the catalog lists `badge` with a story state and a snapshot): A13 fails after Build Phase 2 unless `badge` gets its own component file, or Build Phase 5 renames the marker; the marker is unchanged here, and Build Phases 2 and 5 reconcile (the plan lists `chip` separately).
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-admin/vitest.config.ts`) — name the `@` alias once (`const alias`) instead of writing `{ "@": path.resolve(__dirname, "src") }` at the top level and in each of the three projects. Rule: should this inline block have been a named value — the same object written four times in one file, one added by this phase

#### Build Phase 1 Verification

- [x] A5 and A21 pass (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/storybook.contract.test.ts -t A5`; `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/everyday-tests-never-wait.test.ts`); `cd apps/indusk-admin && pnpm build` exits 0 and `public/storybook/iframe.html` exists; tsc and biome clean on changed files

#### Build Phase 1 Context

- [x] root (Key Decisions): "Storybook components: each component one file with a story per state rendered to a snapshot; mockups compose components by name; a changed component reopens its mockups; Storybook served by the cockpit — see `/decisions/storybook-components`" — always-on because every UI plan from now on builds from these components; if the root is over its budget line, move another root entry down a tier first
- [x] `apps/indusk-admin/CLAUDE.md`: Storybook is `@storybook/nextjs-vite`, its story tests are the system tier's, and Next stays at 16.2.x until storybookjs#36720 — guarded by `everyday-tests-never-wait.test.ts` (A21)

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: Storybook in the admin, `/storybook`, how to run it locally

### Build Phase 2: One file per component, stories rendered to snapshots, the catalog

**Tier**: med — the work step's default

- [x] `apps/indusk-mcp/src/lib/looks/components.ts`, exported as `./looks/components`: scan an app's `sources` (from `screens.json`) for `data-component` markers; each name must sit in exactly one non-test, non-story file (`duplicate component <name>: <file>, <file>`); a marker in any other file is `component markup outside its file: <file>:<line> <name>`; replaces the two-element pattern list in `component-reuse-audit.test.ts` with a call to the scan
  - Note: a name in two or more files is `duplicate component`; when one of them is the component's own file by name (`Badge.tsx` for `badge`, `DecisionCard.tsx` for `decision-card`) every other file's marker is also `component markup outside its file`. A name in one file is never a scan finding (today's `shell` in `layout.tsx` is a component not yet extracted: the catalog's gap, not the scan's).
  - Deviation: the audit's `<button className=`/`<table className=` patterns guard a different rule (use the primitive), so they stay; the scan is a second case in `component-reuse-audit.test.ts`, not a replacement.
- [x] `indusk looks stories <app>` in `src/bin/commands/looks.ts`: composes each story with `composeStories` from `@storybook/nextjs-vite` (through the admin's `.storybook` project annotations), renders it to static markup, writes `.indusk/mockups/<app>/components/<name>.<state>.html`, and writes `components.json` (name, file, properties from `storybook build`'s components manifest, states with their snapshot hash); a story that cannot render statically is refused by name
  - Deviation (render mechanism): `composeStories` outside the Vitest addon does not load. In plain Node or a Vite SSR server `@storybook/nextjs-vite` imports `sb-original`, an alias only its Vite plugin defines, and the plugin's `next/dist/compiled/react` aliases fail to evaluate; in a Vitest node environment the plugin's `module-alias` cannot resolve `next/dist/client/router`. The step instead runs the app's own Vitest with the addon-vitest plugin (the runner the `storybook` project uses) over a generated config directory in `node_modules/.cache/indusk-looks/` whose preview adds one `afterEach` that writes each story's `canvasElement.innerHTML`, so the snapshot is the markup Chromium drew from the app's own preview annotations, decorators included. Properties still come from the components manifest; a manifest older than a story or component is rebuilt first (`pnpm run build:storybook`).
  - Note: the component's name is read from the marker its snapshot carries (`chip` for `Badge.tsx`), its file from the scan; the state is the story id after `--`. A marked component with no story is not in the catalog; the admin's eight (`button`, `decision-card`, `device-choice`, `device-frame`, `look-row`, `nav`, `shell`, `view-link`) are listed in `.indusk/mockups/admin/screens.json` `uncatalogued`, which Build Phase 5 empties, so `indusk looks lint admin` (A24) keeps passing with a catalog present.
- [x] The lint and coverage report a component implemented in the app but missing from `components.json` (`not in catalog: <name>`) and a component state a mockup shows with no story (`no story: <name>.<state>`)
  - Note: both are reported only when the app has a `components.json` (an app that has not adopted stories has nothing to omit from). `readApprovals` now recognises a `kind: "story"` entry and returns the mockups' entries only, and `approve` keeps every entry when it writes, so a record holding story approvals is not refused as malformed before Build Phase 3 reads them.
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-mcp/src/lib/looks/stories.ts`) — `renderStories` decided what each story is (name from its marker, state from its id, the refusals) and wrote files in one body; the decision is now `buildCatalog` in `stories-catalog.ts`, pure and tested without a browser (`stories-catalog.test.ts`). Rule: does this unit have one reason to change — the second job moves to a named, testable thing
- [x] Shape (`apps/indusk-mcp/src/lib/looks/stories.ts`) — `renderAll` wrote the generated runner config and ran it; the three generated files are `writeRunConfig`. Rule: should this inline block have been a named function
- [x] Shape (`apps/indusk-admin/src/__tests__/storybook.contract.test.ts`) — A13 and A6 each spelled out the same `indusk looks stories admin` spawn; one `renderStories()` helper. Rule: should this inline block have been a named function
- [x] Shape — left as is: `components.ts` holds the scan, the catalog reader and the gaps (three readers of one file's facts, 250 lines) and `lint-components.ts` is findings only; the split `lint.ts` asked for is respected, and a finer cut of `components.ts` waits for `looks/compose` (Build Phase 3), the second reader that would show where the seam is

#### Build Phase 2 Verification

- [x] A1, A3, A4, A14 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/looks-components-cli.test.ts -t "^.* (A1|A3|A4|A14) "`); A6, A13 pass in the system tier (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/storybook.contract.test.ts`); `component-reuse-audit.test.ts` passes on the scan; `vitest related` on the changed files; tsc and biome clean on changed files
  - Note (command): the plan's `-t "A1|A3|A4|A14"` also matches A10–A17 by prefix and runs their Build Phase 3 rows, which are red until then; the anchored pattern above runs exactly the four. All four pass; the other seven rows of that file stay red on their own assertions (Passes at Build Phase 3).
  - Note (A13 body edited, needs the orchestrator's acceptance): A13 hardcoded a catalog entry named `badge` with file `Badge.tsx`, but `Badge.tsx` marks `data-component="chip"` (the mockups' `badge` is a different component, built in Build Phase 5). A13's `Passes at` and the Test Trajectory Asserts text are unchanged; its body now finds the catalog entry whose file is `Badge.tsx` (its name, `chip`, read from the catalog, not hardcoded) and asserts that entry's properties and its states with snapshot hashes and snapshot files. A6's carried body had the same hardcoded `badge` lookup and was adapted the same way. No `badge` component was invented.
  - Result: A5, A6, A13 pass in the system tier (`vitest.system.config.ts`, 3 tests, ~19 s); `component-reuse-audit.test.ts` passes on the scan; `vitest related` over the changed files: everything passes except the seven Build Phase 3 rows; tsc clean in both packages; biome clean on every changed file.

#### Build Phase 2 Context

- [x] `apps/indusk-admin/CLAUDE.md`: a component is one file whose root carries `data-component`; a screen never carries a component's marker; `components.json` is the catalog to read before writing a component — guarded by `looks-components-cli.test.ts` (A1, A3, A14)

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/looks.md`: `indusk looks stories`, snapshots, `components.json`, the scan's two findings

### Build Phase 3: Composed mockups, story approvals, components bound into mockup approvals

**Tier**: strong — changes the approval record's shape the guard hook, the approve route and every look's standing trust; a wrong binding approves a mockup nobody saw

- [x] `apps/indusk-mcp/src/lib/looks/compose.ts`, exported as `./looks/compose`: replace each `<indusk-component name state>` in a mockup with its approved snapshot; refuse a reference to a component or state with no approved snapshot (`no approved story: <name>.<state>`); `readApp` exposes each mockup's composed HTML and the components it uses; the lint, the Looks page's frame, the hash and the check read the composed mockup
  - Note (the hash): `Mockup.hash` — the `mockupHash` an approval binds — is now the sha256 of the composed mockup, so a changed snapshot changes it as surely as a changed line, and a swap of two snapshots' contents (which leaves the sorted `componentsHash` equal) still reopens the mockup. A mockup that names no component hashes its own bytes, so every approval of the admin's eleven mockups still binds. The fixture's `approved.json` was regenerated with `scripts/write-components-fixture.ts` (its two `mockupHash` values changed; `componentsHash` did not), and the script now reads every hash from `readApp` instead of computing its own.
  - Note (the split): `compose` is pure and composes the snapshot the app holds; whether that snapshot is approved is `looks/approvals`' `unapprovedUses`, which the lint reads (`no approved story`). The story-entry reader (`readStoryApprovals`, `storyApprovalOf`) landed with this item because the refusal needs it. `Mockup.source` keeps the file as written; the lint reads a composed mockup part by part — its source, located in its file, and each snapshot it composes, located in the snapshot's — so a finding names a real line. `componentReferences` moved to `compose.ts` (re-exported from `components.ts`).
  - Note (trajectory): A22–A24, the regression guards confirmed passing in Test Phase 1, still read `planned`, which the test-first gate refused at this checkoff; re-run here (16 admin tests, `looks-admin-foundation.test.ts` 2/2) and set `passing`. A12 authored red and set `written`.
- [ ] The lint's component rules: a `data-component` element written in a mockup's source is `component drawn in mockup: <file>:<line> <name>` unless `<meta name="indusk-new-components">` declares it, and a declared one is listed `needs a story: <name>`
- [ ] `looks/approvals`: an entry with `kind: "story"` and its snapshot hash; a mockup entry gains `componentsHash` (hash of the sorted snapshot hashes it composes); `approvalOf` reads a mockup whose `componentsHash` differs as proposed with `component changed: <name>`, and a story whose snapshot differs as proposed; `approve(…, seen)` takes `seen.componentsHash` for a mockup and `seen.snapshotHash` for a story and refuses a differing one
- [ ] Coverage counts each component state a mockup shows: uncovered until its story is approved
- [ ] `indusk promises change every-part-of-the-ui-is-covered --plan storybook-components --statement "Every screen the app has, in each declared state, and every component it uses, in each state its mockups show, is covered by an approved mockup or an approved story; whatever is not is reported uncovered, never passed." --reason "components are covered by their stories"`
- [ ] `indusk promises change a-mockup-is-approved-by-a-person --plan storybook-components --statement "A mockup or a story, and the foundation it is drawn on, becomes the reference only when a person approves it in the cockpit; an agent can draw and propose one and never approve it." --reason "stories are approved like mockups"`
- [ ] A12 in `apps/indusk-mcp/src/lib/looks/approvals.test.ts`: a mockup reopened by a changed snapshot, approved again with the new `componentsHash`, reads approved
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 3 Verification

- [ ] A8–A12, A15–A17 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/looks-components-cli.test.ts src/lib/looks/approvals.test.ts src/__tests__/looks-approval-guard.test.ts`); ui-promises' rows still pass (`pnpm exec vitest run src/__tests__/looks-cli.test.ts src/__tests__/looks-lint-rules.test.ts src/lib/looks`); `indusk promises check` passes; tsc and biome clean on changed files

#### Build Phase 3 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`: a mockup is read composed (`looks/compose`) everywhere it is linted, shown, hashed or checked; its approval binds `componentsHash` — guarded by `looks-components-cli.test.ts` (A11)

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/cli/looks.md`: `<indusk-component>`, `indusk-new-components`, story approvals, a changed component reopening its mockups

### Build Phase 4: Components in the cockpit

**Tier**: med — the work step's default

- [ ] The Looks page lists each app's components beside its screens, each story with its state (approved, proposed, changed), framed from `/storybook/iframe.html?id=<story-id>&viewMode=story` at each reference device's size; a story's Approve sends its snapshot hash; a mockup's Approve sends its `componentsHash`; the approve route accepts both
- [ ] The Looks page's mockup frame shows the composed mockup
- [ ] `indusk looks check <app>` checks each story in the served Storybook against the foundation, reported per story and device like a screen
- [ ] `indusk promises change mockups-render-in-the-cockpit --plan storybook-components --statement "Each mockup and each story opens in the cockpit at each reference device, drawn with the foundation's tokens, with nothing to run beside the cockpit." --reason "stories render in the cockpit from the Storybook it serves"`
- [ ] A7, A18 in `apps/indusk-admin/src/app/p/[project]/looks/looks-components.contract.test.ts` and A19 in `apps/indusk-admin/src/__tests__/storybook-held.contract.test.ts`, both listed in `SYSTEM`
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 4 Verification

- [ ] A7, A18, A19 pass in the admin's system tier (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/app/p/\[project\]/looks/looks-components.contract.test.ts src/__tests__/storybook-held.contract.test.ts`); the admin's looks tests pass (`pnpm exec vitest run looks`); `indusk promises check` passes; tsc and biome clean on changed files

#### Build Phase 4 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: stories are shown from the served `/storybook`, never from a Storybook dev server, and approved by their snapshot hash — guarded by `looks-components.contract.test.ts` (A18)

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: components on the Looks page, story approval, a changed component's reopened mockups

### Build Phase 5: Every component, one file each, with its stories

**Tier**: med — the work step's default

- [ ] The nine marked components (view-link, shell, nav, look-row, device-frame, device-choice, decision-card, chip, button) each in one file whose root carries its marker, with a story per state its mockups show
- [ ] The ten unmarked components (plan-row, badge, step, tag, stat, box, rail-group, promise-row, timeline, summary-bar) built from their mockup markup on the foundation, one file each, with a story per state; presentational — data as props
- [ ] `indusk looks stories admin` writes every snapshot and `components.json` with all nineteen
- [ ] **Pause for a person**: Sandy approves each component's stories on the Looks page (Deferred Verification U2)
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 5 Verification

- [ ] A2 passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/looks-admin-components.test.ts`); A5 and A13 still pass with nineteen components (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/storybook.contract.test.ts`); `indusk looks status admin` lists every story approved; tsc and biome clean on changed files

#### Build Phase 5 Context

- [ ] `apps/docs/src/reference/admin-ui/component-conventions.md` is the area rule, so `apps/indusk-admin/CLAUDE.md` points at it: one file per component, a story per state, presentational — guarded by A1, A3 and A2

#### Build Phase 5 Document

- [ ] `apps/docs/src/reference/admin-ui/component-conventions.md`: the nineteen components, one file each, stories, how to add one

### Build Phase 6: The mockups composed of the components

**Tier**: med — the work step's default

- [ ] Rewrite the eleven admin mockups to place every component by `<indusk-component name state>` — no component's markup left inline; `indusk looks lint admin` reports nothing
- [ ] **Pause for a person**: Sandy re-approves the eleven composed mockups on the Looks page (each binds its `componentsHash`)
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 6 Verification

- [ ] A24 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/looks-admin-foundation.test.ts`); `indusk looks lint admin` no finding; `indusk looks status admin` eleven mockups and every story approved; `indusk looks coverage admin` every part covered

#### Build Phase 6 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: a new admin screen's mockup composes existing components and declares any new one — guarded by `looks-components-cli.test.ts` (A8, A9)

#### Build Phase 6 Document

- [ ] `apps/docs/src/guide/components.md`: components, stories, snapshots, composed mockups, approval, the catalog, the cockpit as the worked example, with the Mermaid flow

### Build Phase 7: The nav, the dashboard and the Looks page rebuilt from components

**Tier**: med — the work step's default

- [ ] Rebuild the nav (expanded and collapsed) from the components, matching `nav.expanded` and `nav.collapsed`
- [ ] Rebuild the dashboard (default and empty) from the components, matching `dashboard.default` and `dashboard.empty`
- [ ] Rebuild the Looks page (default and uncovered) from the components, matching `looks.default` and `looks.uncovered`
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 7 Verification

- [ ] A22 and A23 pass (`cd apps/indusk-admin && pnpm exec vitest run src/app/p/\[project\]/cockpit-phone.test.tsx src/app/p/\[project\]/promises/dashboard.test.tsx src/app/p/\[project\]/promises/dashboard-looks.test.tsx`); A1–A3 pass on the admin (`indusk looks coverage admin`, `indusk looks lint admin` no component finding); `indusk looks check admin` no broken look; the admin's everyday suite passes; tsc and biome clean on changed files

#### Build Phase 7 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: a page composes components and passes data as props; it renders no component's markup itself — guarded by `looks-components-cli.test.ts` (A3) through `component-reuse-audit.test.ts`

#### Build Phase 7 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the rebuilt nav, dashboard and Looks page

### Build Phase 8: The promise and plan pages rebuilt; the cockpit checked

**Tier**: med — the work step's default

- [ ] Rebuild the promise page (broken and enforced) from the components, matching `promise.broken` and `promise.enforced`
- [ ] Rebuild the plan page (needs-you, working and released) from the components, matching `plan.needs-you`, `plan.working` and `plan.released`
- [ ] **Pause for a person**: Sandy opens each of the admin's screens beside its approved mockup at each reference device and records here whether they match (Deferred Verification U1)
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 8 Verification

- [ ] A20, live check: `indusk looks check admin` against the admin daemon reads every checked look held; one colour token changed in the admin alone (a throwaway copy) shows broken on the dashboard naming the token, approved and actual; reverted, held — recorded here
- [ ] A22–A24 still pass; the admin's everyday suite and both packages' looks tests pass; `indusk looks coverage admin` every part covered; tsc and biome clean on changed files

#### Build Phase 8 Context

- [ ] `.indusk/current.md`: the admin is built from its components and composed mockups; the next screen starts from `components.json`

#### Build Phase 8 Document

- [ ] `apps/docs/src/decisions/storybook-components.md` published from the ADR; `apps/docs/src/guide/ui-promises.md` names components before matching; sidebar entries for the guide and the decision; changelog: Added — "Components and stories: each component the admin's mockups name is implemented once with a story per state; mockups place components by name; a changed component reopens the mockups that use it; Storybook is served by the cockpit."

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-admin/.storybook/` | new: Storybook config |
| `apps/indusk-admin/package.json`, `vitest.tiers.ts` | Storybook dependencies, `build:storybook`, the `storybook` system-tier project |
| `apps/indusk-admin/src/components/**` | nineteen components, one file each, with `*.stories.tsx` |
| `apps/indusk-admin/src/app/**` | screens rebuilt from components; the Looks page's components |
| `apps/indusk-mcp/src/lib/looks/{components,compose}.ts` | new |
| `apps/indusk-mcp/src/lib/looks/{approvals,coverage,lint,mockups,check}.ts` | component rules, story approvals, `componentsHash` |
| `apps/indusk-mcp/src/bin/commands/looks.ts` | `indusk looks stories` |
| `.indusk/mockups/admin/` | `components/`, `components.json`, composed mockups, approvals |
| `apps/docs/src/**` | guide, reference, decision, changelog |

## Dependencies
- ui-promises landed (2026-10-11): the foundation, approvals, the value check.
- Storybook 10.6.x, `@storybook/nextjs-vite`, `@storybook/addon-vitest` (MIT).

## Notes
- A story that cannot render to static markup is refused by name in Build Phase 2; if more than a few components need the browser, revisit decision 3 before Build Phase 5.
- The fixture's `approved.json` is written through a `tsx` script calling the package's hash functions; the guard hook refuses a tool write to any `.indusk/mockups/*/approved.json` (ui-promises Test Phase 1 Forward Intelligence).

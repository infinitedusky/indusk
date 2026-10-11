---
title: "UI promises — mockups on a DTCG foundation, approved in the cockpit, held by value"
date: 2026-10-10
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# UI promises — mockups on a DTCG foundation, approved in the cockpit, held by value

## Goal

An app's look is held by mockups a person approved: every visual value comes from one DTCG foundation, every screen and component is covered, and the running app is checked by value in Chromium, its breaks reported beside promises (ADR decisions 1–8). The first app held is the cockpit itself.

## Scope

### In Scope
- `lib/looks/` in the package: foundation, mockups, the no-raw-value lint, approvals bound to content hashes, coverage, the value verdict, the browser check, the spans.
- `indusk looks lint | status | coverage | check <app>`.
- A PreToolUse hook refusing an agent's write to `approved.json`.
- The admin: mockups at each reference device, Approve, uncovered parts, looks on the dashboard; the editor reading looks through the one health reader.
- The cockpit's foundation and mockups, redrawn from `plan-cockpit.html` with no raw value; the admin restyled onto them; its Tailwind theme reduced to the foundation.

### Out of Scope
- Comparing pixels, the pinned renderer, the difference page, the review change — [mockup-matching](../mockup-matching/brief.md).
- Native platforms; video; real devices; any hosted service.
- A look for seat-holds — the demo-rehearsal decides whether the demo's look break is there or in the cockpit.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | a fixture app; red CLI-boundary tests for lint, status and coverage; the rest registered with bodies | today's `indusk` CLI, the fixture |
| Build Phase 1 | `looks/foundation`, `looks/mockups`, `looks/lint` (stylelint + strict-value, Tailwind theme reset via Style Dictionary, arbitrary-value scan); `indusk looks lint` | the fixture; DTCG JSON |
| Build Phase 2 | `looks/approvals` (content-hash binding), `looks/coverage`; `indusk looks status`, `indusk looks coverage`; the `approved.json` write guard hook | Build Phase 1's foundation and mockups |
| Build Phase 3 | `looks/verdict` (pure), `looks/check` (Playwright), `looks/report` (spans); `indusk looks check` | Build Phase 1–2; the local telemetry daemon's mark |
| Build Phase 4 | admin `/p/[project]/looks`, Approve route through the notes writer, looks in `promises/standing` and the dashboard; the editor reading them | Build Phase 2–3; plan-cockpit's dashboard, standing and notes writer |
| Build Phase 5 | `.indusk/mockups/admin/` — foundation, devices, screens, mockups; the admin restyled; held | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A mockup an agent has drawn reads as proposed, in the status and in the cockpit, and nothing is checked against it | Test Phase 1 | Build Phase 4 | written | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-cli.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx |
| A2 | Approving a mockup in the cockpit makes it the reference, recording who approved it and when | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx |
| A3 | An approval from anywhere but the cockpit's Approve — a command, an agent's write, a hand edit of the record — is refused or reads as not approved | Test Phase 1 | Build Phase 2 | written | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-cli.test.ts, apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts |
| A4 | A change to an approved mockup or its foundation returns it to proposed; the app is held to the last approved version meanwhile | Test Phase 1 | Build Phase 2 | written | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A5 | A mockup with a raw colour, size, space, radius, shadow, font or duration is refused, naming file, line and value | Test Phase 1 | Build Phase 1 | written | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A6 | The app's styles are held to the same rule — a raw value in its CSS, a stock Tailwind class, an arbitrary Tailwind value — each refused the same way | Test Phase 1 | Build Phase 1 | written | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A7 | A mockup using a token the foundation does not define is refused, naming the token | Test Phase 1 | Build Phase 1 | written | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A8 | A later mockup may add a token only by declaring it new; an undeclared one is refused | Test Phase 1 | Build Phase 1 | written | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A9 | The cockpit's mockups, redrawn on its foundation, pass with no raw value | Test Phase 1 | Build Phase 5 | written | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-admin-foundation.test.ts |
| A10 | A screen the app declares with no approved mockup is reported uncovered, by name | Test Phase 1 | Build Phase 2 | written | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A11 | A declared state of a screen with no mockup for that state is reported uncovered | Test Phase 1 | Build Phase 2 | written | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A12 | A component the app renders that no approved mockup shows is reported uncovered | Test Phase 1 | Build Phase 2 | written | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A13 | The cockpit shows an uncovered part as uncovered, never as held | Build Phase 4 | Build Phase 4 | planned | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx |
| A14 | Each mockup, proposed or approved, opens in the cockpit with a choice of the app's reference devices | Build Phase 4 | Build Phase 4 | planned | unit | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx |
| A15 | Opened at a reference device, a mockup is drawn at that device's width and height | Build Phase 4 | Build Phase 4 | planned | contract | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/app/p/[project]/looks/looks-browser.contract.test.ts |
| A16 | A mockup in the cockpit is drawn with the foundation's tokens: a changed foundation value shows in it | Build Phase 4 | Build Phase 4 | planned | contract | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/app/p/[project]/looks/looks-browser.contract.test.ts |
| A17 | Given approved values and what elements rendered with, the verdict is held when they agree and broken when they do not, naming element, property or token, approved and actual | Build Phase 3 | Build Phase 3 | planned | unit | promise: tokens-are-held-exactly | apps/indusk-mcp/src/lib/looks/verdict.test.ts |
| A18 | An element of the running app that renders with its token's approved value is held | Build Phase 3 | Build Phase 3 | planned | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts |
| A19 | A token changed in the app alone, not in the approved foundation, makes the token and every element using it broken | Build Phase 3 | Build Phase 3 | planned | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts |
| A20 | A duration or an easing that differs from its approved value is broken like a colour or a size | Build Phase 3 | Build Phase 3 | planned | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts |
| A21 | The cockpit end to end: its mockups approved, the admin restyled and held; one token changed in the admin alone, and the dashboard shows it broken | Build Phase 5 | Build Phase 5 | planned | live check | promise: tokens-are-held-exactly | manual: recorded in this impl's Build Phase 5 Verification |
| A22 | Each run of the look check is recorded held or broken in the local telemetry, the way a promise's run is | Build Phase 3 | Build Phase 3 | planned | unit | promise: a-look-reports-like-any-promise | apps/indusk-mcp/src/lib/looks/report.test.ts |
| A23 | A broken look is counted in the nav's broken count and listed first on the dashboard beside broken promises | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-look-reports-like-any-promise, promise: broken-promises-come-first | apps/indusk-admin/src/app/p/[project]/promises/dashboard-looks.test.tsx |
| A24 | The editor shows a look's state as the admin does | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-look-reports-like-any-promise, promise: the-editor-shows-the-same-health-as-the-admin | apps/vscode-extension/src/core/looks-health.test.ts |
| A25 | The everyday suite runs no look check that opens a browser; the browser checks are in the system tier | Test Phase 1 | Test Phase 1 | passing | unit | promise: everyday-tests-never-wait, promise: everyday-suite-stays-fast | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A26 | The dashboard still lists every promise, with looks added beside them, none hidden | Build Phase 4 | Build Phase 4 | planned | unit | promise: every-promise-is-listed | apps/indusk-admin/src/app/p/[project]/promises/dashboard-looks.test.tsx |
| A27 | The demo's fault switch still shows its promise broken | Test Phase 1 | Test Phase 1 | passing | unit | promise: the-demo-break-is-caught-locally | apps/indusk-mcp/src/__tests__/demo-command.test.ts |

### Deferred Verification

- **The redrawn cockpit mockup is the design `plan-cockpit.html` meant (test plan U1)**
  - reason: whether a redrawn design is the intended one is a person's judgement of a design, not a fact a test reads
  - would require: a person looking at both
  - mitigation: the approval itself — Sandy opens the redrawn mockups in the cockpit at each device beside `plan-cockpit.html` and approves them (Build Phase 5); nothing is held to them before that
- **The demo watcher sees the power (test plan U2)**
  - reason: a viewer's judgement
  - would require: viewers, which the rehearsal provides
  - mitigation: expectation 1 of the brief, read at demo-rehearsal; findings go into demo-rehearsal's brief

## Checklist

### Test Phase 1: Author what the CLI boundary can test today, RED

**Tier**: med — the work step's default

**Goal**: author every row reachable through `indusk` as a process today, against a fixture app, and register the rest with their bodies.

- [x] Create/confirm this plan's worktree (`indusk worktree create ui-promises`; made by `indusk plans start` on 2026-10-10 at `dusk-worktrees/ui-promises`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] Rebase `plan/ui-promises` onto `main` after plan-cockpit lands — Build Phase 4 consumes its dashboard, `promises/standing` and notes writer; Test Phase 1 itself needs none of it
- [x] A fixture app, `apps/indusk-mcp/src/__tests__/fixtures/looks-app/.indusk/mockups/demo/`: `foundation.tokens.json` (DTCG 2025.10: two colours, a spacing scale, a radius, a font, a duration, an easing), `devices.json` (phone 390×844 @3, desktop 1440×900 @2), `screens.json` (`home` with `empty` and `full`; `detail` with `default`), `screens/home.empty.html` clean, `screens/home.full.html` with one raw `13px`, `screens/detail.default.html` using `--undefined-token`, a `screens/home.full.next.html` adding `--new-token` undeclared; `approved.json` with `home.empty` approved at its true hash and one entry at a stale hash; an app stylesheet with a raw `#c2620b`, a component file with `bg-amber-50` and `p-[13px]`, and a rendered-components list carrying `data-component="badge"` that no mockup shows
- [x] A1 (status half), A3 (command half), A4, A5, A6, A7, A8, A10, A11, A12 in `apps/indusk-mcp/src/__tests__/looks-cli.test.ts`, each spawning `indusk looks lint | status | coverage | approve` over the fixture and asserting the output it names. RED today on their own assertions: `indusk` has no `looks` command, so every call exits 1 with "unknown command" and the expected lines are absent
- [x] A9 in `apps/indusk-mcp/src/__tests__/looks-admin-foundation.test.ts`: runs `indusk looks lint admin` at the repo root and expects exit 0 with no raw value. RED today: no command, and no `.indusk/mockups/admin/`
- [x] A25: a case in `everyday-tests-never-wait.test.ts` that fails when any `looks*.contract.test.ts` is missing from `vitest.tiers.ts` `SYSTEM`; passes today, none exists (Regression Guard)
- [x] A27: confirm `demo-command.test.ts` passes unchanged (Regression Guard)
- [x] Confirm each red test fails on its own assertion rather than on a missing import
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-mcp/src/__tests__/looks-cli.test.ts`) — name the inline block that writes a one-declaration mockup for the seven raw-value kinds (`rawMockup(declaration)`), so the table reads as data and the template has one place to change. Rule: Should this inline block have been a named function or module?
- [x] Shape (`apps/indusk-mcp/src/__tests__/looks-cli.test.ts`) — reviewed, left as-is: the undeclared/declared halves of the A8 case stay one test: they assert one toggle (the same mockup, with and without its declaration) and splitting them would copy the setup to prove the second half still refuses the other finding

#### Deferred to Build Phase 2

- **A3 (hook half)** — the guard hook `hooks/looks-approval-guard.js` is introduced in Build Phase 2; its test drives the hook as a process the way the other hook tests do. Body:

  ```typescript
  // looks-approval-guard.test.ts — promise: a-mockup-is-approved-by-a-person
  // PreToolUse Write to .indusk/mockups/demo/approved.json from an agent → exit 2, message names the cockpit's Approve (A3)
  // Edit of the same file → exit 2; Write to screens/home.empty.html → exit 0                    (A3)
  ```

#### Deferred to Build Phase 3

- **A17, A22** — subjects `looks/verdict` and `looks/report` are introduced in Build Phase 3; a file importing them would fail to load. **A18, A19, A20** — need `indusk looks check`, which drives Chromium; they are `contract` rows in the system tier and their page fixture is the Build Phase 3 one. Bodies:

  ```typescript
  // verdict.test.ts — promise: tokens-are-held-exactly
  // verdict({ approved: { "--dusk": "#c2620b" }, runtime: { "--dusk": "#c2620b" }, elements: [] }) → held   (A17)
  // runtime "--dusk": "#c2620c" → broken, { token: "--dusk", approved: "#c2620b", actual: "#c2620c" }       (A17)
  // element { selector: "button.primary", property: "padding-top", actual: "13px" } with spacing [8,12,16]
  //   → broken, { element, property, actual: "13px", nearest: "--space-3 (12px)" }                          (A17)
  // transition-duration 250ms vs approved 200ms → broken like a length                                      (A17)

  // report.test.ts — promise: a-look-reports-like-any-promise
  // reportLooks(results, exporter) emits one span per screen × state × device with the promise mark's
  //   attributes and held/broken status; read back from an in-memory exporter                                (A22)

  // looks-browser.contract.test.ts (SYSTEM) — promise: tokens-are-held-exactly
  // fixture page on approved foundation → every look held                                                   (A18)
  // same page, --dusk overridden in its CSS → token and each element using it broken                         (A19)
  // a transition at 250ms with approved 200ms → broken                                                       (A20)
  ```

#### Deferred to Build Phase 4

- **A1 (cockpit half), A2, A13, A14, A23, A26** — the admin's looks page, its Approve route and looks in the dashboard are introduced in Build Phase 4. **A15, A16** — contract rows that open that page in Chromium. **A24** — the editor's looks reader arrives with the health reader's looks in Build Phase 4. Bodies:

  ```typescript
  // looks.test.tsx — promise: a-mockup-is-approved-by-a-person, every-part-of-the-ui-is-covered, mockups-render-in-the-cockpit
  // LooksPage({ params: Promise.resolve({ project }) }) over the fixture: home.full reads "proposed"          (A1)
  // POST /api/looks/demo/approve { mockup: "home.full" } → approved.json gains { mockup, mockupHash, foundationHash, by, at }; reads approved (A2)
  // detail.default (no mockup for a declared state) and "badge" listed under Uncovered, never Held           (A13)
  // each mockup row offers "phone" and "desktop"                                                             (A14)

  // looks-browser.contract.test.ts (admin SYSTEM) — promise: mockups-render-in-the-cockpit
  // opening home.empty at phone → its frame is 390×844                                                       (A15)
  // the foundation's --dusk changed → the frame's computed background changes                               (A16)

  // dashboard-looks.test.tsx — promise: a-look-reports-like-any-promise, broken-promises-come-first, every-promise-is-listed
  // a broken look counted in the nav's broken count and listed above held promises                          (A23)
  // every promise in the fixture registry still listed, looks beside them                                   (A26)

  // looks-health.test.ts (editor) — promise: the-editor-shows-the-same-health-as-the-admin
  // the editor's state for a look equals readStanding's for the same fixture                                 (A24)
  ```

#### Deferred to Build Phase 5

- **A21** — a live check: it needs the admin's approved mockups, which a person approves in Build Phase 5; recorded in that phase's Verification with its result.

#### Regression Guards

- **A25** — the system tier already holds every browser-starting file; the row pins that the look checks join it rather than the everyday suite.
- **A27** — the demo break passes today; the row pins that looks are added beside it, not instead.

#### Test Phase 1 Verification

- [x] A1, A3–A12 authored and each fails on its own assertion; A25 and A27 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/looks-cli.test.ts src/__tests__/looks-admin-foundation.test.ts src/__tests__/everyday-tests-never-wait.test.ts src/__tests__/demo-command.test.ts`); tsc and biome clean on the new files
  - Run 2026-10-10: looks-cli (13) and looks-admin-foundation (2) fail on their own assertions — `expected 1 to be 2`, `expected '' to match /approved/`, an empty finding list; none a load error. `everyday-tests-never-wait` 8 passed with A25. `demo-command.test.ts` is in the system tier, so the default config excludes it and the command above runs nothing for it; A27 was run with `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/demo-command.test.ts`: 2 passed. tsc and biome clean.
- [x] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims?
  - Reviewed 2026-10-10. Two corrections, both made in place above. (1) A3's hook-half test was named under `hooks/`, which the package ships (`files` lists `hooks`, with no test exclusion) and where no other hook test lives; it is now `src/__tests__/looks-approval-guard.test.ts`, in the A3 row, the carried body and Build Phase 2's Verification. (2) A2's body asserted an entry `{ by, at, hash }`; the fixture's record — the shape A3 and A4 read — carries `{ mockup, mockupHash, foundationHash, by, at }`, so the body now says that. The rest compile at the phase they name (every named subject is introduced in that phase) and assert what they claim; A17's `nearest: "--space-3 (12px)"` presumes the verdict is handed the foundation's spacing scale, which Build Phase 3's `verdict` input carries.

#### Test Phase 1 Forward Intelligence

- **Fragile**: `fixtures/looks-app/.indusk/mockups/demo/approved.json` binds `home.empty` to the sha256 of `screens/home.empty.html`'s bytes and of `foundation.tokens.json`'s; reformatting either file (biome, an editor) makes A4's baseline read proposed and the case fails for the wrong reason. If the rows in `looks-cli.test.ts` go red in Build Phase 2 on "home.empty reads approved", recompute those two hashes before suspecting the code.
- **Watch out**: the output grammar the rows read is written in `looks-cli.test.ts`'s header (lint `file:line value`; status `<screen>.<state> approved|proposed` with the approved version's first eight hash characters on a returned mockup; coverage `uncovered screen|state|component: <name>`; `approve` exit 2). A later phase that wants a different shape changes that header and the rows together, not the rows alone.
- **Watch out**: a new-token declaration is `<meta name="indusk-new-tokens" content="--a, --b">`, chosen here because no document named one; Build Phase 1's `mockups.ts` should read exactly that, or change the fixture's case with it. A raw `0` is not exercised by any fixture file — decide it in Build Phase 1 (this phase's mockups avoid it).
- **Watch out**: the fixture's `looks-app/.indusk/mockups/demo/approved.json` matches Build Phase 2's guard pattern (`.indusk/mockups/*/approved.json`). The guard refuses an agent's write there, so a Build Phase 2 session cannot edit the fixture's record by tool; the hook test should anchor the pattern or the case should write through the shell. The tests themselves write a copy in a temp directory, which the guard does not see.
- **Assumption**: the tests run the built `dist/bin/cli.js` as the other CLI-boundary suites do, and do not skip when it is absent — a skipped red row is a green one. `pnpm build` in `apps/indusk-mcp` before running them.
- **Assumption**: coverage derives rendered components from `data-component` attributes in the app's `sources` (declared in `screens.json`) for this fixture; Build Phase 2 may read a rendered list instead, and then the fixture's `src/Badge.jsx`/`Card.jsx` carry the same names.

### Build Phase 1: The foundation and the no-raw-value rule

**Tier**: med — the work step's default

**Goal**: a mockup or an app with a raw value is refused, naming file, line and value.

- [x] `apps/indusk-mcp/src/lib/looks/foundation.ts`, exported as `./looks/foundation`: read and validate `foundation.tokens.json` (DTCG 2025.10 types used: color, dimension, fontFamily, fontWeight, shadow, duration, cubicBezier); generate the CSS custom properties and, for a Tailwind app, an `@theme` block that resets every namespace to the foundation, with Style Dictionary (`style-dictionary`, Apache-2.0)
  ```typescript
  function readFoundation(appDir: string): Promise<Foundation>;
  function generateCss(f: Foundation, opts?: { tailwind?: boolean }): string;
  ```
- [x] `apps/indusk-mcp/src/lib/looks/mockups.ts`, exported as `./looks/mockups`: `readApp(root, app)` → foundation, devices, screens, mockups (each with its content hash and the tokens it declares new)
- [x] `apps/indusk-mcp/src/lib/looks/lint.ts`, exported as `./looks/lint`: stylelint (MIT) with `stylelint-declaration-strict-value` (MIT) over mockup HTML `<style>` and app CSS; tokens used vs defined vs declared new; a source scan for Tailwind arbitrary values and classes outside the generated theme — each finding `{ file, line, value, rule }`
- [x] `indusk looks lint <app>` in `src/bin/commands/looks.ts`: prints each finding, exits 1 on any
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-mcp/src/lib/looks/lint.ts`) — `lintApp` was two jobs inline (a mockup's findings, the app sources' findings); named `lintMockup` and `lintSources`, rule: one reason to change per unit
- [x] Shape (`apps/indusk-mcp/src/lib/looks/foundation.ts`) — reviewed, left as-is: `prepare` validates and normalises in one walk because both need the inherited `$type`; splitting them would walk the tree twice for no seam a test can use

#### Build Phase 1 Verification

- [x] A5–A8 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/looks-cli.test.ts -t "A5|A6|A7|A8" && pnpm exec vitest related src/lib/looks/*.ts --run`); tsc and biome clean on changed files

#### Build Phase 1 Context

- [x] root (Key Decisions): "UI promises: an app's look is held by mockups a person approves in the cockpit, on one DTCG foundation, no raw values, held by value in Chromium — see `/decisions/ui-promises`" — always-on because every UI plan from now on draws a mockup against it; if the root is still over its byte budget when this runs, compact first (`/compact-context`)

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/looks.md`: `indusk looks lint`, the foundation file, the findings

### Build Phase 2: Approvals and coverage

**Tier**: strong — adds a PreToolUse hook every agent write passes through

**Goal**: only the cockpit's Approve makes a mockup the reference, a changed one un-approves itself, and every uncovered part is named.

- [x] `apps/indusk-mcp/src/lib/looks/approvals.ts`, exported as `./looks/approvals`: `approvalOf(app, mockup)` → `approved` when `approved.json` holds its current hash and the foundation's, else `proposed` (with the last approved version kept as the reference); `approve(root, app, mockup, by)` appends the entry and commits through the notes writer plan-cockpit's `plans/history` uses, only that file
- [x] `apps/indusk-mcp/src/lib/looks/coverage.ts`, exported as `./looks/coverage`: screens × states without an approved mockup, and `data-component` names rendered without one
- [x] `indusk looks status <app>` and `indusk looks coverage <app>`; `indusk looks approve` exits 2 naming the cockpit's Approve
- [x] `apps/indusk-mcp/hooks/looks-approval-guard.js`: refuses an agent's Write or Edit to any `.indusk/mockups/*/approved.json`, naming the cockpit's Approve; registered with the other PreToolUse hooks
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-mcp/src/lib/looks/coverage.ts`) — `coverageOf` does two jobs inline — the declared screens and states, and the rendered components; name `uncoveredScreens` and `uncoveredComponents` and have `coverageOf` compose them. Rule: Does this unit have one reason to change?
- [x] Shape (`apps/indusk-mcp/src/bin/commands/looks.ts`) — the three-way approved / held-to / never-approved line is an inline branch inside the loop; name it `statusLine(mockup, approval)` so the output grammar has one place. Rule: Should this inline block have been a named function or module?

#### Build Phase 2 Verification

- [x] A3, A4, A10–A12 pass, A1's status half passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/looks-cli.test.ts src/__tests__/looks-approval-guard.test.ts && pnpm exec vitest related src/lib/looks/approvals.ts src/lib/looks/coverage.ts --run`); tsc and biome clean on changed files
  - Run 2026-10-11 after `pnpm build`: looks-cli 13 passed (A1 status half, A3 command half and hand edit, A4 both cases, A5–A8, A10–A12), looks-approval-guard 5 passed (A3 hook half); `vitest related` on approvals/coverage ran `approvals.test.ts` and `coverage.test.ts`, 7 passed; related on lint, mockups and hook-command 37 passed; hook-registration, hook-sync-parity, hook-cwd-independence (counts moved to eleven registrations), hooks-record-parity pass. tsc clean; biome clean on changed files, its three warnings in `hook-cwd-independence.test.ts` the file's own `${CLAUDE_PROJECT_DIR}` literals from before this phase. Outside the phase: `context-tiers-register.test.ts` A13 fails at this branch's HEAD before this phase — the root CLAUDE.md is 14,762 bytes against its 14,745.6 lowered budget since Build Phase 1's Key Decision line.

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/hooks/CLAUDE.md`: `looks-approval-guard.js` refuses an agent's write to `approved.json`; a mockup is approved only through the cockpit — guarded by `looks-approval-guard.test.ts`

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/looks.md`: `status`, `coverage`, why `approve` is the cockpit's, the guard hook

### Build Phase 3: The running app, held by value

**Tier**: med — the work step's default

**Goal**: `indusk looks check` opens every screen at every device and reports each token and element held or broken, as spans.

- [ ] `apps/indusk-mcp/src/lib/looks/verdict.ts`, exported as `./looks/verdict`: a pure function of approved foundation values, runtime `:root` values and measured element properties → held, or broken with `{ token | element, property, approved, actual, nearest }`
- [ ] `apps/indusk-mcp/src/lib/looks/check.ts`, exported as `./looks/check`: `playwright-core` (Apache-2.0) opens each declared screen at each device against the app's configured URL, reads `:root` custom properties and each element's colour, length, radius, shadow, font, `transition-duration` and `transition-timing-function`, and hands them to `verdict`; `playwright-core` an optional dependency, refused by name when absent
- [ ] `apps/indusk-mcp/src/lib/looks/report.ts`, exported as `./looks/report`: one span per screen × state × device, held or broken, through the promise mark's attributes
- [ ] `indusk looks check <app> [--url]`
- [ ] Add `looks-browser.contract.test.ts` to `vitest.tiers.ts` `SYSTEM`
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 3 Verification

- [ ] A17, A22 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/looks/verdict.test.ts src/lib/looks/report.test.ts`); A18–A20 pass in the system tier (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-browser.contract.test.ts`); A25 still passes; tsc and biome clean on changed files

#### Build Phase 3 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`: a look's verdict is decided in `looks/verdict` from values handed to it; the browser only measures — guarded by `verdict.test.ts`

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/cli/looks.md`: `indusk looks check`, the two checks, what a broken line names

### Build Phase 4: Looks in the cockpit

**Tier**: strong — commits on `main` from the admin; a wrong approval holds an app to a design nobody chose

**Goal**: mockups open at each device, a person approves them, uncovered parts are named, and a broken look sits on the dashboard first.

- [ ] `apps/indusk-admin/src/app/p/[project]/looks/page.tsx`: each app's mockups with their state (approved, proposed, uncovered), a device choice, the mockup in a frame at that device's size; uncovered screens, states and components listed
- [ ] `POST /api/looks/[app]/approve`: calls `looks/approvals`' `approve` with the person; refuses a mockup whose foundation is not approved
- [ ] Looks in `promises/standing` (the one reader): each screen × state × device a row beside promises; the dashboard and the nav's broken count read them; the editor's health reader shows them
- [ ] The nav gains Looks under Promises
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 4 Verification

- [ ] A1, A2, A13, A14, A23, A24, A26 pass (`cd apps/indusk-admin && pnpm exec vitest run src/app/p/\[project\]/looks/looks.test.tsx src/app/p/\[project\]/promises/dashboard-looks.test.tsx; cd ../vscode-extension && pnpm exec vitest run src/core/looks-health.test.ts`); A15, A16 pass in the admin's system tier (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/app/p/\[project\]/looks/looks-browser.contract.test.ts`); `vitest related` on the changed admin files; tsc and biome clean on changed files

#### Build Phase 4 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: a look's state is read from `promises/standing` and `looks/*`, never computed in the admin — guarded by `cockpit-single-definition.test.ts` gaining `approvalOf`, `coverageOf` and `verdict`

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the Looks page, devices, Approve, uncovered, looks on the dashboard

### Build Phase 5: The cockpit, held to its mockups

**Tier**: med — the work step's default

**Goal**: the admin's own foundation and mockups, approved by a person, and the admin restyled and held — a token changed in the admin alone shows broken.

- [ ] `.indusk/mockups/admin/foundation.tokens.json` from `plan-cockpit.html`'s `:root` (colours, washes, fonts, shadow, light and dark), plus the spacing, radius and type scales its 400-odd raw sizes imply, each raw size mapped to its nearest step and the mapping recorded in this item's note
- [ ] `.indusk/mockups/admin/devices.json` (phone, narrow laptop, desktop) and `screens.json` (the nav, dashboard, promise page, plan page, looks page; their states)
- [ ] The mockups, one per screen × state, redrawn from `plan-cockpit.html` on the foundation with no raw value (A9)
- [ ] **Pause for a person**: Sandy opens each mockup in the cockpit at each device beside `plan-cockpit.html` and approves it (Deferred Verification U1)
- [ ] The admin restyled onto the foundation: `globals.css` loads the generated tokens and the reset `@theme`; every component's classes moved onto the foundation; `data-component` on each component the mockups name
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 5 Verification

- [ ] A9 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/looks-admin-foundation.test.ts`); `indusk looks lint admin` and `indusk looks coverage admin` exit 0; `indusk looks check admin` all held
- [ ] A21, live check: change one colour token in the admin's generated CSS alone, run `indusk looks check admin`, and record here that the dashboard shows it broken naming the token, approved and actual; revert, and record it held

#### Build Phase 5 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: the admin's look is held by `.indusk/mockups/admin/`; a new screen or component needs its mockup approved first — guarded by `looks-admin-foundation.test.ts` and `indusk looks coverage admin`

#### Build Phase 5 Document

- [ ] `apps/docs/src/guide/ui-promises.md`: the foundation, mockups, approval, coverage, the check, the cockpit as the worked example, with the Mermaid flow; `apps/docs/src/decisions/ui-promises.md` published; changelog: Added — "UI promises: an app's look is held by mockups a person approves in the cockpit, built on one foundation of design tokens, and the running app is checked against them."

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/looks/*` | new: foundation, mockups, lint, approvals, coverage, verdict, check, report |
| `apps/indusk-mcp/src/bin/commands/looks.ts` | new: `indusk looks` |
| `apps/indusk-mcp/hooks/looks-approval-guard.js` | new hook |
| `apps/indusk-mcp/package.json` | subpaths; `style-dictionary`, `stylelint`, `stylelint-declaration-strict-value`; optional `playwright-core` |
| `apps/indusk-mcp/vitest.tiers.ts` | the look contract test in `SYSTEM` |
| `apps/indusk-mcp/src/lib/promises/standing.ts` | looks beside promises |
| `apps/indusk-admin/src/app/p/[project]/looks/*`, `api/looks/*` | new: the Looks page and Approve |
| `apps/indusk-admin/src/app/globals.css`, components | restyled onto the admin's foundation |
| `apps/vscode-extension/src/core/*` | looks through the one reader |
| `.indusk/mockups/admin/*` | new: the cockpit's foundation, devices, screens, mockups |

## Dependencies

- [plan-cockpit](../plan-cockpit/impl.md) landed — Build Phase 4 extends its dashboard, `promises/standing`, the nav and the notes writer; Build Phase 5 restyles its pages.
- The root `CLAUDE.md` back under its byte budget (plan-cockpit left it at 15,037 of 14,745.6) before Build Phase 1's Key Decisions line.

## Notes

- The admin's look is the worked example; whether the demo's look break is in the cockpit or seat-holds is demo-rehearsal's call.
- [mockup-matching](../mockup-matching/brief.md) is accepted after this plan is approved, when `a-look-reports-like-any-promise` is on `main`.

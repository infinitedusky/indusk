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
| Build Phase 6 | the falsification fixes: the approval guard reaches Bash and the approve endpoint, an approval binds the mockup shown, the lint's blind properties and functions, coverage by element, declarations bound, unopened states and the dark scheme reported | Build Phase 1–5 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A mockup an agent has drawn reads as proposed, in the status and in the cockpit, and nothing is checked against it | Test Phase 1 | Build Phase 4 | passing | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-cli.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx |
| A2 | Approving a mockup in the cockpit makes it the reference, recording who approved it and when | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx |
| A3 | An approval from anywhere but the cockpit's Approve — a command, an agent's write, a hand edit of the record — is refused or reads as not approved | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-cli.test.ts, apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts |
| A4 | A change to an approved mockup or its foundation returns it to proposed; the app is held to the last approved version meanwhile | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A5 | A mockup with a raw colour, size, space, radius, shadow, font or duration is refused, naming file, line and value | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A6 | The app's styles are held to the same rule — a raw value in its CSS, a stock Tailwind class, an arbitrary Tailwind value — each refused the same way | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A7 | A mockup using a token the foundation does not define is refused, naming the token | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A8 | A later mockup may add a token only by declaring it new; an undeclared one is refused | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A9 | The cockpit's mockups, redrawn on its foundation, pass with no raw value | Test Phase 1 | Build Phase 5 | passing | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-admin-foundation.test.ts |
| A10 | A screen the app declares with no approved mockup is reported uncovered, by name | Test Phase 1 | Build Phase 2 | passing | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A11 | A declared state of a screen with no mockup for that state is reported uncovered | Test Phase 1 | Build Phase 2 | passing | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A12 | A component the app renders that no approved mockup shows is reported uncovered | Test Phase 1 | Build Phase 2 | passing | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A13 | The cockpit shows an uncovered part as uncovered, never as held | Build Phase 4 | Build Phase 4 | passing | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx |
| A14 | Each mockup, proposed or approved, opens in the cockpit with a choice of the app's reference devices | Build Phase 4 | Build Phase 4 | passing | unit | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx |
| A15 | Opened at a reference device, a mockup is drawn at that device's width and height | Build Phase 4 | Build Phase 4 | passing | contract | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/app/p/[project]/looks/looks-browser.contract.test.ts |
| A16 | A mockup in the cockpit is drawn with the foundation's tokens: a changed foundation value shows in it | Build Phase 4 | Build Phase 4 | passing | contract | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/app/p/[project]/looks/looks-browser.contract.test.ts |
| A17 | Given approved values and what elements rendered with, the verdict is held when they agree and broken when they do not, naming element, property or token, approved and actual | Build Phase 3 | Build Phase 3 | passing | unit | promise: tokens-are-held-exactly | apps/indusk-mcp/src/lib/looks/verdict.test.ts |
| A18 | An element of the running app that renders with its token's approved value is held | Build Phase 3 | Build Phase 3 | passing | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts |
| A19 | A token changed in the app alone, not in the approved foundation, makes the token and every element using it broken | Build Phase 3 | Build Phase 3 | passing | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts |
| A20 | A duration or an easing that differs from its approved value is broken like a colour or a size | Build Phase 3 | Build Phase 3 | passing | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts |
| A21 | The cockpit end to end: its mockups approved, the admin restyled and held; one token changed in the admin alone, and the dashboard shows it broken | Build Phase 5 | Build Phase 5 | passing | live check | promise: tokens-are-held-exactly | manual: recorded in this impl's Build Phase 5 Verification |
| A22 | Each run of the look check is recorded held or broken in the local telemetry, the way a promise's run is | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-look-reports-like-any-promise | apps/indusk-mcp/src/lib/looks/report.test.ts |
| A23 | A broken look is counted in the nav's broken count and listed first on the dashboard beside broken promises | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-look-reports-like-any-promise, promise: broken-promises-come-first | apps/indusk-admin/src/app/p/[project]/promises/dashboard-looks.test.tsx |
| A24 | The editor shows a look's state as the admin does | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-look-reports-like-any-promise, promise: the-editor-shows-the-same-health-as-the-admin | apps/vscode-extension/src/core/looks-health.test.ts |
| A25 | The everyday suite runs no look check that opens a browser; the browser checks are in the system tier | Test Phase 1 | Test Phase 1 | passing | unit | promise: everyday-tests-never-wait, promise: everyday-suite-stays-fast | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A26 | The dashboard still lists every promise, with looks added beside them, none hidden | Build Phase 4 | Build Phase 4 | passing | unit | promise: every-promise-is-listed | apps/indusk-admin/src/app/p/[project]/promises/dashboard-looks.test.tsx |
| A27 | The demo's fault switch still shows its promise broken | Test Phase 1 | Test Phase 1 | passing | unit | promise: the-demo-break-is-caught-locally | apps/indusk-mcp/src/__tests__/demo-command.test.ts |
| A28 | An agent's Bash command that writes an app's `approved.json` — a redirect, `tee`, `sed -i`, `cp`/`mv`, `node -e`, `git checkout <ref> --` — is refused by the guard hook, naming the cockpit's Approve | Test Phase 1 | Build Phase 6 | written | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts |
| A29 | A POST to the approve route from a client that sets `Host` and `Origin` itself but carries no browser fetch metadata (`Sec-Fetch-Site: same-origin`) is refused, and the guard hook refuses a Bash command that names `/api/looks/` and `approve` | Test Phase 1 | Build Phase 6 | written | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx, apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts |
| A30 | Approving a mockup that changed after the page showed it is refused, naming both hashes — an approval binds the mockup the person was shown, as it binds the foundation | Test Phase 1 | Build Phase 6 | written | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/lib/looks/approvals.test.ts, apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx |
| A31 | A mockup that defines a token the foundation already defines — `:root { --dusk: #ff00ff }` in its own style — is refused naming file, line and token, and so is an app stylesheet that does so outside the generated file | Test Phase 1 | Build Phase 6 | written | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A32 | A raw value behind a CSS function (`rgb(255 0 0)`, `calc(13px * 2)`, `linear-gradient(#f00, #00f)`, the fallback of `var(--dusk, #ff0000)`), in a size or border property the rule did not list (`width`, `border-top`, `border-width`, `font`), or in a custom property a mockup or the app defines, is refused like a hex colour | Test Phase 1 | Build Phase 6 | written | unit | promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A33 | A mockup that reaches outside itself — `<link rel="stylesheet">`, `@import`, an `<img>` or `url()` that is not a `data:` URI — is refused, because its approval binds only its own bytes | Test Phase 1 | Build Phase 6 | written | unit | promise: a-mockup-is-approved-by-a-person, promise: a-mockup-leaves-nothing-undefined | apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A34 | A `data-component` named in an approved mockup's comment, script or style covers nothing; a source's `data-component={name}` that is not a literal is listed as an unresolved component, never ignored | Test Phase 1 | Build Phase 6 | written | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/lib/looks/coverage.test.ts, apps/indusk-mcp/src/__tests__/looks-cli.test.ts |
| A35 | A change to the declarations the check trusts — a device's size, an `ignore` tag, an app's `sources` — returns the approved mockups to proposed, as a change to the foundation does | Test Phase 1 | Build Phase 6 | written | unit | promise: a-mockup-is-approved-by-a-person, promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/lib/looks/approvals.test.ts |
| A36 | A screen state whose page does not say it rendered that state is reported unchecked, naming the reason, and is never held | Test Phase 1 | Build Phase 6 | written | unit | promise: every-part-of-the-ui-is-covered | apps/indusk-mcp/src/lib/looks/check.test.ts, apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts |
| A37 | A token whose dark value changed in the app alone is broken under the dark scheme, and a look under a scheme the foundation names is held only when that scheme was opened | Test Phase 1 | Build Phase 6 | written | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts |

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

- [x] `apps/docs/src/reference/cli/looks.md`: `status`, `coverage`, why `approve` is the cockpit's, the guard hook

#### Build Phase 2 Forward Intelligence

- **Trajectory**: A3, A4, A10, A11 and A12 are `passing`. A1 stays `written`: its status half passes (`looks-cli.test.ts`, "a mockup nobody approved reads proposed"), its cockpit half is Build Phase 4's.
- **Signature**: `approvalOf(app, mockup, approvals)` takes the record as a third argument (read once with `readApprovals(app)`), not the two the item names — it stays a pure function over facts, and status and coverage read the record once per run. Build Phase 4's `promises/standing` and Approve route call it the same way.
- **Watch out**: `approve(anyCheckout, app, mockup, by)` reads the mockup and foundation from the **main checkout** (`bookkeepingRoots().trunk`) and writes and commits the record there, as the plan history does. A mockup drawn in a plan worktree and not yet merged is "no mockup" to it; Build Phase 4's Approve must run against what is on `main`, and say so when it refuses.
- **Watch out**: a foundation has no approval of its own — approving a mockup binds the foundation's hash with it, and a changed foundation returns every mockup to proposed. Build Phase 4's "refuses a mockup whose foundation is not approved" has nothing to read yet; decide there whether the foundation gets its own entry or the refusal reads "some entry binds this foundation hash".
- **Gap, recorded**: the guard hook sees Write/Edit/MultiEdit only. A shell write to `approved.json` (`echo >`, `jq`) passes it; what holds there is the hash binding — an entry reads approved only when its hashes are the mockup's true ones, which an agent can compute. The thin lane (`indusk run`) does not run the hook at all; recorded as shed in the Dawn master's keep/shed record. Closing either gap (a Bash pattern in the guard, the hook in `indusk run`'s gate chain, or a signature on the entry) is a decision for a later plan.
- **Watch out**: the guard has no `lesson:` line — no lesson for it exists, and a working agent does not materialise lessons. It names `promise: a-mockup-is-approved-by-a-person` instead. `hooks/CLAUDE.md` says every refusing hook names its lesson; a highlight was filed for the eval agent.
- **Fragile**: the guard's pattern also matches the fixture's `src/__tests__/fixtures/looks-app/.indusk/mockups/demo/approved.json`. Change that fixture through the shell, and recompute its two hashes (Test Phase 1 Forward Intelligence) if a mockup or the foundation in it changes.
- **Assumption**: coverage counts only mockups approved as they are now — a mockup changed since approval covers nothing until re-approved — and reads `data-component` only when the name is a literal. A screen declared with no states reads uncovered.
- **Outside this phase**: `context-tiers-register.test.ts` A13 (the root CLAUDE.md at least 20 % under its budget) fails on this branch since Build Phase 1's Key Decision line — 14,762 bytes against 14,745.6. The root needs `/compact-context` before landing.

### Build Phase 3: The running app, held by value

**Tier**: med — the work step's default

**Goal**: `indusk looks check` opens every screen at every device and reports each token and element held or broken, as spans.

- [x] `apps/indusk-mcp/src/lib/looks/verdict.ts`, exported as `./looks/verdict`: a pure function of approved foundation values, runtime `:root` values and measured element properties → held, or broken with `{ token | element, property, approved, actual, nearest }`
- [x] `apps/indusk-mcp/src/lib/looks/check.ts`, exported as `./looks/check`: `playwright-core` (Apache-2.0) opens each declared screen at each device against the app's configured URL, reads `:root` custom properties and each element's colour, length, radius, shadow, font, `transition-duration` and `transition-timing-function`, and hands them to `verdict`; `playwright-core` an optional dependency, refused by name when absent
- [x] `apps/indusk-mcp/src/lib/looks/report.ts`, exported as `./looks/report`: one span per screen × state × device, held or broken, through the promise mark's attributes
- [x] `indusk looks check <app> [--url]`
- [x] Add `looks-browser.contract.test.ts` to `vitest.tiers.ts` `SYSTEM`
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-mcp/src/bin/commands/looks.ts`) — `looksCheck` printed each look's head and findings inline in its loop; named `lookLines(result)` so the check's output grammar has one place, as `statusLine` is for status. Rule: Should this inline block have been a named function or module?
- [x] Shape (`apps/indusk-mcp/src/lib/looks/check.ts`) — `checkable` spelled the `{ screen, state, path? }` shape inline twice; named `LookTarget`. Rule: Does the name say what it is for, rather than how it works?
- [x] Shape (`apps/indusk-mcp/src/lib/looks/check.ts`) — reviewed, left as-is: `checkApp` resolves the URL, starts the browser and loops screens x devices in one function because the browser must be closed on every path (`finally`) and the loop is the only thing inside it; splitting would pass the browser through a second function for no seam a test can reach without Chromium (`checkable` and `pageUrl` are the seams, and are named and tested)
- [x] Shape (`apps/indusk-mcp/src/lib/looks/verdict.ts`) — reviewed, left as-is: `canon`, `isInitial` and `distance` each switch on the value's kind; one table of per-kind behaviour would hide the three questions (spelling, browser default, order) in one object a reader must hold whole

#### Build Phase 3 Verification

- [x] A17, A22 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/looks/verdict.test.ts src/lib/looks/report.test.ts`); A18–A20 pass in the system tier (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-browser.contract.test.ts`); A25 still passes; tsc and biome clean on changed files
  - Run 2026-10-11 after `pnpm build`: verdict.test.ts 9 passed (A17), report.test.ts 3 passed (A22), everyday-tests-never-wait 8 passed (A25 holds with the contract file in SYSTEM); system tier `looks-browser.contract.test.ts` 3 passed in real Chromium (A18 held, A19 token and element broken, A20 duration broken); `check.test.ts` 4 passed (which states are opened); `looks-cli.test.ts` 13 passed unchanged. tsc and biome clean on changed files.

#### Build Phase 3 Context

- [x] `apps/indusk-mcp/CLAUDE.md`: a look's verdict is decided in `looks/verdict` from values handed to it; the browser only measures — guarded by `verdict.test.ts`

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/cli/looks.md`: `indusk looks check`, the two checks, what a broken line names

#### Build Phase 3 Forward Intelligence

- **Trajectory**: A17, A18, A19, A20 and A22 are `passing`. A25 still passes with `looks-browser.contract.test.ts` in `SYSTEM`. A18–A20 ran in real Chromium (system tier, `looks-browser.contract.test.ts`, 3 passed); A17 is `verdict.test.ts` (9), A22 is `report.test.ts` (3); `check.test.ts` (4) pins which screen states are opened and the page URL.
- **Fragile**: `looks-browser.contract.test.ts` serves its page from a child `node` process, not in-process: `runCli` is `spawnSync`, which blocks the test's event loop, so an in-process server never answers Chromium and every case times out at 30 s on `page.goto`. Keep the server out of process.
- **Fragile**: the contract test passes only because the fixture's `home.empty` is approved at its true hashes (Test Phase 1 Forward Intelligence); `home.full` is also opened, because a proposed mockup whose last approved version was approved on the *current* foundation hash is still checked. Reformatting the fixture's foundation makes both read unchecked and the run exits 1 with "nothing checked".
- **Watch out**: the verdict knows *kinds* by the shape of the approved value (`#hex`/`rgb(` colour, `12px` length, `200ms` duration, `cubic-bezier(` easing, three digits weight, colour plus digits shadow, else family), not by the foundation's DTCG `$type`. A `fontWeight` written as a name (`bold`) is read as a family and a computed `700` then breaks. Build Phase 5's foundation should write weights as numbers, or `verdict`'s input gains types.
- **Watch out**: Tailwind v4 emits only the theme variables a page uses, and `generateCss({ tailwind: true })` maps `space.*` to `--spacing-*`. Check (a) reads every foundation token by its foundation name (`--space-3`) off `:root`; an unused token, or a renamed one, reads `(not set)` and breaks. Build Phase 5, restyling the admin, must either emit the foundation `:root` block beside the `@theme` or make `generateCss` write `@theme static`; the check cannot tell "app does not use this token" from "app lost it".
- **Watch out**: the check exits 1 when it opened nothing (no approved mockup, or a changed foundation). Build Phase 4's watcher pass and dashboard should read that as "unchecked", not "held" or "broken"; the report emits no span for an unchecked state.
- **Assumption**: an app's screens are reachable at `<url><path|/name>?state=<state>`; `screens.json` gained optional `url` and per-screen `path` (read by `readApp`, not hashed). The admin, which routes `/p/[project]/...`, will need `path` per screen in Build Phase 5.
- **Assumption**: browser defaults are never breaks (a zero length, `normal`, `none`, `0s`, `ease`, a transparent colour, weight 400) and a border side whose width is 0 has no colour to check. An app that paints with the initial `ease` easing is therefore "held" with no easing token at all.
- **Assumption**: look spans are filed under the one promise `tokens-are-held-exactly` with `indusk.look.{app,screen,state,device}`; `a-look-reports-like-any-promise` is the *reporting* promise and has no mark of its own. Build Phase 4's `promises/standing` reads looks by the `indusk.look.*` attributes on that promise's marks.
- **Setup note**: `playwright-core` was added to `optionalDependencies` (1.59.1, same as `playwright`'s) and the lockfile; `pnpm add -O` excluded it on the first try ("failed compatibility check", a pnpm quirk with an importer the lockfile did not know), declaring it by hand and `pnpm install --offline --no-frozen-lockfile` linked it.
- **Outside this phase**: `context-tiers-register.test.ts` A13 (root `CLAUDE.md` 20 % under budget) still fails as Build Phase 2 recorded.

### Build Phase 4: Looks in the cockpit

**Tier**: strong — commits on `main` from the admin; a wrong approval holds an app to a design nobody chose

**Goal**: mockups open at each device, a person approves them, uncovered parts are named, and a broken look sits on the dashboard first.

- [x] `apps/indusk-admin/src/app/p/[project]/looks/page.tsx`: each app's mockups with their state (approved, proposed, uncovered), a device choice, the mockup in a frame at that device's size; uncovered screens, states and components listed
- [x] `POST /api/looks/[app]/approve`: calls `looks/approvals`' `approve` with the person; refuses a mockup whose foundation is not approved
- [x] Looks in `promises/standing` (the one reader): each screen × state × device a row beside promises; the dashboard and the nav's broken count read them; the editor's health reader shows them
- [x] The nav gains Looks under Promises
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-mcp/src/lib/promises/standing.ts`) — `lookStandingOf` picks the newest counted run and decides the standing inline in its device loop; name `newestRunSince(runs, look, device, since)` and `lookStandingFor(approval, newest)` so the rule has one place and a seam. Rule: Should this inline block have been a named function or module?
- [x] Shape (`apps/indusk-admin/src/components/looks/Looks.tsx`) — `AppSection` draws the list and, inline, the open mockup (its device line, Approve and the frame); name `OpenMockupView` so the frame has one place to change. Rule: Does this unit have one reason to change?
- [x] Shape (`apps/vscode-extension/src/core/panel-html.ts`) — `panelBody` builds the Looks list inline beside `card` and `row`; name `looksSection(model)`. Rule: Should this inline block have been a named function or module?
- [x] Shape (`apps/indusk-mcp/src/lib/promises/standing.ts`) — reviewed, left as-is: `readLookStanding` keeps the cache, the runs read and the per-app read in one function: the cache is keyed on the result of all three and skipped exactly when runs are handed in, and splitting it would pass that condition through a second function; `readLookRuns` and `lookStandingOf` are the seams, named and tested

#### Build Phase 4 Verification

- [x] A1, A2, A13, A14, A23, A24, A26 pass (`cd apps/indusk-admin && pnpm exec vitest run src/app/p/\[project\]/looks/looks.test.tsx src/app/p/\[project\]/promises/dashboard-looks.test.tsx; cd ../vscode-extension && pnpm exec vitest run src/core/looks-health.test.ts`); A15, A16 pass in the admin's system tier (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/app/p/\[project\]/looks/looks-browser.contract.test.ts`); `vitest related` on the changed admin files; tsc and biome clean on changed files
  - Run 2026-10-11 after `pnpm build` in `apps/indusk-mcp`: `looks.test.tsx` 6 passed in the admin's node project (A1 cockpit half, A2 both cases, A13, A14 both cases) and `dashboard-looks.test.tsx` 5 passed in the browser project (A23 three cases, A26, the nav's Looks link); the editor's `looks-health.test.ts` 2 passed (A24); system tier `looks-browser.contract.test.ts` 2 passed in real Chromium under `next dev` (A15 frame 390 × 844 at phone and 1440 × 900 at desktop, A16 the card's background follows `color.paper`). `vitest related` on the changed admin files: 31 files, 211 passed. Package: `approvals.test.ts` 6 passed (the foundation refusal added), `look-standing.test.ts` 4 passed, `looks-cli`, `everyday-tests-never-wait` (A25) and `cockpit-single-definition` pass. tsc clean in the package, the admin and the editor; biome clean on the 33 changed files. Outside the phase: `context-tiers-register.test.ts` A13 fails as Build Phase 2 recorded; `inbox.test.ts` A17's two cases fail on a `reminder` entry that `recordBreaks` adds depending on the hour of the run (03:00 UTC) — `record.ts` and `reminders.ts` are untouched by this phase; a parallel admin browser run prints React "Maximum update depth exceeded" from a file this phase did not change (none of its files reproduce it alone; no component this phase added has an effect).

#### Build Phase 4 Context

- [x] `apps/indusk-admin/CLAUDE.md`: a look's state is read from `promises/standing` and `looks/*`, never computed in the admin — guarded by `cockpit-single-definition.test.ts` gaining `approvalOf`, `coverageOf` and `verdict`

#### Build Phase 4 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: the Looks page, devices, Approve, uncovered, looks on the dashboard

#### Build Phase 4 Forward Intelligence

- **Trajectory**: A1, A2, A13, A14, A15, A16, A23, A24 and A26 are `passing` — `looks.test.tsx` 6 (admin node project), `dashboard-looks.test.tsx` 5 (admin browser project), `looks-health.test.ts` 2 (editor), `looks-browser.contract.test.ts` 2 (admin system tier, real Chromium under `next dev`; re-run after Shape). A5–A8, Build Phase 1's lint rows, were still `written` though they have passed since Build Phase 1 (`looks-cli.test.ts`, 13 passed); `check-gates` refused this phase's checkbox edits until they were set `passing` — done here, no Asserts or Passes-at changed.
- **Decision — "refuses a mockup whose foundation is not approved"**: the foundation keeps no approval of its own (Build Phase 2's open question). An entry binds the foundation's hash with the mockup's, so approving a mockup approves the foundation it is drawn on. The refusal reads as: Approve sends the foundation hash the page showed (`approve(…, { foundationHash })`), and the package refuses when `main` holds another — a foundation changed since the person looked, or one only a plan worktree holds. A foundation is therefore never approved unseen; there is no second record to drift. A foundation that cannot be read refuses too (`readApp` throws; `approve` returns the reason "read on main").
- **Deviation**: `looks.test.tsx` runs in the admin's **node** project, not the browser one its folder implies — it reads and writes a real fixture project through the package (approve commits on a temp repo's `main`), which a browser cannot reach and a mock would reduce to wiring. `vitest.tiers.ts` lists it in `NODE_PAGES`; the browser project excludes it and every `SYSTEM` entry. Bracketed route folders are escaped (`asGlob`) before vitest globs a listed path: unescaped, `[project]` is a character class and the file silently matches nothing.
- **Deviation**: A16's carried body changed `--dusk`; the fixture's `home.empty` does not paint with it, so the contract changes `color.paper`, the value its card's background uses.
- **Fragile**: the look rows' runs come from the local Jaeger by `marksBetween` over every service, filtered to marks carrying `indusk.look.*` (now parsed by `parseMarkedSpan` into `MarkedSpan.look`) and to this project's `markProjectId`. A look check run from another checkout of the same repository shares the project id. `readLookStanding` caches per project for 5 s (the admin passes `admin.refresh_ms` on the dashboard; the nav uses the default) and asks nothing when `.indusk/mockups/` is absent.
- **Watch out**: a run counts only when it is no older than the approval in force (`newestRunSince`); after a re-approval every look reads `not checked` until `indusk looks check` runs again. A held run against an old reference never makes an uncovered look held (`lookStandingFor`: broken, else uncovered until approved, else held / not checked). Build Phase 3's "unchecked" state is this `not checked` — not held, not broken, never counted.
- **Watch out**: the mockup frame is an `<iframe srcDoc sandbox="">` whose document is `looks/overview`'s `mockupDocument` — the mockup's `<link … tokens.css>` replaced by `generateCss(foundation)` inline. A Build Phase 5 mockup that loads its tokens any other way gets the CSS prepended to its `<head>`; one that loads other stylesheets by relative URL will not resolve them in the frame.
- **Watch out**: the approver is the project's `git config user.name`, else the OS account (`approver`). Approve reloads the page (`window.location.reload()`), not `router.refresh()`: `useRouter` throws outside a mounted app router, which the node-rendered page test is.
- **Assumption**: looks are local only — `readLookRuns` reads the local daemon, never `promises.jaeger`. A deployed look check (none exists) would need the sources split promises have.
- **Outside this phase**: `context-tiers-register.test.ts` A13 (root `CLAUDE.md` 20 % under budget) still fails; `inbox.test.ts` A17 fails on a `reminder` entry whose presence depends on the hour of the run (`record.ts`/`reminders.ts`, untouched here); a parallel admin browser run prints React "Maximum update depth exceeded" that no file of this phase reproduces alone.

### Build Phase 5: The cockpit, held to its mockups

**Tier**: med — the work step's default

**Goal**: the admin's own foundation and mockups, approved by a person, and the admin restyled and held — a token changed in the admin alone shows broken.

- [x] Approval happens in the checkout being worked, never on `main` (Sandy, 2026-10-11 — reverses Build Phase 4's "approve against `main`"): `approve` reads and commits in the checkout it is given (the plan's worktree or the current branch) through `commitNote` with `anyBranch`; the Looks page reads a chosen checkout (`?checkout=<plan>`, defaulting to the one worktree that holds mockups `main` lacks) and Approve sends it; the route resolves it from the plan-worktree record and refuses any other path; Build Phase 4's `main` refusals and tests are rewritten, not deleted
  - Note: `approve(checkout, …)` reads and commits in the checkout it is given on that branch (`commitNote … { anyBranch: true }`; a detached HEAD leaves the entry written and says why). `looksCheckouts`/`resolveLooksCheckout` in `looks/overview` list the project's own checkout and each assigned plan worktree that holds mockups; the route takes a plan name, never a path, and refuses one with no such worktree (404). The Looks page shows a "Reading" switch when there is more than one. Tests: `approvals.test.ts` (approve from the worktree leaves `main` untouched), `looks.test.tsx` (two new A2 cases). Open: the dashboard's looks standing and `indusk looks check` still read the project's own checkout — a plan's look is held on the dashboard once merged.
- [x] Group approval (Sandy, 2026-10-11): the Looks list has a checkbox on each proposed mockup, a select-all, and one Approve for the selection; the route takes `mockups[]` and records one entry per mockup, each as the person who clicked and each bound to its own hash, reporting each result — never a single entry covering several
  - Note: `ApproveSelected` (client) reads the checkboxes the server rows carry; the route's `mockups[]` returns one result per mockup (200 when any recorded, 409 when none), one commit each. Tests: two new A2 cases in `looks.test.tsx`.
- [x] `.indusk/mockups/admin/foundation.tokens.json` from `plan-cockpit.html`'s `:root` (colours, washes, fonts, shadow, light and dark), plus the spacing, radius and type scales its 400-odd raw sizes imply, each raw size mapped to its nearest step and the mapping recorded in this item's note
  - Note — the mapping (nearest step, a tie goes to the larger): **space** 2→`hair`, 4→`1`, 5/6→`tight`, 7/8→`2`, 9/10→`snug`, 11/12→`3`, 14/16→`4`, 18/20→`5`, 22/24→`6`, 28/30/32→`8`, 40→`10`, 56/64/70/72→`16`; **radius** 2→`xs`, 3–5→`sm`, 6/7→`md`, 8/9→`lg`, 10–14→`xl`, 999 and 50 %→`pill`; **text** 9/10/11→`2xs`, 12→`xs`, 13→`sm`, 14→`md`, 15→`base`, 16/17/18→`lg`, 20→`xl`, 22→`2xl`, 26→`3xl`, 30→`4xl`; **leading** the mockup's ratios resolved against their sizes to 12/16/18/20/24/28/32 px (a unitless line-height is a raw value to the rule); **tracking** .04–.09em→`chip` 0.5 px / `caps` 1 px, −.01em dropped; **border** 1 px and 2 px; layout and control widths (nav 280, rail 264, dots, badges) are `size` tokens. Dark values sit beside the light under `$extensions["dev.indusk"].dark`; `generateCss` emits them under `prefers-color-scheme` and `[data-theme="dark"]` (`foundation.test.ts`). The check measures the light scheme only.
- [x] `.indusk/mockups/admin/devices.json` (phone, narrow laptop, desktop) and `screens.json` (the nav, dashboard, promise page, plan page, looks page; their states)
  - Note: `screens.json` declares `url` (the daemon, port 3939) and each screen's `path` under project `dusk`; the admin does not read `?state=`, so a state is shown by the data the project holds when the check runs, not by the query — Build Phase 5's live check names which states the dusk project can show.
- [x] The mockups, one per screen × state, redrawn from `plan-cockpit.html` on the foundation with no raw value (A9)
  - Note: eleven mockups (nav 2, dashboard 2, promise 2, plan 3, looks 2), generated once from one stylesheet so the components agree; `indusk looks lint admin` reports no finding in `.indusk/mockups/`. Nineteen `data-component` names: shell, nav, plan-row, badge, view-link, summary-bar, chip, promise-row, button, decision-card, rail-group, step, stat, box, timeline, look-row, device-frame, device-choice, tag.
- [x] **Pause for a person**: Sandy opens each mockup in the cockpit at each device beside `plan-cockpit.html` and approves it (Deferred Verification U1)
  - Note: Sandy approved all eleven in the cockpit on 2026-10-11 (14:57–14:58, by Sandy Corsillo; `indusk looks status admin` reads eleven approved). Deferred Verification U1 is that approval.
- [x] The admin restyled onto the foundation: `globals.css` loads the generated tokens and the reset `@theme`; every component's classes moved onto the foundation; `data-component` on each component the mockups name
  - Note: `foundation.generated.css` (from `indusk looks tokens admin --tailwind`) and a token-only `globals.css`; 57 source files moved by a codemod and then by hand (stock palette to the foundation's colours, `0.5`/`1.5` steps to `hair`/`tight`, rings to borders or outlines, arbitrary values to named CSS in `globals.css`); `@tailwindcss/typography` dropped for a `.prose` on the foundation; `data-component` on button, chip, nav, view-link, shell, decision-card, look-row, device-frame, device-choice. Found and fixed on the way, all in the package: tokens unset under Tailwind (`@theme static`, and the foundation's own names beside Tailwind's), a shadow compared as text (now by layer and colour), `.25` against `0.25`, `margin: auto` read as pixels, `<option>` and a dev-only portal measured, and `translate-x-0` compiling to nothing (`--spacing-0`).
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Findings: `generateCss` had grown to dark blocks, the Tailwind theme and the mockup `:root` in one function — split into `darkBlocks` and `tailwindTheme` (rule: one reason to change); output unchanged against the committed generated file. Left as-is: the codemod's whole-file class edits (mechanical, checked by lint, coverage, the check and the admin's 519 tests), and `ApproveSelected` reading the server rows' checkboxes from the DOM — the rows are the server's markup, so the selection is the checkboxes themselves.

#### Build Phase 5 Verification

- [x] A9 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/looks-admin-foundation.test.ts`); `indusk looks lint admin` and `indusk looks coverage admin` exit 0; `indusk looks check admin` all held
  - Run 2026-10-11: `looks-admin-foundation.test.ts` 2 passed; `indusk looks lint admin` no raw value; `indusk looks coverage admin` every part covered; `indusk looks check admin --url http://localhost:3940` 33 looks held (11 mockups × 3 devices, against `next dev` from this worktree). Admin: 78 files, 519 tests pass; package looks tests pass; tsc clean in both.
- [x] A21, live check: change one colour token in the admin's generated CSS alone, run `indusk looks check admin`, and record here that the dashboard shows it broken naming the token, approved and actual; revert, and record it held
  - Run 2026-10-11: `--color-dusk` changed `#c2620b` → `#d07020` in `foundation.generated.css` alone: `indusk looks check admin` reported 33 of 33 looks broken, `token --color-dusk approved #c2620b actual #d07020` and, per element, `color`/`background-color` actual `rgb(208, 112, 32)` nearest `--color-dusk (#c2620b)` (1,200+ findings across the badges, links and bars that use it). Reverted (byte-identical to the generated file): 33 looks held. Not seen: the dashboard itself — the check's spans were emitted, but I read the verdict on the command line, not the dashboard's broken count.

#### Build Phase 5 Context

- [x] `apps/indusk-admin/CLAUDE.md`: the admin's look is held by `.indusk/mockups/admin/`; a new screen or component needs its mockup approved first — guarded by `looks-admin-foundation.test.ts` and `indusk looks coverage admin`

#### Build Phase 5 Document

- [x] `apps/docs/src/guide/ui-promises.md`: the foundation, mockups, approval, coverage, the check, the cockpit as the worked example, with the Mermaid flow; `apps/docs/src/decisions/ui-promises.md` published; changelog: Added — "UI promises: an app's look is held by mockups a person approves in the cockpit, built on one foundation of design tokens, and the running app is checked against them."

#### Build Phase 5 Forward Intelligence

- **Trajectory**: A9 (`looks-admin-foundation.test.ts`, 2 cases) and A21 (live check, recorded under Verification) are `passing`; every row is terminal.
- **Decision — approval moved to the worktree**: Build Phase 4's "approve against `main`" was reversed on Sandy's instruction (2026-10-11): `approve(checkout, …)` commits on the checkout's own branch; the Looks page reads a chosen checkout (`?checkout=<plan>`). The ADR's decision 3 and the published decision are amended. Group approval (checkboxes, one entry per mockup) was added in the same phase.
- **Fragile**: the value check does not see layout. `translate-x-0` compiled to nothing once Tailwind's spacing was reset and the nav sat off-screen with 33 looks held; `--spacing-0` in the generated theme is the fix, and the admin's cockpit-phone test is what found it. A restyle is looked at, not only checked.
- **Fragile**: the cockpit's states are not reachable — the admin ignores `?state=`, so the 11 mockups are checked against the three pages the paths name, and every state of a screen measures the same page. The check says held for a state it did not open.
- **Watch out**: `foundation.generated.css` is generated; a change to the foundation is a re-approval of every mockup (the hash binds), then `indusk looks tokens admin --tailwind --out apps/indusk-admin/src/app/foundation.generated.css`. Do not edit it by hand.
- **Watch out**: the dashboard's looks standing and `looks check` read the project's own checkout, so a plan's look appears on the dashboard once merged. The admin daemon on port 3939 still runs `main`'s bundle; the worktree was served by `next dev -p 3940`.
- **Assumption**: dark values are written and emitted but never measured — the check opens the light scheme only.
- **Outside this phase**: `context-tiers-register.test.ts` A13 and `inbox.test.ts` A17 fail as Build Phase 2 and 4 recorded; `http-promise-remote.test.ts` is not biome-formatted on `main`.

### Build Phase 6: Falsification — what an agent, a function or an unopened page gets past

**Tier**: strong — changes the guard hook every agent write passes through, the approval record's shape and the lint's rule; a wrong fix here lets a design be approved or held by nobody

**Goal**: verify whether the attested state holds against an agent that approves its own mockup, a mockup or an app that carries a raw value past the lint, a coverage that counts words rather than elements, a check that says held for what it did not open. Each row in this phase's Verification is a hypothesis that is red today; each item is the fix if it confirms.

**Hunted and found** (the code read, not guessed):
- **The guard is `Edit|Write` only.** `approvalOf` believes any entry whose hashes are the true ones, and the hashes are `sha256` of files the agent can read; `printf`/`node -e` through Bash writes a record that reads *approved*. The route's `adminOnly` compares `Origin` with `Host`, both of which a `curl` sets (its comment: it is a cross-site guard, not a local-process one).
- **The record binds the mockup's and foundation's bytes, not what the person was shown nor what the check trusts.** The route sends `foundationHash` only; `screens.json`'s `ignore` (tag names the browser half does not measure) and `sources`, and `devices.json`, are not bound by anything.
- **The lint's strict list and plugin defaults leave holes** — probed against `stylelint-declaration-strict-value` as configured: `rgb(255 0 0)`, `calc(13px * 2)`, `linear-gradient(#f00, #00f)`, `var(--dusk, #ff0000)`, `border-top: 1px solid #ff0000`, `border-width: 13px`, `width: 13px`, `font: 13px Arial` and `:root { --dusk: #ff00ff }` all pass; only the bare hex is flagged. `tokenFindings` lets a mockup define a name the foundation already defines.
- **Coverage counts text.** `componentsIn` runs a regex over the mockup's whole source, comments included.
- **Recorded, not fixed** (Build Phase 5's Forward Intelligence and the lesson `a-value-check-that-says-held-has-not-seen-the-layout`): a state the page ignores measures as held, and the dark scheme is emitted but never opened.

- [ ] **Hook**: `hooks/looks-approval-guard.js` also matches `Bash` (settings matcher `Edit|Write|Bash`): refuses a command whose text names `.indusk/mockups/<app>/approved.json` with a write verb or redirect, or names `/api/looks/` with `approve`; message names the cockpit's Approve. State in the hook's header what it cannot see (an interpreter building the path at run time) — the rule is a tripwire for an agent's ordinary attempt, not a boundary against a user-level process
- [ ] **Route**: `POST /api/looks/[app]/approve` refuses a request that lacks `Sec-Fetch-Site: same-origin` (set by the browser, not by page script); `adminOnly`'s own comment says what it is for and this route's addition says what it adds
- [ ] **Approve binds the mockup shown**: `approve(checkout, app, mockup, by, seen)` takes `seen.mockupHash` beside `seen.foundationHash` and refuses a differing one naming both; the Looks page sends the hash of the mockup it rendered, per mockup for a group approval
- [ ] **Lint, redefinition**: a mockup defining any name in the foundation is `redefined-token`; an app stylesheet may define a foundation name only in the file `looks tokens --out` generated (its header marks it)
- [ ] **Lint, functions and properties**: configure the strict rule with `ignoreFunctions: false` and pass `var()` on its own; add a pass that refuses a literal colour or `px`/`rem`/`em` length anywhere in a strict property's value, `var()` fallback included; widen the property list to `width`, `height`, `min-*`, `max-*`, `inset`/`top`/`right`/`bottom`/`left`, `border(-side)?(-width)?`, `outline-offset`, `font`; refuse a raw value in a custom property a mockup defines that it does not declare new. Percentages, `vw`/`vh`/`fr`, `0`, `auto` and the keywords stay allowed. Then run `indusk looks lint admin` and `indusk looks lint demo`: every finding the wider rule raises in the admin's own source becomes an item here, mapped onto a token, before the phase closes
- [ ] **Lint, a mockup is self-contained**: `external-reference` for `<link>`, `@import`, and `src`/`url()` that is not `data:`; a mockup's approval is then the whole of what it draws
- [ ] **Coverage by element**: parse each mockup's HTML (an HTML parser the dependency tree already holds — `parse5` via stylelint's `postcss-html` — checked first, per the don't-reinvent rule) and read `data-component` off elements; a source's `data-component={…}` that is not a string literal is listed `unresolved component: <file>:<line>`, exit 1 like an uncovered one
- [ ] **Declarations bound**: an approval entry gains `declarationsHash` over the declared devices, `ignore` and `sources` — not the screens list, which coverage already judges; an entry without it reads proposed. **Decision for the person (gate policy ask)**: the eleven admin approvals Build Phase 5 recorded have none, so they read proposed until a person re-approves them with the Looks page's group approval — recommended, since a declaration the person has not seen is exactly what the field closes; the alternative, reading an absent field as bound to whatever is declared now, keeps the loophole for every old approval
- [ ] **A state is opened or unchecked**: the measure script reads the page's own answer to which state it rendered (`document.documentElement.dataset.lookState`, set by the app; name final in the lesson's fix); absent or different, the look is `unchecked: the page did not report state <state>` and never held, printed and counted as the lesson's How-to-apply (2) says. The admin sets it for the states it can render and declares the rest unchecked until it can
- [ ] **The dark scheme is opened**: for a foundation that names dark values, `check` opens each look under `colorScheme: "dark"` too and `verdict` takes the dark approved values; a look names its scheme (`phone/dark`), so spans and the dashboard say which. One scheme not opened is reported, not held
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 6 Verification

- [ ] A28–A37 pass: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/looks-approval-guard.test.ts src/__tests__/looks-cli.test.ts src/lib/looks/approvals.test.ts src/lib/looks/coverage.test.ts src/lib/looks/check.test.ts` and `cd apps/indusk-admin && pnpm exec vitest run src/app/p/\[project\]/looks/looks.test.tsx`; A36 and A37 in the system tier (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-browser.contract.test.ts`); A1–A27 still pass; tsc and biome clean on changed files
- [ ] Live check: `indusk looks lint admin`, `indusk looks coverage admin` exit 0 and `indusk looks check admin --url …` reports every look held or named unchecked — none held for a state it did not open; recorded here with the commands and the counts

#### Build Phase 6 Context

- [ ] `apps/indusk-mcp/hooks/CLAUDE.md`: `looks-approval-guard.js` matches Bash too and is a tripwire against an agent's ordinary attempt, not a boundary against a user-level process — guarded by `looks-approval-guard.test.ts`
- [ ] `apps/indusk-admin/CLAUDE.md`: the approve route takes the mockup's and the foundation's hashes the page showed, and a browser-set fetch header — guarded by `looks.test.tsx`

#### Build Phase 6 Document

- [ ] `apps/docs/src/reference/cli/looks.md`: the widened rule and its allowed units, `redefined-token`, `external-reference`, `unresolved component`, `unchecked` with its reasons, the dark scheme, what an approval binds
- [ ] `apps/docs/src/decisions/ui-promises.md` and the ADR: "Approval cannot be faked by an agent" restated to what is enforced — a hook tripwire over Write, Edit and Bash plus hashes bound to what was shown — and the residual named
- [ ] Changelog: Fixed — "UI promises: an approval binds the mockup the person was shown and what the check trusts, the lint reaches raw values behind functions and in size properties, and a look the check did not open is reported unchecked, not held."

#### Build Phase 6 Summary of the hunt

- **Investigated, held**: the Looks page's mockup frame (`sandbox=""` — no script, opaque origin, so a mockup cannot post to the approve route itself); `approve`'s app name (`isUsableSegment`) and mockup name (looked up, never joined into a path); `readApprovals`' refusal of a malformed record; the lock around the record's write; `checkable`'s refusal when nothing is approved; `markPromise` attributes in `report`.
- **Not hunted, and why**: Tailwind's namespace reset (`foundation.ts`'s `tailwindTheme`) — Build Phase 5's `translate-x-0` finding is the lesson's and the reset was reworked there; the editor's reader (`looks-health.ts`) — it reads `promises/standing`, which no hypothesis here touches; Style Dictionary's DTCG alias resolution — no alias is used by the admin's foundation, and a DTCG edge in a foundation file is the foundation reader's own tests'; layout and position (a drawer off-screen by design is indistinguishable from one stuck there by a value check; position is mockup-matching's, out of scope here).
- **Residual, by nature**: nothing an agent can run as the person can be made unforgeable on the person's machine; A28 and A29 raise the bar to a deliberate act and the record is in git, where a forged entry is a visible commit by whoever made it.

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

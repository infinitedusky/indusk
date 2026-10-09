---
title: "VS Code extension — promises in the editor, the break where the fix happens"
date: 2026-10-08
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# VS Code extension — promises in the editor, the break where the fix happens

## Goal

Promise health worked out once, in the package; `indusk promises health --json` streaming it; and a VS Code extension, presentation only, that marks each promise at the line that keeps it, shows a break within two five-second reads, and starts the developer's own `claude` on the fix in one click. Decided in the [ADR](adr.md); promised in the [brief](brief.md); proven by the [test plan](test-plan.md)'s 16 assertions.

## Scope

### In Scope
- `promises/health` in the package (moved from the admin), the admin re-pointed, a single-definition pin
- `indusk promises health --json [--every <seconds>]`
- `apps/vscode-extension`: a pure core and a thin VS Code layer; the `.vsix` shipped in the npm package; `indusk editor install` for VS Code and Cursor
- Docs: the guide, `reference/cli/editor.md`, the promises reference, the admin promises page; the live checks on the demo app

### Out of Scope
- Recording incidents or reopening plans from the editor; a Marketplace listing; editors other than VS Code and Cursor; promise DevTools

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A7 red; the register | the admin's `promise-health.ts` |
| Build Phase 1 | `lib/promises/health.ts`, `lib/promises/store.ts`, the `promises/health` subpath, `indusk promises health --json`, the admin re-pointed | `promises/sources`, `promises/telemetry`, `promises/incidents` |
| Build Phase 2 | `apps/vscode-extension/src/core/` — `markers`, `hover`, `problems`, `notify`, `fixPrompt`, `readSession` | `lib/tokens.ts` (bundled), the health line shape |
| Build Phase 3 | `apps/vscode-extension/src/extension.ts`, `dist/indusk.vsix`, `editor/indusk.vsix` in the package, `indusk editor install` | the core; `@vscode/vsce`, `@vscode/test-electron`, esbuild |
| Build Phase 4 | the live record: A5, A11, A14, Cursor | the demo app, VS Code 1.141, Cursor |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A line carrying a promise's token shows, at the end of the line, the promise's name and its state: holding, broken, not seen, or watched by the tests | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-promise-shows-where-it-is-kept | apps/vscode-extension/src/core/markers.test.ts |
| A2 | A line carrying the token of a promise the project does not have says so | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-promise-shows-where-it-is-kept | apps/vscode-extension/src/core/markers.test.ts |
| A3 | A line in a test that carries a promise's token shows that the test proves the promise | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-promise-shows-where-it-is-kept | apps/vscode-extension/src/core/markers.test.ts |
| A4 | Hovering a marked line shows the promise's sentence, its state for each source, and when it last held or broke | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-promise-shows-where-it-is-kept | apps/vscode-extension/src/core/hover.test.ts |
| A5 | With the extension installed, opening the demo app's telemetry file shows its promise on the line that marks it | Build Phase 3 | Build Phase 4 | passing | live check | promise: a-promise-shows-where-it-is-kept | apps/vscode-extension/e2e/live.e2e.test.ts |
| A6 | For the same project and marks, the editor, the admin and `indusk promises health` give every promise the same state for each source | Build Phase 1 | Build Phase 2 | passing | unit | promise: the-editor-shows-the-same-health-as-the-admin | apps/indusk-mcp/src/__tests__/promise-health-windows.test.ts, apps/vscode-extension/src/core/same-health.test.ts |
| A7 | Promise health is worked out in one place the admin, the CLI and the editor all use; a second copy fails the build | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-editor-shows-the-same-health-as-the-admin | apps/indusk-mcp/src/__tests__/promise-health-single-definition.test.ts |
| A8 | A break that becomes readable shows within two reads (ten seconds at five) on its line, in the Problems list and in one notification, with no reload | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-break-reaches-the-editor | apps/vscode-extension/src/core/session.test.ts |
| A9 | A break read again does not notify again; a fixed break clears from the line and the Problems list | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-break-reaches-the-editor | apps/vscode-extension/src/core/session.test.ts |
| A10 | A source that cannot be read, or reads watcher blind, is shown as such, never "holding"; no line for two cadences reads "not reading" | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-break-reaches-the-editor | apps/vscode-extension/src/core/session.test.ts |
| A11 | With the demo app running, its fault switch makes the editor show the promise broken within ten seconds | Build Phase 3 | Build Phase 4 | passing | live check | promise: a-break-reaches-the-editor | apps/vscode-extension/e2e/live.e2e.test.ts |
| A12 | The fix action on a broken promise opens a terminal in the project running `claude` whose first message names the promise, its symptom, its trace link and its tests | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-break-opens-a-fix-in-one-click | apps/vscode-extension/src/core/fix.test.ts |
| A13 | Where `claude` is not installed, the fix action says how to install it and opens nothing | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-break-opens-a-fix-in-one-click | apps/vscode-extension/src/core/fix.test.ts |
| A14 | On the demo break in VS Code, one click starts `claude` with those facts | Build Phase 3 | Build Phase 4 | passing | live check | promise: a-break-opens-a-fix-in-one-click | apps/vscode-extension/e2e/live.e2e.test.ts |
| A15 | After the extension reads a project, shows a break and runs the fix action, the project's files are exactly as they were | Build Phase 2 | Build Phase 2 | passing | unit | promise: the-editor-only-shows | apps/vscode-extension/src/core/only-shows.test.ts |
| A16 | The packaged extension installs into VS Code with one `indusk` command, activates in a project with InDusk, and stays inactive in one without | Build Phase 3 | Build Phase 3 | passing | contract | the install path every developer takes; VS Code is not ours | apps/vscode-extension/src/__tests__/install.contract.test.ts |

### Deferred Verification

- **The same package works in Cursor (U1)**
  - reason: Cursor's extension host is not scriptable here, and its compatibility with VS Code's API is Cursor's to keep
  - would require: a scriptable Cursor, or Cursor's own extension test runner
  - mitigation: installed and opened by hand on the demo app in Build Phase 4 and again at demo-rehearsal, each recorded in this plan; `indusk editor install` names Cursor's CLI when it finds it

## Checklist

### Test Phase 1: The single-definition pin, red; the rest registered

**Goal**: author the one row whose subject exists today, and register every other row with the body it will have.

- [x] Create/confirm this plan's worktree (`indusk worktree create vscode-extension`; made by `indusk plans start` on 2026-10-08 at `dusk-worktrees/vscode-extension`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
- [x] (red on all three assertions: no `readHealth`/`healthOf` in the package, the admin defines them, five admin files import its own copy) A7 in `apps/indusk-mcp/src/__tests__/promise-health-single-definition.test.ts`: `lib/promises/health.ts` defines `readHealth` and `healthOf`; no file under `apps/indusk-admin/src` or `apps/vscode-extension/src` defines either; the admin's importers name `@infinitedusky/indusk-mcp/promises/health`. RED today: the health lives in the admin and the package has none

#### Deferred to Build Phase 1

- **A6** — its subject is the package's `readHealth` and the `promises health --json` command, which Build Phase 1 introduces. Body:

  ```typescript
  // apps/indusk-mcp/src/__tests__/promise-health-windows.test.ts
  // promise: the-editor-shows-the-same-health-as-the-admin
  // A fixture project (helpers/promises-fixture.ts) with recorded marks and a fixed clock; the probe and the store's
  // reads are faked through HealthDeps. Read health three ways — readHealth() directly (what the admin calls),
  // the CLI's `promises health --json` line (runCli), and the extension core's readSession() fed that line (Build
  // Phase 2 adds the third; until then the test compares two and is `written`) — and expect every
  // { source, promise, state } triple to be equal across them.
  ```

#### Deferred to Build Phase 2

- **A1–A4, A8–A10, A12, A13, A15** — their subjects are the extension core's functions under `apps/vscode-extension/src/core/`, which Build Phase 2 introduces with the app itself. Bodies, as the shapes they assert:

  ```typescript
  // markers.test.ts — promise: a-promise-shows-where-it-is-kept
  // markers({ path: "src/telemetry.ts", text: 'span.setAttribute("x") // promise: seats-held\n', registry, health })
  //   → [{ line: 0, text: "seats-held · broken (production)" }]                                        (A1)
  // a token naming "no-such-promise" → [{ line: 0, text: "no-such-promise · not in this project" }]       (A2)
  // the same token in a file the registry lists under `tests:` → "seats-held · proved here"              (A3)
  // hover.test.ts — hover(line, …) → sentence, "local: holding", "production: broken, last broke 12:04"  (A4)

  // session.test.ts — promise: a-break-reaches-the-editor
  // a session fed health lines at t=0 (holding) and t=5 s (broken) shows the break on its line, one Problem
  //   and one notification by the t=5 s line; at t=10 s (still broken) no second notification; at t=15 s
  //   (holding) the marker and Problem clear                                                           (A8, A9)
  // a line whose production source is { ok: false, reason: "watcher blind …" } shows "production: watcher blind";
  //   no line for 10 s shows "not reading"                                                                (A10)

  // fix.test.ts — promise: a-break-opens-a-fix-in-one-click
  // fixAction(broken row, { claudeOnPath: true }) → { terminal: { cwd: root, command: 'claude "…"' } } whose
  //   prompt contains the promise name, symptom, trace URL and each test path                             (A12)
  // with claudeOnPath false → { message: /install Claude Code/ }, no terminal                                (A13)

  // only-shows.test.ts — promise: the-editor-only-shows
  // a git-initialised fixture project; run readSession over three lines, markers, hover and fixAction;
  //   `git status --porcelain` is empty afterwards                                                         (A15)
  ```

#### Deferred to Build Phase 3

- **A16, A5, A11, A14** — A16 needs the packaged `.vsix` and `indusk editor install`, which Build Phase 3 builds; A5, A11 and A14 drive the installed extension against the running demo app, written at Build Phase 3 and run once by hand at Build Phase 4. Bodies:

  ```typescript
  // install.contract.test.ts — system tier; skipped by name without `code` on PATH
  // runs `indusk editor install` with VS Code's --extensions-dir pointed at a temp dir; then @vscode/test-electron
  //   opens a fixture project with .indusk/config.json and one without; expects the extension active in the first
  //   (its command `indusk.fixWithClaude` registered) and inactive in the second                             (A16)

  // e2e/live.e2e.test.ts — skipped by name without INDUSK_LIVE_EDITOR=1; the demo app started first
  // opens examples/seat-holds/src/telemetry.ts in VS Code; reads the decorations through the extension's
  //   test hook; expects the promise's marker (A5); turns the fault switch on; expects broken within 10 s (A11);
  //   runs the fix action; expects a terminal named "Claude — <promise>" running claude with the facts (A14)
  ```

#### Test Phase 1 Verification

- [x] A7 is authored and red on its own assertion (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promise-health-single-definition.test.ts`)
- [x] (reviewed. Found: the package already has `lib/promises/health.ts` — `promiseHealth`, the agents' report behind the `promise_health` MCP tool — so health is computed twice today, not once; Build Phase 1 gains an item to merge the admin's into that file and build the agents' report on it, and A6's body adds the MCP report as a fourth read that must agree. The core bodies compile against the functions Build Phase 2 introduces; A16's needs `@vscode/test-electron`, added in Build Phase 3) Every deferred body above reviewed: will it compile at the phase it names, and does it assert what it claims

### Build Phase 1: Health in the package, and the CLI that streams it

**Goal**: one health reader, in the package, read by the admin and by a new CLI command.

- [x] (the store moved without its timeline view: `readTimelineView` draws the admin's strips, so it stays in the admin and reads through `promises/store`; the admin's health and store tests stay beside their shared fake, `__tests__/helpers/fake-source.ts`, re-pointed at the package rather than moved) Move `apps/indusk-admin/src/lib/promise-health.ts` → `apps/indusk-mcp/src/lib/promises/health.ts` and `promise-timeline.ts` → `lib/promises/store.ts`; `readAdminRefreshMs` stays in the admin and becomes a parameter (`HealthDeps.cacheMs`); move their tests with them
- [x] (the agents' rows are now `reportRows`, exported, each carrying `health` from `healthOf`) (found at Test Phase 1's review) `lib/promises/health.ts` already exists: `promiseHealth`, the agents' per-source report behind the `promise_health` MCP tool, computed from the same reads but by its own rules. The admin's `readHealth`/`healthOf` merge into that file rather than beside it, and `promiseHealth` is rebuilt on `healthOf` so the agents' report, the admin and the editor share one rule; A6 adds the MCP report to the reads that must agree
- [x] (and `./promises/store`; the page passes its refresh interval as `cacheMs`, the sidebar's layout uses the five-second default, since importing the refresh reader into the layout pulled Node-only config into the project page's browser test; admin tests 62 files, 406 green) Export `./promises/health` from `apps/indusk-mcp/package.json`; re-point the admin's importers (`app/p/[project]/layout.tsx`, `app/p/[project]/promises/page.tsx`, `components/PromiseHealth.tsx`, `components/bars/labels.ts`) and anything else that imported the two files; the admin's own tests unchanged and green
- [x] (the line is built by `healthLine` in `promises/health`, each read with `cacheMs: 0` so `--every` never repeats a cached read; run on the demo app with no daemon, it printed the local source as could-not-be-read and exited 0) `indusk promises health --json [--every <seconds>]` in `bin/commands/promises.ts`: one line `{ at, sources: [{ name, ok, reason?, rows: [{ promise, state, lastHeld?, lastBroke?, symptom?, traceUrl?, tests }] }] }` per read; without `--every`, one read and exit 0; with it, a read per period until SIGTERM; a source that fails is `ok: false` with its reason, never dropped
- [x] (red at 45c9c0db on its own assertion; it compares the admin's rule, the CLI's line and the agents' report over one read, and passes now for those three) A6 authored from the register, comparing the reader and the CLI (the editor joins in Build Phase 2), red first

#### Build Phase 1 Verification

- [x] (A6 and A7: 4 green; `vitest related` over the moved files and the command: 5 files, 39 green; admin: 62 files, 406 green) A7 passes; A6 is `written` and passes for the reader and the CLI (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promise-health-single-definition.test.ts src/__tests__/promise-health-windows.test.ts && pnpm exec vitest related src/lib/promises/health.ts src/lib/promises/store.ts --run`; `cd ../indusk-admin && pnpm exec vitest related src/app src/components --run`)
- [x] `pnpm exec tsc --noEmit` clean in both apps

#### Build Phase 1 Context

- [x] (points at the ADR until the retrospective publishes the decisions page; to make room, the "Admin plan authoring" line moved down to the admin's own context file) root (Key Decisions): `- VS Code extension: promise health is worked out once in the package (promises/health); the CLI streams it (promises health --json); the editor only shows — see /decisions/vscode-extension` — always-on because it fixes where health lives for every window, present and future
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
- [x] (folded into the pins list; the redundant pointer to `src/lib/papers/CLAUDE.md` came out to make room, since that file loads by itself) mcp (`apps/indusk-mcp/CLAUDE.md`, single-definition pins): `promises/health` — `promise-health-single-definition.test.ts`, folded into an existing entry so the file does not grow

#### Build Phase 1 Document

- [x] (the admin's health is described in `reference/admin-ui/overview.md`, not a separate promises page; that is where the moved module is named) `reference/cli/promises.md`: `promises health --json`, its line shape and `--every`; `reference/admin-ui/promises.md`: health comes from the package's `promises/health`; changelog: Added `promises health --json`, Changed health moved to the package

### Build Phase 2: The extension's core

**Goal**: everything the editor shows, decided by pure functions over a file, the registry, a health line and a clock.

- [x] (done before the tests, which need the app to run; `type: commonjs` for VS Code's loader; the health line gained a `promises` list so the editor never reads the registry, and the package a `./tokens` subpath) `apps/vscode-extension/` scaffold: `package.json` (`name: indusk`, `publisher: infinitedusky`, `engines.vscode: ^1.90.0`, `activationEvents: ["workspaceContains:.indusk/config.json"]`), `tsconfig.json`, `vitest.config.ts` extending the root's, biome inherited; added to the workspace
- [x] (a local break beside a production that holds is shown on the line too: "holding, broken (local)") `src/core/markers.ts` — token lines through the package's `lib/tokens.ts` (bundled, never re-spelled); "keeps" or "proves" by the registry's `tests:` paths
- [x] (the Problems list is `problems(session)` in `session.ts`, beside the breaks it lists, not a file of its own) `src/core/hover.ts`, `src/core/problems.ts`
- [x] (a reducer — `startSession`, `onLine`, `onTick`, `problems` — rather than one `readSession`, so the extension feeds each line and tick as it arrives) `src/core/session.ts` — `readSession(lines, clock)`: the current state per promise and source, new breaks to notify once, cleared breaks, "not reading" after two cadences without a line
- [x] (the prompt names incident-recording's `record_breaks` tool and `indusk promises watch`, both on main; it is one single-quoted shell word whatever the symptom holds) `src/core/fix.ts` — the fix action: the prompt (promise, symptom, trace link, tests, and "record the incident with `indusk promises watch` and fix it under its owning plan"), quoted for the shell; the install message when `claude` is absent
- [x] (red at e5711393, eleven failures on their own calls; green at 48b57d17. A6's editor half is `src/core/same-health.test.ts`: the package cannot import the editor's core, so the extension checks its words against the admin's states over the package's own line) A1–A4, A8–A10, A12, A13, A15 authored from the register, red first; A6 gains the editor's read and goes green

#### Build Phase 2 Verification

- [x] (extension: 5 files, 12 green; the package's half of A6 green) A1–A4, A6, A8–A10, A12, A13, A15 pass (`cd apps/vscode-extension && pnpm exec vitest run`; `cd ../indusk-mcp && pnpm exec vitest run src/__tests__/promise-health-windows.test.ts`)
- [x] `pnpm exec tsc --noEmit` and biome clean in `apps/vscode-extension`

#### Build Phase 2 Context

- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
- [x] `apps/vscode-extension/CLAUDE.md` (new, small): the core is pure and every editor rule is tested there; `extension.ts` only applies it; nothing writes to the project; tokens come from the package's grammar

#### Build Phase 2 Document

- [x] (in the guide sidebar beside "Run your own server"; the install section is Build Phase 3's) `guide/promises-in-your-editor.md` (first version): what the markers, hovers, Problems entries and notifications mean; the Mermaid sequence from break to Claude

### Build Phase 3: VS Code, the package, the install

**Goal**: the core applied in VS Code, packaged, shipped in the npm package, installed by one command.

- [x] `src/extension.ts` — activation; the `indusk promises health --json --every 5` child (restarted once, then reported); `TextEditorDecorationType` markers, a `HoverProvider`, a `DiagnosticCollection`, one `showWarningMessage` per new break, a `CodeActionProvider` "Fix with Claude" running `window.createTerminal({ cwd, name: "Claude — <promise>" })` + `sendText`; a test hook exposing the current decorations for the e2e
- [x] esbuild bundle to `dist/extension.js`; `@vscode/vsce package` to `dist/indusk.vsix` (`pnpm --filter indusk package`); indusk-mcp `prepublishOnly` copies it to `editor/indusk.vsix`, listed in `files`
- [x] `indusk editor install` (`bin/commands/editor.ts`): `code --install-extension <vsix> --force`, and `cursor …` when Cursor's CLI is found; says which it installed into, and how to get VS Code's `code` command when neither is found
- [x] A16 authored (system tier); A5, A11, A14 authored in `e2e/live.e2e.test.ts`, `written`, skipped by name without `INDUSK_LIVE_EDITOR=1`
- [x] Shape: move "which source's break does the fix act on, and with what facts" out of `extension.ts` into the core as `fixFor(view, promise, opts)` in `core/fix.ts`, with a case in `fix.test.ts` — rule: the ADR's pure core / thin layer split (a rule in the VS Code layer has no unit seam)
- [x] Shape: closing the window kills the health child and its exit handler restarts it; a `stopping` flag set on dispose stops the restart — rule: one reason to change per handler (exit-on-failure vs exit-on-dispose)

#### Build Phase 3 Verification

- [x] (3 of 3 passed, 2026-10-08; two fixes the run found: a VS Code terminal exports `ELECTRON_RUN_AS_NODE`, which starts the test VS Code as plain Node, and a worktree path makes VS Code's socket longer than macOS allows, so the test clears the one and passes a short `--user-data-dir`) A16 passes in the system tier on this machine (`cd apps/vscode-extension && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/install.contract.test.ts`, VS Code 1.141); A5, A11, A14 `written`

#### Build Phase 3 Context

- [x] mcp (`apps/indusk-mcp/CLAUDE.md`, Releases): the `.vsix` is built by `prepublishOnly` and shipped in `editor/`; folded into the existing entry

#### Build Phase 3 Document

- [x] `reference/cli/editor.md` (new); the guide's install section; changelog: Added the VS Code extension and `indusk editor install`

### Build Phase 4: Live on the demo app

**Goal**: the three live checks and Cursor, run once by hand and recorded.

- [x] (run 2026-10-08 against the demo app from `indusk demo`, VS Code 1.141, the extension from `indusk editor install --extensions-dir`, and this branch's CLI named by `INDUSK_LIVE_EDITOR_COMMAND` instead of `pnpm install:local`, so the machine's `indusk` was left alone. **A5**: `src/telemetry.ts` line 7 ended `a-held-seat-is-released-in-time · not seen` before any run. **A11**: broken (local) **5.3 s** after the late release was marked; 14.9 s after the hold, of which 9.5 s is the demo's own window plus its fault delay. The probe first timed from the hold, which charged the app's deliberate delay to the editor; it now starts the clock when the seat comes free. **A14**: the `Claude — a-held-seat-is-released-in-time` terminal opened with the command sent. The run also needed A16's two launch fixes.) A5, A11, A14: `pnpm install:local`, `indusk editor install`, the demo app started (`indusk demo`), `INDUSK_LIVE_EDITOR=1 pnpm exec vitest run --config vitest.e2e.config.ts e2e/live.e2e.test.ts`; record each result and A11's seconds in this file
- [x] (scripted, not by hand, 2026-10-08: the same live probe with `INDUSK_LIVE_EDITOR_APP=/Applications/Cursor.app/Contents/MacOS/Cursor` passed. `indusk editor install` found `cursor` and installed into it; the marker read `· broken (local)` on line 7 and Fix with Claude opened its terminal. The break's timing was not measured in Cursor, because the promise was already broken from the VS Code run. Cursor printed `UserNotLoggedInError` for its own account, which did not affect the extension.) U1: install into Cursor by hand, open the demo app, confirm the marker and the fix action; record it here
- [x] Shape — reviewed the files this phase changed (`e2e/live.e2e.test.ts`, `e2e/live-probe.cjs`) against the enabled extensions' craft rules; nothing to change.

#### Build Phase 4 Verification

- [x] A5, A11, A14 pass and are recorded above; the row states set `passing` in the same edit

#### Build Phase 4 Context

- [x] (committed on main as c62d5c68) current.md (Project, shared): one line — the demo's step 9 is built; how long a break took to reach the editor

#### Build Phase 4 Document

- [x] the guide: an "Observed" note with A11's seconds and the Cursor result, dated

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/{health,store}.ts` | moved from the admin |
| `apps/indusk-mcp/package.json` | `./promises/health` export; `editor/` in `files`; `prepublishOnly` copies the `.vsix` |
| `apps/indusk-mcp/src/bin/commands/{promises,editor}.ts`, `src/bin/cli.ts` | `promises health --json`, `editor install` |
| `apps/indusk-admin/src/**` | four importers re-pointed; two lib files removed |
| `apps/vscode-extension/**` | new app |
| `apps/docs/src/**` | guide, references, changelog |
| `CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, `apps/vscode-extension/CLAUDE.md`, `.indusk/current.md` | context |

## Dependencies

- VS Code 1.141 with `code` on PATH (present); Cursor for U1
- `@vscode/vsce` and `@vscode/test-electron` (current: 4.0.0, 3.1.0), esbuild (already in the workspace or added)
- incident-recording landed, so the fix prompt names the command that records a break

## Notes

- A6 spans two phases on purpose: written in Build Phase 1 for the reader and the CLI, green in Build Phase 2 when the editor's read joins.
- The Key Decisions line is Build Phase 1's Context item, written with the code, since `plans approve` refuses a branch that changed anything outside `.indusk/` before its build.

---
title: "The admin knows the package root"
date: 2026-10-19
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
cleanup: skipped
cleanup_reason: "Reviewed changed files; small and cohesive, two env-stripping spots are below the rule of three."
approved_brief: "39098b5e39510b2e3e1d2680ff5c09bf659cce5f193d622480c0df92a5ea6988"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T13:15:24.800Z"
---

# The admin knows the package root

## Goal

Code running inside the admin daemon finds the package's shipped files, because the `indusk` command that starts the daemon hands down the package root it resolved, and `induskMcpPackageRoot()` trusts that value when it holds this package. The unattended planning run then ends "ready for approval" instead of "cannot continue".

## Scope

### In Scope

- `induskMcpPackageRoot()` (`lib/package-root.ts`) reads a handed root from the environment first, trusts it only if a `package.json` named `@infinitedusky/indusk-mcp` sits there, and otherwise walks up from its own location as before.
- `daemonStart` (`lib/admin/daemon.ts`) puts the root into the daemon's environment beside `INDUSK_PROJECT_ROOT`; `indusk ui` (`bin/commands/ui.ts`) passes the root it resolves.
- A line in the package's `CLAUDE.md` and a changelog line.

### Out of Scope

- Changing any caller of `induskMcpPackageRoot()` (`read-planning.ts` and the rest keep asking the one lookup).
- The daemon started by `indusk demo` (`bin/commands/demo.ts` calls the telemetry daemon's `daemonStart`, a different function); the admin daemon has one starter, `indusk ui`.
- Making the bundler stop rewriting a module's own location.

Decisions made unattended (`INDUSK_GATE_POLICY=auto`), each with its reason:

1. **The variable is named `INDUSK_MCP_PACKAGE_ROOT`**, exported as `PACKAGE_ROOT_ENV` from `lib/package-root.ts`. The test plan left the name to this impl; a named constant means the daemon and the lookup cannot drift apart, and the name says which package it points at.
2. **`indusk ui` passes the root; `daemonStart` does not resolve it itself.** `daemonStart` stays a function of its options, so its environment is a pure unit test (A1) with no real package lookup; `ui.ts` already supplies `adminDir` and `nextBin` the same way.
3. **The environment is built by a new pure function `daemonEnv(opts, base)`** in `lib/admin/daemon.ts`, called by `daemonStart`. The test plan's A1 needs the environment observable without spawning a daemon; `spawn` cannot be inspected without one.
4. **A2 and A3 are slow-tier live checks**, as the test plan decided, and A2 is its own row: its check reads the running daemon's environment and log after `indusk ui`, which needs no planning run. Reason for keeping it separate rather than folding into A3: it fails on the lookup alone, while A3 can fail for other reasons.
5. **Tiers**: every phase takes the step's default (`med` for the work step, per `.indusk/config.json`); nothing here edits a gate or a hook.
6. **No OTel gate**: the project's `otel.role` is `library`.
7. **No audit, falsify or cleanup waiver is written here**; those are the person's to decide at approval of the build.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Failing tests for the handed root and the unchanged fallbacks; the recorded body of the daemon-environment test | The test plan's assertions |
| Build Phase 1 | `PACKAGE_ROOT_ENV`, the trusted-handed-root lookup, `daemonEnv`, the `ui` hand-off, the live-check procedure | The tests from Test Phase 1 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | The admin daemon's environment names the package root the `indusk` command passed, beside the project root, and leaves it out when none is passed | Build Phase 1 | Build Phase 1 | passing | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/admin/daemon-env.test.ts |
| T2 | With no handed root, the lookup finds the package root from where the code sits, exactly as before | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over the lookup every CLI path relies on (demo, worktree, plan start) | apps/indusk-mcp/src/lib/package-root.test.ts |
| T3 | A handed root that holds this package is returned instead of the folder found from the module's own location | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/package-root.test.ts |
| T4 | A handed root that is empty, holds no package, or holds another package is ignored and the lookup falls back to finding the root from where the code sits | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: a stale environment value must never beat a correct lookup | apps/indusk-mcp/src/lib/package-root.test.ts |
| T5 | The planning reader still names the impl hook through the package-root lookup, not through `"node"` or a path built from its own location | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard (`read-planning-hook-path.test.ts`): the fix goes through the same lookup, not around it | apps/indusk-mcp/src/lib/build/read-planning-hook-path.test.ts |
| T6 | Inside the admin as started by `indusk ui`, the lookup returns the folder holding the shipped impl hook, not `.../apps/apps/indusk-mcp/dist/lib` | Build Phase 1 | Build Phase 1 | skipped | live check | promise: an-accepted-brief-is-planned-unasked | manual: build the admin, restart it with `indusk ui restart`, read the daemon's environment (`ps eww <pid>`) for the package root and its log (`~/.indusk/admin-ui.log`) for no lookup error naming `apps/apps` |
| T7 | A planning run over an accepted brief, in the admin as started by `indusk ui`, ends "ready for approval" instead of "cannot continue" | Build Phase 1 | Build Phase 1 | skipped | live check | promise: an-accepted-brief-is-planned-unasked | manual: after landing and `pnpm install:local`, run `indusk ui restart`, start a planning run over an accepted brief, read the run's stop reason in the admin |
| T8 | A Claude session the admin starts does not inherit the handed package root, so an `indusk` running inside it (its MCP server, its CLI calls) finds its own install, not the install that started the admin | Build Phase 2 | Build Phase 2 | passing | unit | a regression guard: a handed value must never beat a correct lookup (T4's purpose), carried to the admin's sessions | apps/indusk-mcp/src/lib/session/start-env.test.ts |

(T1 to T7 are the test plan's A1 to A6 with the live check split: A1 is T1, A4 is T2, A5 is T4, A6 is T5, A2 is T6, A3 is T7, and T3 is the positive half of A1's hand-down that the lookup must honour.)

### Deferred Verification

- **T6 and T7, the live checks**
  - reason: the bug exists only in the bundler's output, so a unit test over the source cannot reproduce it; the checks need a built admin bundle and a running daemon.
  - would require: a test that builds the admin and starts a real daemon in a temporary home, which is the slow tier's to run, never a gate on landing or release (`/decisions/release-checks-run-once`).
  - mitigation: the planning run's stop reason on the next unattended plan; a "cannot continue" naming the package-root lookup breaks `an-accepted-brief-is-planned-unasked` and shows as a broken promise.

## Checklist

### Test Phase 1: Author the tests that can fail today

**Tier**: med — the work step's default

This phase writes the tests of the package-root lookup so the one that asks for a handed root fails on its own assertion, and the two that guard the existing fallback pass from the start. It hands the next phase a red test to make green and the recorded body of the daemon-environment test, which cannot load until the next phase adds the function it imports.

- [x] Write the tests of the package-root lookup in a new file beside it.
  <details><summary>Technical</summary>

  Create `apps/indusk-mcp/src/lib/package-root.test.ts`. Use a temporary directory and set `process.env.INDUSK_MCP_PACKAGE_ROOT` (a string literal, so the file loads today); restore the variable after each test. T2: variable unset → result equals the folder holding `apps/indusk-mcp/package.json` (`join(import.meta.dirname, "..", "..")`). T3: write `package.json` `{"name":"@infinitedusky/indusk-mcp"}` into a temporary folder, set the variable to it → result is that folder (red today: the lookup ignores the variable). T4, with `it.each`: variable `""`, a folder with no `package.json`, a folder whose `package.json` is named `other` → result equals T2's folder. Header comment names `promise: an-accepted-brief-is-planned-unasked` once, on T3's test name.

  </details>
- [x] Confirm the existing guard of the planning reader's hook path passes untouched.
  <details><summary>Technical</summary>

  T5: `read-planning-hook-path.test.ts` already exists and passes; change nothing, run it.

  </details>
- [x] Make sure no test fails only because a file or function it loads is missing.
  <details><summary>Technical</summary>

  T3 must fail on `expect(...).toBe(handed)`, not on an import; T2, T4, T5 pass. The daemon-environment test is deferred below because `daemonEnv` does not exist yet.

  </details>

#### Deferred to Build Phase 1

- **T1** — its subject, `daemonEnv`, is introduced by Build Phase 1, so a file written now would fail to load rather than fail an assertion. Body reviewed:

  ```typescript
  // apps/indusk-mcp/src/lib/admin/daemon-env.test.ts
  // promise: an-accepted-brief-is-planned-unasked
  import { expect, it } from "vitest";
  import { daemonEnv } from "./daemon.js";
  import { PACKAGE_ROOT_ENV } from "../package-root.js";

  const opts = { port: 1, adminDir: "/a", nextBin: "/n" };

  it("T1 hands down the package root beside the project root", () => {
    const env = daemonEnv({ ...opts, packageRoot: "/pkg", projectRoot: "/proj" }, { KEEP: "1" });
    expect(env[PACKAGE_ROOT_ENV]).toBe("/pkg");
    expect(env.INDUSK_PROJECT_ROOT).toBe("/proj");
    expect(env.KEEP).toBe("1");
  });

  it("T1 leaves the variable out when no root is passed, keeping an inherited one out too", () => {
    const env = daemonEnv(opts, { [PACKAGE_ROOT_ENV]: "/stale" });
    expect(env[PACKAGE_ROOT_ENV]).toBeUndefined();
  });
  ```

  The second test pins that a daemon started without a root does not inherit a stale value from the starting shell.
- **T6, T7** — live checks that exist only as the manual procedure in the trajectory table; they run in the slow tier after landing and no file can be authored.

#### Regression Guards

- **T2** — passes the moment it is written: it pins the walk-up behaviour the fix must leave alone, so it has no red phase.
- **T4** — passes the moment it is written for the same reason (today the variable is ignored entirely); it guards the trust check the fix adds.
- **T5** — an existing passing test, run unchanged.

#### Test Phase 1 Verification

- [x] The new package-root tests exist, the handed-root test fails on its own assertion, and the guards pass.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/package-root.test.ts src/lib/build/read-planning-hook-path.test.ts`: T3 red on its `toBe`, T2, T4, T5 green.

  </details>
- [x] The deferred daemon-environment test body above has been read and judged.
  <details><summary>Technical</summary>

  Reviewed against both questions: it compiles once `daemonEnv`, `PACKAGE_ROOT_ENV` and the `packageRoot` option exist (Build Phase 1), and each test asserts what its name claims. `lib/admin/daemon-env.test.ts` does not start a process, so it needs no `vitest.tiers.ts` entry.

  </details>

#### Test Phase 1 Context

- [x] Record nothing new yet.
  <details><summary>Technical</summary>

  The rule this plan adds is written in Build Phase 1, where the code that enforces it lands.

  </details>

#### Test Phase 1 Document

- [x] Write nothing in the docs yet.
  <details><summary>Technical</summary>

  The changelog line is written in Build Phase 1 with the code.

  </details>

### Build Phase 1: Hand the package root down to the admin

**Tier**: med — the work step's default

This phase makes the command that starts the admin pass the package root it resolved into the daemon's environment, and makes the shared lookup trust that value when it really holds this package. It ends by writing the daemon-environment test deferred from the first phase and recording how the two live checks run once the build is installed.

- [x] Make the package-root lookup use a root handed through the environment when it holds this package.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/package-root.ts`: export `PACKAGE_ROOT_ENV = "INDUSK_MCP_PACKAGE_ROOT"`; split the existing name check into `holdsThisPackage(dir: string): boolean` (reads `join(dir, "package.json")`, true only for name `@infinitedusky/indusk-mcp`, false on a missing file or a parse error); in `induskMcpPackageRoot()` check `const handed = process.env[PACKAGE_ROOT_ENV]; if (handed && holdsThisPackage(handed)) return handed;` before the walk-up, which then uses `holdsThisPackage` too. Update the docblock to say why: the admin's bundler rewrites the module's own location. T2, T3, T4.

  </details>
- [x] Put the package root into the admin daemon's environment through one function.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/admin/daemon.ts`: add `packageRoot?: string` to `DaemonStartOptions`; export

  ```typescript
  export function daemonEnv(
  	opts: DaemonStartOptions,
  	base: NodeJS.ProcessEnv = process.env,
  ): NodeJS.ProcessEnv {
  	const { [PACKAGE_ROOT_ENV]: _stale, ...inherited } = base;
  	return {
  		...inherited,
  		...(opts.projectRoot ? { INDUSK_PROJECT_ROOT: opts.projectRoot } : {}),
  		...(opts.packageRoot ? { [PACKAGE_ROOT_ENV]: opts.packageRoot } : {}),
  	};
  }
  ```

  and make `spawn` use `env: daemonEnv(opts)`. Import `PACKAGE_ROOT_ENV` from `../package-root.js`. The stale value is dropped from the inherited environment so a daemon started without a root never inherits one from the starting shell. T1.

  </details>
- [x] Make the command that starts the admin pass the package root it resolved.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/bin/commands/ui.ts` (the call at `daemonStart({ port, adminDir, nextBin })`): add `packageRoot: induskMcpPackageRoot()` and the import from `../../lib/package-root.js`. A daemon started by the `indusk` command thus carries the root the command found correctly.

  </details>
- [x] Write the daemon-environment test deferred from the first phase.
  <details><summary>Technical</summary>

  Create `apps/indusk-mcp/src/lib/admin/daemon-env.test.ts` with the reviewed body from "Deferred to Build Phase 1" (T1).

  </details>
- [x] Rebuild and confirm the admin's production bundle still builds.
  <details><summary>Technical</summary>

  `pnpm --filter indusk-admin build` succeeds; the change touches only the package's own modules, but the bundler is the subject of the bug. Run the live checks T6 and T7 per their rows after landing and `pnpm install:local`, and record each result in the retrospective; they are slow-tier and never a gate.

  </details>
- [x] Shape — review the changed functions for craft; nothing is assumed needed.
  <details><summary>Technical</summary>

  `package-root.ts` and `daemon.ts`: one definition of "holds this package" (`holdsThisPackage`), no second name check anywhere.

  </details>

#### Build Phase 1 Verification

- [x] The lookup honours a trusted handed root and ignores a wrong one; the daemon's environment names the root; the earlier guards still pass.
  <details><summary>Technical</summary>

  T1, T2, T3, T4, T5 pass: `indusk plans tests the-admin-knows-the-package-root --phase "Build Phase 1"` (the rows' files and the Must-not-break promise's tests). The package's type check and `pnpm check` on the changed files are clean.

  </details>
- [x] The two live checks are written down and wait for the installed build.
  <details><summary>Technical</summary>

  T6 and T7 stay in `skipped` state with their manual procedure in the trajectory table (slow tier, after landing).

  </details>

#### Build Phase 1 Context

- [x] Add the rule that the admin is handed the package root to the package's context file.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, One home per fact: extend the existing entry on code the admin bundles — `induskMcpPackageRoot()` trusts a root handed through `INDUSK_MCP_PACKAGE_ROOT` (set by `indusk ui` in `daemonEnv`) only when it holds this package, because the bundler rewrites a module's own location. Guard: `package-root.test.ts` (T3, T4) and `daemon-env.test.ts` (T1), so the rule is delivered by the tests; the line is one more clause on an existing bullet, not a new always-on entry.

  </details>

#### Build Phase 1 Document

- [x] Add a changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md` unreleased: the admin is started with the package root, so a planning run inside it reaches "ready for approval".

  </details>


Unattended decisions in this phase: `pnpm biome check --write` over `src/lib` touched two unrelated files; reverted them so the commit holds only this plan's changes. Shape review: `package-root.ts` and `daemon.ts` have one `holdsThisPackage` and one `daemonEnv`; reviewed, nothing found. The live checks T6 and T7 stay skipped for the slow tier after landing.

### Build Phase 2: Falsification — the handed root reaches past the admin, and the live checks read an old admin

**Tier**: med — the work step's default

The handed package root is meant for the admin's own bundled code, but today every Claude session the admin starts inherits it too, and inside such a session the `indusk` on the path trusts it whenever it names any copy of this package, even a different install from the one that session runs. This phase stops the admin's sessions from inheriting the value, so only the admin itself reads it, and corrects the two live checks so they restart the admin instead of reading one left running from before the upgrade. Once it closes, a handed root can only ever answer for the code it was handed to.

- [x] Stop the sessions the admin starts from inheriting the handed package root.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/session/start.ts:88` builds the session's environment as `{ ...process.env, ...opts.env }`, so the admin daemon's `INDUSK_MCP_PACKAGE_ROOT` reaches the spawned `claude`, its `indusk serve` MCP server (the `indusk` on PATH, per `.mcp.json`) and every `indusk` it runs. Those are not bundled — their own walk-up is correct — but `induskMcpPackageRoot()` checks the handed root first and its trust check (`holdsThisPackage`) only compares the package name, so a different install passes. Concrete failure: the admin started by one install (`node <worktree>/apps/indusk-mcp/dist/bin/cli.js ui`, or a global install while PATH resolves another) → the session's `indusk plans start`, `scaffold/apply`, `draft.ts` copy of `skills/planner.md` read templates, skills and hooks from the starting install, not their own. Add a pure `sessionEnv(base: NodeJS.ProcessEnv, extra?: Record<string, string>)` in `start.ts` that drops `PACKAGE_ROOT_ENV` (imported from `../package-root.js`) from `base` and then spreads `extra`; `spawn` uses `env: sessionEnv(process.env, opts.env)`. A caller passing the variable explicitly in `opts.env` keeps it (deliberate, not inherited). Answers T8.

  </details>
- [x] Make the two live checks restart the admin before they read it.
  <details><summary>Technical</summary>

  `uiStart` (`bin/commands/ui.ts:83-90`) returns early when a daemon is already running, reusing it — its old bundle and its old environment, without the variable. The T6 and T7 procedures say "run `indusk ui`" after `pnpm install:local`; on a machine where the admin was already up (the normal case), they read the pre-fix daemon and report the bug still present. Change both rows' `Test` column to `indusk ui restart` (which calls `uiStop` then `uiStart`). Only the manual command changes; the rows' assertions and states are untouched — decided unattended: this corrects how the check is run, not what it claims, so it is not goalpost drift.

  </details>

#### Build Phase 2 Verification

- [x] A session started by the admin carries no inherited package root and keeps everything else, failing today and passing after the fix.
  <details><summary>Technical</summary>

  T8: `apps/indusk-mcp/src/lib/session/start-env.test.ts` — `sessionEnv({ [PACKAGE_ROOT_ENV]: "/other", KEEP: "1" })` has no `PACKAGE_ROOT_ENV` and keeps `KEEP`; `sessionEnv(base, { X: "y" })` adds `X`; an explicit `opts.env` value for the variable is kept. Writable at Build Phase 2, not Phase 0: its subject `sessionEnv` does not exist, and testing through `startSession` would spawn a process (a system test, `vitest.tiers.ts`), which this pure function avoids. Run `indusk plans tests the-admin-knows-the-package-root --phase "Build Phase 2"`; T1 to T5 stay green.

  </details>
- [x] The two live checks' procedures restart the admin.
  <details><summary>Technical</summary>

  `grep -n "indusk ui restart" .indusk/planning/the-admin-knows-the-package-root/impl.md` shows both the T6 and T7 rows; they stay `skipped` for the slow tier.

  </details>

#### Build Phase 2 Context

- [x] Add to the package's rule on the handed root that the admin's sessions do not inherit it.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, One home per fact, the existing bullet on code the admin bundles: append "and `sessionEnv` (`lib/session/start.ts`) drops it from the sessions the admin starts, whose own lookup is correct" and add `start-env.test.ts` to its guards. One clause on an existing bullet, delivered by the test.

  </details>

#### Build Phase 2 Document

- [x] (none needed — the changelog line from Build Phase 1 already describes the user-visible fix; keeping the value out of the admin's sessions changes nothing a reader of the docs would see)

#### Build Phase 2 hunt record

Decided unattended (`INDUSK_GATE_POLICY=auto`): the Notes' assumption that everything the daemon spawns "runs from the same install" was tested and found not guaranteed — the admin's starter and the `indusk` on PATH are independent — so the fix narrows the value to the one process that needs it rather than tightening the trust check (a version comparison would still let a same-version dev build and global install trade files).

Searched without a hypothesis forming:
- **Every admin-daemon starter**: `daemonStart` has one caller, `uiStart`; `uiRestart` goes through it; `indusk demo` calls the telemetry daemon's `daemonStart`, a different function.
- **`daemonEnv`**: strips an inherited value, passes `projectRoot` and `packageRoot` only when given; `ui.ts` resolves the root in the CLI process, whose walk-up is correct and absolute.
- **`holdsThisPackage`**: missing file, unreadable JSON and a wrong name all read false; the walk-up's bound and the throw are unchanged.
- **The lookup's timing**: the variable is read per call, not at module load, so no import-order hazard.
- **Other spawns from the admin**: `read-planning.ts` runs the impl hook with `process.execPath`, and `new-project/create.ts` runs this package's own `cli.js` — both from the same install, where the value is correct or ignored.

Not investigated, with reasons:
- **Whether Turbopack inlines `process.env[PACKAGE_ROOT_ENV]` at build time**: only a built bundle can answer it; T6, the live check reading the running daemon, is the test that would catch it.
- **A relative handed path**: only `daemonEnv` sets the variable, from an absolute lookup, and it strips any inherited value; nothing in the plan's paths produces a relative one.
- **The admin started by `next dev`**: out of this plan's scope — the bug is in the production bundle, and the dev server is never started by `indusk`.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/package-root.ts` | `PACKAGE_ROOT_ENV`, `holdsThisPackage`, the trusted handed-root check first |
| `apps/indusk-mcp/src/lib/admin/daemon.ts` | `packageRoot` option, `daemonEnv`, `spawn` uses it |
| `apps/indusk-mcp/src/bin/commands/ui.ts` | passes `packageRoot: induskMcpPackageRoot()` |
| `apps/indusk-mcp/src/lib/package-root.test.ts` | new: T2, T3, T4 |
| `apps/indusk-mcp/src/lib/admin/daemon-env.test.ts` | new: T1 |
| `apps/indusk-mcp/src/lib/session/start.ts` | `sessionEnv` drops the handed root from the sessions the admin starts (Build Phase 2) |
| `apps/indusk-mcp/src/lib/session/start-env.test.ts` | new: T8 (Build Phase 2) |
| `apps/indusk-mcp/CLAUDE.md` | one clause on the existing admin/package-root entry |
| `apps/docs/src/changelog.md` | unreleased line |

## Dependencies

- The bugfix brief is accepted and the test plan is drafted; nothing else must exist first.
- The live checks need an installed build (`pnpm install:local` after landing) and an accepted brief to run a planning step over.

## Notes

- Open, decided: whether A2 can run without a full admin build was left to this impl; it cannot read the bundle's behaviour from source, so T6 reads the running daemon's environment and log instead and needs the build installed.
- The variable is inherited by anything the daemon spawns (the planning session's `claude`, hooks); that is intended — they run from the same install — and the trust check means a stale value is ignored.

## Cleanup review

Decided unattended (`INDUSK_GATE_POLICY=auto`): no Cleanup Phase, `cleanup: skipped`.

- `package-root.ts` (the `holdsThisPackage` helper already lifted out of the walk-up loop), `daemon.ts` (`daemonEnv`), `start.ts` (`sessionEnv`): each a few lines, one responsibility, under the cleanup cap; all three changed sources are small edits to existing files.
- Cross-file duplication: `daemonEnv` and `sessionEnv` both destructure `PACKAGE_ROOT_ENV` out of an environment. Two copies of a one-line destructure with different follow-ups; a shared helper would be the wrong abstraction and the rule of three is not met. Left as-is.
- The three test files (`package-root.test.ts`, `daemon-env.test.ts`, `start-env.test.ts`) are each one subject, 18–46 lines; nothing to merge.
- Not reviewed: docs and CLAUDE.md edits (prose, one clause each).


---
title: "The admin knows the package root"
date: 2026-10-19
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
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
| T1 | The admin daemon's environment names the package root the `indusk` command passed, beside the project root, and leaves it out when none is passed | Build Phase 1 | Build Phase 1 | planned | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/admin/daemon-env.test.ts |
| T2 | With no handed root, the lookup finds the package root from where the code sits, exactly as before | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard over the lookup every CLI path relies on (demo, worktree, plan start) | apps/indusk-mcp/src/lib/package-root.test.ts |
| T3 | A handed root that holds this package is returned instead of the folder found from the module's own location | Test Phase 1 | Build Phase 1 | planned | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/package-root.test.ts |
| T4 | A handed root that is empty, holds no package, or holds another package is ignored and the lookup falls back to finding the root from where the code sits | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard: a stale environment value must never beat a correct lookup | apps/indusk-mcp/src/lib/package-root.test.ts |
| T5 | The planning reader still names the impl hook through the package-root lookup, not through `"node"` or a path built from its own location | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard (`read-planning-hook-path.test.ts`): the fix goes through the same lookup, not around it | apps/indusk-mcp/src/lib/build/read-planning-hook-path.test.ts |
| T6 | Inside the admin as started by `indusk ui`, the lookup returns the folder holding the shipped impl hook, not `.../apps/apps/indusk-mcp/dist/lib` | Build Phase 1 | Build Phase 1 | skipped | live check | promise: an-accepted-brief-is-planned-unasked | manual: build the admin, start it with `indusk ui`, read the daemon's environment (`ps eww <pid>`) for the package root and its log (`~/.indusk/admin-ui.log`) for no lookup error naming `apps/apps` |
| T7 | A planning run over an accepted brief, in the admin as started by `indusk ui`, ends "ready for approval" instead of "cannot continue" | Build Phase 1 | Build Phase 1 | skipped | live check | promise: an-accepted-brief-is-planned-unasked | manual: after landing and `pnpm install:local`, run `indusk ui`, start a planning run over an accepted brief, read the run's stop reason in the admin |

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

- [ ] Write the tests of the package-root lookup in a new file beside it.
  <details><summary>Technical</summary>

  Create `apps/indusk-mcp/src/lib/package-root.test.ts`. Use a temporary directory and set `process.env.INDUSK_MCP_PACKAGE_ROOT` (a string literal, so the file loads today); restore the variable after each test. T2: variable unset → result equals the folder holding `apps/indusk-mcp/package.json` (`join(import.meta.dirname, "..", "..")`). T3: write `package.json` `{"name":"@infinitedusky/indusk-mcp"}` into a temporary folder, set the variable to it → result is that folder (red today: the lookup ignores the variable). T4, with `it.each`: variable `""`, a folder with no `package.json`, a folder whose `package.json` is named `other` → result equals T2's folder. Header comment names `promise: an-accepted-brief-is-planned-unasked` once, on T3's test name.

  </details>
- [ ] Confirm the existing guard of the planning reader's hook path passes untouched.
  <details><summary>Technical</summary>

  T5: `read-planning-hook-path.test.ts` already exists and passes; change nothing, run it.

  </details>
- [ ] Make sure no test fails only because a file or function it loads is missing.
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

- [ ] The new package-root tests exist, the handed-root test fails on its own assertion, and the guards pass.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/package-root.test.ts src/lib/build/read-planning-hook-path.test.ts`: T3 red on its `toBe`, T2, T4, T5 green.

  </details>
- [ ] The deferred daemon-environment test body above has been read and judged.
  <details><summary>Technical</summary>

  Reviewed against both questions: it compiles once `daemonEnv`, `PACKAGE_ROOT_ENV` and the `packageRoot` option exist (Build Phase 1), and each test asserts what its name claims. `lib/admin/daemon-env.test.ts` does not start a process, so it needs no `vitest.tiers.ts` entry.

  </details>

#### Test Phase 1 Context

- [ ] Record nothing new yet.
  <details><summary>Technical</summary>

  The rule this plan adds is written in Build Phase 1, where the code that enforces it lands.

  </details>

#### Test Phase 1 Document

- [ ] Write nothing in the docs yet.
  <details><summary>Technical</summary>

  The changelog line is written in Build Phase 1 with the code.

  </details>

### Build Phase 1: Hand the package root down to the admin

**Tier**: med — the work step's default

This phase makes the command that starts the admin pass the package root it resolved into the daemon's environment, and makes the shared lookup trust that value when it really holds this package. It ends by writing the daemon-environment test deferred from the first phase and recording how the two live checks run once the build is installed.

- [ ] Make the package-root lookup use a root handed through the environment when it holds this package.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/package-root.ts`: export `PACKAGE_ROOT_ENV = "INDUSK_MCP_PACKAGE_ROOT"`; split the existing name check into `holdsThisPackage(dir: string): boolean` (reads `join(dir, "package.json")`, true only for name `@infinitedusky/indusk-mcp`, false on a missing file or a parse error); in `induskMcpPackageRoot()` check `const handed = process.env[PACKAGE_ROOT_ENV]; if (handed && holdsThisPackage(handed)) return handed;` before the walk-up, which then uses `holdsThisPackage` too. Update the docblock to say why: the admin's bundler rewrites the module's own location. T2, T3, T4.

  </details>
- [ ] Put the package root into the admin daemon's environment through one function.
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
- [ ] Make the command that starts the admin pass the package root it resolved.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/bin/commands/ui.ts` (the call at `daemonStart({ port, adminDir, nextBin })`): add `packageRoot: induskMcpPackageRoot()` and the import from `../../lib/package-root.js`. A daemon started by the `indusk` command thus carries the root the command found correctly.

  </details>
- [ ] Write the daemon-environment test deferred from the first phase.
  <details><summary>Technical</summary>

  Create `apps/indusk-mcp/src/lib/admin/daemon-env.test.ts` with the reviewed body from "Deferred to Build Phase 1" (T1).

  </details>
- [ ] Rebuild and confirm the admin's production bundle still builds.
  <details><summary>Technical</summary>

  `pnpm --filter indusk-admin build` succeeds; the change touches only the package's own modules, but the bundler is the subject of the bug. Run the live checks T6 and T7 per their rows after landing and `pnpm install:local`, and record each result in the retrospective; they are slow-tier and never a gate.

  </details>
- [ ] Shape — review the changed functions for craft; nothing is assumed needed.
  <details><summary>Technical</summary>

  `package-root.ts` and `daemon.ts`: one definition of "holds this package" (`holdsThisPackage`), no second name check anywhere.

  </details>

#### Build Phase 1 Verification

- [ ] The lookup honours a trusted handed root and ignores a wrong one; the daemon's environment names the root; the earlier guards still pass.
  <details><summary>Technical</summary>

  T1, T2, T3, T4, T5 pass: `indusk plans tests the-admin-knows-the-package-root --phase "Build Phase 1"` (the rows' files and the Must-not-break promise's tests). The package's type check and `pnpm check` on the changed files are clean.

  </details>
- [ ] The two live checks are written down and wait for the installed build.
  <details><summary>Technical</summary>

  T6 and T7 stay in `skipped` state with their manual procedure in the trajectory table (slow tier, after landing).

  </details>

#### Build Phase 1 Context

- [ ] Add the rule that the admin is handed the package root to the package's context file.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, One home per fact: extend the existing entry on code the admin bundles — `induskMcpPackageRoot()` trusts a root handed through `INDUSK_MCP_PACKAGE_ROOT` (set by `indusk ui` in `daemonEnv`) only when it holds this package, because the bundler rewrites a module's own location. Guard: `package-root.test.ts` (T3, T4) and `daemon-env.test.ts` (T1), so the rule is delivered by the tests; the line is one more clause on an existing bullet, not a new always-on entry.

  </details>

#### Build Phase 1 Document

- [ ] Add a changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md` unreleased: the admin is started with the package root, so a planning run inside it reaches "ready for approval".

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/package-root.ts` | `PACKAGE_ROOT_ENV`, `holdsThisPackage`, the trusted handed-root check first |
| `apps/indusk-mcp/src/lib/admin/daemon.ts` | `packageRoot` option, `daemonEnv`, `spawn` uses it |
| `apps/indusk-mcp/src/bin/commands/ui.ts` | passes `packageRoot: induskMcpPackageRoot()` |
| `apps/indusk-mcp/src/lib/package-root.test.ts` | new: T2, T3, T4 |
| `apps/indusk-mcp/src/lib/admin/daemon-env.test.ts` | new: T1 |
| `apps/indusk-mcp/CLAUDE.md` | one clause on the existing admin/package-root entry |
| `apps/docs/src/changelog.md` | unreleased line |

## Dependencies

- The bugfix brief is accepted and the test plan is drafted; nothing else must exist first.
- The live checks need an installed build (`pnpm install:local` after landing) and an accepted brief to run a planning step over.

## Notes

- Open, decided: whether A2 can run without a full admin build was left to this impl; it cannot read the bundle's behaviour from source, so T6 reads the running daemon's environment and log instead and needs the build installed.
- The variable is inherited by anything the daemon spawns (the planning session's `claude`, hooks); that is intended — they run from the same install — and the trust check means a stale value is ignored.

---
title: "Small fixes"
date: 2026-10-08
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
gate_policy: ask
---

# Small fixes

## Goal

Eight fixes from `known-issues.md`: dusk updates itself from its checkout and publishes deliberately; a plan builds only after approval; the session panel says what happened; a bare stash is refused where another session could pop it; the installed hooks are pinned to the package's; both daemon stops judge a process by its command line; the planner's Key Decisions line no longer trips approve; the update notice compares numbers.

## Scope

### In Scope
- `pnpm install:local` and `workflow.steps.land.install`; the retrospective's landing and publish steps for a project that installs locally; the slow tier back in `pnpm release`
- the approval gate in `check-gates.js`; the planner skill's end and its Key Decisions timing
- `stash-guard.js`, registered like `trunk-guard.js`; a hook parity test
- the session panel's result wording; one process-identity rule for both daemon stops; the version compare

### Out of Scope
- the workbench items and the telemetry restart race (deferred, `known-issues.md`)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A2–A15 red or guarding | the CLI, hooks, skills and panel as they are |
| Build Phase 1 | `install:local`, `land.install`, the skill's landing and publish steps, the release script with its slow tier; A1 on this machine | `workflow.steps` (release-checks-run-once), `prepublishOnly` |
| Build Phase 2 | the approval gate, the planner's end and Key Decisions timing, `stash-guard.js`, hook parity | `check-gates.js`, `trunk-guard.js`'s Bash reading, the hook registration in `init`/`update` |
| Build Phase 3 | the panel's wording, `lib/process-identity.ts` behind both stops, the numeric version notice | `isOwnProcess` (telemetry), `verifyIdentity` (admin), `isNewerVersion` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | After the local install, `indusk --version` from any directory reports the checkout's version and `indusk ui start` finds the admin, with nothing published | Build Phase 1 | Build Phase 1 | passing | live check | promise: dusk-installs-its-own-build | manual: `pnpm install:local && cd /tmp && indusk --version && indusk ui status` |
| A2 | A project that declares `workflow.steps.land.install` gets it named by `indusk checks show`; one that declares none is told landing installs nothing | Test Phase 1 | Build Phase 1 | passing | unit | promise: dusk-installs-its-own-build | apps/indusk-mcp/src/__tests__/checks-show.test.ts |
| A3 | `pnpm release` runs the full slow tests before it publishes, every time | Test Phase 1 | Build Phase 1 | passing | unit | promise: dusk-installs-its-own-build | apps/indusk-mcp/src/__tests__/release-script.test.ts |
| A4 | Editing a draft plan's status to `in-progress` by hand is refused, naming the lesson; after `plans approve` the same edit lands | Test Phase 1 | Build Phase 2 | written | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/__tests__/approval-gate.test.ts |
| A5 | Checking off a build item on a draft plan is refused; on an approved plan it lands | Test Phase 1 | Build Phase 2 | written | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/__tests__/approval-gate.test.ts |
| A6 | The planner skill ends at the written plan: it names `plans approve` as the only way on and nowhere tells the agent to start building | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/__tests__/planner-stops-at-the-plan.test.ts |
| A7 | A turn that ends with an API error shows **Failed** and the error's first line, and "success" appears nowhere on the panel | Test Phase 1 | Build Phase 3 | written | unit | promise: a-session-says-how-it-ended | apps/indusk-admin/src/components/session/SessionPanel.result.test.tsx |
| A8 | A turn that completes shows **Turn done**; only a session whose process exited shows **Session ended**, with its exit code | Test Phase 1 | Build Phase 3 | written | unit | promise: a-session-says-how-it-ended | apps/indusk-admin/src/components/session/SessionPanel.result.test.tsx |
| A9 | In a repository with more than one worktree, `git stash` and `git stash pop` are refused before they run, naming a temporary commit and `stash push -m <tag>` / `stash apply <sha>` | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-stash-never-crosses-worktrees | apps/indusk-mcp/src/__tests__/stash-guard.test.ts |
| A10 | `stash push -m <tag>`, `stash list` and `stash apply <sha>` are not refused; in a repository with one worktree nothing is refused | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-stash-never-crosses-worktrees | apps/indusk-mcp/src/__tests__/stash-guard.test.ts |
| A11 | Every hook in the package has a byte-identical installed copy in this repository, and an installed hook with no package source is reported by name | Test Phase 1 | Test Phase 1 | passing | unit | promise: installed-hooks-match-the-package | apps/indusk-mcp/src/__tests__/hook-sync-parity.test.ts |
| A12 | `indusk ui stop` with a port slow to answer still stops its own daemon and removes its record; it never signals a process that is not its own, and exits non-zero naming one that would not stop | Build Phase 3 | Build Phase 3 | planned | unit | promise: indusk-stops-only-its-own-daemons | apps/indusk-mcp/src/lib/admin/daemon-stop.test.ts |
| A13 | `indusk telemetry stop` behaves exactly as before: its tests pass unchanged | Test Phase 1 | Test Phase 1 | passing | unit | promise: indusk-stops-only-its-own-daemons | apps/indusk-mcp/src/lib/telemetry/stop.test.ts |
| A14 | The command-line identity check is defined once, and both stops use it | Test Phase 1 | Build Phase 3 | written | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/__tests__/process-identity-single-definition.test.ts |
| A15 | The planner writes the Key Decisions line as the first build phase's context item, never at ADR acceptance | Test Phase 1 | Build Phase 2 | written | unit | a fix to the planner skill so `plans approve` accepts the branch; the approve rule is unchanged | apps/indusk-mcp/src/__tests__/planner-stops-at-the-plan.test.ts |
| A16 | The update notice says a newer version exists for `1.10.0` over `1.9.0`, and not for `1.9.0` over `1.10.0` | Test Phase 1 | Build Phase 3 | written | unit | a regression guard over a one-line fix | apps/indusk-mcp/src/lib/version-check.test.ts |

## Checklist

### Test Phase 1: Over the CLI, the hooks, the skills and the panel

**Goal**: author A2–A5, A7–A10, A12, A14 and A15 red against things as they are; run A6, A11 and A13 as guards; record why A1 and A16 wait.

- [x] Confirm this plan's worktree (`indusk plans start` made it and recorded the assignment) — worktree-per-plan default
- [x] (red: "expected … to contain 'pnpm install:local'") A2: `checks-show.test.ts` gains a project declaring `land.install`; RED: `checks show` prints no install line
- [x] (red: the four-step list against five) A3: `release-script.test.ts`'s pinned step list includes `pnpm -w test:system` before `npm whoami`; RED: 1.67.0 removed it
- [x] (red: both edits exit 0; the approved-plan cases pass already, as they should) A4, A5: `approval-gate.test.ts` runs `check-gates.js` through the hook runner on a draft impl: a status edit to `in-progress`, and a build-item checkoff; RED: both land today
- [x] (A6 green, A15 red on both its assertions) A6, A15: `planner-stops-at-the-plan.test.ts` reads `skills/planner.md`: `plans approve` named as the only way on, no instruction to build (A6, a guard today), and the Key Decisions line placed in the first build phase's Context, not at ADR acceptance (A15, RED: step 6 says "after the ADR is accepted, add a one-liner to CLAUDE.md")
- [x] (red: the panel reads "Ended: success — API Error…") A7, A8: `SessionPanel.result.test.tsx` renders a `result` event with an API error and `subtype: "success"`, a completed one, and an `exit`; RED: "Ended: success"
- [x] (not authored: the write was stopped by a safety classifier and may not be retried in this session — deferred to Build Phase 2 in the register, where it is written before the hook) A9, A10: `stash-guard.test.ts` runs `hooks/stash-guard.js` over a two-worktree fixture and a one-worktree one; RED: the hook does not exist (a spawned process, a boundary red)
- [x] (green: the package's eleven hooks and the installed eleven are byte-identical, no strays) A11: `hook-sync-parity.test.ts`, the skills parity test over `hooks/` ↔ `.claude/hooks/`; a guard today, since 1.67.0's hooks are installed
- [x] (green) A13: run `stop.test.ts` unchanged; a guard
- [x] (red: `"1.10.0"` reads newer than `"1.9.0"` as text, and so does `"1.9.0"`) A16: `version-check.test.ts`: `hasNewerVersion("1.9.0", "1.10.0")` is true and `hasNewerVersion("1.10.0", "1.9.0")` false; RED: it compares strings
- [ ] A14: `process-identity-single-definition.test.ts` pins one definition of "is this process mine" used by both stops; RED: two

#### Deferred to Build Phase 1

- **A1** — a live check that installs into this machine's global `indusk`; it runs once the install script exists.

#### Deferred to Build Phase 4

- **A9, A10** — this session's write of `stash-guard.test.ts` was stopped by a safety classifier partway through, and the session was told not to produce it again; nothing about the test is unusual (a two-worktree fixture from `lib/bookkeeping/fixture.test-support.ts`, the `bash` event from `helpers/trunk-guard-fixture.ts`, `runHook("stash-guard.js", …)` expecting exit 2 with the safe commands named, and exit 0 for the allowed spellings and the one-worktree repo). The stash guard is its own last phase, Build Phase 4, so the rest of the plan is not held behind it: a fresh session, or Sandy, authors the test there before the hook; `hook-runner.ts`'s `HookName` already lists `stash-guard.js`.

#### Deferred to Build Phase 3

- **A12** — `telemetry/stop.ts` takes its reads as inputs (`StopDeps`), so its rule is a unit test; `admin/daemon.ts`'s `daemonStop()` reads the real process table and files with no seam, so a test of "a port slow to answer but the command line is ours" cannot reach it honestly until Build Phase 3 gives it the same `deps` argument. Body reviewed:

  ```typescript
  // daemon-stop.test.ts — the seam is Build Phase 3's
  const deps = {
    alive: () => true,
    command: (pid) => (pid === 4242 ? `node ${adminDir}/server.js` : "postgres"),
    kill: (pid, sig) => kills.push([pid, sig]),
    sleep: async () => {},
  };
  const r = await daemonStop({ pid: 4242, port: 4321, adminDir }, deps); // the port is never asked
  expect(kills).toEqual([[4242, "SIGTERM"]]);
  expect(r.stopped).toBe(true);
  ```

#### Regression Guards

- **A6** — the planner already names `plans approve`; the guard keeps it so once A15 edits the same step.
- **A11** — the hooks match today (synced at 1.66.0's install and unchanged since); the test is what keeps it so.
- **A13** — `telemetry stop`'s tests pass today and must keep passing when its identity check moves.

#### Test Phase 1 Verification

- [x] (package: 9 red, 29 green across the eight files, each red on its own assertion; admin: 3 red, "Ended: success"; A9/A10 deferred, above) A2–A5, A7, A8, A14, A15, A16 are authored and fail on their own assertions; A6, A11, A13 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/checks-show.test.ts src/__tests__/release-script.test.ts src/__tests__/approval-gate.test.ts src/__tests__/planner-stops-at-the-plan.test.ts src/__tests__/hook-sync-parity.test.ts src/__tests__/process-identity-single-definition.test.ts src/lib/version-check.test.ts src/lib/telemetry/stop.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/session/SessionPanel.result.test.tsx`)
- [x] Every deferred body reviewed: A9/A10's is a boundary test over a spawned hook (an honest red once the file exists); A12's calls `daemonStop(meta, deps)`, a signature Build Phase 3 introduces, and asserts the port is never asked

### Build Phase 1: Dusk installs its own build

- [x] (`npm install -g ./apps/indusk-mcp` makes a symlink — `$(npm root -g)/@infinitedusky/indusk-mcp -> …/dusk-worktrees/small-fixes/apps/indusk-mcp` — so until this lands the global `indusk` is this branch; landing's step 7 re-links it to `main`) Root `package.json`: `install:local` — `pnpm --filter @infinitedusky/indusk-mcp prepublishOnly && npm install -g ./apps/indusk-mcp` (the same build a publish makes, then a global symlink to the checkout)
- [x] `workflow.steps.land.install` in the config type and `readWorkflowSteps`; `checks show` names it or says landing installs nothing (A2); dusk's `.indusk/config.json` declares `pnpm install:local`
- [x] (a new step 7, "Install the landed build"; Step 11 opens with the installs-locally case: say the build is installed and nothing is published, and stop, unless this close is a publish; the `--unless-covered` advice now applies only to a project that declares slow tests at landing) The retrospective's Step 10 runs the declared install after the merge; Step 11 says a project that installs locally bumps and publishes only when it decides to (a server deploy, another project or machine), and then `pnpm release` runs the slow tier itself; resync `.claude/skills/`
- [x] `apps/indusk-mcp/package.json` `release`: `pnpm -w test:system` back before `npm whoami` (A3)
- [x] (install exit 0 in about two minutes, "removed 302 packages, and changed 1 package" — the published copy replaced by the link; from `/tmp`: `indusk --version` → `1.67.0`, the checkout's; `indusk ui status` → "Admin UI: running on port 3939", the daemon started 2026-10-06 still serving) A1: run `pnpm install:local` on this branch, then from `/tmp`: `indusk --version` and `indusk ui status`; record the output here

#### Build Phase 1 Verification

- [x] (checks-show 4 of 4; release-script, skill parity, steps-name-project-commands and release-ritual-skill 35 of 35; `tsc` clean) A2 and A3 pass, A1 recorded (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/checks-show.test.ts src/__tests__/release-script.test.ts src/__tests__/steps-name-project-commands.test.ts src/__tests__/skill-sync-parity.test.ts`)
- [x] Shape — one new key read, shown and declared; one script; the skill is prose. Nothing to change

#### Build Phase 1 Context

- [x] current.md: dusk's `indusk` is a link to the checkout's build (`pnpm install:local` after each landing); publishing is deliberate

#### Build Phase 1 Document

- [x] (`checks.md` and the changelog done here; the retrospective reference page's Steps 10–11 updated with them) `apps/docs/src/reference/cli/checks.md`: `land.install`; `apps/docs/src/reference/skills/retrospective.md`: Step 10's install, Step 11 only when publishing; `apps/docs/src/changelog.md` Unreleased

### Build Phase 2: A plan builds only after approval

- [ ] `check-gates.js`: refuse an edit that changes an impl's `status:` from `draft` to anything but through `plans approve` (the hook sees a hand edit; approve writes without a tool event), and refuse checking off any build-phase item while the impl's status is `draft`; failure names `lesson: a-plan-builds-only-after-approval` (A4, A5)
- [ ] `skills/planner.md`: step 6's Key Decisions line becomes "give the impl's first build phase a Context item for the root's Key Decisions line" (A15); step 10 says the planning session ends at the written plan and only `plans approve` moves it on (A6)
- [ ] `hook-sync-parity.test.ts` stays green: resync `.claude/hooks/` after the gate change (A11)

#### Build Phase 2 Verification

- [ ] A4, A5, A15 pass; A6, A11 still do (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/approval-gate.test.ts src/__tests__/planner-stops-at-the-plan.test.ts src/__tests__/hook-sync-parity.test.ts src/__tests__/hook-cwd-independence.test.ts src/__tests__/skill-sync-parity.test.ts src/__tests__/context-tiers-hook-lesson.test.ts`)

#### Build Phase 2 Context

- [ ] guard: `check-gates.js` carries `lesson: a-plan-builds-only-after-approval`, and the lesson is written so the token resolves

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/skills/planner.md`: the plan ends at approval

### Build Phase 3: The panel says what happened; one identity rule; numbers

- [ ] `SessionPanel.tsx`'s `result` case: **Failed — <first line>** when `ok` is false, **Turn done** when true; the `exit` case: **Session ended (code N)**; never `subtype` (A7, A8)
- [ ] `lib/process-identity.ts`: `isOwnProcess(pid, expectedCommandLine, deps)` lifted from `telemetry/stop.ts`; `admin/daemon.ts`'s `verifyIdentity` uses it with the bundled admin's path, never the port (A12, A13, A14)
- [ ] `hasNewerVersion` in `lib/version-check.ts` compares with `isNewerVersion` (A16 goes green); A12 authored red against the new `daemonStop(meta, deps)` seam first, then green

#### Build Phase 3 Verification

- [ ] A7, A8, A12, A13, A14, A16 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/admin src/lib/telemetry src/__tests__/process-identity-single-definition.test.ts src/lib/pending-release.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/session`)

#### Build Phase 3 Context

- [ ] mcp: `lib/process-identity.ts` is the one answer to "is this process mine", for every daemon InDusk stops — in the package `CLAUDE.md`'s single-definition list, with one entry there moved down a tier to make room

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/admin-ui/sessions.md`: what the panel's three endings mean; `apps/docs/src/changelog.md` Unreleased: the rest

### Build Phase 4: A stash never crosses worktrees

**For a fresh session**: this session could not author A9/A10 (see Test Phase 1's register), so this phase is last and self-contained.

- [ ] A9, A10 authored red in `stash-guard.test.ts` (the register's body): a two-worktree fixture, `runHook("stash-guard.js", bash(cwd, command))`, exit 2 naming the safe commands for `git stash` and `git stash pop`; exit 0 for `stash push -m <tag>`, `stash list`, `stash apply <sha>`, and for everything in a one-worktree repository
- [ ] `hooks/stash-guard.js`: PreToolUse Bash; when the repository has more than one worktree, refuse `git stash` with no subcommand, `git stash pop` and `git stash drop` without a sha, naming a temporary commit and `stash push -m <tag>` / `stash apply <sha>`; registered beside `trunk-guard.js` in `init.ts`, `update.ts` and this repository's settings; `.claude/hooks/` resynced (A11)

#### Build Phase 4 Verification

- [ ] A9, A10 pass; A11 still does (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/stash-guard.test.ts src/__tests__/hook-sync-parity.test.ts src/__tests__/hook-cwd-independence.test.ts`)

#### Build Phase 4 Context

- [ ] hooks: `stash-guard.js`'s header carries the rule and names its promise

#### Build Phase 4 Document

- [ ] `apps/docs/src/guide/multi-agent.md`: the stash rule and the safe commands

## Files Affected

| File | Change |
|------|--------|
| `package.json`, `apps/indusk-mcp/package.json` | `install:local`; the slow tier back in `release` |
| `apps/indusk-mcp/src/lib/checks/steps.ts`, `src/bin/commands/checks.ts`, `src/lib/config.ts` | `land.install` |
| `apps/indusk-mcp/hooks/check-gates.js`, `hooks/stash-guard.js`, `src/bin/commands/init.ts`, `update.ts` | the approval gate; the stash guard and its registration |
| `apps/indusk-mcp/skills/planner.md`, `retrospective.md` | the plan ends at approval; Key Decisions at the first build phase; landing installs, publishing is deliberate |
| `apps/indusk-admin/src/components/session/SessionPanel.tsx` | the three endings |
| `apps/indusk-mcp/src/lib/process-identity.ts`, `lib/telemetry/stop.ts`, `lib/admin/daemon.ts` | one identity rule |
| `apps/indusk-mcp/src/lib/pending-release.ts` (or where the notice compares) | numbers |

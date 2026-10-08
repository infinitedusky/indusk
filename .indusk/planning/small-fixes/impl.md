---
title: "Small fixes"
date: 2026-10-08
status: completed
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
| A4 | Editing a draft plan's status to `in-progress` by hand is refused, naming the lesson; after `plans approve` the same edit lands | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/__tests__/approval-gate.test.ts |
| A5 | Checking off a build item on a draft plan is refused; on an approved plan it lands | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/__tests__/approval-gate.test.ts |
| A6 | The planner skill ends at the written plan: it names `plans approve` as the only way on and nowhere tells the agent to start building | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/__tests__/planner-stops-at-the-plan.test.ts |
| A7 | A turn that ends with an API error shows **Failed** and the error's first line, and "success" appears nowhere on the panel | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-session-says-how-it-ended | apps/indusk-admin/src/components/session/SessionPanel.result.test.tsx |
| A8 | A turn that completes shows **Turn done**; only a session whose process exited shows **Session ended**, with its exit code | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-session-says-how-it-ended | apps/indusk-admin/src/components/session/SessionPanel.result.test.tsx |
| A9 | In a repository with more than one worktree, `git stash` and `git stash pop` are refused before they run, naming a temporary commit and `stash push -m <tag>` / `stash apply <sha>` | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-stash-never-crosses-worktrees | apps/indusk-mcp/src/__tests__/stash-guard.test.ts |
| A10 | `stash push -m <tag>`, `stash list` and `stash apply <sha>` are not refused; in a repository with one worktree nothing is refused | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-stash-never-crosses-worktrees | apps/indusk-mcp/src/__tests__/stash-guard.test.ts |
| A11 | Every hook in the package has a byte-identical installed copy in this repository, and an installed hook with no package source is reported by name | Test Phase 1 | Test Phase 1 | passing | unit | promise: installed-hooks-match-the-package | apps/indusk-mcp/src/__tests__/hook-sync-parity.test.ts |
| A12 | `indusk ui stop` with a port slow to answer still stops its own daemon and removes its record; it never signals a process that is not its own, and exits non-zero naming one that would not stop | Build Phase 3 | Build Phase 3 | passing | unit | promise: indusk-stops-only-its-own-daemons | apps/indusk-mcp/src/lib/admin/daemon-stop.test.ts |
| A13 | `indusk telemetry stop` behaves exactly as before: its tests pass unchanged | Test Phase 1 | Test Phase 1 | passing | unit | promise: indusk-stops-only-its-own-daemons | apps/indusk-mcp/src/lib/telemetry/stop.test.ts |
| A14 | The command-line identity check is defined once, and both stops use it | Test Phase 1 | Build Phase 3 | passing | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/__tests__/process-identity-single-definition.test.ts |
| A15 | The planner writes the Key Decisions line as the first build phase's context item, never at ADR acceptance | Test Phase 1 | Build Phase 2 | passing | unit | a fix to the planner skill so `plans approve` accepts the branch; the approve rule is unchanged | apps/indusk-mcp/src/__tests__/planner-stops-at-the-plan.test.ts |
| A16 | The update notice says a newer version exists for `1.10.0` over `1.9.0`, and not for `1.9.0` over `1.10.0` | Test Phase 1 | Build Phase 3 | passing | unit | a regression guard over a one-line fix | apps/indusk-mcp/src/lib/version-check.test.ts |
| A17 | `indusk ui stop` signals its own daemon when `ps` reports it the way `next start` really does — `next-server (v16.2.4)`, no binary path, no `--port` — and never a `next-server` started at another time than the record's `startedAt` | Build Phase 5 | Build Phase 5 | passing | unit | promise: indusk-stops-only-its-own-daemons | apps/indusk-mcp/src/lib/admin/daemon-stop.test.ts |
| A18 | With the landed build, `indusk ui status` reports the running admin daemon as running and `indusk ui restart` replaces it, leaving one process listening on its port | Build Phase 5 | Build Phase 5 | passing | live check | promise: indusk-stops-only-its-own-daemons | manual: `indusk ui status && indusk ui restart && lsof -nP -iTCP:3939 -sTCP:LISTEN` |
| A19 | A draft plan's status cannot leave `draft` by an Edit whose `old_string` is a fragment without the `status:` key (`draft` → `in-progress`), nor be checked off when its frontmatter spells it `status: "draft"` | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/__tests__/approval-gate.test.ts |
| A20 | With more than one worktree, `git stash branch <name>` with no stash named is refused, since it pops the top entry; `git stash branch <name> <sha>` is not | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-stash-never-crosses-worktrees | apps/indusk-mcp/src/__tests__/stash-guard.test.ts |
| A21 | `indusk plans land` refuses, before merging anything, when the `indusk` running it is installed from the worktree it is about to remove, naming how to re-link from the trunk | Build Phase 5 | Build Phase 5 | passing | unit | promise: dusk-installs-its-own-build | apps/indusk-mcp/src/lib/plans/land-own-worktree.test.ts |
| A23 | Whether a process is alive and what `ps` says it is (command line, start time) are read in one place, `lib/process-identity.ts`; the admin daemon, the telemetry daemon and the session manager use it | Build Phase 6 | Build Phase 6 | passing | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/__tests__/process-identity-single-definition.test.ts |
| A24 | Which hooks a project registers, under which event and matcher, is one table that `init` and `update` both read; neither names a hook file of its own | Build Phase 6 | Build Phase 6 | passing | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/__tests__/hook-registration.test.ts |
| A22 | A turn that fails with no result text (`error_max_turns`, `error_during_execution`) shows **Failed** with a reason in plain words, and no raw subtype | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-session-says-how-it-ended | apps/indusk-admin/src/components/session/SessionPanel.result.test.tsx |

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
- [x] (authored at fbc01cf9, red on its own assertion — both tests failed, the file and the imports absent; the tick was missed when Test Phase 1 closed and is written here at Build Phase 3) A14: `process-identity-single-definition.test.ts` pins one definition of "is this process mine" used by both stops; RED: two

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

- [x] (stronger than the item: on a draft, *any* checkoff is refused, not only a build item's — a draft's checklist is the plan; `draft → abandoned` stays allowed. Both rules sit before the phase parsing, so they hold for Write as well as Edit) `check-gates.js`: refuse an edit that changes an impl's `status:` from `draft` to anything but through `plans approve` (the hook sees a hand edit; approve writes without a tool event), and refuse checking off any build-phase item while the impl's status is `draft`; failure names `lesson: a-plan-builds-only-after-approval` (A4, A5)
- [x] `skills/planner.md`: step 6's Key Decisions line becomes "give the impl's first build phase a Context item for the root's Key Decisions line" (A15); step 10 says the planning session ends at the written plan and only `plans approve` moves it on (A6)
- [x] `hook-sync-parity.test.ts` stays green: resync `.claude/hooks/` after the gate change (A11)

#### Build Phase 2 Verification

- [x] (approval-gate, context-tiers-hook-lesson, hook-cwd-independence, hook-sync-parity: 16 of 16; planner-stops-at-the-plan and skill parity: 28 of 28) A4, A5, A15 pass; A6, A11 still do (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/approval-gate.test.ts src/__tests__/planner-stops-at-the-plan.test.ts src/__tests__/hook-sync-parity.test.ts src/__tests__/hook-cwd-independence.test.ts src/__tests__/skill-sync-parity.test.ts src/__tests__/context-tiers-hook-lesson.test.ts`)
- [x] Shape — two rules of a few lines each in the hook, each before the parsing they must not depend on; the skill is prose. Nothing to change

#### Build Phase 2 Context

- [x] (the lesson written through `add_lesson`, which puts it in the main checkout's `.claude/lessons/` and commits it there; the token resolves on `main` now and on this branch at landing) guard: `check-gates.js` carries `lesson: a-plan-builds-only-after-approval`, and the lesson is written so the token resolves

#### Build Phase 2 Document

- [x] (the page is `reference/skills/plan.md`; a paragraph after the impl's frontmatter table) `apps/docs/src/reference/skills/planner.md`: the plan ends at approval

### Build Phase 3: The panel says what happened; one identity rule; numbers

- [x] `SessionPanel.tsx`'s `result` case: **Failed — <first line>** when `ok` is false, **Turn done** when true; the `exit` case: **Session ended (code N)**; never `subtype` (A7, A8)
- [x] (the markers are the `next` binary the daemon was started with, recorded in its meta as `nextBin`, and its `--port N` flag; `isOwnProcess(pid, markers[], deps)` takes a list so both stops pass what they know) `lib/process-identity.ts`: `isOwnProcess(pid, expectedCommandLine, deps)` lifted from `telemetry/stop.ts`; `admin/daemon.ts`'s `verifyIdentity` uses it with the bundled admin's path, never the port (A12, A13, A14)
- [x] (`isNewerVersion` moved into `version-check.ts` and re-exported from `pending-release.ts`, which imports `induskHome` from it — the other direction was a cycle; A12 red at 9386abe7 on its own assertion against the committed `daemon.ts`, green at b41fe9f5; the seam is `daemonStop(deps)` — the meta is read from the record, not passed; a daemon still there after SIGKILL is reported `stopped: false` with its pid, record kept, and `ui stop` exits 1 naming it, at 6e49a955) `hasNewerVersion` in `lib/version-check.ts` compares with `isNewerVersion` (A16 goes green); A12 authored red against the new `daemonStop(meta, deps)` seam first, then green
 - [x] (done at 14d7bfab; the phase's boundary was recorded late, at 14e9de3d, the commit after Build Phase 2 closed — opening it was missed at phase start) Shape (`apps/indusk-mcp/src/lib/admin/daemon.ts`) — the two wait-for-exit polls in daemonStop (after SIGTERM, after SIGKILL) are one inline block written twice; name it waitForExit(pid, tries, deps) so daemonStop reads as signal, wait, escalate, wait. Rule: Should this inline block have been a named function or module? The general move is to extract it.
 - [x] Shape (reviewed `apps/indusk-mcp/src/lib/admin/daemon.ts` `realDeps.command` — left as-is: it reads `ps` the way `telemetry/daemon.ts` already does; a second copy across files is `/cleanup`'s question, not this phase's)
 - [x] Shape (reviewed `apps/indusk-admin/src/components/session/SessionPanel.tsx`, `lib/process-identity.ts`, `bin/commands/ui.ts`, `version-check.ts` — left as-is: each changed unit is a few lines with one reason to change; `rules.unreadable` was empty)

#### Build Phase 3 Verification

- [x] (mcp: 10 files, 57 tests; admin session: 5 files, 23 tests; tsc clean; `vitest related` over the changed files green; A12 ran red at 9386abe7 on its own assertion first) A7, A8, A12, A13, A14, A16 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/admin src/lib/telemetry src/__tests__/process-identity-single-definition.test.ts src/lib/pending-release.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/session`)

#### Build Phase 3 Context

- [x] (the `headSha` / `headShaOrNull` entry moved down: its pin `head-sha-single-definition.test.ts` names the lesson, and the list's closing sentence already says a git primitive belongs in `lib/git.ts`; the file is 16376 of 16384 bytes — the next entry here moves another one down; the A14 pin now names the lesson too, as the list's opening clause promises) mcp: `lib/process-identity.ts` is the one answer to "is this process mine", for every daemon InDusk stops — in the package `CLAUDE.md`'s single-definition list, with one entry there moved down a tier to make room

#### Build Phase 3 Document

- [x] (changelog: Added — the approval gate; Changed — the panel's endings; Fixed — `ui stop` identity and the would-not-stop exit, the numeric update notice; Build Phase 4's stash guard is not in it, since it is not built) `apps/docs/src/reference/admin-ui/sessions.md`: what the panel's three endings mean; `apps/docs/src/changelog.md` Unreleased: the rest

### Build Phase 4: A stash never crosses worktrees

**For a fresh session**: this session could not author A9/A10 (see Test Phase 1's register), so this phase is last and self-contained.

- [x] (26 red: the hook file is absent, node exits 1 — a spawned-process boundary red, as the register planned; the refused set adds `push` with no message, `-u`, `pop stash@{0}` and `clear`, the allowed set `drop stash@{2}`, `show` and an `echo` of the words; `cd`/`-C` into a worktree from outside is judged by the worktree) A9, A10 authored red in `stash-guard.test.ts` (the register's body): a two-worktree fixture, `runHook("stash-guard.js", bash(cwd, command))`, exit 2 naming the safe commands for `git stash` and `git stash pop`; exit 0 for `stash push -m <tag>`, `stash list`, `stash apply <sha>`, and for everything in a one-worktree repository
- [x] (the repository judged is read through `_commit-anchor.js` — it now exports `gitVerbRe(verb)` and `COMMIT_RE` is `gitVerbRe("commit")`, so `cd <worktree> && git stash` and `git -C` are read the one way; beyond the item, bare `apply`, `pop` in any form (an index shifts under another session's push), `push`/`-u` with no message and `clear` are refused, `drop stash@{n}` allowed; `INDUSK_STASH_GUARD=off` for one call; `hook-cwd-independence.test.ts`'s pinned registration counts move from eight to nine) `hooks/stash-guard.js`: PreToolUse Bash; when the repository has more than one worktree, refuse `git stash` with no subcommand, `git stash pop` and `git stash drop` without a sha, naming a temporary commit and `stash push -m <tag>` / `stash apply <sha>`; registered beside `trunk-guard.js` in `init.ts`, `update.ts` and this repository's settings; `.claude/hooks/` resynced (A11)
 - [x] (each hook is now one `registerHook` line; `hook-cwd-independence` A3, which pins update's exact settings output, still passes — 51 of 51 across the registration tests) Shape (`apps/indusk-mcp/src/bin/commands/update.ts`) — the hook-registration step now holds four copies of one block (read settings, `ensureHookRegistered` per matcher, write if changed, log; or log that it could not): eval-trigger + workbench-sync, claude-md-budget, trunk-guard, stash-guard. Name it `registerHooks(settingsPath, label, registrations)` so each hook is one line. Rule: Should this inline block have been a named function or module? The general move is to extract it.
 - [x] Shape (reviewed `hooks/stash-guard.js`, `hooks/_commit-anchor.js`, `init.ts`, the two tests — left as-is: each unit has one reason to change, the guard's four helpers are each a few lines; `rules.unreadable` was empty)

#### Build Phase 4 Verification

- [x] (stash-guard, hook-sync-parity, hook-cwd-independence: 38 of 38; `vitest related` over the hook, `_commit-anchor.js`, `init.ts`, `update.ts`: 18 of 18; trunk-guard, eval-trigger-commit-anchor and hook-shared-modules still green after the `gitVerbRe` lift; `tsc` clean) A9, A10 pass; A11 still does (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/stash-guard.test.ts src/__tests__/hook-sync-parity.test.ts src/__tests__/hook-cwd-independence.test.ts`)

#### Build Phase 4 Context

- [x] (the header states the rule, the refused and allowed spellings and the off switch, and carries `promise: a-stash-never-crosses-worktrees`; the refusal names `lesson: a-stash-never-crosses-worktrees`, written through `add_lesson` on the main checkout — the token resolves on `main` now and on this branch at landing, as Build Phase 2's did) hooks: `stash-guard.js`'s header carries the rule and names its promise

#### Build Phase 4 Document

- [x] (a section, "Worktrees share one stash": why, the refused/allowed table, the safe commands, the off switch; and the changelog's Unreleased Added) `apps/docs/src/guide/multi-agent.md`: the stash rule and the safe commands

### Build Phase 5: Falsification — the world's command lines, fragments, and the build that removes itself

**Goal**: verify whether the attested state holds against inputs the fixtures did not take from the world: the admin daemon's real command line, an Edit that changes a status without its key, the one stash subcommand that pops implicitly, a landing run by the build it deletes, and a failed turn with no text. Each row is one hypothesis; each item the fix it needs.

**Found, not hypothesized (A17):** on this machine the admin daemon (PID 44479, listening on 127.0.0.1:3939, started 2026-10-06) reads from `ps -o command=` as `next-server (v16.2.4)` — `next start` rewrites its process title, so neither `nextBin` nor `--port 3939` is in it. `verifyIdentity` returns false for the real daemon: `ui stop` deletes its record and never signals it; `ui status` sweeps the record and says not running. Two other `next-server` processes on this machine (other projects' dev servers) read identically, so the command line cannot tell them apart. A12's fixture used `node ${adminDir}/server.js`, a line no daemon has. While the global `indusk` is this branch's build, `ui status`/`stop`/`restart` orphan the running daemon.

**Not investigated further, and why:** the telemetry stop (jaeger/otelcol are Go binaries that keep their argv; its identity was live-checked in 1.60); `install:local` and `land.install` beyond A21 (a script and a config key, read by one function each); `hasNewerVersion` (A16 covers ordering; prerelease tags are ignored by design); `stash-guard` spellings inside scripts called by name (out of scope for every Bash-reading hook, as trunk-guard records); two sessions sharing one worktree (they share a working tree, not just a stash — worktree-per-plan's ground, not this hook's).

- [x] (red on its own assertion: no SIGTERM — the record's `--port` and binary are not in `next-server (v16.2.4)`; the stranger and the unreadable-start cases pass today, as guards; A19, A20, A21, A22 authored red in the same commit, ahead of their items; A18's red is the investigation's reading of `ps`, not a run — running `ui status` red would sweep the live daemon's record) A17 authored red in `daemon-stop.test.ts`: `command` returns `next-server (v16.2.4)` for the recorded PID, started when the record says; expect SIGTERM to it. A stranger `next-server` started at another time is not signalled
- [x] (`isOwnProcess(pid, markers, deps, startedAt?)` gains the start-time check with a 5 s tolerance and an optional `startTime` read, so telemetry's call is unchanged; the admin reads `ps -o lstart=` in the C locale; the `nextBin` record field added in Build Phase 3 is gone, nothing reads it. Read-only against this machine with the real `ps` reads: PID 44479 `ours: true`, the `next-server`s 27316 and 97555 `ours: false`) (the item first named the working directory; read on this machine it fails too — npm renames the old package folder aside when `install:local` replaces it, so PID 44479's cwd is `…/@infinitedusky/.indusk-mcp-7GmG4Aiu/admin`, not its recorded `adminDir`, and that happens at every landing, the moment `ui restart` must stop it. Its start time, `ps -o lstart=`, is `Tue Oct 6 18:20:19 2026`, the record's `startedAt` to the second; the two other `next-server`s started a day later) `lib/admin/daemon.ts` identity by facts `next start` and an install do not rewrite: the command line carries `next` and the process started within seconds of the record's `startedAt` (every record has it), through `lib/process-identity.ts` so there is still one rule; a start time that cannot be read is not ours. A12's fixtures move to the command line the world gives
- [x] (the Edit's result predicted by the tool's literal splice, `replace_all` included, never `String.replace`; approval-gate 10/10; every test naming `check-gates`, 27 files, 186 tests green; `.claude/hooks/` resynced) A19 authored red in `approval-gate.test.ts`; `check-gates.js` judges the status move on the whole file before and after the edit (the file on disk, and the edit applied to it), with the frontmatter's `status` value unquoted — never on `old_string`/`new_string` alone
- [x] (stash-guard + hook parity 34/34; the header lists `branch`) A20 authored red in `stash-guard.test.ts`; `stash-guard.js` refuses `stash branch <name>` with no stash named
- [x] (`landPlan(checkout, plan, { runningFrom })`, defaulting to the module's own file, real paths compared; the workbench lane guards its code worktree the same way; land-own-worktree, plans-land, plans-workbench 32/32. **This plan's own landing meets it**: the global `indusk` is this worktree's build, so re-link from main first — main has no `install:local` yet, so `npm install -g @infinitedusky/indusk-mcp@1.67.0` — then land, then Step 10.7 installs the landed build) A21 authored red in `land-own-worktree.test.ts`; `plans land` refuses, before any merge, when the running CLI's real path is inside the plan's worktree, naming `pnpm install:local` (or `npm install -g`) from the trunk first
- [x] (`failedWithoutText(subtype)`, three cases; admin session tests 26/26; the admin's `tsc` was red on this test file since Build Phase 3 — its result events lacked `sessionId`, and that phase typechecked only the mcp package — fixed here, `tsc` clean) A22 authored red in `SessionPanel.result.test.tsx`; the panel gives a failed turn with no text a plain-words reason from its subtype (`error_max_turns` → the turn limit was reached; `error_during_execution` → it stopped on an error), and an unknown subtype a generic one, never the raw word
 - [x] (one `applyEdit(disk)`; an Edit whose `old_string` is not in the file now exits 0 rather than parsing the unchanged file — the tool refuses that edit itself; every test naming `check-gates`, 27 files, 186 tests green; `.claude/hooks/` resynced) Shape (`apps/indusk-mcp/hooks/check-gates.js`) — the hook now predicts an Edit's result twice: the status check's literal splice, and the gate parse's `fullContent.replace(oldContent, newContent)`, the `String.replace` `hooks/CLAUDE.md` forbids (its `$` patterns substitute; the Edit tool's do not). Name it `applyEdit(disk, toolInput)` once and use it for both. Rule: Should this inline block have been a named function or module? The general move is to extract it.
 - [x] Shape (reviewed `lib/process-identity.ts`, `lib/admin/daemon.ts`, `lib/plans/land.ts`, `hooks/stash-guard.js`, `SessionPanel.tsx` and the tests — left as-is: each change is a few lines with one reason to change; `rules.unreadable` was empty)
- [x] (run on this branch's build, which the global `indusk` links to — the code that lands; from `/tmp`: `ui status` → "running on port 3939, PID: 44479, Started: 2026-10-06T22:20:19.639Z", the record kept; `ui restart` → "Ended 1 Claude session(s) started by the admin: PID 58777." (a two-day-old seatbox planning session, ended with Sandy's go), "Admin UI daemon (PID 44479) stopped.", new PID 63918; `ui status` recognises 63918; `lsof` one listener on 127.0.0.1:3939; 44479 gone. The new daemon runs from this worktree's `admin/`, which landing removes: after Step 10.7's install on trunk, `indusk ui restart` again) A18 (live check, after the merge and the install on trunk): `indusk ui status` reports the daemon running, `indusk ui restart` replaces it, one listener on 3939; record the output here

#### Build Phase 5 Verification

- [x] (mcp: 11 files, 76 tests; admin session: 5 files, 26 tests; `vitest related` over `process-identity.ts`, `daemon.ts`, `land.ts`: 8 files, 46 tests; every test naming `check-gates`: 27 files, 186; the system-tier `daemon-identity.test.ts` 2/2; both packages' `tsc` clean; A18 recorded above) A17, A19, A20, A21, A22 pass; A12, A13, A4, A5, A9, A10 still do (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/admin src/lib/telemetry src/__tests__/approval-gate.test.ts src/__tests__/stash-guard.test.ts src/lib/plans/land-own-worktree.test.ts src/__tests__/hook-sync-parity.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/session`)

#### Build Phase 5 Context

- [x] (the header names the start time, not the working directory this item first said — an install moves the cwd, see the identity item; lesson `identify-a-process-by-what-it-cannot-rewrite` written through `add_lesson` on main, its token in the header) mcp: `lib/process-identity.ts`'s header says a marker must be read from a real process, not composed from the spawn arguments — `next start` rewrites its title — and names the working directory as the admin's marker; a lesson for it, so the header's token resolves

#### Build Phase 5 Document

- [x] (the Build Phase 3 entry that said the record carries the `next` binary is rewritten to the start-time rule; four new Fixed entries; the guide's table gains `stash branch`) `apps/docs/src/changelog.md` Unreleased Fixed: the admin daemon recognised by its working directory; the approval gate on fragments and quoted status; `stash branch`; `plans land` refusing to remove its own build; a failed turn's reason. `apps/docs/src/guide/multi-agent.md`: `stash branch` in the refused table

### Build Phase 6: Cleanup — one home for the process reads, one table for the hooks

**Goal**: decompose what this plan's two shared rules grew across files, on the rule of three and the package's single-definition convention (no `nextjs`/`react` extension is enabled; the move is a module or an exported table). Each item is an extraction or a reasoned leave-as-is; each new shared unit gets a pin.

**Reviewed:** every file `listOversizedChangedFiles` flagged against `main` (`init.ts` 1359, `update.ts` 1006, `config.ts` 656, `check-gates.js` 461, `planner.md` 685, the retrospective reference 549) and every code file the plan changed. **Under threshold, cohesive, untouched here:** `process-identity.ts`, `land.ts`'s guard, `stash-guard.js`, `SessionPanel.tsx`, `version-check.ts`, `checks/steps.ts`.

- [x] (four files, not three: `telemetry/status.ts` too, including `liveOtlpEndpointSync`'s own `process.kill(meta.jaegerPid, 0)`; the test's liveness pattern was narrowed to `process.kill(…, 0)` in code after its first run matched the prose `kill(pid, 0)` in two doc comments; `status.ts` keeps exporting `isAlive` for its importers, now the one definition; the telemetry daemon's long-unused `rmSync` import went with biome's fix to that file; A23 + admin/telemetry/session 81/81, `vitest related` 58 files 377 tests, system-tier `daemon-identity` + `orphans` 9/9, `tsc` clean) A23 authored red in `process-identity-single-definition.test.ts` (counts `process.kill(pid, 0)` and `"ps"` spawns under `src/lib`: today three each, in `admin/daemon.ts`, `telemetry/status.ts` + `telemetry/daemon.ts`, `session/manager.ts`); then `lib/process-identity.ts` exports `realProcessReads` (`alive`, `command`, `startTime`, `ps` in the C locale) and all three use it — the rule of three, and `process-identity.ts` is already the declared one home for "is this process mine"; the admin's copy reads `ps` in the C locale and the others do not, which is the drift a second copy starts
- [x] (`HOOK_REGISTRATIONS` carries the comments the init literal had; `hookGroups()` builds `init`'s settings object from it; `update` groups the rows by file and runs `registerHook` once per hook, after the legacy `check-catchup` removal; `hook-cwd-independence` A3 still byte-equal; registration, init/update/hook-command readers and `vitest related`: 64 tests green; `tsc` clean) A24 authored red in `hook-registration.test.ts` (`init.ts` and `update.ts` name no `.js` hook file outside the table); then `lib/hook-command.ts` exports `HOOK_REGISTRATIONS` (`[event, matcher, file]`, in today's order), `init` builds its `hookConfig` from it and `update` runs `registerHook` over it. Adding the stash guard meant editing both lists and the hooks `CLAUDE.md` rule that says to; one table makes that rule structural. `update` then also ensures `check-gates`, `validate-impl-structure` and `gate-reminder`, which today only `init` registers — a project missing one gets it; `hook-cwd-independence` A3 pins `update`'s exact output
- [x] (reviewed `stash-guard.js`'s `stashArgs` beside `trunk-guard.js`'s `commitArgs` — left as-is: two copies with different needs; the stash guard asks only for the subcommand and whether a target is named, and sharing the commit tokenizer would carry trunk-guard's flag tables into a hook that has no flags to read)
 - [x] Shape (reviewed `process-identity.ts`, `hook-command.ts`, and the call sites in `admin/daemon.ts`, `telemetry/daemon.ts`, `telemetry/status.ts`, `session/manager.ts`, `init.ts`, `update.ts` — nothing found: each change is a short exported unit or a deletion; `rules.unreadable` was empty)
- [x] (reviewed `land.ts`'s `real()` beside `trunk-guard.js`'s — left as-is: a hook is plain JS and cannot import the TS library, the boundary `hooks/CLAUDE.md` records)
- [x] (reviewed `init.ts`, `update.ts`, `config.ts`, `check-gates.js`, `planner.md` and the retrospective reference — left as-is: each was over its cap before this plan, which changed a few lines in each; decomposing them is a plan of its own, not this close-out's)

#### Build Phase 6 Verification

- [x] (16 files, 103 tests; `tsc` clean) A23, A24 pass; A12, A13, A14, A17 and the registration tests still do (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/process-identity-single-definition.test.ts src/__tests__/hook-registration.test.ts src/__tests__/hook-cwd-independence.test.ts src/__tests__/trunk-guard-registration.test.ts src/lib/admin src/lib/telemetry src/lib/session`)

#### Build Phase 6 Context

- [x] (the mcp entry reads "identity, `ps` reads", 16382 of 16384 bytes — the next entry there must move one down; the hooks rule names the table and its A24 pin) hooks `CLAUDE.md`: a new hook is one row in `HOOK_REGISTRATIONS` (`lib/hook-command.ts`), which `init` and `update` both read — replacing "also needs an `ensureHookRegistered` call from `update.ts`"; mcp `CLAUDE.md`'s `process-identity.ts` entry names the process reads too, in the same bytes (the file is at 16376 of 16384)

#### Build Phase 6 Document

- [x] `apps/docs/src/changelog.md` Unreleased Changed: `indusk update` ensures every hook `init` registers, from one table, so a project missing `check-gates`, `validate-impl-structure` or `gate-reminder` gets it

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

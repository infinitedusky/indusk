# Known issues

Things found in use that no plan owns yet. When a plan takes one, the entry
moves into that plan's brief and is deleted from here. That keeps the standing
rule in `master.md`: a follow-on lives in the brief of the step that owns it.
This list is where an issue waits until some step does.

Each entry says what happens, where it was seen, and what we know so far.

## Plans

- **Renaming a plan strands its session.** Seen 2026-10-06 in the
  workbench-plan-authoring live check: the planner renamed a plan by hand
  with git, and the running session stayed filed under the old name, whose
  page no longer existed. Designed there, then moved out so that plan could
  ship. The design: `indusk plans rename <old> <new>` moves what InDusk looks
  the plan up by (its folder, the branch `plan/<old>`, `code.json` or the
  plan-worktree record, its promises' `owner`, its phase-boundary lines);
  leaves the worktree's directory where it is (a session may be running in
  it, and moving a process's directory silently breaks its hooks); asks the
  running admin to move the session's record, which tells the panel to go
  to the new page; refuses, changing nothing, when the new name is taken or
  invalid, the plan is not open, or a build is running. The planner renames
  only through it. Rejected: fixing a plan's name once it starts (a name
  gets better once the idea is clear), and detecting a hand rename
  afterwards (a guess is the wrong way to find a plan). Its promise was
  `a-renamed-plan-is-found-by-its-new-name`.
- **A planning session builds.** In the live check the planning agent went
  on past the written plan, set the impl `in-progress` itself and made the
  code change, so Approve (the brief and promise checks) never ran. A
  planning session should stop at the written plan; only `plans approve`
  should mark a plan approved.
- **The planner's worktree kickoff item is the normal-mode command.** In a
  workbench New plan has already made the worktree; `indusk worktree assign`
  errors there, and the agent improvised.
- **No way to delete a plan.** Abandoning a started plan means removing its
  folder, worktree and branch by hand, and stopping its session first. Seen
  2026-10-06, live check.

## Agents and sessions

- **A build or review session starts without the project's state.** New plan's
  agent now prepares first (workbench-plan-authoring, ADR D11); the other
  sessions the admin starts still begin with their skill alone.

- **A session's agent runs `git stash` in a worktree.** The stash list is
  shared by every worktree of a repo, so one session's stash can be popped
  by another. Seen 2026-10-06, live check (harmless there: the copy is its
  own clone).

## The demo

- **The promise timeline should be a bar chart of checks.** Seen 2026-10-07
  in demo-app-template's live check: a break shows as one red square, and the
  held checks around it do not show at all. Sandy's design: each time bucket
  (say five minutes) is a bar whose height is how many times the promise was
  checked in it; green for each held check, red for each violation (the
  greens keep stacking beside it), and a red turns purple once the incident
  covering it is fixed. Belongs to plan-cockpit's promise page. It needs a
  counting read from Jaeger: today's timeline keeps the violations and only
  the last held mark per window.
- **The admin did not update in real time.** The promise page refreshes every
  5 s (`admin.refresh_ms`); in the live check the break needed a manual
  reload. Look at whether the promise page's refresh reached it.
- **More promises and features in the demo.** Sandy, 2026-10-07: the demo
  holds; what it needs next is work that adds promises and features to the
  seat-holds example, live, through the planner: for example "a booked seat
  is never double-booked" or "a hold is answered within 200 ms". Belongs to
  the demo's script steps 2 and 5, and the rehearsal.

## Admin

- **No Update button, and nothing says a project is behind.** Updating a
  project's InDusk needs `indusk update` in a terminal (seen 2026-10-05,
  updating seatbox). The admin plans with whatever skills and hooks a
  project has installed. numero runs
  InDusk 1.56.0, whose planner writes no promises, so its plans came out
  without them and nothing said why. Seen 2026-10-06, live check.
- **"Ended: success" on a failed turn.** The panel prints Claude Code's
  `subtype` (`success`) beside an API error, and "Ended" when only the turn
  ended. Seen 2026-10-06, live check.
- **No Create project.** A project can only be registered from the CLI. Seen
  2026-10-05, trying the admin on a fresh workbench.

## Contracts and workbenches

- **A shadow contract has no adopt command.** A workbench holds a repo's
  contract until the repo adopts it; nothing moves it into the repo yet.
  From the workbench-plan-authoring design. A hypothesis for that plan,
  from workbench-plan-authoring's falsify: once a repo holds its own
  contract, `promises confirm` at a plan's close writes into the code
  worktree, and `plans land` refuses a code worktree with uncommitted
  changes, so a workbench plan with a repo contract may not land without a
  commit nobody makes. Unreachable until a repo can adopt its contract.
- **`init` drops a workbench's `worktree` config.** Seen during
  workbench-plan-authoring.

## Planning rules

- **Approve and the planner disagree about the root `CLAUDE.md`.** The planner
  adds a Key Decisions line when the ADR is accepted; approve refuses a branch
  that changed anything outside `.indusk/` before the build. Seen approving
  workbench-plan-authoring; worked around by moving the line to the build.

## Workflow configuration

- **Every step's tooling under `workflow`.** release-checks-run-once adds
  `workflow.steps` for landing's slow tests and release; `verify.testRunner`
  and `plans.land_checks` still live apart and should move in, with a
  migration for existing projects. Held to the same rule: facts, never logic
  (a command, a path or a name). The order of steps (promise-core's
  step-picking screen) would live in the same section. (Sandy, 2026-10-08.)
- **Announce landing and release as CDEvents.** The Continuous Delivery
  Foundation's event format (*build finished*, *test suite passed*, *artifact
  published*) is the nearest thing to OpenTelemetry for delivery; InDusk
  could emit them so other delivery tools follow along. (Sandy, 2026-10-08.)
- **Promises can carry a story.** An optional `## Story` in a promise's file
  and under each promise in the brief: who does what, today and once it holds
  (the Maya story for `landing-and-release-name-the-projects-commands`). The
  sentence is what a test checks; the story is why anyone cares. Shown one
  click down in the admin. (Sandy, 2026-10-08.)
- **The installed hooks have no parity test.** `skill-sync-parity` pins
  `.claude/skills/` to the package; nothing pins `.claude/hooks/`, so a hook
  change reaches this repository only through `indusk update` (found at
  1.66.0's install).

## Releases

- **Every release has failed its first `pnpm release`.** 1.63.0 (twice) and
  1.64.0. The release re-runs the whole system tier (40 files, real Jaeger,
  otelcol, `next dev` and Claude sessions, run in parallel) minutes after
  the landing ran it on nearly the same tree, so each release is another
  roll of the dice on timing-sensitive tests. 1.64.0's failure: the
  telemetry restart test (`telemetry-cli-lifecycle.test.ts`, T5) never
  checks `telemetry start`'s exit code, so a start that missed its 15 s
  Jaeger readiness wait under load shows only "expected null not to be
  null"; alone the file passes 3 of 3. The likely cause (moderate
  confidence) is a race in the daemon itself: `findFreePort(0)` picks a free
  port and releases it before Jaeger binds, so a daemon started in parallel
  can take it; Jaeger never binds, and start waits its full 15 s (the failing
  test took 15,060 ms against 0.4 s for the starts before it). The fix: start
  retries on a fresh port when Jaeger cannot bind, and the test checks
  start's result. The rerun passed (40/40 and 13/13); publishing then failed
  with `EOTP` because `pnpm release | tee` gave npm no terminal for the
  browser sign-in. Owned by
  [release-checks-run-once](release-checks-run-once/brief.md) and the
  small-fixes plan.

- **The admin daemon's stop has the same port-based identity check.**
  `lib/admin/daemon.ts` keeps its own `verifyIdentity(pid, port)`: a slow
  port there would skip its own process the way `telemetry stop` did before
  telemetry-stop-stops-what-it-started (2026-10-07). Two copies of one rule.

## Package

- **The version notice compares versions as strings.** `hasNewerVersion`
  should use `isNewerVersion`.
- **The package `CLAUDE.md` is 2 bytes under its budget.** The next rule
  added there will be refused; one entry needs to move down a tier first.

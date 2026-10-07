---
title: "Workbench plan authoring — Retrospective"
date: 2026-10-07
---

# Workbench plan authoring — Retrospective

## What We Set Out to Do

Make the admin's plan flow work in a workbench. In the 1.63.0 smoke check, New
plan refused at once in a workbench, though eight of Sandy's sixteen projects
are workbenches; admin-plan-authoring had never considered them. Two
expectations: the admin plans and builds in the projects Sandy works in, and
one plan in a real workbench goes the whole way without the terminal. Along
the way, a design question came up and was settled: promises belong with the
code, so a repo has one contract, held in the workbench as a versioned shadow
until the repo adopts it.

## What Actually Happened

Six build phases, 57 files, +1,937/−172 lines across the apps. Build Phases
1–5 went as planned: one contract resolver (`contractDir`), a workbench plan
that records its code (`code.json`), approve/review/land in the repo, sessions
at the root with the code worktree added, and the admin's buttons from one
rule (`planActions`).

The live check (Build Phase 6) ran on a copy of numero and found more than any
phase before it:

- **numero's repo lives on `staging`.** Approve and land refused it as "not a
  trunk branch". Fixed: a workbench plan lands on its repo's declared base
  branch.
- **The planner renamed a plan by hand**, and the running session was left
  filed under a page that no longer existed. A rename command was designed and
  written in, with a promise, then moved out by Sandy's call so the plan could
  ship.
- **The agent planned from the title.** Fixed: a new plan's first prompt says
  to prepare, then ask.
- **The workbench was untrusted**, so every session asked about everything.
  Known since admin-plan-authoring and only ever reported. Fixed on Sandy's
  "just fix it": Trust in Claude Code.
- **numero runs InDusk 1.56.0**, whose planner writes no promises, and a
  planning agent went on to build and set the impl in-progress itself,
  skipping Approve. Both went to `known-issues.md`.

Review, accept and land were not run live; Sandy stopped the check after build
("whatever I have been testing will work"). The landing run then found three
real defects the phase-scoped runs had not: approve still joined its own path
to `.indusk/promises` (caught by A17's grep), an earlier plan's test still
asserted the registry was workbench-only (D4 reversed that), and an archived
impl that no longer validated.

## Getting to Done

- The impl validator refused edits twice because a verification note cited
  another plan's row ID ("A24's two cases"). The full-file validator reads
  any `A<n>` in a Verification block as a row of this plan.
- `promises confirm` refused the three changed promises until each was
  recorded with `promises change` and the brief's **Changes** entries read
  exactly as the registry does. The brief had described the changes in prose
  ("It becomes: …"), which the check cannot match.
- Two system-tier contracts failed the first landing run on Anthropic's API
  rate limit (HTTP 429), the same limit Sandy hit in the panel; they passed on
  rerun.

## What We Learned

- **A live check in a real project finds what fixtures cannot.** Every
  fixture used `main`; numero uses `staging`. Every fixture was trusted or
  irrelevant to trust; numero was not. Every fixture ran current InDusk;
  numero runs 1.56.0.
- **A known gap reported for a release is a gap.** Trust was named in
  admin-plan-authoring's docs and never fixed; the first person to use the
  admin on a real workbench hit it within minutes.
- **The admin drives a project with whatever skills that project has
  installed.** An old project plans the old way, silently.
- **A phase runs what it touched, so a test from an earlier plan that the
  new decision reverses goes unseen until landing.** That is the design, and
  it worked: the landing run caught it.

## What We'd Do Differently

- **Run the live check on the real project's own state before building the
  last phase,** not a cleaned-up copy. I emptied numero's setup steps in the
  copy to make worktrees quick, which hid the install the build needed and
  cost Sandy time; that edit made the test less real, not faster.
- **Check for a running session before restarting the admin.** I restarted it
  to load a build and orphaned Sandy's session.
- **Write a brief's changed promises as the exact new sentence from the
  start,** not as a description of the change.
- **Keep scope fixed during a live check.** Rename grew into a promise, four
  rows and an ADR decision before being moved out; the known-issues list was
  the right home from the first moment.

## Insights Worth Carrying Forward

- Name the project's InDusk version before a live check; an older install
  invalidates what the check says about the planner.
- `known-issues.md` is where a finding waits until a plan owns it; a live
  check should feed it, not the plan in flight, unless the finding blocks the
  flow.

## Quality

Shape raised one finding across six build phases (Build Phase 5: the plan
page's three inline conditions became `planActions`, one named rule with its
own test). A human judged none of them wrong. No recurring lint or type errors
suggested a new Biome rule.

## Rituals

Falsification and cleanup were skipped, each with its reason in the impl's
frontmatter. The one hypothesis falsify formed (a repo-held contract leaving
the code worktree dirty at land) is unreachable until the shadow-contract adopt
plan, and is written there in `known-issues.md`.

Landed on main at bd70403f, 2026-10-07.

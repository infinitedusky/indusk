---
title: "Day step 4a — Promises — Retrospective"
date: 2026-09-18
---

# Day step 4a — Promises — Retrospective

## What We Set Out to Do

Build the promise as a primitive of InDusk: a registry a person writes under
`.indusk/promises/`, a check that refuses it by name the moment it lies, this
repository self-hosting one promise per kind, and an admin page that shows
declared state and never a health it has not observed. The brief's frame,
settled the day before: a plan establishes promises, preserves the ones in
force, and is free in how; a promise's kind decides what checks it. The
planning half (promises declared before code, rows that establish or
preserve, confirmation at close) was cut to `day-contract`; the telemetry
half stayed `day-monitor`.

## What Actually Happened

One session, from the brief's rewrite to the branch landing. 55 commits on
`plan/day-promises`; 73 files, +4,200 / −145 lines, of which 51 code and
test files (+3,521 / −29): 36 under `apps/indusk-mcp`, 15 under
`apps/indusk-admin`, 8 docs pages, the four registry files, two lessons the
eval agent materialized mid-plan. 34 trajectory rows, all passing.

Three things diverged from the plan as written:

- **The plan documents were rewritten twice before any code.** The first
  version named two other projects as proving ground and acceptance; Sandy
  refused it — this is a feature of the system, not a change to the
  projects that will adopt it. The second version dropped every mention and
  tested the registration rule against this repository's own candidates
  instead, which gave the rule the negative cases it had lacked. The only
  trace of the starting-point implementations is a "starting points"
  paragraph in the ADR, cited as references for what to build.
- **The token rule was wrong twice, in opposite directions.** Running the
  check against this repository in Build Phase 3 (the standing rule: run a
  new tool against its own repo before closing) found six false citations —
  a field named `promise` in a type, a lockfile entry, a test example. The
  rule tightened to "after a comment opener or in a quote". Falsification
  then showed the tightening refused a real comment with text before the
  token, and the rule settled at "a comment opener anywhere earlier on the
  line, or a quote directly before". Both times the file that *documents*
  the token was the first false positive: a docblock describing the marker
  carries the marker.
- **The admin's live view could not see the plan.** The daemon reads plans
  from registered project paths, and the registered path is the trunk, so a
  plan in a worktree is invisible until it merges. Registering the worktree
  as a second project was tried and rejected the same hour — the worktree is
  not the project. Recorded in the root master as the bugfix to do the
  moment this lands, with the shape: one resolver for a plan's documents,
  record and ledger from its `plan/<name>` worktree, read by the admin and
  the MCP plan tools alike (`advance_plan` had the same blindness).

## Getting to Done

- Test Phase 1 authored 17 rows red at the CLI and HTTP boundaries and
  deferred five component rows with their bodies; the gate refused the first
  checkoff until every row was `written`, which is the discipline working.
- Build Phase 1's first run was 32 of 33 green; the one red was the check's
  own refusal footer saying "not clean", caught by the row that asserts the
  output never says clean.
- Build Phase 2's byte-identical `update` assertion was wrong: `update` stamps
  `indusk.updated_at` on every run by design. The honest claim is "nothing
  else moves", and the test says so now.
- Build Phase 3 found the loose token (above) and one `isUsableSegment`-shaped
  gap: the missing-owner refusal was the one refusal without the registry
  prefix every other carried.
- Build Phase 4: two existing browser tests failed to import because the
  plan page and the layout now import the promises reader, which reaches
  `node:fs`; Biome then wanted the chip's `aria-label` on an element with a
  role. The manual smoke could not use the daemon (it serves the installed
  bundle and points at the trunk) and ran this worktree's admin under a
  throwaway registry instead.
- Falsification: five hypotheses, ten of twelve cases red on the shipped
  check, all five confirmed — including a `..` in `sites:` that made the
  check read and accept a token-bearing file outside the code root.
- Cleanup: the rule of three met by the third presence-keyed config ensure;
  the reverse scan out of `check.ts` (23 lines over its cap for exactly that
  reason); the badge out of the client-boundary page module. Authoring the
  badge's pin corrected the ritual's own row: the page never rendered the
  badge.
- Two environmental incidents: a by-hand reproduction ran `init` in the
  package directory before changing into its temp dir (stray `.indusk/`,
  `.claude/`, `.mcp.json` and a registry entry, all removed within the
  minute); and the daemon identity test went red for any branch because the
  local-telemetry collector restarted on the port it assumes is free.

## What We Learned

- **A checker's own documentation is its first false positive.** A docblock
  or a guide that describes a scanned marker carries the marker. Run the
  check against the repository that documents it before the phase closes,
  and keep the documenting files clean by construction (describe the token,
  never spell it).
- **"Opener before the token" has two readings and only one is right.** The
  first rule required the token to be the first thing after the opener and
  refused `// enforces promise: x`. A comment opener anywhere earlier on the
  line is a citation; a quote must directly precede, or a type annotation on
  a line with an earlier string literal becomes one.
- **An owner that "exists" is not an owner that is a plan.** `existsSync`
  accepted a file and the `archive` folder itself; a plan is a directory
  under the planning dir whose name is not `archive`.
- **A registry read that reports problems must still return what it read.**
  The first `readPromises` returned only the problems, so one malformed file
  would have hidden every neighbour from the page. The partial registry
  travels with the problems.
- **The admin sees registered paths, not branches.** Worktree-per-plan means
  the live bars never move for the plan being worked until it merges. The
  fix belongs in the one plan inventory, not in registering worktrees.
- **A fixed "surely free" port in a test is an environmental coin flip.**
  Bind and release to find one.

## What We'd Do Differently

- Run the check against this repository in Build Phase 1, not Build Phase 3
  — the token rule would have been right one phase earlier and falsification
  would have hunted elsewhere.
- Write the brief without naming other projects from the start. The first
  version cost two rewrites and an hour, for a plan whose whole point was a
  universal feature.
- Leave the daemon-serving smoke out of the impl: the manual smoke item
  assumed `indusk ui restart` would show a worktree's plan, which the
  worktree-blindness finding made impossible by construction. The
  throwaway-registry `next dev` smoke is the right item.

## Insights Worth Carrying Forward

- The check proves a test *names* a promise; that it *validates* it is
  binding (Day step 6). Writing that distinction down kept three
  conversations short.
- Every refusal message is a factual claim and the tests assert what it
  names; the first wrong footer and the one unprefixed refusal were both
  caught that way.
- Hollow chips by construction — the page has no health field at all — is
  cheaper and more honest than a health axis that defaults to "unknown".

## Quality Ratchet

No new Biome rule. Biome's existing rules caught every class of mistake made
here (assignment in an expression, string concatenation over a template,
`aria-label` on a role-less element), each on the first run, so the ratchet
already held. Shape findings: **4 raised, 0 judged wrong by a human** —
`domainRefusals` / `citationRefusals` and an unused export (Build Phase 1),
`PromiseGroup` / `IncidentsTable` (Build Phase 4), `aliasProblems` (Build
Phase 5); Build Phases 2, 3 and 6 recorded "nothing to change" with
left-as-is reasoning. Not a second consecutive plan with findings judged
wrong.

## Follow-ons, and where they live

- **Admin and MCP plan tools read a plan from its worktree** — root
  `master.md`, "Bugfix, not a step — do it the moment day-promises lands".
- **`daemon-identity.test.ts` assumes port 65001 is free** — root
  `master.md`, small queue.
- **`day-contract` (Day 4c)** — proposed in the brief and the Day master;
  create with `/planner` when picked up.
- **`day-monitor` (Day 4b)** — brief narrowed to behaviour promises; its
  first step takes the trace-shape test helper.
- **The two red-panel sites** (`PromisesProblems`, the boundary error) — the
  next one extracts the three; recorded in the Cleanup Phase.

## Metrics

- Sessions spent: 1 (planning rewrite through landing)
- Files touched: 73
- Lines added/removed: +4,200 / −145 (code and tests: +3,521 / −29)
- Commits on the branch: 55
- Trajectory rows: 34 passing (24 from the test plan, 2 structural pins, 5 falsification, 3 cleanup)
- Falsification: 5 hypotheses, 5 confirmed, 5 fixed
- Cleanup: 3 extractions, 5 reasoned leave-as-is
- Shape: 4 findings raised, 0 judged wrong

---

Landed on main at 5c41372d, 2026-09-18.

---
title: "Decisions as questions"
date: 2026-10-19
status: in-progress
---

# Decisions as questions — Research

## Question

How does an unattended session put a choice to the person without stopping the
run for every one, and what happens when the person disagrees after the run
went ahead?

## Background

Child 2 of [run-the-master](../run-the-master/master.md), speed item 4 in
`.indusk/current.md` (Sandy, 2026-10-18). Today an unattended session that
meets a choice either decides and records it in the documents as "decided
unattended" (the planning run; the person sees it only at approval), or stops
the whole run: a declared judgement (`detectHumanGate` in
`lib/build/judgement.ts`), a blocker, or "cannot continue". The admin shows a
plan that waits under Needs you and on its page's decision card, one decision
at a time (`decisions-wait-in-one-place`).

Built before `run-the-graph` (Sandy, 2026-10-19, speed order): without the
graph a plan cannot be partly held, so an expensive question stops its plan's
session rather than only the phases downstream of it.

## Findings

- Choices recorded as "decided unattended" appear in planning documents
  (e.g. `archive/the-admin-knows-the-package-root/test-plan.md`, decisions 1–5).
- The session protocol already carries an `AskUserQuestion` from a session to
  the admin as a `question` event (`lib/session/protocol.ts`) — used by
  conversation sessions.
- Fix-forward has a precedent: `an-unclaimed-failure-opens-a-bugfix-plan` opens
  a draft bugfix plan for a failure no promise claims.
- The session cap: `sessions-are-capped` (`sessions.max`, 4 by default).

## Decisions

- **Fix forward, don't stop** (Sandy, 2026-10-19): as the system speeds up,
  prefer going back with a later plan over stopping. A late answer that
  disagrees with what a timer took opens a follow-on plan.
- **The release waits, landing doesn't** (Sandy, 2026-10-19): a release refuses
  while a follow-on from a disagreeing answer is open; landing on main is never
  blocked by one. Main is not production; the release is. A team whose main
  deploys would put the block at the pull request — a project fact, so the
  step is configurable, release by default.
- **An expensive question stops its session and frees its slot** (Sandy,
  2026-10-19); it resumes when answered.
- **Answer where decisions are answered today** (Sandy, 2026-10-19): Needs you
  and the plan's decision card; nothing new. The page shows several questions,
  so the looks change.
- **What counts as a decision** (Sandy, 2026-10-19, "whatever now stops and asks
  for me, when something is unknown"): any point where a session today stops
  for the person on a choice, or chooses between options the plan does not
  settle and records it as decided unattended. Review and acceptance stay
  stops; they are not questions.
- **Significance by what the answer changes** (2026-10-19, from
  `audit-concerns-are-answered`): an answer that would change the brief, a
  promise or a look, or skip a gate, is always expensive.

## Open Questions

- Whether a moderate question's hour counts only while the admin runs.

## Sources

- `.indusk/planning/run-the-master/master.md`
- `apps/indusk-mcp/src/lib/build/judgement.ts`, `lib/session/protocol.ts`

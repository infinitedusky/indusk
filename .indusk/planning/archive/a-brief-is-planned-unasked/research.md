---
title: "A brief is planned unasked"
date: 2026-10-18
status: complete
---

# A brief is planned unasked — Research

## Question

What has to exist so that accepting a brief (with its looks approved) starts an
unattended session that writes the test plan, ADR and impl, and approving the plan
starts the build?

## Findings (2026-10-18)

- **Accepting a brief is a hand edit.** No CLI command, MCP tool or admin route sets a
  brief to `status: accepted`; the planner skill tells the agent to declare the
  promises, run `indusk promises contract`, then edit the status (`skills/planner.md`).
  `indusk plans accept` and `/api/plans/accept` accept a plan's *build*, not its brief.
- **An unattended build** starts only from the admin's Build button:
  `/api/plans/build` → `startBuild` (`apps/indusk-admin/src/lib/build-host.ts`) →
  `runBuild` (`lib/build/runner.ts`), which loops `nextBuildStep` and runs each step as
  a fresh `kind: "build"` session through `runStepSession` (`lib/build/build-session.ts`)
  with `stepEnv` (`INDUSK_GATE_POLICY=auto`, `INDUSK_BUILD_STEP=<step>`); questions are
  refused and permissions decided in code. No CLI runs `runBuild`.
- **Planning sessions** are the person's conversations (`kind: "planning"`, opened with
  "ask what the person wants"); nothing writes plan documents without a person.
- **Approving does not start a build.** `approvePlan` (`lib/plans/approve.ts`) commits
  the documents, runs the contract and looks checks, sets `approved` and merges to the
  trunk; the admin route only calls it. The library has no access to the session host,
  so "approval starts the build" belongs in the approve route (calling `startBuild`).
- **Looks approval** is the append-only `mockups/<app>/approved.json`, written only by
  the admin's approve and unapprove routes. "Are all a brief's looks approved?" is
  `unapprovedMockups(root, briefText)` (`lib/plans/approved-brief.ts`), empty when all are.
- **Step timing is not kept.** Session records are deleted when a session ends; build
  events carry no timestamps. (Speed item 3's.)

## Decisions

- **Looks are settled with the brief** (Sandy, 2026-10-18): drawn in its conversation and
  approved before planning starts; the unattended session never draws or approves one.
- **Accepting a brief starts it; approving the plan starts the build; the session decides
  and records rather than asking** (Sandy, 2026-10-18, accepting the brief's defaults;
  requests with a cost are `decisions-as-questions`).
- **A brief acceptance command is part of this plan**, since "starts on acceptance" needs
  an acceptance moment that a hand edit does not give.
- How an unattended run is shown is the activity page's (`activity-and-graph`).
- **The admin's interface is what draws** (Sandy, 2026-10-18): its `screens.json`
  `sources` was the whole `src`, so server code (`lib/build-host.ts`, API routes) counted
  as interface and `plans accept` refused any plan changing it with Looks `None`. Narrowed
  to `src/app` and `src/components`, with `src/app/api` excluded; the look check's route
  lookup learns that a source can be the app folder itself.

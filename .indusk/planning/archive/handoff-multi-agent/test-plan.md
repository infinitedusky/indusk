---
title: "Multi-Agent Coordination — Test Plan"
date: 2026-06-25
status: accepted
---

# Multi-Agent Coordination — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean concurrent agents can work on the same InDusk project without the file-collision and overwrite failures Sandy hit on 2026-05-25. Each assertion names the mechanism by which it will be tested — vitest unit, vitest integration (spawning real CLI subprocesses), end-to-end script, or manual smoke against two real Claude Code sessions.

The assertions here become the source rows for the impl's `## Test Trajectory` table. The ADR that follows is constrained by "what makes all these assertions true?" — for example, the assertion that one agent's presence is visible to another within seconds is what forces the presence-file location decision (workbench-level vs `~/.indusk/agents/{project}/` vs in-worktree).

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Two agents starting catchup at the same time both complete without one freezing or hanging on the other. | vitest integration (spawn two `indusk` CLI subprocesses concurrently) |
| A2 | When a new agent starts catchup, it can see the tasks the other currently-working agents are on. | manual smoke (two Claude Code sessions on the same project) + vitest integration |
| A3 | Registering as an agent makes you visible to other agents within 5 seconds. | vitest integration |
| A4 | An agent that ends cleanly disappears from the bulletin other agents see. | vitest integration |
| A5 | An agent that crashed without cleanup stops appearing on the bulletin after the configured stale TTL elapses. | vitest unit (mtime-manipulation fixture) |
| A6 | After someone commits an edit to the durable project-state file on main, the next agent's catchup reflects the new state. | manual smoke + vitest integration (git commit + spawn agent) |
| A7 | Running catchup does not modify any file that other agents would observe. | vitest unit (filesystem-mutation assertions on a temp project) |
| A8 | The deprecated handoff command exits with a message that tells the user what to do instead. | vitest unit |
| A9 | On a system where Claude Code's session ID env var is unset, agent registration still works and uses a stable per-session identifier. | vitest unit (env-stripped subprocess) |
| A10 | Two agents in different worktrees on the same workbench can each edit their own branches without their changes appearing in each other's working trees mid-session. | manual smoke against the worktree extension |
| A11 | A new teammate cloning the project sees no leftover presence files from the original developer's machine. | vitest unit (asserts presence directory is gitignored) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Catchup output is genuinely useful for a returning or fresh agent — neither overwhelming nor under-informative. | UX judgment; depends on session context that no automated test can reproduce. | Feedback signal: Sandy uses it daily; any session where catchup output feels wrong becomes a retrospective lesson. |
| U2 | The bulletin produces actual coordination behavior (agents notice and avoid each other's in-flight work), not just visible presence. | Coordination depends on agent reasoning, which is non-deterministic. | Telemetry alert: eval agent flags sessions where two agents touched the same file within 5 minutes; if the rate trends up, the bulletin isn't doing its job. |

## Notes

- A10 belongs in this plan because the multi-agent value proposition depends on worktree isolation. The worktree extension already has its own tests for the mechanism; A10 is the integration-level check that nothing in this plan breaks that promise.
- A6's "next agent's catchup reflects the new state" assumes the new agent has pulled main. If `current.md` lives on a branch and isn't merged, the new agent sees the previous state — which is the correct behavior (durable state only updates via merge). The assertion should be tested with an explicit `git commit` (not `git push`) to capture the local-only case.
- The session-ID mechanism (A9) needs a Phase 1 spike to confirm what Claude Code actually exposes. If the env var doesn't exist or isn't stable, the fallback (PID at start) is what A9 tests; if the env var does exist, A9 tests both paths.
- A11 is the gitignore assertion. Brief implies this but doesn't state it — surfacing as a test makes the convention explicit.

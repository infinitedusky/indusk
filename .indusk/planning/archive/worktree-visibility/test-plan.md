---
title: "Worktree Visibility — Test Plan"
date: 2026-07-12
status: accepted
---

# Worktree Visibility — Test Plan

## Purpose

The behavioral assertions that, taken together, mean worktree visibility is working. Each names the
mechanism that verifies it. These rows become the impl's Test Trajectory. The split is deliberate:
the **visibility half** (bulletin shows worktree/branch, collision flag, sanitization) is fully
unit/integration-testable against the `indusk agent` CLI on a tmp project; the **kickoff half**
(the skill actually creates a worktree at `/work` start) is skill-driven prose and verifies by
manual smoke.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Running `indusk agent list` shows each active session's worktree path and branch alongside its task. | vitest integration (register + list on a tmp project) |
| A2 | After a session moves into a different worktree/branch, the next `indusk agent list` shows the current branch — not the one captured when it first registered. | vitest integration |
| A3 | When two active sessions are both working in the shared trunk, `indusk agent list` shows a collision warning identifying them; two sessions in separate worktrees show no warning. | vitest integration |
| A4 | Pasting text that contains a `**Branch**:` or `**Worktree**:` line into a session's in-flight notes does not create a phantom agent or a spoofed worktree/branch value in `indusk agent list`. | vitest unit (section-body sanitizer) |
| A5 | `/catchup` reports other active agents' worktree and branch, and surfaces a same-trunk collision when one exists. | manual smoke (skill-driven, against a running stack with two sessions) |
| A6 | Starting `/work` on a plan with no opt-out results in a git worktree existing for that plan before any code file is edited. | manual smoke |
| A7 | Starting `/work` on a plan whose impl frontmatter has `worktree: none` proceeds in the current tree with no worktree created. | manual smoke |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The kickoff step reliably creates/confirms a worktree whenever an agent runs `/work` on a default plan. | The behavior is executed by an LLM following skill prose, not deterministic code — can't be asserted in vitest. | The *decision* the skill reads (frontmatter `worktree: none` → skip, else → create) is extracted into a pure helper with unit tests; A6/A7 manual smokes exercise the end-to-end behavior; failure mode is visible (no worktree → collision flag from A3 fires). |

## Notes

- A6/A7 test *observable outcome* (a worktree exists / doesn't), via manual smoke. The pure decision
  helper behind them (read frontmatter → create-or-skip) gets its own vitest unit in the impl, so the
  logic is deterministically covered even though the skill's execution isn't.
- Trunk-vs-worktree detection is exercised through A3 (the collision flag depends on classifying a
  session as "in the trunk") — no separate assertion row, to avoid over-specifying an internal helper.
- Recompute-not-snapshot (A2) is the one assertion that would silently pass against a naive
  implementation that stores the branch once; it must be authored to *change* the branch between
  register and list.

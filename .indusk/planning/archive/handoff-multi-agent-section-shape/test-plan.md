---
title: "handoff-multi-agent section shape — Test Plan"
date: 2026-06-26
status: accepted
---

# handoff-multi-agent section shape — Test Plan

## Purpose

This document lists the behavioral assertions that must be true for the section-shape rework to be working. Each assertion names the mechanism by which it will be tested.

The assertions here become the source rows for the impl's `## Test Trajectory` table. The plan reshapes the surface of an already-shipped feature — so the assertions are split into two groups: **new shape** (assertions this rework introduces) and **parent regressions** (invariants from `handoff-multi-agent` that must not break).

## Behavioral Assertions — New Shape

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | After an agent runs handoff, only its own section in `.indusk/current.md` has changed — other agents' sections are byte-identical before vs after. | vitest unit + e2e (two-session fixture against tmp project) |
| A2 | When an agent's session ID has no matching section in `current.md` and it runs handoff, a new section is appended tagged with its session ID. | vitest unit + e2e |
| A3 | A new agent's catchup output lists every fresh session present in `current.md` (other agents working on the project), with their tasks. | manual smoke + vitest integration (parse catchup output) |
| A4 | Any agent can edit the `Project (shared)` section without changing any session-owned section. | vitest unit |
| A5 | The agent updates its in-flight / open-questions / cursor content via a single structured MCP tool call (no free-form file editing required). | vitest unit on the MCP tool |
| A6 | Two agents on different branches both run handoff; merging both branches to main produces no merge conflict because they touched different sections. | e2e (git fixture: two worktrees, two handoffs, merge sequence) |
| A7 | `indusk agent done` removes only the calling agent's section from `current.md`; other sections survive. | vitest unit |
| A8 | `indusk agent prune` removes sections whose `Last updated` timestamp is older than `agents.stale_ttl_minutes`; fresh sections survive. | vitest unit (timestamp fixture) |
| A9 | Fresh `indusk init` creates `current.md` containing a `Project (shared)` section and no session sections. | vitest integration |
| A10 | Running `indusk update` on a pre-section-shape project migrates the template if it's still the empty version from the previous plan; if the user has edited it, the content is preserved untouched. | vitest integration |

## Behavioral Assertions — Parent Regressions

These were behavioral assertions of the parent `handoff-multi-agent` plan. They must remain true after this rework.

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A11 | Running `/catchup` does not modify any file (other than the agent's own section after it explicitly chooses to write via the MCP tool — but catchup itself is read-only). | vitest unit (filesystem-mutation diff before/after) |
| A12 | A session ID containing path-traversal characters (`..`, `/`, `\`, leading `.`) cannot cause section writes or removals to escape `.indusk/current.md`. | vitest unit (sanitizer regression) |
| A13 | A teammate cloning the project sees no leftover session sections from the original developer's machine — `current.md` is committed; sections are committed; nothing leaks via untracked files. | vitest unit (git status check post-init) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Working agents actually call the `update_current_section` MCP tool at meaningful moments during real Claude Code sessions, rather than letting `current.md` go stale. | Depends on agent reasoning + skill discipline; non-deterministic. | Feedback signal: Sandy uses the system daily; sessions that should have updated `current.md` and didn't become a retrospective lesson. If the rate is high, follow-up plan to bake the trigger into a skill or hook. |

## Notes

- A3 has both manual smoke and vitest integration mechanisms. The vitest integration parses the catchup skill's output text; manual smoke is two real Claude Code sessions and the human reading the catchup summary. Manual smoke is the load-bearing one for outsider-readability; vitest catches regressions in the parse-and-format logic.
- A6's e2e fixture is a real git workflow: spawn two worktrees, write a section in each on its own branch, attempt merge, assert no conflict. If git's auto-merge doesn't handle different-section edits cleanly, that's a finding worth surfacing — could indicate the section boundaries need clearer delimiters (e.g., `---` separators with stable markers).
- A11 is the pure-read invariant from the parent plan. It's listed as a regression check because catchup's behavior changes (reads sections instead of fixed structure + glob), and the new code path needs to preserve the no-mutation guarantee.
- U1's mitigation explicitly does NOT include "build a hook that forces the agent to update." That's a possible v2 if the feedback signal says it's needed; the brief deliberately punts on auto-trigger discipline.

---
title: "git-only-substrate — Test Plan"
date: 2026-06-27
status: accepted
---

# git-only-substrate — Test Plan

## Purpose

This test plan enumerates the behavioral assertions that must hold for the git-only-substrate plan to be working. Two phases of behavior:

- **Phase A (parity)** — git-mode projects gain full semantic graph + Graphiti file-linkage functionality. The visible change: `indusk graph sync` populates events on git projects, `graph_capture` writes file-linkage edges, rebase produces convergent state.
- **Phase B (rip-out)** — jj support is removed from the codebase, skills, and docs. The visible change: developer experience is single-SCM. `getScm`, `jj.ts`, `jj.md`, dual-form skill prose, eval-prompt branching, and the `jj describe` trigger pattern are all gone.

Each assertion becomes a trajectory row in the impl. The mechanism column names the test approach, not the test code.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | On a fresh git project, running `indusk graph sync` after a commit produces events in `.indusk/graph/semantic-graph.log` and `indusk graph status` reports anchors > 0 (replaces today's "git mode — semantic graph unavailable" stderr no-op). | end-to-end script (init tmp git project, commit a file, run `indusk graph sync`, assert log + status output) |
| A2 | A `graph_capture` call on a git-mode project writes both the Graphiti episode AND an `edge.attached` event to `.indusk/graph/semantic-graph.log` connecting the episode UUID to the file anchor. | vitest integration (real semantic-graph + log writer; stubbed Graphiti client) |
| A3 | After `indusk graph sync` → `git rebase -i HEAD~3` (rewriting commit history without changing file content) → `indusk graph sync` again, the runtime state reflects current file paths and contents. No orphaned anchors for files whose blob hash matches their current path. | end-to-end script |
| A4 | After `indusk graph sync` → `git mv` a file to a new path + commit → `indusk graph sync` again, the file's anchor UUID is preserved across the move (rename detection produces an `anchor.moved` event, not `tombstoned` + `created`). | end-to-end script |
| A5 | After `mcp__indusk__graph_capture` is called with a `file_path` argument on a git-mode project, the resulting `edge.attached` event has the file's anchor UUID as the target (not a project-root fallback anchor). | vitest integration |
| B1 | A search across `apps/indusk-mcp/src/` for `getScm`, `jj.ts`, `NotAJjRepoError`, or `getJjReachable` finds zero matches (the SCM abstraction layer and jj-specific helpers are gone). | vitest unit (grep-style static assertion against the source tree) |
| B2 | `apps/indusk-mcp/skills/jj.md` does not exist on disk; `apps/indusk-mcp/skills/git.md` does exist and contains no "if your project uses jj" framing. | vitest unit (filesystem + content assertion) |
| B3 | The eval-trigger hook fires on `git commit` bash commands but does NOT fire on `jj describe`, `jj split`, or any other jj subcommand (regex narrowed from `/\b(jj describe\|git commit)\b/` to `/\bgit commit\b/`). | vitest unit (existing eval-trigger test pattern; updated assertions) |
| B4 | The eval agent's prompt's diff-fetch instruction says `git show ${id}` regardless of project; never `jj diff -r ${id}`. | vitest unit (prompt-builder source assertion) |
| B5 | Running `indusk update` on a project whose `.indusk/config.json` has `scm: "jj"` emits exactly one stderr nudge (text: "scm field no longer used; safe to remove from .indusk/config.json") and leaves the config file's contents byte-unchanged. | end-to-end script |
| B6 | The skills `apps/indusk-mcp/skills/{work,highlight,eval-review}.md` contain no SCM-conditional "if jj... else git..." prose patterns — every commit-cadence and diff-fetch reference is single-form (git only). | vitest unit (grep-style assertion on skill file content) |
| B7 | `apps/docs/src/guide/scm.md` opens as a git workflow guide (no "choose your SCM" framing; no jj presented as a current option). `apps/docs/src/decisions/git-or-jj-substrate.md` carries a supersession banner at the top pointing to this plan's ADR. | vitest unit (file content assertions) |
| B8 | `pnpm test` from the repo root passes after every code, skill, and doc change lands. Every existing test that previously asserted dual-SCM behavior either updates to assert git-only behavior or is deleted with rationale. | CI / vitest run from repo root |

## Untestable Assertions

None deferred — every assertion in this plan can be verified by test or static check.

The one judgment call worth naming explicitly: the impl will produce noisy semantic-graph log entries after a rebase (extra `anchor.moved` or `anchor.created` events for files that didn't change). The convergence test (A3) asserts that the runtime ends up correct — not that the log is minimal. We accept noise as a known trade-off of the content-keyed-dedup approach; a future plan could add log compaction, but it's out of scope here.

## Notes

- A1, A3, A4, and B5 share an end-to-end script harness (init tmp git project + run CLI commands + assert filesystem state). Factor a single helper rather than duplicating setup.
- B3's hook test reuses the existing source-level grep pattern at `apps/indusk-mcp/src/__tests__/eval-trigger-git-mode.test.ts` and `eval-trigger-filter-falsepositives.test.ts`. Update assertions; don't author a new harness.
- B1 and B6 use `Bun.glob`/`globSync` + `readFileSync` to walk the source tree and assert patterns; this style is established at `apps/indusk-mcp/src/__tests__/init-globsync-hooks.test.ts`.
- A2 and A5 may benefit from a fixture project layout that's currently absent from the test tree. If so, capture as a setup helper and document.

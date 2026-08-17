---
title: "jj Residue Rip-Out"
date: 2026-08-13
status: accepted
---

# jj Residue Rip-Out — Brief

## Problem

The [`git-only-substrate`](../archive/git-only-substrate/) plan shipped on 2026-06-27 (1.31.0) and declared jj removed. Its enforcement test — `apps/indusk-mcp/src/__tests__/scm-rip-out-grep.test.ts` — has been green ever since.

It was green for a structural reason, not because jj was gone. That plan's test-plan assertion B1 reads:

> A search across `apps/indusk-mcp/src/` for `getScm`, `jj.ts`, `NotAJjRepoError`, or `getJjReachable` finds zero matches…

Both halves of that assertion are narrower than the codebase:

1. **Path scope.** `SRC_ROOT` resolves to `apps/indusk-mcp`. The test has never scanned `apps/indusk-admin/`.
2. **Pattern scope.** All five `FORBIDDEN_PATTERNS` are TypeScript symbol names. None of them match an argv-level `execFileSync("jj", [...])`.

`apps/indusk-admin/src/lib/vcs.ts` sits in the intersection of those two gaps. It calls `jj log` — **tried first**, before git, once per commit id, on every scorecard render. It was created 2026-04-19, two months *before* the rip-out, so this is residue the rip-out never looked at rather than a reintroduction. Its doc comment still asserts jj is "the project default in dusk," which stopped being true five minor versions ago.

The cost so far is small and real: a failed process spawn per commit id on any machine without jj, and user-facing UI copy instructing people to run `jj describe`. The larger cost is that the project believes this is done. That belief is load-bearing — `git-only-substrate`'s own retrospective lists "T6 (zero `getScm` matches in production source) was green" among the gates that falsification had to see past, and this is the same failure mode surviving undetected in the same plan's enforcement test.

## Proposed Direction

**Widen the enforcement test before removing anything, and require it to go red.**

The removals themselves are mechanical — one executing call site, four copy strings, a deprecated config field, some stale comments. Doing them first would leave the same blind test behind and no evidence it can ever fail. So the sequence inverts: Test Phase 1 rewrites `scm-rip-out-grep.test.ts` to scan both apps and to match jj at the argv level, and confirms it goes **red against today's tree**. Only then do the removals turn it green.

That ordering is the whole point of the plan. A green test we cannot make fail is what produced this situation; the deliverable is a test with a demonstrated red state, and the removals are what happens to satisfy it.

Removals, once the tripwire is armed:

- **Executing code** — collapse `vcs.ts` to a git-only lookup, deleting the jj branch and its false doc comment.
- **User-facing copy** — `Scorecards.tsx` (3 spots) and `scorecards/page.tsx` say `jj describe`; they should say `git commit`.
- **Back-compat shim** — the `scm?: "jj" | "git"` config field, the one-time `indusk update` nudge, and the nudge's test. Shipped 1.31.0, now 1.36.0; the deprecation window has served its purpose. Old `config.json` files keep an ignored field, which is harmless because nothing will read it.
- **Stale comments** — `init.ts` (the `.jj/` ignore entry and a historical reference), `lib/eval/findings.ts`, `lib/eval/prompt-builder.ts`. The last also describes writing findings to Graphiti, which the makeover removed.
- **One docs page** — `reference/semantic-graph/jj-dependency.md`.

## Context

Prior art: [`git-only-substrate`](../archive/git-only-substrate/) (the rip-out this one finishes) and [`git-or-jj-substrate`](../archive/git-or-jj-substrate/) (the superseded decision to support both). Both stay on disk — they are the decision record.

Scope was established by a scripted census across the repo rather than by reading, per the [scripted-census-over-manual-survey](../../../.claude/lessons/scripted-census-over-manual-survey-for-fan-out-counts.md) lesson. The census returned ~110 files mentioning jj; all but ~15 are historical records that must not be touched.

## Scope

### In Scope

- `apps/indusk-admin/src/lib/vcs.ts` — remove the jj execution path
- `apps/indusk-admin/src/components/Scorecards.tsx` — 3 copy strings
- `apps/indusk-admin/src/app/p/[project]/scorecards/page.tsx` — empty-state copy
- `apps/indusk-mcp/src/lib/config.ts` — the `scm?: "jj" | "git"` field
- `apps/indusk-mcp/src/bin/commands/update.ts` — the `scm: "jj"` nudge
- `apps/indusk-mcp/src/__tests__/update-scm-jj-nudge.test.ts` — delete
- `apps/indusk-mcp/src/__tests__/scm-rip-out-grep.test.ts` — **widen** (both apps, argv-level patterns)
- `apps/indusk-mcp/src/bin/commands/init.ts` — `.jj/` ignore entry + stale comment
- `apps/indusk-mcp/src/lib/eval/findings.ts`, `lib/eval/prompt-builder.ts` — stale doc comments
- `apps/docs/src/reference/semantic-graph/jj-dependency.md` — delete

### Out of Scope

- **`apps/docs/src/decisions/git-or-jj-substrate.md` and `apps/docs/src/lessons/git-or-jj-substrate.md`** — superseded records. Deleting an ADR destroys the decision record; superseded is a status, not a reason to remove.
- **~60 files under `.indusk/planning/`** — the historical archive, including both predecessor plan folders.
- **`apps/docs/src/guide/scm.md`** — already correct. It is the git-only page and its jj mentions are an accurate migration note.
- **The other 8 pages in `apps/docs/src/reference/semantic-graph/`** — they document a subsystem the makeover removed entirely. That is a real docs problem and a larger one than jj, but it is not this plan.
- Any change to eval-trigger behavior, hook registration, or the commit cadence.

## Success Criteria

- `scm-rip-out-grep.test.ts` scans both `apps/indusk-mcp/` and `apps/indusk-admin/`, matches jj at the argv level, and **has been observed red** against the pre-removal tree.
- No file outside `.indusk/planning/`, `apps/docs/src/decisions/`, `apps/docs/src/lessons/`, and `apps/docs/src/guide/scm.md` executes or names jj as a live option.
- The admin scorecards page renders commit messages with no `jj` process spawn.
- No user-facing string instructs anyone to run a jj command.
- `pnpm check` and the full `pnpm test` suite pass.

## Depends On

- None.

## Blocks

- None.

## Notes

- Deleting `update-scm-jj-nudge.test.ts` also removes one of the four test files that leak orphaned telemetry daemon pairs (diagnosed separately this session — one pair per CLI invocation, never reaped). Incidental benefit, not a reason for this plan; the telemetry leak needs its own fix for the other three files.
- The `scm: "jj"` removal is a deliberate deprecation-window close, decided in conversation on 2026-08-13.

---
title: "Worktree Visibility"
date: 2026-07-12
status: accepted
---

# Worktree Visibility — Brief

## Problem

Concurrent Claude Code sessions on one project collide on a shared working tree. The worktree
substrate that solves this already exists (the worktree extension), and Graphiti carries the lesson
that worktree-per-branch *"eliminated the concurrent-session git collision class entirely."* But two
gaps keep it from paying off: the presence bulletin doesn't **show** which worktree/branch a session
is in (so isolation is invisible — you can watch collisions happen but nothing prevents them), and
worktrees only get created when an agent remembers to (so most work still lands in the trunk). The
result is that the isolation mechanism exists but isn't the default, and its absence isn't observable.

## Proposed Direction

Two coupled moves, both dusk-owned and generic to any workbench-shaped project.

**1. Make isolation observable (the deliverable).** `indusk agent register` records each session's
worktree path + branch; `indusk agent list` shows them as columns; catchup surfaces them (it already
consumes `agent list`). This is mostly finishing a stub — `agentRegister` already computes the branch
from cwd and discards it. Because the field is visible, a **same-tree collision flag** falls out for
free: when ≥2 fresh sessions share a tree (the real case being both in the trunk), `agent list` /
catchup flags it. One design decision rides along: the `agent list` self-heartbeat must **recompute**
branch/worktree from cwd, not re-stamp the register-time snapshot, because agents move between trunk
and worktree mid-session.

**2. Make isolation automatic — worktree-per-plan (what makes #1 worth having).** Bind the worktree
to the *plan*, not the session. Every plan gets a worktree by default, created as the **first step of
impl** (a kickoff step, at the research→impl boundary — research/brief/ADR only write plan docs and
are trunk-safe). A plan opts out with **`worktree: none`** in impl frontmatter. This is the universal
default because worktrees are cheap (`worktreeCreate` auto-provisions env in one shot) and the payoff
is the **clean PR flow**: one plan → one branch → one worktree → PR → merge-and-delete. "No overlap"
becomes true by construction; #1 just makes it visible.

Visibility alone would only let you *watch* collisions. The plan→worktree binding is the load-bearing
half — it's what eliminates them.

## Context

Full findings in [research.md](research.md). Grounding facts:

- `agentRegister` ([agent.ts:112](../../../apps/indusk-mcp/src/bin/commands/agent.ts#L112)) already
  accepts `--branch`/`--worktree` and computes `currentBranch()`, then discards it (`void _branch`).
  Adding capture = 2 fields on `AgentSection`, 2 marker lines (must be added to the parser's
  forbidden-marker sanitization list), 1 table column.
- `worktreeCreate(slug, baseBranch)`
  ([worktree.ts:97](../../../apps/indusk-mcp/src/bin/commands/worktree.ts#L97)) creates the worktree
  and auto-provisions env in one call.
- Worktree policy is a new axis from the existing `WORKFLOW_GATES` dispatch — implemented as a single
  `worktree: none` frontmatter flag read by the kickoff step, not a new per-workflow map or plan type.
- Revises the archived `planner-hotfix-mode` "no worktree" decision outright: hotfix now gets a
  worktree by default like every other workflow.
- dusk itself is workbench-shaped and dogfoods this.

## Scope

### In Scope

- `AgentSection` gains `branch` + `worktree` fields; parser/serializer emit/read `**Branch**:` /
  `**Worktree**:` marker lines; both added to `sanitizeSectionBody`'s forbidden-marker list.
- `indusk agent list` shows `WORKTREE` / `BRANCH` columns; self-heartbeat recomputes them from cwd.
- Same-tree collision flag in `agent list` output + catchup summary wording.
- A worktree kickoff step at the start of impl, driven by the planner + work skills, honoring the
  `worktree: none` frontmatter opt-out.
- `worktree: none` recognized in impl frontmatter as a general per-plan escape hatch; **no workflow
  sets it by default** (hotfix included — its shipped "no worktree" decision is reversed).
- Trunk-vs-worktree detection helper (mechanism chosen in test-plan/impl).

### Out of Scope

- Concurrent-migration coordination (Drizzle / Supabase) — per-project schema concern, not dusk.
- Making a worktree required for *every session* — rejected; read-only sessions stay lightweight.
  The binding is to the plan's impl, not to sessions.
- A hard write-gate ("no writes without a plan") — not needed; isolation is the plan's job and only
  impl code writes need it.
- numero process (CI gating, staging-branch retirement, feature flags) — separate, project-local.

## Success Criteria

- `indusk agent list` shows each live session's worktree + branch, recomputed (never stale).
- Two sessions both sitting in the trunk are flagged, in both `agent list` and catchup.
- Starting impl on a default plan creates (or confirms) a worktree before code is written; a
  `worktree: none` plan proceeds in place with no worktree.
- The whole thing dogfoods on dusk without friction — the kickoff step is a nudge, not a wall (see
  open decision).

## Open Decisions (for the ADR)

- **Hard gate vs. nudge at impl kickoff.** Does `check-gates.js` *refuse* impl Phase 1 progress until
  a worktree exists (for non-opted-out plans), or loudly nudge? Recommendation: **nudge first**, flip
  to hard once the kickoff step is proven frictionless — a hard gate as step one is how gates get
  disabled.
- ~~Does hotfix's template ship `worktree: none`?~~ **Resolved: no.** Hotfix gets a worktree by
  default like every other workflow; `worktree: none` stays a general per-plan escape hatch that no
  workflow ships by default.

## Depends On

- Worktree extension (shipped: `indusk-worktree-extension`) — the substrate this builds on.

## Blocks

- Nothing currently. Generalizes the multi-agent coordination line
  (`handoff-multi-agent-section-shape`).

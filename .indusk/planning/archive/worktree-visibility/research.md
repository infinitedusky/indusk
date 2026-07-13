---
title: "Worktree Visibility"
date: 2026-07-12
status: complete
---

# Worktree Visibility — Research

## Question

Concurrent Claude Code sessions on one project repeatedly collide on a shared working tree.
Graphiti already carries the lesson: *"isolating work in git worktrees per branch eliminated the
concurrent-session git collision class entirely."* The worktree *substrate* exists (the worktree
extension). What's missing is (a) the presence bulletin **showing** which worktree/branch each
session is in, and (b) worktrees getting created *by default for the work that needs them* instead of
by an agent remembering to. What is the smallest dusk-owned change that makes agent isolation
**observable** and **automatic**?

Scope note: this research covers the generic InDusk tooling only. Per-project schema concerns
(Drizzle/Supabase migration collisions) are explicitly out — that's project process, not dusk.

## Findings

### The presence bulletin already half-implements worktree binding

`indusk agent register` ([apps/indusk-mcp/src/bin/commands/agent.ts:112](../../../apps/indusk-mcp/src/bin/commands/agent.ts#L112))
**already** accepts `--branch` and `--worktree` options, and already computes the branch from cwd via
`currentBranch()` — then explicitly discards it:

```ts
const branch = opts.branch ?? currentBranch(opts.worktree ?? process.cwd());
const _branch = branch; // currently stored only for future use; sections don't carry branch yet
void _branch;
```

So worktree/branch capture is a **finished-stub**, not net-new work. The gap:

- `AgentSection` ([apps/indusk-mcp/src/lib/agents/current-md.ts:89](../../../apps/indusk-mcp/src/lib/agents/current-md.ts#L89))
  carries `sessionId`, `sessionShort`, `task`, `lastUpdated`, `inFlight`, `openQuestions`, `cursor` —
  no `branch` / `worktree` fields.
- The serializer/parser emit/read marker lines `**Session ID**:` and `**Last updated**:`. Adding
  `**Branch**:` / `**Worktree**:` follows the same pattern. **Caveat:** the parser has a
  forbidden-marker sanitization list (`sanitizeSectionBody`) — any new marker line must be considered
  there so a section body can't inject a fake one (same class as the Phase 6 falsification fix in
  handoff-multi-agent-section-shape).
- `formatTable` ([agent.ts:176](../../../apps/indusk-mcp/src/bin/commands/agent.ts#L176)) prints
  `SESSION | TASK | LAST UPDATED` — no `WORKTREE` / `BRANCH` column.

### Snapshot vs. recompute is a real decision, not a detail

`agent register` captures branch/worktree from cwd **at register time**. But an agent moves between
trunk and worktree mid-session (that is the whole point of the automatic-worktree half). The
`agent list` self-heartbeat ([agent.ts:200](../../../apps/indusk-mcp/src/bin/commands/agent.ts#L200))
re-upserts the caller's section with **preserved fields** and only bumps `lastUpdated` — so a stale
branch would be faithfully re-stamped on every `list`. To keep the board honest, the heartbeat must
**recompute** branch/worktree from cwd (one `git rev-parse`; the `currentBranch()` helper already
exists). This is cheap but must be decided explicitly — snapshot-and-drift is the wrong default for a
who-is-where board.

### Catchup already consumes the bulletin — visibility flows for free

The catchup skill ([apps/indusk-mcp/skills/catchup.md:178](../../../apps/indusk-mcp/skills/catchup.md#L178))
already reads `indusk agent list` and surfaces "other agents currently working," and explicitly
states *"the bulletin is visibility, not coordination — the working agent owns the avoid-stepping-on-
each-other judgment."* So once worktree/branch are columns, catchup surfaces them with no skill
change beyond wording. The same data supports a **same-tree collision flag**: when ≥2 fresh
(non-stale) sessions share a tree — the real case being both in the trunk — `agent list` / catchup can
flag it. That is a *read over the same data*, not a separate feature.

### Worktree creation is already a one-shot CLI call

`worktreeCreate(slug, baseBranch)`
([apps/indusk-mcp/src/bin/commands/worktree.ts:97](../../../apps/indusk-mcp/src/bin/commands/worktree.ts#L97))
creates the worktree **and** auto-provisions its env (`provisionWorktreeEnv`, doppler) in one shot.
So "create a worktree at the start of impl" is a single `indusk worktree create <slug>` invocation —
no new provisioning machinery. The worktree extension is opt-in (`required: false`) and applies to
workbench-shaped projects; dusk itself is workbench-shaped and can dogfood.

### Workflow-type dispatch exists — but keys a different axis

`detectWorkflow` + `WORKFLOW_GATES` ([apps/indusk-mcp/hooks/check-gates.js:116](../../../apps/indusk-mcp/hooks/check-gates.js#L116))
parse `workflow:\s*(bugfix|refactor|feature|spike)` from impl frontmatter and map each workflow to a
list of **gate section types** (`verification`/`otel`/`context`/`document`). Worktree policy is a
*different axis* — not a gate section.

**Decision (2026-07-12): worktree-per-plan is the universal default, NOT keyed off workflow type.**
Worktrees are cheap (`worktreeCreate` is a one-shot auto-provision) and the real prize is the clean
PR flow — one plan → one branch → one worktree → PR → merge-and-delete. So every workflow gets a
worktree at impl kickoff by default; a plan opts out with **`worktree: none`** in impl frontmatter.
This supersedes the earlier "keyed per workflow" framing and revises the archived
**`planner-hotfix-mode`** decision (*"created in the current working directory (not a worktree)"*)
outright: hotfix now gets a worktree by default too, with no template opt-out. `worktree: none`
survives only as a general per-plan escape hatch that no workflow ships by default. The mechanism is
a single frontmatter flag read by the kickoff step — no new `WORKFLOW_WORKTREE` map, no new plan type.

Note: on this branch (`plan/cleanup-ritual-phase-0`) the `detectWorkflow` regex does **not** yet list
`hotfix` — that shipped on `plan/planner-hotfix-mode-phase-1`. Irrelevant to the frontmatter-flag
mechanism, which doesn't depend on the workflow enum.

### Where the worktree step belongs in the lifecycle

Research/brief/ADR are *thinking* stages — they write only plan docs into
`.indusk/planning/<plan>/`, which are trunk-safe and frequently never ship code (a plan can die at
brief). Impl is the *writing* stage. So the natural creation point is the **research→impl boundary**:
the first step of impl (a kickoff / Phase 0), not plan creation. This also means there is **no broad
"which writes need a plan" exemption taxonomy** to get wrong — the only writes needing isolation are
impl code writes, and impl already has phases. The planner skill currently has no "kickoff phase"
concept that provisions environment; ritual phases (falsify, cleanup) are authored *into* impl.md, so
a kickoff step is a compatible extension of the same pattern.

## Open Questions

- **Hard gate vs. nudge at impl kickoff.** Should `check-gates.js` *refuse* to let a
  worktree-requiring impl's Phase 1 items be checked until a worktree exists, or loudly nudge? Hotfix
  proves per-workflow rules are cheap to express, so hard is feasible — but a hard gate as step one is
  how gates get disabled. (Resolve in the ADR.)
- ~~Which workflows require a worktree?~~ **Resolved 2026-07-12:** all of them, by default;
  `worktree: none` frontmatter opts out. Not keyed off workflow type.
- **Trunk detection mechanism.** How does a session know it's "in the trunk" vs. a worktree —
  `git rev-parse --show-toplevel` compared against the workbench's `worktree.wrapped_repo`, or
  `git worktree list` membership? (Resolve in test-plan/impl.)

## Sources

- `apps/indusk-mcp/src/bin/commands/agent.ts` — presence CLI (the half-built stub)
- `apps/indusk-mcp/src/lib/agents/current-md.ts` — `AgentSection` + parser/serializer
- `apps/indusk-mcp/src/bin/commands/worktree.ts` — `worktreeCreate` + env auto-provision
- `apps/indusk-mcp/hooks/check-gates.js` — `detectWorkflow` / `WORKFLOW_GATES` dispatch
- `apps/indusk-mcp/skills/catchup.md` — existing bulletin consumer
- `.indusk/planning/archive/planner-hotfix-mode/brief.md` — the "no worktree for hotfix" precedent
- Graphiti lesson: worktree-per-branch eliminated the concurrent-session collision class

---
title: "Worktree Visibility"
date: 2026-07-12
status: proposed
---

# Worktree Visibility

## Goal

**Make agent worktree isolation the default for every plan and observable in the presence bulletin —
so concurrent sessions stop colliding on the shared trunk, and you can always see who is where.**

Today two Claude Code sessions on one project can both edit the shared working tree and clobber each
other; the worktree extension that would isolate them exists but only fires when an agent remembers
to, and `indusk agent list` doesn't show which tree a session is in — so the collision class is both
un-prevented and invisible. After this ships, starting `/work` on a plan puts that plan in its own
worktree by default (one plan → one branch → one worktree → PR → merge-and-delete), and `agent list`
plus catchup show each session's worktree/branch and flag two sessions sharing the trunk.

## Y-Statement

**In the context of:**
multiple concurrent Claude Code sessions working on one workbench-shaped InDusk project, where the
worktree substrate already exists but isolation is neither the default nor visible in the presence
bulletin.

**Facing:**
sessions collide on the shared trunk and the collision is invisible until it bites, while the payoff
that isolation should unlock — a clean one-plan-one-branch PR flow — is left on the table because
worktrees are created ad hoc, if at all.

**We decided for:**
binding a worktree to each plan as the default first step of impl (opt out with `worktree: none` in
impl frontmatter), and surfacing each session's worktree/branch — recomputed live, not snapshotted —
as columns in `indusk agent list` and catchup, with a same-trunk collision flag derived from that
same data.

**And against:**
keying worktree policy off workflow type (a new per-workflow map for a decision that is uniformly
"yes"), a hard write-gate that blocks all writes without a plan (over-broad, deadlocks the plan
machinery, huge exemption taxonomy), and a hard gate at impl kickoff on day one (gets disabled before
it earns trust).

**To achieve:**
no-overlap-by-construction for the work that ships code, an observable who-is-where board, and the
clean PR discipline the `/git` skill already preaches — with the smallest possible code surface
(finishing an existing stub plus one frontmatter flag).

**Accepting:**
that the load-bearing half (the skill actually creating the worktree at `/work`) is LLM-executed
prose verified by manual smoke rather than a deterministic test; that this revises the shipped
`planner-hotfix-mode` "no worktree" decision outright (hotfix now gets a worktree too); and that the
kickoff step ships as a *nudge* first, leaving a hard gate as a deliberate later flip once the step
is proven frictionless.

**Because:**
worktrees are cheap now (`worktreeCreate` auto-provisions env in one shot), cheap enough that even a
hotfix should land in its own worktree → PR → merge-and-delete — so the default is genuinely
universal across every workflow, with `worktree: none` surviving only as a deliberate per-plan escape
hatch that no workflow ships by default; and visibility without automatic isolation just gives a
nicer view of the same collisions.

## Context

Situation and grounding are in [research.md](research.md) and [brief.md](brief.md). The two halves:

1. **Visibility** — `agentRegister` already computes the branch from cwd and discards it
   (`void _branch` at [agent.ts:112](../../../apps/indusk-mcp/src/bin/commands/agent.ts#L112)).
   Finishing it means adding `branch`/`worktree` to `AgentSection`, two marker lines (added to the
   `sanitizeSectionBody` forbidden-marker list), a table column, and making the `agent list`
   self-heartbeat recompute rather than re-stamp.
2. **Automatic isolation** — `worktreeCreate(slug, baseBranch)`
   ([worktree.ts:97](../../../apps/indusk-mcp/src/bin/commands/worktree.ts#L97)) already creates +
   provisions a worktree in one call. The planner authors a kickoff step at the top of impl; `/work`
   executes it, reading the `worktree: none` frontmatter flag to decide create-or-skip.

## Decision

1. **Worktree-per-plan is the universal default.** Every plan gets a worktree, created as the first
   step of impl (the research→impl boundary). Not keyed off workflow type.
2. **Opt out with `worktree: none` in impl frontmatter.** Single flag, read by the kickoff step. No
   new `WORKFLOW_WORKTREE` map, no new plan type.
3. **hotfix gets a worktree too — no template opt-out.** *(Resolved open decision.)* Worktrees are
   cheap enough (`worktreeCreate` one-shot) that even a hotfix should land in its own worktree → PR →
   merge-and-delete rather than branch-in-trunk. This revises the shipped `planner-hotfix-mode` "no
   worktree" decision outright: hotfix's template does **not** ship `worktree: none`. The
   `worktree: none` flag remains as a general escape hatch, but **no workflow sets it by default** —
   a plan uses it only when an author deliberately wants in-trunk for that specific plan.
4. **Kickoff is a nudge, not a hard gate, in v1.** *(Resolved open decision.)* `/work` prompts to
   create a worktree when starting impl on a non-opted-out plan sitting in the trunk; it does not
   block. `check-gates.js` gains no worktree enforcement in v1. Revisit a hard gate only after the
   nudge is proven frictionless in dogfooding.
5. **Visibility fields recompute live.** The `agent list` self-heartbeat recomputes branch/worktree
   from cwd; the register-time value is a seed, not the source of truth.
6. **Collision flag is a read, not a feature.** ≥2 fresh sessions sharing a tree (the real case:
   both in the trunk) → a warning in `agent list` and catchup. No new storage.

## Alternatives Considered

### Key worktree policy off workflow type (new `WORKFLOW_WORKTREE` map)
Rejected. The decision is uniformly "yes" for every workflow; a per-workflow map encodes a matrix for
a non-matrix policy. A single frontmatter flag covers the one real exception (hotfix) and any future
per-plan judgment without new dispatch code.

### Hard write-gate: no writes without a plan
Rejected. Over-broad — it must exempt the plan's own docs, `current.md`, eval logs, hook state, and
presence writes, and getting that exemption taxonomy wrong deadlocks the plan machinery from
bootstrapping itself (same over-match failure class as documented hook regexes). Isolation only needs
to cover impl *code* writes, which already live behind impl phases.

### Hard gate at impl kickoff on day one
Rejected for v1. Feasible (the gate machinery expresses per-workflow rules cheaply), but a hard gate
introduced before the kickoff step is proven frictionless is the classic path to a disabled gate.
Nudge first, earn the gate.

### Snapshot branch/worktree at register time
Rejected. Agents move between trunk and worktree mid-session; a snapshot re-stamped by the heartbeat
would show a confidently-wrong branch. A who-is-where board must recompute.

## Consequences

### Positive
- Concurrent-session trunk collisions eliminated by construction for the work that ships code.
- Clean PR flow becomes the default path, not a discipline to remember.
- Isolation is observable — `agent list`/catchup answer "who is where" and flag the collision case.
- Tiny code surface: finish a stub + one frontmatter flag + a skill kickoff step.

### Negative
- The load-bearing behavior (skill creates the worktree) is verified by manual smoke, not vitest.
- Revises shipped `planner-hotfix-mode` behavior (hotfix now gets a worktree; its "no worktree"
  decision is reversed).
- A nudge (not a gate) means a determined agent can still start impl in the trunk — accepted for v1.

### Risks
- **Nudge ignored → collisions persist.** Mitigation: the A3 collision flag makes the failure
  self-announcing in `agent list`/catchup; a hard gate is a known, cheap follow-up if the nudge under-
  performs.
- **Recompute cost on every `agent list`.** Mitigation: it's one `git rev-parse`; the heartbeat
  already writes the file, so the marginal cost is negligible.
- **Marker-line injection via section bodies.** Mitigation: `**Branch**:`/`**Worktree**:` join the
  `sanitizeSectionBody` forbidden-marker list (A4), same defense as the handoff-section-shape fix.

## Documentation Plan

### Pages
- Update: `apps/docs/src/guide/multi-agent.md` — worktree/branch now shown in the bulletin; collision flag.
- Update: `apps/docs/src/reference/cli/agent.md` (or equivalent) — new `WORKTREE`/`BRANCH` columns.
- Update: worktree extension skill / worktree-setup guide — worktree-per-plan default + `worktree: none` opt-out.
- Update: planner + work skill reference — the impl kickoff step.

### Diagrams
- Update the multi-agent sequence/state diagram to show the impl-kickoff worktree creation and the
  bulletin surfacing worktree/branch.

### Changelog
- "Worktree-per-plan by default at impl kickoff (`worktree: none` to opt out); `indusk agent list`
  and catchup now show each session's worktree/branch and flag same-trunk collisions."

### ADR in Docs
- Publish to `apps/docs/src/decisions/worktree-visibility.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/planning/archive/planner-hotfix-mode/` — the "no worktree" decision this revises
- `.indusk/planning/archive/handoff-multi-agent-section-shape/` — the bulletin this extends
- `.indusk/planning/archive/indusk-worktree-extension/` — the substrate this builds on

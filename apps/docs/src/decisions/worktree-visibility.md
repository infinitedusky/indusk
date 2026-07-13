---
title: "Worktree Visibility"
date: 2026-07-12
status: accepted
---

# Worktree Visibility

## Goal

**Make agent worktree isolation the default for every plan and observable in the presence bulletin —
so concurrent sessions stop colliding on the shared trunk, and you can always see who is where.**

Two Claude Code sessions on one project can both edit the shared working tree and clobber each other.
The worktree extension that would isolate them exists but only fires when an agent remembers to, and
`indusk agent list` doesn't show which tree a session is in — so the collision class is both
un-prevented and invisible. After this ships, starting `/work` on a plan puts that plan in its own
worktree by default (one plan → one branch → one worktree → PR → merge-and-delete), and `agent list`
plus catchup show each session's worktree/branch and flag two sessions sharing the trunk.

## Y-Statement

**In the context of:**
multiple concurrent Claude Code sessions on one workbench-shaped InDusk project, where the worktree
substrate exists but isolation is neither the default nor visible.

**Facing:**
sessions collide on the shared trunk and the collision is invisible until it bites, while the clean
one-plan-one-branch PR flow that isolation should unlock is left on the table because worktrees are
created ad hoc, if at all.

**We decided for:**
binding a worktree to each plan as the default first step of impl (opt out with `worktree: none` in
impl frontmatter), and surfacing each session's worktree/branch — recomputed live, not snapshotted —
in `indusk agent list` and catchup, with a same-trunk collision flag from the same data.

**And against:**
keying worktree policy off workflow type, a hard write-gate blocking all writes without a plan, and a
hard gate at impl kickoff on day one.

**To achieve:**
no-overlap-by-construction for the work that ships code, an observable who-is-where board, and the
clean PR discipline the `/git` skill already preaches — with the smallest possible code surface.

**Accepting:**
that the load-bearing half (the skill creating the worktree at `/work`) is manual-smoke-verified
rather than unit-tested; that this revises the shipped `planner-hotfix-mode` "no worktree" decision
(hotfix now gets a worktree too); and that the kickoff ships as a nudge first, leaving a hard gate as
a deliberate later flip.

**Because:**
worktrees are cheap now (`worktreeCreate` auto-provisions env in one shot), cheap enough that even a
hotfix should land in its own worktree, so a universal default with a per-plan opt-out is simpler and
safer than a policy matrix — and visibility without automatic isolation just gives a nicer view of
the same collisions.

## Decision

1. **Worktree-per-plan is the universal default**, created as the first step of impl (the
   research→impl boundary) — not keyed off workflow type.
2. **Opt out with `worktree: none`** in impl frontmatter — a single flag, no new dispatch map, no new
   plan type. **No workflow ships it by default**, including hotfix (whose "no worktree" decision is
   reversed).
3. **Kickoff is a nudge, not a hard gate, in v1.** `check-gates.js` gains no worktree enforcement;
   `/work` prompts to create a worktree when starting impl in the trunk. The collision flag makes an
   ignored nudge self-announcing; a hard gate stays a cheap follow-up.
4. **Visibility fields recompute live** — the `agent list` self-heartbeat recomputes branch/worktree
   from cwd; the register-time value is a seed, not the source of truth.
5. **The collision flag is a read, not a feature** — ≥2 fresh sessions sharing a tree → a warning in
   `agent list` and catchup.

## Consequences

- **Positive:** concurrent-session trunk collisions eliminated by construction for code-shipping work;
  clean PR flow becomes the default path; isolation is observable; tiny code surface (finish a stub +
  one frontmatter flag + a skill kickoff step).
- **Negative:** the load-bearing behavior is manual-smoke-verified, not vitest; revises shipped hotfix
  behavior; a nudge (not a gate) means a determined agent can still start in the trunk.
- **Risk:** an ignored nudge → collisions persist — mitigated by the self-announcing collision flag
  and a known hard-gate follow-up.

See the full plan at `.indusk/planning/worktree-visibility/` and the
[multi-agent guide](/guide/multi-agent).

---
title: "Multi-Agent Coordination"
date: 2026-06-25
status: accepted
---

# Multi-Agent Coordination

> **Superseded in part by [`.indusk/planning/handoff-multi-agent-section-shape/`](../handoff-multi-agent-section-shape/) (2026-06-26).** The original split between `.indusk/current.md` (fixed `In Flight / Open Questions / Cursor` sections) and `.indusk/agents/<sessionId>.md` (per-session presence files) is replaced by per-agent sections inside a single `.indusk/current.md`. The session ID / sanitizer / init scaffolding / CLI surface decisions in this ADR stay; the file shape and skill behavior described in "Decision" and "Alternatives Considered" below are revised by the section-shape ADR. Read this document for the rationale; for the actual shipped behavior see the section-shape plan.

## Goal

**Two or more Claude Code sessions can work on the same InDusk project at the same time without one freezing the other, overwriting the other's session state, or proceeding blind to what the other is doing.**

Today, two concurrent sessions on the same project deadlock or destroy each other's handoff. The mutation race during `/catchup` freezes one agent while the other holds the checkbox state machine open; the singleton `.claude/handoff.md` means whoever runs `/handoff` second silently destroys what the first one wrote. This ADR commits to a structure where concurrent agents are the normal case, isolation is provided by the already-shipped worktree extension, durable state lives in a file mutated only through git commits, and presence is signaled via per-session files in a shared bulletin directory.

## Y-Statement

**In the context of:**
running two or more Claude Code sessions concurrently on the same InDusk project, where each session goes through catchup at start, edits files during work, and needs awareness of what other sessions are working on to avoid duplicating or stomping on each other's effort.

**Facing:**
a single mutable `.claude/handoff.md` that catchup partially mutates and handoff fully overwrites, producing two reliable failure modes (catchup freezes mid-write while another agent's gate hook reads a partial file; handoff destroys the previous session's snapshot), with no mechanism today for either agent to know the other exists.

**We decided for:**
a three-primitive separation — (1) worktrees per agent for filesystem isolation (already shipped via F1), (2) a single durable `.indusk/current.md` mutated only via git commits to main, read freely by anyone, and (3) per-session presence files at `.indusk/agents/{session-id}.md` written on agent registration, deleted on clean exit, and ignored by readers once their mtime crosses a configurable stale TTL.

**And against:**
keeping the singleton handoff file (the status quo, with both observed failure modes); a lock-and-snapshot state machine that converts `current.md` into a `handoff.md` and locks all agents out until catchup unlocks (reintroduces mutation races and tries to bound growth via ceremony rather than git history); an in-repo bulletin committed to main (produces noisy commits, merge conflicts, and conflates ephemeral presence with durable history); distributed-systems primitives like Redis locks or file locks (overkill for a single-machine coordination problem already solved by git's concurrency model).

**To achieve:**
race-free concurrent catchup (no shared mutation surface), continuous visibility into who else is working (presence directory globbed by anyone), bounded growth (`current.md` is a fixed-shape sections doc; presence files are tiny, ephemeral, and self-clean via TTL), and zero new ceremonies (handoff is deprecated; the work that mattered was the periodic distillation, which already happens via `/retrospective`).

**Accepting:**
that cross-machine coordination (Sandy's laptop + Sandy's desktop) is out of scope for v1 — `current.md` syncs via git push/pull on the natural commit cadence, but presence bulletins are local-only; that stale-presence TTL is a tradeoff (too short hides slow sessions, too long retains ghost agents from crashes) we resolve by defaulting to 1 hour and making it configurable; that the precise mechanism for obtaining a stable session ID depends on what Claude Code actually exposes, which is a Phase 1 spike, with a PID-at-start fallback if no env var is stable.

**Because:**
this is the same separation that every successful multi-actor system uses — isolation via per-actor sandboxes (git branches for humans, worktrees here) plus a shared visibility surface that is append-friendly or merge-mediated (PR descriptions for humans, presence files + commits to `current.md` here) — and treating the single-machine multi-agent case as a degenerate distributed-systems problem produces the same answer with less machinery than any state machine, lock, or coordination primitive.

## Context

The brief (`brief.md`) lays out the failure modes Sandy hit on 2026-05-25 and the three-primitive shape this ADR formalizes. The test plan (`test-plan.md`) enumerates the 11 behavioral assertions this design must satisfy. The worktree extension (`indusk-worktree-extension`, shipped Phases 2-7 between 2026-05-28 and 2026-05-30) provides the isolation substrate this ADR builds on; without it, the file-collision problem this ADR claims to solve is not actually solved. The SCM abstraction layer (`apps/indusk-mcp/src/lib/scm/`) means we can be git-native here without breaking the (deprecating) jj-mode projects.

The four open questions in the brief were resolved by Sandy on 2026-06-25:
- `current.md` lives at `.indusk/current.md` (its own file, alongside other `.indusk/` state).
- Session ID source is `$CLAUDE_SESSION_ID` with PID fallback (verify in Phase 1 spike).
- Stale TTL is mtime-based, 1 hour default, configurable via `.indusk/config.json`.
- `current.md` is the operational layer; CLAUDE.md is the architectural layer; `/retrospective` already distills one into the other.

This ADR adds one further architectural decision the brief didn't surface: **where the `.indusk/agents/` directory lives in workbench-shaped vs single-repo projects.** In workbench mode (the worktree extension's layout), `.indusk/` is at the workbench root and is naturally shared across all worktrees. In single-repo mode, `.indusk/` is at the project root. The runtime resolution is the same `findInDuskRoot()` walk-up that already powers other indusk commands — agents always write to `<inDuskRoot>/.indusk/agents/{session-id}.md`, which is workbench-shared in workbench mode and project-local otherwise.

## Decision

The system gets three coordinated changes:

### 1. Durable shared state: `.indusk/current.md`

A single fixed-shape markdown document under the InDusk root, gitignored only when the project chose `--local` mode (otherwise tracked and synced via normal git operations). Working agents edit it in-place when something operational solidifies enough to be worth promoting. It is the answer to "what is happening on this project right now?" — distinct from CLAUDE.md, which is "what is this project?" The `/retrospective` cadence distills `current.md` into CLAUDE.md's durable architectural memory.

Concurrent mutation is resolved by git: two agents on two branches both edit it, the merger sees a conflict at merge time and resolves like any other code conflict. No locks, no state machines.

### 2. Presence bulletin: `.indusk/agents/{session-id}.md`

A directory of small per-session files, gitignored unconditionally. On session start, the agent calls `indusk agent register --task "<what>"`, which writes a file containing the task description, branch, worktree path, and start timestamp. On clean exit (`/handoff` is deprecated, but a session-end hook still fires), the agent calls `indusk agent done`, which removes its own file. Other agents glob `.indusk/agents/*.md` to see who's around.

The directory lives at `<inDuskRoot>/.indusk/agents/`, where `inDuskRoot` is the workbench root in workbench mode and the project root otherwise — resolved by the existing walk-up logic.

Stale files (from sessions that crashed without cleanup) are filtered by mtime: `indusk agent list` ignores files older than `agents.stale_ttl_minutes` (default 60). An optional `indusk agent prune` CLI removes them eagerly for users who want to.

Session ID source: `$CLAUDE_SESSION_ID` if exposed (Phase 1 spike verifies the actual env var name); fall back to start-time PID.

### 3. Catchup pure-read; handoff deprecated

`/catchup` becomes a pure-read operation: it reads `.indusk/current.md`, globs `.indusk/agents/`, and writes its own presence file (registration). It does not touch `current.md`, does not mutate any other agent's presence file, and does not write a session-state checkbox file. Concurrent catchups cannot conflict because the only file each agent writes is its own.

`/handoff` is deprecated. The skill is replaced with a brief one-screen message: "Handoff is now a side-effect of normal commits. Edit `.indusk/current.md` if there's operational state worth promoting, commit it, then `indusk agent done`." The eval-trigger hook still fires on commits, so the existing per-commit evaluation continues to work; only the user-facing ceremony is removed.

## Alternatives Considered

### Lock-and-snapshot handoff state machine (Sandy's mid-conversation proposal)

Sandy proposed in the 2026-06-25 conversation: keep `current.md` continuously editable by anyone; let an agent decide to "run handoff," which prunes `current.md` into a `handoff.md` and deletes `current.md`. While `handoff.md` exists, the system is locked — no agent can work until someone runs `/catchup`, which copies `handoff.md` back to `current.md` and unlocks.

Rejected because: (a) the prune step is heavy ceremony solving a problem (bounded growth) that git history already solves more cheaply; (b) the lock turns multi-agent work into single-agent serialized work — if someone runs handoff while another agent is mid-task, the second agent is locked out until they catchup, defeating the concurrency this plan exists to enable; (c) the atomic-rename guarantee that prevents two simultaneous handoffs from racing is exactly the kind of distributed-systems primitive we don't want to maintain when git already provides ordering for free.

### Single shared `handoff.md` with append-only writes

Keep one file; have catchup and handoff only append, never overwrite. Avoids the destroy-the-previous-handoff failure but does not avoid the mid-write read-during-mutate failure, and produces a file that grows without bound.

### In-repo bulletin committed to main

`.indusk/agents/*.md` files tracked in git, committed to main. Every register and done becomes a commit. Other agents pull main and see who's around.

Rejected because: (a) chatty commits that nobody wants to review or merge; (b) merge conflicts on every concurrent register; (c) conflates ephemeral presence with durable history, polluting `git log` and triggering the eval agent on noise; (d) requires `git push` to be visible, which couples local presence to network state.

### Distributed locks (Redis, file locks, advisory locks)

Use a real distributed-coordination primitive: an agent acquires a lock before mutating shared state, releases on completion. Robust, well-understood mechanism.

Rejected because: (a) overkill for a single-machine problem with at most a handful of concurrent agents; (b) introduces a new runtime dependency (Redis) or platform-specific behavior (file locks differ on macOS / Linux / Windows); (c) lock-release-on-crash is its own problem domain (lease timeouts, deadlock detection) that adds machinery for a failure mode (`current.md` race) that git's existing concurrency model already handles for free.

### Per-worktree presence files (no shared directory)

Each worktree has its own `.indusk/agents/`. Agents in different worktrees can't see each other's presence files. This is the trivially-implementable option.

Rejected because: it fails the entire point of the bulletin. The brief's value proposition is "an agent starting up can see what other agents are working on" — per-worktree isolation makes that impossible. The workbench-shared `.indusk/` is the only location that satisfies the visibility requirement.

## Consequences

### Positive

- The two observed failure modes from 2026-05-25 (catchup-blocks-other-agent, handoff-overwrites-handoff) are structurally impossible: no shared mutation surface during catchup, no singleton handoff file at all.
- New-agent onboarding gets observably better: catchup output names the other working agents instead of pretending the project is single-tenant.
- `current.md` and CLAUDE.md split the operational/architectural axis cleanly, with `/retrospective` as the existing distillation cadence. No new ceremonies.
- Bounded growth is automatic: `current.md` is sections, not a log; presence files are tiny and self-clean.
- jj deprecation lands cleanly here: this is git-only, no event-log substrate, no change-ID tracking.

### Negative

- Cross-machine coordination is out of scope. Sandy's laptop and desktop don't see each other's presence bulletins until a future plan addresses this (probably via a tiny push-on-register hook to a shared location).
- The system depends on the worktree extension. Projects that disable the worktree extension fall back to one agent per project; we don't try to make multi-agent work in single-worktree projects.
- Stale TTL is a tuning knob that will occasionally be wrong (too short during long-running tasks; too long after a crash). 1 hour is a reasonable default but not universally correct.
- Session ID source is a Phase 1 spike risk. If Claude Code's env var name changes or isn't exposed, we ship with PID-only and lose stability across process restarts within a session.

### Risks

- **Risk: `current.md` becomes a swamp.** Without enforcement, working agents may write everything to `current.md` instead of CLAUDE.md or plan docs, turning it into an undifferentiated dumping ground. *Mitigation:* The `/retrospective` skill is the existing distillation cadence; if it stops distilling, that's a `/retrospective` skill bug, not a `current.md` bug. Default `current.md` template will have explicit sections (In Flight, Open Questions, Cursor) to discourage freeform sprawl.
- **Risk: Bulletins lie because agents forget to register.** If the working-agent skill doesn't reliably call `indusk agent register` on session start, other agents see an empty bulletin and assume they're alone. *Mitigation:* Registration happens inside `/catchup` (which agents always run on start anyway); the skill itself calls the CLI before producing output.
- **Risk: Workbench-root resolution is wrong for some project shape we haven't seen.** The `findInDuskRoot()` walk-up assumes `.indusk/` is always at a discoverable ancestor. *Mitigation:* Reuse the existing implementation, which already handles workbench and non-workbench projects; treat any new project shape that breaks it as a worktree-extension bug, not a multi-agent bug.

## Documentation Plan

### Pages
- New: `apps/docs/src/guide/multi-agent.md` — user-facing guide describing how to run two Claude Code sessions on one project, what shows up in catchup, when to edit `current.md`, what replaces `/handoff`.
- Update: `apps/docs/src/reference/skills/catchup.md` — strip the checkbox-mutation language, document the pure-read behavior, document the presence-registration side-effect.
- Update: `apps/docs/src/reference/skills/handoff.md` — convert to a deprecation page explaining the new flow.
- New: `apps/docs/src/reference/cli/agent.md` — reference for `indusk agent register | done | list | prune`.
- Update: `CLAUDE.md` Conventions section — add the `current.md` ↔ CLAUDE.md split and the presence-bulletin convention.

### Diagrams
- Mermaid sequence diagram in `multi-agent.md` showing two concurrent agents from start (both register) through mid-work (both glob, both edit their own branches) to one of them committing `current.md` (visible to the next agent that starts).
- Mermaid state diagram in `multi-agent.md` showing presence-file states (none / fresh / stale / cleaned) and the transitions.

### Changelog
- Added multi-agent coordination: concurrent Claude Code sessions on one project no longer collide; `current.md` + `.indusk/agents/` bulletin + worktree isolation. `/handoff` deprecated; `/catchup` is now pure-read.

### ADR in Docs
- Yes — publish to `apps/docs/src/decisions/multi-agent-coordination.md` as part of the retrospective.

## References

- `brief.md` — problem statement and resolved open questions
- `test-plan.md` — 11 behavioral assertions + 2 untestable items
- `.indusk/planning/archive/indusk-worktree-extension/` — F1 substrate this builds on (Phases 2-7 shipped 2026-05-28 → 2026-05-30)
- `.indusk/planning/archive/git-or-jj-substrate/` — SCM abstraction this depends on for the (deprecating) jj-mode case
- `apps/indusk-mcp/src/lib/scm/` — runtime SCM detection
- `apps/indusk-mcp/extensions/worktree/` — worktree extension manifest + skill
- 2026-06-25 conversation transcript (this session) — re-derivation of the design and resolution of open questions

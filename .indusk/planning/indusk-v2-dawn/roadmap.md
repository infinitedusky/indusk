---
title: "Dawn — Roadmap"
date: 2026-07-26
status: living
---

# Dawn — Roadmap

> **The live sequence is [master.md](master.md)** — components, status, order, and acceptance tests. This file holds direction and horizon only.

Horizons for Dawn, near → far. Everything is checked against the [maxims](maxims.md). The **Later / ambitious** items are captured on purpose — direction we believe in even if we won't reach it soon. They are *not* commitments or scheduled work; they exist so the intent isn't lost.

## Now — in flight

- **[dawn-external-orchestrator](../dawn-external-orchestrator/) (MVP)** — lift the discipline out of Claude Code into a model-agnostic orchestrator (`indusk run <plan> --model X`): rent the AI SDK loop, reuse the gate scripts as-is, own the thin adapter + autopilot loop-port. Brief + ADR + impl written; Phases 0–5.

## Next — deferred, shape is clear

- **Tier-2 judgment checker** — a checker-agent at the phase boundary that reviews the diff for judgment-invariants (broke something / ignored the instruction / real bug), automating "the watch" so it scales past human bandwidth. Follows once Tier-1 runs externally.
- **Hook invariant/procedure keep-shed audit** — classify every existing gate as **invariant** (keep — portable discipline), **procedure** (cut — brittle prescription), or **judgment** (→ Tier-2). Surfaces empirically from the orchestrator matrix (which hooks actually fire across models).
- **Cloud deployment** — run the same headless orchestrator on an always-on box (raw **Fly Machines** vs a rented **RDE** like Bitrise/HopX). Unlocks "kick off from my phone, it grinds while I'm away." A deployment, not a rewrite.
- **More model drivers** — GPT-5 / Gemini / Grok beyond the MVP's two, with **cost-to-durably-done** routing informed by the matrix.
- **Worktree kickoff in `atdawn run`** (Sandy, 2026-07-27, from staging) — the orchestrator should inherit worktree-per-plan: in a git trunk (unless `worktree: none`), create the plan worktree via the existing machinery and run inside it; already-in-worktree → run; non-git dir (fixture/staging/remote cell) → run in place LOUDLY, never silently. Wiring, not invention (`resolveWorktreeDecision` + `detectTreeContext` + worktree extension). Pairs with run-cell sandboxing: worktree scopes writes/git state, container/box scopes bash.
- **@dawn Linear plugin (Dawn on Linear)** — rent the coordination substrate: Linear's Agents API as the front door (@dawn assignable in-issue), phases mirrored as sub-issues, verification state as issue activity, human-gate approvals in-thread. The repo stays the record — gates enforce in the write path; Linear is a projection, never the truth. Distribution via Linear's integrations directory. Post-matrix, post-dogfood (maxim 8). — see [positioning.md](positioning.md)

## Later / ambitious — on the roadmap, not soon

- **Event-log coordination layer** *(from Block's [Buzz](https://github.com/block/buzz))* — the coordination/activity/audit timeline (presence, agent actions, gate decisions, eval, approvals) is event-shaped; today it's fragmented across `current.md` + the highlights queue + `results.log` + commits. Move it to a single **append-only signed event stream**, while keeping versioned artifacts (plans, lessons) in git (maxim 6). *Different state, different substrate.* Enables real multi-agent + team coordination and a unified audit trail. *Largely absorbable by the Linear substrate (rent-not-build) if Dawn-on-Linear lands — see [positioning.md](positioning.md).*
- **ACP (Agent Client Protocol) driver** *(from Buzz)* — beyond swapping the *model* behind our one loop, swap the whole *agent* (Goose, Codex, Claude Code) via ACP, the emerging agent-interop standard. An "ACP driver" alongside the model drivers — align with a standard instead of reinventing. (Verify ACP fits our per-edit gate seam before committing.)
- **Agents as first-class signed/audited identities** *(from Buzz)* — every gated action attributable, signed, and logged; generalizes the ADR's HMAC-signed approvals into a full audit trail. Trust infrastructure for the "make agentic output trustworthy" thesis (maxim 1).
- **Cross-IDE front-ends** — the orchestrator is headless; Cursor / VS Code / editor panes sit on top as thin clients over the model-agnostic substrate. Discipline never lives in any IDE's hook system.
- **Retire the Claude Code hooks** — if/when the orchestrator becomes the *sole* execution surface, the Claude Code PreToolUse hooks are redundant (both invokers already shell the same scripts). Maximal single-invoker uniformity — at the cost of the Max flat-rate lane.
- **Comparative-methodology benchmark** — put Dawn's discipline in a ring against the serious alternatives (spec-first, TDD-heavy, "let the agent rip + review PRs"), same agent + longitudinal workload, measuring durability / rework / compounding. The honest test of "is there a 10×-better way?" — not "is discipline better than chaos?" (maxim 5, maxim 8).
- **The `monitor` lifecycle stage** — the ninth loop stage (today telemetry-extension only) becomes a real ritual: production signal feeds the next cycle's *research* and *remember* (the "production-driven test authority" idea).
- **Impl → spec + ledger split** — impl.md prose becomes a pure technical spec (*what exactly and how*, vs the ADR's *what we decided and why*); done-state moves to a compact machine ledger the gates keep enforcing in the write path; human-facing progress lives in the coordination projection (Linear sub-issues). — see [positioning.md](positioning.md)

---
title: "Dawn External Orchestrator (MVP) — Brief"
date: 2026-07-26
status: draft
audience: Sandy
---

# Dawn External Orchestrator (MVP) — Brief

First build under [Dawn](../indusk-v2-dawn/maxims.md). Applies maxims 2 (own the discipline, rent the runtime), 5 (evidence over assertion), 7 (mechanism in Dawn, content in the project), 9 (the lifecycle loop).

## Problem

InDusk's discipline is enforced *inside* Claude Code — the gate scripts fire as Claude Code PreToolUse hooks. That couples the whole methodology to one runtime: you cannot run the same gates behind GPT-5, Gemini, or Grok, and you cannot move across platforms (other IDEs, remote) without re-porting the hooks into each host's hook system. "Try new models for a speed/quality advantage while keeping every gate" is currently impossible, because the gates only exist where Claude Code runs them.

## Key finding (verified 2026-07-26)

The gate scripts are **already externalizable** — pure programs with a clean contract:
- **Input (stdin JSON):** `{ tool_input: { file_path, old_string, new_string | content }, cwd }`
- **Output:** `exit 0` = allow, `exit 2` = block (stderr → agent feedback)
- No semantic Claude coupling — the only Claude-isms are field names + the `.claude/settings.json` path convention.

They are pure functions of *(edit intent + repo state) → allow/block* and don't know which model is upstream. Any orchestrator that intercepts its model's edit tool-calls, serializes them into that envelope, and honors the exit code gets identical enforcement for any model. The only new glue is a ~50-line adapter mapping the orchestrator's tool-call shape → the scripts' field names.

## Proposed Direction

A thin, model-agnostic orchestrator, shipped as an **`indusk` command** so it's invoked the same way for every model:

```
indusk run <plan> --model claude|gpt|gemini|grok   # runs the loop, gates enforced identically
```

Three parts:
- **Reuse (as-is):** the existing gate scripts — Tier-1 invariants.
- **Rent:** a provider-agnostic agentic tool-loop (evaluate Vercel AI SDK / Claude Agent SDK / LangGraph / Mastra — do **not** hand-roll the model+tool loop).
- **Own (thin):** the tool-call interceptor + adapter that fires the gate scripts on each edit, plus the loop control ported from `/work --autopilot` (scoped-per-phase, advance-on-green, goalpost guard, pause-at-human-gate).

**First driver: Claude via API** — so Claude runs through the orchestrator, not Claude Code. Parity from day one; nothing works differently on Claude than on anything else. Then GPT/Gemini/Grok drivers are the same loop with a different model client.

## Scope

### In scope (MVP)
- Provider-agnostic agentic loop (chosen library) running read/edit/bash tools scoped to a worktree.
- The ~50-line tool-input adapter (orchestrator tool-call → gate-script JSON envelope).
- Tier-1 enforcement: gate scripts invoked on each edit tool-call; `exit 2` → deny the edit + feed stderr back as the tool result.
- Loop control for the full lifecycle loop, ported from autopilot.
- Two drivers minimum: **Claude** (first) + **one non-Claude** (GPT-5 or Gemini) to prove portability.
- The reference program + matrix harness (see Acceptance).

### Out of scope (MVP)
- Tier-2 judgment checker — its own plan; follows once Tier-1 runs externally.
- The full hook invariant/procedure audit — surfaces empirically from running the matrix.
- Cross-IDE front-ends — the orchestrator is headless; IDE integration is later.
- The `monitor` lifecycle stage — stays telemetry-extension for now.

## Acceptance Criteria

A **single simple-but-complete program** — small enough to build end-to-end cheaply, large enough to *require the full lifecycle loop* (research → plan → decide → test → build → challenge → refactor → remember → monitor), with at least one real gate that **must block** (e.g. a phase that can't be checked off until its tests are green).

That program is executed **via `indusk` across a matrix**:
- **Models:** Claude, GPT-5, Gemini, Grok (as available).
- **Environments:** at least local + one remote (Remote Control on-desk, or a rented box).

For each cell, capture and compare:
1. **Did every gate hold?** — the Tier-1 invariant fired identically regardless of model/environment. *This is the core correctness claim.*
2. **Outcome quality** — did the program come out correct/solid; how much rework / red-gate thrash.
3. **Speed / cost** — wall-clock and token cost *to durably-done* (not to first-green).

**Pass** = the loop runs to completion under the *same* gate enforcement in every cell, and we have a first comparative read on model × environment — the "is there a speed advantage with the discipline intact?" question, answered with data.

## Depends On
- Gate-script externalizability (verified).
- A rented agentic-loop library (chosen in the ADR).
- A remote environment for the non-local matrix cells.

## Blocks
- `dawn-tier2-checker` (judgment checker) — meaningful only once Tier-1 runs externally.
- Cross-IDE / cross-platform front-ends — this orchestrator is the substrate they sit on.

## Effort
Days-to-weeks. Biggest unknowns: the chosen library's tool-call interception (can we gate each edit *before* it applies, per provider?), and building the reference program + matrix harness. The adapter and gate-script reuse are small; the loop control is a port, not new logic.

## Open Questions (for the ADR)
1. **Which agentic-loop library?** Provider coverage, and — critically — does it expose a *pre-tool* hook so Tier-1 can block an edit before it lands (PreToolUse parity)? If not, we wrap tool execution ourselves.
2. **Gate at tool-call or logical-unit?** Tier-1 intercepts each edit; the future Tier-2 checker runs at phase boundary. MVP does Tier-1 only.
3. **What is the reference program?** Small enough for a cheap matrix, real enough to force the full loop. Candidate: a tiny CLI on a throwaway repo.
4. **Headless `indusk`?** Confirm the gate scripts + CLI run outside a Claude Code session (they should — plain Node reading stdin).
5. **Matrix cost bound.** N models × M environments × full loop spends real tokens — cap or sample.

## Cross-references
- [Dawn maxims](../indusk-v2-dawn/maxims.md) — this is Dawn's first buildable piece.
- `/work --autopilot` (`apps/indusk-mcp/skills/work.md`) — the loop control being ported; this orchestrator is autopilot-with-a-pluggable-driver, lifted out of Claude Code.

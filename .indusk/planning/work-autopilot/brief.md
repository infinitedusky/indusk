---
title: "Work Autopilot — phase-loop with fresh context per phase"
date: 2026-07-25
status: accepted
---

# Work Autopilot — Brief

## Problem

Multi-phase plans require a manual dance, once per phase: `/work` a phase → `/handoff` (persist the cursor) → start a *fresh session* → `/catchup` → `/work` the next phase. The fresh-session-per-phase is deliberate — each phase executes best in a **clean context window** (accumulated context degrades careful/fund-critical work), and the persisted cursor + rich impl docs are already built to make a cold pickup work. But driving that loop by hand is pure friction, and friction discourages the good practice. The user shouldn't have to re-have the "ok, handoff, new session, catchup, next phase" conversation on every plan.

## Proposed Direction

**`/work --autopilot {plan}`** — a driver that executes a plan's remaining phases hands-off, **each phase in a fresh subagent context**, advancing only when a phase's gates pass, and pausing at human-judgment gates.

The key insight — and why this is a *dusk* feature, not a bespoke per-plan workflow — is that **the autopilot is thin because the safety rails already exist and belong to dusk.** The gate-hook system (`check-gates`, the test-first RED-before-impl hook, the verification gate) already makes faked completion *structurally impossible*: a subagent cannot check off a phase whose trajectory `Passes at: Phase N` rows aren't green, cannot skip test-first, cannot advance a red gate. The autopilot doesn't re-implement rigor — it **inherits** it. It just loops the phases dusk already defines and spawns a fresh subagent per phase. ~50 lines of driver over primitives dusk already owns. **(See Review §R1 — this thin-ness is contingent on subagents actually firing the hooks, which is unverified.)**

## Context

Every primitive this needs already exists in dusk:
- **Impl phases + trajectory** (`impl.md`) — the loop's unit of work.
- **Gate hooks** (`check-gates`, test-first, verification) — the rails that make autonomous execution trustworthy.
- **Subagents** — fresh context window per spawn (the "clear context between phases" property, for free).
- **The persisted cursor** (`current.md` via `update_current_section`) + committed code — the between-phase handoff surface.
- **Worktree-per-plan** — the isolated tree each phase's subagent drops into.

It's the natural completion of `/work`: `/work` is *interactive*; `/work --autopilot` is *hands-off with fresh context per phase*. Precedent: `compact-context` was flagged as a dusk feature from a numero session and shipped in v1.34.0 — same channel, same shape. **(See Review §R2 — the compact-context equivalence undersells this feature's size.)**

### Mechanism
1. Read the impl's phases. For each phase not yet complete:
2. Spawn a **fresh subagent** (clean context) with: *"Execute Phase N of {plan}. Catch up from the plan docs + cursor, run the phase checklist under the gate hooks (test-first → implement → verify → commit per item), then report a COMPACT result: what shipped, what's green, any blocker."*
3. The orchestrator keeps **only the compact per-phase result** — not the phase's working context. That IS the fresh-context-per-phase property.
4. **Advance to Phase N+1 only on green** — the subagent reports success AND the orchestrator independently confirms via `check-gates` (defense in depth). A red gate → **STOP loud**, surface the blocker to the human. Never barrel on.
5. **Human gates:** a phase declares it needs human judgment (`human_gate` — see Open Questions for where the marker lives). The autopilot pauses there, states exactly what the human should check, resumes on approval.
6. **Per-phase iteration cap:** a subagent that can't reach green after K tries surfaces the blocker instead of spinning.
7. Phases run **sequentially / foreground** (they're a dependency chain, not parallel work). Each phase commits, so a bad phase is a revertable unit.

### Safety model (why it's responsible)
- **The rails ARE the gate hooks** — autopilot can't skip test-first or advance a red trajectory row, regardless of who's driving.
- **Green-only-advance** — a failing verification halts the loop.
- **Human gates** cover judgment that can't be structurally verified (visual/UX, a fund-boundary review, an external-service smoke).
- **Iteration cap + loud-on-failure** — no silent spinning, no silent bad-but-passing.
- **Per-phase commits** — a bad phase is isolated and revertable.

## Scope

### In Scope (v1)
- The `/work --autopilot {plan}` driver (a mode/flag on the work skill).
- Read phases from `impl.md`; spawn a fresh subagent per phase; advance on green.
- Independent `check-gates` confirmation between phases (don't trust the report alone).
- The `human_gate` per-phase contract (pause → prompt → resume).
- Per-phase iteration cap + loud failure surfacing.
- Compact per-phase result relay (orchestrator context stays bounded).
- Reuse the existing worktree; persist the cursor between phases.

### Out of Scope (v1)
- Parallel phase execution (phases are a dependency chain).
- Cross-plan orchestration / chaining multiple plans.
- Auto-*fixing* a red gate beyond the same-phase iteration cap (autopilot STOPS on red; it does not endlessly retry-and-mutate).
- Replacing interactive `/work` — autopilot is additive; `/work` stays the default.

## Success Criteria
- A multi-phase plan runs Phases 2→N unattended, each in a fresh context, committing per phase, with the **same gate rigor** as interactive `/work`.
- A red gate **halts** the loop and surfaces the blocker — never advances on red.
- A `human_gate` phase **pauses** for human input and resumes on approval.
- The orchestrator completes a 5-phase plan **without context exhaustion** (proof that per-phase results, not accumulated working context, are what it holds).

## Open Questions
- **Skill vs flag:** `/work --autopilot` (mode on the existing work skill) vs a distinct `/autopilot` skill. Lean: a flag/mode on `work` — autopilot is a *way of working a plan*, not a different thing.
- **Where the `human_gate` marker lives:** per-phase inline (a phase can be a gate while siblings aren't) — e.g. a `#### Phase N Human Gate` section or a `human_gate: <reason>` line in the phase body — vs impl frontmatter (per-plan). Lean: per-phase inline, since it's a property of the phase (Phase 5's visual smoke is a gate; Phase 2 isn't). **(See Review §R3 — prefer deriving gates from existing Deferred Verification rows over a new marker.)**
- **Trust vs verify the phase result:** the subagent reports green, but the orchestrator should independently run `check-gates` before advancing (belt-and-suspenders). Confirm that's cheap enough to always do.
- **Eval rail granularity:** each phase's subagent commits → fires the eval trigger per phase. Good (keeps eval granular) — confirm no double-firing.
- **Resumability:** if autopilot is interrupted mid-plan, `/work --autopilot {plan}` should resume from the first unstarted phase (the cursor + checked-off items already encode this). Confirm it reads that state on re-entry.

## Depends On
- Gate-hook system (`check-gates`, test-first, verification) — **exists**.
- Subagent mechanism (fresh context per spawn) — **exists**.
- Persisted cursor (`current.md` / `update_current_section`) — **exists**.
- Worktree-per-plan — **exists**.

(Additive over all of the above — no new machinery, just a driver.)

## Blocks
- Nothing. Purely additive; `/work` interactive is untouched.

## Provenance
Surfaced in a numero session (2026-07-25) executing the multi-phase `agent-training-sandbox` plan, where the manual per-phase handoff dance was the friction. A numero-local **stopgap** (a one-off phase-loop for that plan) is being built in parallel so the plan finishes hands-off while this real feature lands in dusk — the same band-aid-then-upstream pattern `compact-context` followed.

---

## Review — open risks (dusk session, 2026-07-25)

Adversarial review of the above by the dusk-side agent. These are the things the ADR must resolve before this is accepted; they don't reject the direction, they attack its load-bearing assumptions.

### R1 — RESOLVED (2026-07-25 spike): subagents DO fire, and ARE blocked by, the gate hooks ✅

The load-bearing assumption is verified empirically (the `work-autopilot` spike, this session). A throwaway PreToolUse Edit|Write hook was registered in dusk's settings.json; then:
- A subagent's `Write` **fired** the hook (its path appeared in the probe log) — subagent tool calls trigger the session's PreToolUse hooks.
- With the probe upgraded to `exit 2` on a sentinel path, the subagent's `Write` was **denied** — it received `PROBE-BLOCK ... denied by the probe hook (exit 2)` and the file was not created.

Therefore the thin-driver thesis holds: an autopilot subagent editing `impl.md` is gate-enforced identically to the main session — `check-gates` blocks incomplete phase transitions, test-first-RED blocks impl-before-red, `validate-impl-structure` blocks bad writes, all inside subagents, with the block fed back as feedback. The orchestrator's between-phase `check-gates` is now genuine defense-in-depth (a second layer), not the sole belt. **Design decision: build thin — inherit the rails, do not re-implement enforcement.**

### R2 — the compact-context equivalence undersells the size

compact-context was a *skill* (markdown, no new code, a dangling promise made true). This is an *execution driver*: subagent lifecycle, a green-gated loop, independent verification, a human-gate contract, iteration caps, resumability. The six Open Questions are an ADR's worth of decisions. This is research → brief → ADR → impl, not a skill drop — plan it as such.

### R3 — derive human gates from existing structure, don't invent a marker

Open Question #2 proposes a new per-phase `human_gate` marker. But plans already encode their human-judgment points: **the `### Deferred Verification` rows** (a declared "can't be structurally verified — a human/canary must") and the human-gated close-out rituals (falsify/cleanup/retrospective). A phase whose verification references a deferred/manual-smoke row *is* a human gate, structurally, on every existing plan today. Deriving pause points from the trajectory beats a new annotation authors must remember to add — the makeover's recurring principle: read the structure that exists. Autopilot should loop impl phases only and hard-stop at (a) any phase referencing a deferred/manual row, and (b) impl-complete → hand back for `/falsify`. It must never auto-run the close-out rituals; those are human-gated by design.

### R4 — close the goalpost-moving hole

"Advance only on green" + iteration cap stops *spinning*, not *gaming*. A subagent that can't reach green can weaken a test assertion or bump a trajectory row's `Passes at` to a later phase and pass. Interactive work has a human watching; autopilot doesn't. **Guard:** autopilot subagents may write code and check off items, but must be **forbidden from editing the trajectory table or test assertions** — they cannot move the goalposts to reach green. (Enforceable as a subagent-prompt constraint and, ideally, a hook that rejects trajectory-table edits when the editor is an autopilot subagent — pending R1.)

### R5 — token budget story is missing

N fresh subagents each doing a full catchup + phase execution is real aggregate spend. v1 needs a budget/confirmation story (the harness Workflow primitive has budget support; a bare skill-driven loop does not). At minimum, confirm before launching and report cumulative cost.

---

## Resolution (2026-07-25) — v1 shipped

The spike de-risked the central assumption (R1 ✅), so v1 was built directly as an **Autopilot Mode section in the `work` skill** (`/work --autopilot {plan}`), shipped in v1.35.0. The review's improvements are folded in as decisions:

- **R2 (size):** acknowledged — built as a skill-level driver (the distributable InDusk unit), not a bespoke workflow. A future hardening could add a deterministic `Workflow`-based executor with a hard token budget; the skill already names it as the optional rigorous engine.
- **R3 (derive gates):** DECIDED — human gates are **derived** from the trajectory (Deferred Verification rows / manual-smoke / visual-judgment items), not a new `human_gate` marker. Works on every existing plan. Autopilot loops impl phases only and hard-stops at impl-complete → hands back for `/falsify`; it never auto-runs the close-out rituals.
- **R4 (goalpost guard):** DECIDED + built — autopilot subagents are forbidden (by contract) from editing the Test Trajectory table or test assertions, and the orchestrator snapshots the trajectory before each phase and verifies no `Asserts` text changed and no `Passes at` moved later. A drifted trajectory is a gamed gate → STOP LOUD.
- **R5 (token budget):** DECIDED — confirm-cost-and-get-a-go before launch; the optional Workflow executor adds a hard budget.
- **Open Questions resolved:** skill-vs-flag → a `--autopilot` mode on `work` (like `teach`/`--strict`); trust-vs-verify → both (inherited hooks + independent between-phase check-gates); rituals → never auto-run.

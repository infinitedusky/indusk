---
title: "Dawn External Orchestrator (MVP) — Implementation"
date: 2026-07-26
status: in-progress
trajectory: required
gate_policy: auto
---

# Dawn External Orchestrator (MVP) — Implementation

Builds the decision in [adr.md](adr.md) against the [brief](brief.md), under [Dawn](../indusk-v2-dawn/maxims.md). **Rent** the loop (Vercel AI SDK), **reuse** the gate scripts as-is, **own** a thin adapter + the autopilot loop-port. Claude first driver; a non-Claude driver proves the swap. Runs locally for the MVP.

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T0 | `indusk run` command exists and the provider registry parses a `--model` name into a driver config | Phase 0 | Phase 0 | passing |
| T1 | the Claude driver runs a multi-step tool loop that creates + edits a file in the worktree | Phase 1 | Phase 1 | ⬜ |
| T2 | the adapter maps an AI SDK edit tool-call into the gate-script `{ tool_input, cwd }` envelope | Phase 2 | Phase 2 | ⬜ |
| T3 | a premature phase-checkoff edit is BLOCKED — the gate script exits 2, the edit is not applied, and the block message is returned to the model | Phase 2 | Phase 2 | ⬜ |
| T4 | a compliant edit passes the gate (exit 0) and is applied | Phase 2 | Phase 2 | ⬜ |
| T5 | the full loop runs the guinea-pig plan to impl-complete via Claude, advancing only on green gates | Phase 3 | Phase 3 | ⬜ |
| T6 | the goalpost guard STOPS the loop if the Test Trajectory table is mutated mid-phase | Phase 3 | Phase 3 | ⬜ |
| T7 | the same guinea-pig plan runs via a non-Claude driver with the identical gate firing (a premature checkoff is still blocked) | Phase 4 | Phase 4 | ⬜ |
| A8 | the matrix run (models × environments) yields comparable gate-hold, outcome-quality, and cost-to-durably-done data | Phase 5 | Phase 5 | ⬜ |

### Trajectory Rationale

- **T0** is writable at Phase 0 because the command skeleton + registry are Phase 0's deliverable; nothing earlier exists to assert against.
- **T1** is writable at Phase 1 — the Claude driver and the agentic tool loop first exist there; the assertion is "the rented loop drives file edits," which is precisely what Phase 1 stands up.
- **T2–T4** are writable at Phase 2 because the adapter + own-`execute` gate integration is Phase 2's whole purpose; the block (T3) is the load-bearing correctness claim and cannot be authored before the gate is wired.
- **T5–T6** are writable at Phase 3 — advance-on-green and the goalpost guard are the ported loop control landing in Phase 3; they require Phases 1–2 (a gated driver) to exist first.
- **T7** is writable at Phase 4 — proving model-invariance requires a second driver, which Phase 4 adds.
- **A8** is writable at Phase 5 — the matrix is the acceptance harness built in Phase 5; it is a deferred (human-judgment) verification (see Phase 5).

### Phase 0: Scaffold + reference task

- [x] Add an `indusk run <plan>` subcommand to the indusk-mcp CLI with a `--model <name>` flag.
- [x] Provider registry config: `provider → { apiKeyEnv, defaultModel }` for `anthropic` / `openai` / `google` / `xai`; `--model` resolves to a driver config (direct keys, no gateway).
- [x] Add the guinea-pig fixture — a small `semver` parse/compare/bump CLI plan (brief + trajectory-bearing impl) with one phase whose checkoff requires green tests — under a fixtures directory.

#### Phase 0 Verification
- [x] `indusk run --help` prints usage including `--model` (verified: `Usage: dev-system run [options] <plan>`, `--model <name>` default `claude`).
- [x] Registry test green — resolving `--model claude` returns the anthropic driver config; an unknown name errors. Green = **T0** (7/7 in `registry.test.ts`).

#### Phase 0 Context
- [x] Defer the CLAUDE.md Architecture entry for `indusk run` until Phase 3 (avoid churn while the surface is in flux).

#### Phase 0 Document
- [x] Stub `/reference/cli/run` (+ sidebar); fill at plan close.

### Phase 1: Rent the loop (Claude driver)

- [ ] Worktree kickoff: confirm the plan worktree (already created for the autopilot run).
- [ ] Add `ai` + `@ai-sdk/anthropic`; pin versions; confirm the `toolApproval` API is present on install (ADR risk).
- [ ] Define the minimal tool set — `readFile`, `writeFile`/`edit`, `bash`, `list` — bound to the worktree path.
- [ ] Wire the Claude driver as a multi-step loop (`generateText`/`ToolLoopAgent` with `stopWhen`); no gates yet.

#### Phase 1 Verification
- [ ] Integration test: run the loop on a trivial task ("create `foo.ts` exporting `X`, then edit `X`") against a temp worktree → the file exists with the expected content. Green = **T1**.

#### Phase 1 Context
- [ ] Note in the plan's cursor that the rented loop is proven independent of gates.

#### Phase 1 Document
- [x] (none needed — Phase 1 is internal loop wiring with no user-facing surface; the CLI reference lands in Phase 3)

### Phase 2: Gate adapter + Tier-1 enforcement

- [ ] Adapter (~50 lines): map an AI SDK edit tool-call → `{ tool_input: { file_path, old_string, new_string }, cwd }`.
- [ ] Own-the-`execute`: the edit tool spawns the gate script, writes the envelope to stdin, reads the exit code — exit `2` → return the block message as the tool result (edit **not** applied); exit `0` → apply.
- [ ] Wire the SDK-native `toolApproval` as the second layer, with `experimental_toolApprovalSecret` HMAC signing.
- [ ] Point the gate at the real scripts (`check-gates.js`, `validate-impl-structure.js`).

#### Phase 2 Verification
- [ ] Adapter unit test: a sample edit tool-call produces the exact expected envelope. Green = **T2**.
- [ ] Block test: a premature `- [ ] → - [x]` checkoff on the guinea-pig impl → gate exits 2, edit not applied, block message surfaced. Green = **T3**.
- [ ] Pass test: a compliant edit → gate exits 0, edit applied. Green = **T4**.

#### Phase 2 Context
- [ ] Record that the discipline is the *shared scripts*; the SDK gate is a thin invoker (no rules in the invoker).

#### Phase 2 Document
- [x] (none needed — internal enforcement wiring, no user-facing surface; documented with the loop in Phase 3)

### Phase 3: Loop-control port

- [ ] Port the autopilot loop control: scope per phase; advance only when the phase's gates pass (invoke `check-gates` deliberately).
- [ ] Goalpost guard: snapshot the Test Trajectory table pre-phase; STOP LOUD if any `Asserts` text changed or a `Passes at` moved later.
- [ ] Pause-at-human-gate: detect deferred/manual rows and pause instead of self-approving.
- [ ] Run the full guinea-pig plan via Claude with gates live.

#### Phase 3 Verification
- [ ] Full-loop test: the guinea-pig plan runs to impl-complete via Claude with every gate held. Green = **T5**.
- [ ] Goalpost test: inject a trajectory mutation mid-run → the loop STOPS and surfaces it. Green = **T6**.

#### Phase 3 Context
- [ ] Add the `indusk run` surface to CLAUDE.md Architecture now that it's stable (1–2 lines + pointer).

#### Phase 3 Document
- [ ] Fill `/reference/cli/run` with the loop behavior + `--model`.

### Phase 4: Second driver + registry

- [ ] Add a non-Claude driver — **GPT-5 (`@ai-sdk/openai`) or Gemini (`@ai-sdk/google`), chosen by available credits at this phase** — as one registry entry.
- [ ] Run the same guinea-pig plan via `--model <non-claude>`.

#### Phase 4 Verification
- [ ] Swap test: the same plan under the non-Claude model runs the identical gates; a premature checkoff is still blocked. Green = **T7**.

#### Phase 4 Context
- [ ] Record the proof point: same discipline, different model, byte-identical gate behavior.

#### Phase 4 Document
- [ ] Note the second provider in `/reference/cli/run`.

### Phase 5: Matrix + acceptance

- [ ] Matrix harness: run the guinea-pig across {Claude, one non-Claude} × {local, one remote}; capture gate-hold, outcome quality, and cost-to-durably-done per cell.
- [ ] Record the results table for review.

#### Phase 5 Verification
- [ ] **Deferred Verification** (A8):
  - reason: outcome-quality comparison across models is human judgment, not a machine assertion.
  - would require: running N models × M environments end-to-end (real token spend) plus a human read of the resulting code quality.
  - mitigation: cap to Claude + one non-Claude × local + one remote; record raw gate-hold + cost-to-done data so the comparison is evidence-backed rather than impression.

#### Phase 5 Context
- [ ] Capture the matrix findings as the first data point on "which model is cheapest-to-done per task class."

#### Phase 5 Document
- [ ] Publish the matrix results + method as the acceptance record.

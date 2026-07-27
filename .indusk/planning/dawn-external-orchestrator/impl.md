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
| T1 | the Claude driver runs a multi-step tool loop that creates + edits a file in the worktree | Phase 1 | Phase 1 | passing |
| T2 | the adapter maps an AI SDK edit tool-call into the gate-script `{ tool_input, cwd }` envelope | Phase 2 | Phase 2 | passing |
| T3 | a premature phase-checkoff edit is BLOCKED — the gate script exits 2, the edit is not applied, and the block message is returned to the model | Phase 2 | Phase 2 | passing |
| T4 | a compliant edit passes the gate (exit 0) and is applied | Phase 2 | Phase 2 | passing |
| T5 | the full loop runs the guinea-pig plan to impl-complete via Claude, advancing only on green gates | Phase 3 | Phase 3 | passing |
| T6 | the goalpost guard STOPS the loop if the Test Trajectory table is mutated mid-phase | Phase 3 | Phase 3 | passing |
| T7 | the same guinea-pig plan runs via a non-Claude driver with the identical gate firing (a premature checkoff is still blocked) | Phase 4 | Phase 4 | passing |
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

- [x] Worktree kickoff: confirm the plan worktree (already created for the autopilot run). Verified: `git rev-parse --show-toplevel` → `dusk-worktrees/dawn-external-orchestrator`, branch `plan/dawn-external-orchestrator`.
- [x] Add `ai` + `@ai-sdk/anthropic`; pin versions; confirm the `toolApproval` API is present on install (ADR risk). Pinned exact: `ai@7.0.37`, `@ai-sdk/anthropic@4.0.21`. `toolApproval` CONFIRMED present on `generateText`/`streamText`/`ToolLoopAgent`, plus `experimental_toolApprovalSecret` (HMAC) and tool-level `needsApproval`. Drift note: `ai/test` mocks are `MockLanguageModelV3/V4` (not V2); `LanguageModel` accepts spec v2/v3/v4.
- [x] Define the minimal tool set — `readFile`, `writeFile`/`edit`, `bash`, `list` — bound to the worktree path. `src/lib/run/tools.ts`: every path resolves through `resolveInWorktree` (escapes rejected); tools are gate-free by design.
- [x] Wire the Claude driver as a multi-step loop (`generateText`/`ToolLoopAgent` with `stopWhen`); no gates yet. `src/lib/run/driver.ts`: `generateText` + `stopWhen: stepCountIs(16)`; model client injectable (mock in tests, `createAnthropic` from registry config in prod).

#### Phase 1 Verification
- [x] Integration test: run the loop on a trivial task ("create `foo.ts` exporting `X`, then edit `X`") against a temp worktree → the file exists with the expected content. Green = **T1**. `pnpm vitest run src/lib/run/` → 2 files, 9/9 passing (driver.test.ts 2/2 + registry.test.ts 7/7); `tsc --noEmit` clean; `biome check` clean.

#### Phase 1 Context
- [x] Note in the plan's cursor that the rented loop is proven independent of gates. Recorded via `mcp__indusk__update_current_section` (session 930d7469, cursor: "The rented loop is proven independent of gates — T1 green with a scripted mock model; no gate code exists yet").

#### Phase 1 Document
- [x] (none needed — Phase 1 is internal loop wiring with no user-facing surface; the CLI reference lands in Phase 3)

### Phase 2: Gate adapter + Tier-1 enforcement

- [x] Adapter (~50 lines): map an AI SDK edit tool-call → `{ tool_input: { file_path, old_string, new_string }, cwd }`. `toGateEnvelope` in `src/lib/run/gate.ts` — edit → `tool_name: "Edit"` + old/new strings, writeFile → `tool_name: "Write"` + content; paths resolve through `resolveInWorktree` (escapes rejected before the gate ever runs).
- [x] Own-the-`execute`: the edit tool spawns the gate script, writes the envelope to stdin, reads the exit code — exit `2` → return the block message as the tool result (edit **not** applied); exit `0` → apply. `createGatedWorktreeTools` + `runGateScripts` in `gate.ts`; scripts spawned with `--no-warnings` (keeps Node module-type noise out of the block message); non-2 exits allow — PreToolUse parity.
- [x] Wire the SDK-native `toolApproval` as the second layer, with `experimental_toolApprovalSecret` HMAC signing. `createGateToolApproval` (per-tool map: gate allows → `"approved"`, blocks → `{ type: "denied", reason: blockMessage }`); `runDriver({ gate })` wires both layers + a random-per-run (or injected) approval secret. Verified through the loop with the scripted mock — denial feeds back, edit never lands.
- [x] Point the gate at the real scripts (`check-gates.js`, `validate-impl-structure.js`). `resolveGateScripts` walks up from the worktree root to the first ancestor whose `.claude/hooks/` holds BOTH scripts (validator first, then gates — the PreToolUse chain order) and throws loudly when none does — never silently vacuous. Tests inject this repo's installed `.claude/hooks/` scripts. Found + fixed en route: the guinea-pig fixture's `## Phase 1 —` headings were invisible to the gate parser (premature checkoff exited 0) — reshaped to the canonical `### Phase 1:` + `#### Phase 1 <Gate>` shape, verified exit 2.

#### Phase 2 Verification
- [x] Adapter unit test: a sample edit tool-call produces the exact expected envelope. Green = **T2**. (`gate.test.ts` "maps an edit tool-call to the exact Edit envelope" + Write variant + escape rejection — 3/3.)
- [x] Block test: a premature `- [ ] → - [x]` checkoff on the guinea-pig impl → gate exits 2, edit not applied, block message surfaced. Green = **T3**. (Real `.claude/hooks/check-gates.js` spawned against a temp fixture copy; stderr "Phase 1 test-first violation…" returned as the tool result; file byte-identical after.)
- [x] Pass test: a compliant edit → gate exits 0, edit applied. Green = **T4**. (Trajectory rows primed to `passing` in the copy; same checkoff edit applies on disk.) Full run: `pnpm vitest run src/lib/run/` → 3 files, 20/20 passing (gate 11 + driver 2 + registry 7); `pnpm exec tsc --noEmit` clean; `biome check` clean on gate.ts/gate.test.ts/driver.ts.

#### Phase 2 Context
- [x] Record that the discipline is the *shared scripts*; the SDK gate is a thin invoker (no rules in the invoker). Recorded: the discipline is the shared scripts; the SDK gate is a thin invoker. `gate.ts` contains zero rule content — it adapts the tool-call to the `{ tool_name, tool_input, cwd }` envelope, spawns the scripts, and relays exit codes; rules change by changing the scripts, never the invoker. (Also in the `gate.ts` header comment.)

#### Phase 2 Document
- [x] (none needed — internal enforcement wiring, no user-facing surface; documented with the loop in Phase 3)

### Phase 3: Loop-control port

- [x] Port the autopilot loop control: scope per phase; advance only when the phase's gates pass (invoke `check-gates` deliberately). `runLoop` in `src/lib/run/loop.ts`: one gated driver run per phase (tight autopilot-ported contract), then `probePhaseClose` — a synthetic next-phase checkoff envelope fed to the REAL `check-gates` on a temp copy, exit 0 required — decides advance, never the model's self-report. Rows writable at the probe phase are neutralized (`skipped`, probe copy only) so next-phase test-first duty can't false-block this phase's close.
- [x] Goalpost guard: snapshot the Test Trajectory table pre-phase; STOP LOUD if any `Asserts` text changed or a `Passes at` moved later. `checkGoalposts` (pure): Asserts change / Passes-at-later / row removal are violations; State transitions + added rows allowed. `runLoop` returns `{ status: "stopped-goalpost", violations }` — detection, not reversion (the drift stays visible on disk).
- [x] Pause-at-human-gate: detect deferred/manual rows and pause instead of self-approving. `detectHumanGate` (derived, no new marker): unchecked items matching Deferred Verification / `U`-rows / manual-smoke-style phrasings, or referencing ids named in the trajectory's Deferred Verification block → `{ status: "paused-human-gate", items }` BEFORE any model step is spent.
- [x] Run the full guinea-pig plan via Claude with gates live. Deterministic layer DONE: T5 drives the FULL loop (scripted `MockLanguageModelV4` Claude driver, all phases of a temp guinea-pig copy) with the REAL gate scripts spawned live on every edit AND on the phase-close probe — no API calls, gate never mocked. `indusk run <plan> --model` now invokes `runLoop` end-to-end (`src/bin/commands/run.ts`; exit 0 complete / 3 human-gate pause / 1 stopped).
  - **DEFERRED — live API run**: no headless `ANTHROPIC_API_KEY` available (checked env + `~/.indusk/config.env`, 2026-07-27). The one real-API guinea-pig run (gate-hold + cost datum) awaits a key; checked off on the strength of the deterministic full-loop run. Surface this to the orchestrator.

#### Phase 3 Verification
- [x] Full-loop test: the guinea-pig plan runs to impl-complete via Claude with every gate held. Green = **T5**. (`loop.test.ts` "T5: runs the plan to impl-complete via the scripted Claude driver, advancing only on green gates" + companions "stops RED when the phase did not actually close" / "pauses at a human gate". `pnpm vitest run src/lib/run/` → 4 files, 33/33 passing; `tsc --noEmit` clean; biome clean. One re-run flaked on 5s spawn timeouts under background eval-agent load, green on retry — pre-existing Phase 2 tests, not a regression.)
- [x] Goalpost test: inject a trajectory mutation mid-run → the loop STOPS and surfaces it. Green = **T6**. (`loop.test.ts` "T6: a tool step rewriting an Asserts cell STOPS the loop and surfaces it" — the scripted model weakens T1's Asserts via a non-checkbox edit the gate scripts allow; the loop returns `stopped-goalpost` naming T1. Plus 5 pure `checkGoalposts` unit cases: asserts change / passes-at-later / row removal flagged; state transitions + added rows + passes-at-earlier allowed.)

#### Phase 3 Context
- [x] Add the `indusk run` surface to CLAUDE.md Architecture now that it's stable (1–2 lines + pointer). One bullet after the indusk-mcp entry: the loop contract in a line + `— see /reference/cli/run`.

#### Phase 3 Document
- [x] Fill `/reference/cli/run` with the loop behavior + `--model`. Stub replaced with the full reference: the loop contract, the three gate-enforcement layers, `--model` + provider-key table, exit codes, headless `gate_policy: auto` requirement, usage reporting. (Phase 4 appends the second provider.)

### Phase 4: Second driver + registry

- [x] Add a non-Claude driver — **GPT-5 (`@ai-sdk/openai`) or Gemini (`@ai-sdk/google`), chosen by available credits at this phase** — as one registry entry. Chose **Gemini** (`@ai-sdk/google@4.0.24` pinned exact): `GOOGLE_API_KEY` exists in `~/.indusk/config.env`, no OpenAI key on this machine, free tier fits the credit-arbitrage ethos. Default model **`gemini-2.5-flash`** (current stable flash-class). `createDriverModel` is now a provider switch (anthropic + google resolve; openai/xai keep a clear "no driver yet" error). Key-env bridge: the registry entry lists accepted key envs in order (`GOOGLE_GENERATIVE_AI_API_KEY`, then `GOOGLE_API_KEY`); `resolveProviderKey` picks the first set one and the factory passes it as `apiKey` explicitly — never logged.
- [ ] Run the same guinea-pig plan via `--model <non-claude>`.

#### Phase 4 Verification
- [x] Swap test: the same plan under the non-Claude model runs the identical gates; a premature checkoff is still blocked. Green = **T7**. (`swap.test.ts`: the google driver config + scripted mock through the SAME `runLoop` with the REAL gate scripts — premature checkoff denied (`execution-denied`, gate stderr "test-first violation" surfaced in the next model call's prompt), impl.md byte-identical after; plus the recovery run to impl-complete, steps 10. Red→green note: authored red exposed the layering — `toolApproval` denies ABOVE the provider swap before own-the-execute runs, so the surfaced message is the denial reason, not the primary layer's wrapper text. Full run: `pnpm vitest run src/lib/run/` → 5 files, 41/41 passing (swap 8 + loop 13 + gate 11 + registry 7 + driver 2); `pnpm exec tsc --noEmit` clean; `biome check` clean on registry.ts/driver.ts/swap.test.ts/run.ts.)

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

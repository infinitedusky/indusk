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
| A8 | the matrix run (models × environments) yields comparable gate-hold, outcome-quality, and cost-to-durably-done data | Phase 5 | Phase 5 | written |
| T10 | a phase-checkoff performed through the `bash` tool (`sed -i` / `echo >>` / `cat >`) is gated identically to the `edit` tool — the premature checkoff does NOT survive | Phase 0 | Phase 6 | written |
| T11 | the `bash` tool cannot mutate files outside the worktree root (absolute path, `cd ..`, `~`) — the attempt is refused, not merely started in the root | Phase 0 | Phase 6 | written |
| T12 | a symlink inside the worktree pointing outside it cannot be used by the file tools to read or write beyond the root | Phase 0 | Phase 6 | written |
| T13 | flipping a non-terminal trajectory row to `skipped`/`blocked` mid-phase does NOT let the phase-close probe advance — self-assigned terminality is a moved goalpost | Phase 0 | Phase 6 | written |
| T14 | a gate script that exits non-zero-non-2 (crash, malformed impl, zero parsed phases) never silently allows the edit — the run stops loud | Phase 0 | Phase 6 | written |
| T15 | a gate script killed by the spawn timeout never counts as allow — a null exit code blocks and says why | Phase 0 | Phase 6 | written |
| T16 | `--max-steps` rejects non-numeric, zero, and negative values instead of silently producing an unbounded or zero-step run | Phase 0 | Phase 6 | written |

### Trajectory Rationale

- **T0** is writable at Phase 0 because the command skeleton + registry are Phase 0's deliverable; nothing earlier exists to assert against.
- **T1** is writable at Phase 1 — the Claude driver and the agentic tool loop first exist there; the assertion is "the rented loop drives file edits," which is precisely what Phase 1 stands up.
- **T2–T4** are writable at Phase 2 because the adapter + own-`execute` gate integration is Phase 2's whole purpose; the block (T3) is the load-bearing correctness claim and cannot be authored before the gate is wired.
- **T5–T6** are writable at Phase 3 — advance-on-green and the goalpost guard are the ported loop control landing in Phase 3; they require Phases 1–2 (a gated driver) to exist first.
- **T7** is writable at Phase 4 — proving model-invariance requires a second driver, which Phase 4 adds.
- **A8** is writable at Phase 5 — the matrix is the acceptance harness built in Phase 5; it is a deferred (human-judgment) verification (see Phase 5).
- **T10–T16** are writable at Phase 0 — every one asserts against behavior that exists *today*; each is red now and turns green when its Phase 6 fix lands. They are falsification hypotheses, not new-surface tests.

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
- [x] Run the same guinea-pig plan via `--model <non-claude>`. **LIVE run done** (2026-07-27): temp copy of the fixture (+ `.claude/hooks` + minimal `.indusk`), `GOOGLE_API_KEY` sourced by name from `~/.indusk/config.env`, `indusk run impl.md --model gemini` → **impl-complete, exit 0, first attempt** (no retry needed). Phase 1 closed green: 18 steps, 17 tool calls, **98,972 in / 5,740 out tokens**. Gates held: the phase-close probe passed only after genuinely green tests (verified post-hoc: the model's own vitest suite 6/6, covering T1–T3 edge cases); the verification checkoff was honest. Per-edit exit-2 block count is NOT instrumented in the CLI output (unknown whether Gemini hit blocks en route — the deterministic T7 pins the block-feedback path; add block telemetry for the Phase 5 matrix). Two findings: (1) Gemini left the "Thin CLI wrapper" implementation item undone/unchecked yet the phase closed — check-gates enforces gate sections (verification/context/document), never implementation-body items (pre-existing semantics, identical in Claude Code; an outcome-quality dimension for the matrix). (2) It bootstrapped its own vitest env (wrote package.json, ran pnpm install) because the fixture's verification names `pnpm vitest run` — resourceful, but it spends steps/tokens.

#### Phase 4 Verification
- [x] Swap test: the same plan under the non-Claude model runs the identical gates; a premature checkoff is still blocked. Green = **T7**. (`swap.test.ts`: the google driver config + scripted mock through the SAME `runLoop` with the REAL gate scripts — premature checkoff denied (`execution-denied`, gate stderr "test-first violation" surfaced in the next model call's prompt), impl.md byte-identical after; plus the recovery run to impl-complete, steps 10. Red→green note: authored red exposed the layering — `toolApproval` denies ABOVE the provider swap before own-the-execute runs, so the surfaced message is the denial reason, not the primary layer's wrapper text. Full run: `pnpm vitest run src/lib/run/` → 5 files, 41/41 passing (swap 8 + loop 13 + gate 11 + registry 7 + driver 2); `pnpm exec tsc --noEmit` clean; `biome check` clean on registry.ts/driver.ts/swap.test.ts/run.ts.)

#### Phase 4 Context
- [x] Record the proof point: same discipline, different model, byte-identical gate behavior. Recorded: **T7** (`swap.test.ts`) proves it structurally — the google driver config through the SAME `runLoop` with the REAL gate scripts denies a premature checkoff (`execution-denied`, gate stderr surfaced) and leaves impl.md byte-identical, then the identical loop recovers to impl-complete; the gate layers (own-the-execute below the swap, `toolApproval` above it, the phase-close probe) never consult the provider, so gate behavior is invariant by construction. The live `--model gemini` run is the empirical datum on top: same fixture, same scripts, impl-complete with the checkoff earned only on green tests (98,972 in / 5,740 out tokens). Different model, same discipline — the swap is one registry entry + one provider factory line.

#### Phase 4 Document
- [x] Note the second provider in `/reference/cli/run`. Added the wired-drivers table (claude → `claude-sonnet-4-5`, gemini → `gemini-2.5-flash`; gpt/grok resolve but error until their factory line lands) and the key-env bridge note (google accepts `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_API_KEY`, first set wins).

### Phase 5: Matrix + acceptance

- [x] (discovered 2026-07-27) Raw model-id passthrough in `resolveModel` (family prefix → provider, id verbatim) + revert google default to `gemini-2.5-flash`. Finding: gemini-3.x is SDK-blocked — responses carry `thoughtSignature` parts `@ai-sdk/google@4.0.24` (latest) doesn't round-trip, so tool calls never surface and the loop stops red with zero edits (raw REST `functionCall` verified; both local and remote cells reproduced — matrix cells C3/C4). Matrix lesson: provider parity is bounded by SDK model-support lag. **CORRECTED same day (matrix F1): the SDK-blocked diagnosis was wrong — wire-logged probes proved thoughtSignature round-trips fine; real cause was step starvation (24-step cap vs 3.6's read-heavy style). Fixed: budget 48 + `--max-steps` flag + 3.6 restored as default; passthrough kept.**
- [x] Matrix harness: run the guinea-pig across {Claude, one non-Claude} × {local, one remote}; capture gate-hold, outcome quality, and cost-to-durably-done per cell — see [matrix.md](matrix.md) (2026-07-27: Claude column deferred, no API key — Gemini-only across environments; Claude cells append when a key lands. Cells C1–C4 run: gate-hold ✅ in all four including both failure cells).
- [x] Record the results table for review. (matrix.md: cells table + findings F1–F5 + provisioning method record; A8 read pending — the human gate.)

#### Phase 5 Verification
- [ ] **Deferred Verification** (A8):
  - reason: outcome-quality comparison across models is human judgment, not a machine assertion.
  - would require: running N models × M environments end-to-end (real token spend) plus a human read of the resulting code quality.
  - mitigation: cap to Claude + one non-Claude × local + one remote; record raw gate-hold + cost-to-done data so the comparison is evidence-backed rather than impression.

#### Phase 5 Context
- [x] Capture the matrix findings as the first data point on "which model is cheapest-to-done per task class." (matrix.md findings F1–F5: gemini-2.5-flash is the current cheapest-to-done reference — remote first-attempt 48s/167k tokens; 3.x blocked by SDK lag; failed attempts cost real time (8m45s) but never false-advance. Claude comparison pending a key.)

#### Phase 5 Document
- [x] Publish the matrix results + method as the acceptance record. `/lessons/dawn-orchestrator-acceptance-matrix` — method, the 6-cell results table, what the data says (universal gate-hold incl. failure cells; red-over-green is the system working; cost-to-durably-done vs tokens-per-run; remote not slower), and the carry-forward findings. Sidebar + lessons index updated.

### Phase 6: Falsification — the gate has an ungated door (bash), and it fails open

**Goal**: verify whether the attested Tier-1 claim ("the gate scripts fire on each edit; exit 2 → the edit is refused; discipline is structural, not per-model") holds against the *system* rather than the `edit` tool alone. Three failure families: (a) the `bash` tool is a completely ungated write surface bound to nothing, (b) the trajectory's terminality can be self-assigned by the model the guard is meant to police, (c) the gate invoker treats every non-2 exit — including crashes and timeout kills — as permission to proceed. Each trajectory row below is one hypothesis; each item below is the fix it needs.

- [ ] Gate the `bash` write surface (T10): snapshot the gate-relevant files (the impl under run, at minimum) before each `bash` call; if the command mutated one, run the same `{tool_name, tool_input, cwd}` envelope against the resulting change and REVERT + return the block message when the gate refuses. Today `bash("sed -i 's/- \[ \]/- [x]/' impl.md")` checks off a phase with zero gate involvement — the one move a blocked model is most likely to reach for.
- [ ] Confine `bash` to the worktree (T11): `cwd: root` sets a starting directory, not a boundary — absolute paths, `cd ~`, and `..` all escape today while the file tools carefully reject exactly that. Add a best-effort guard AND state plainly (code comment + docs) that real confinement needs the sandboxed run cell (roadmap); never let the guard imply isolation it does not provide.
- [ ] Harden `resolveInWorktree` against symlink escape (T12): it normalizes textually via `resolve()` and never calls `realpath`, so a symlink inside the root that points outside passes the check and the write lands outside. Resolve the real path (of the file, or its nearest existing parent for new files) before the containment comparison. Note the compounding path: `bash` can *create* the symlink, then the "safe" file tools walk through it.
- [ ] Close self-assigned terminality (T13): `checkGoalposts` permits every State transition, and `TERMINAL_STATES` includes `skipped`/`blocked` — so a model that cannot make a test pass can write `skipped` into the State cell and the phase-close probe will happily advance. Treat non-terminal → `skipped`/`blocked` *inside a phase* as a goalpost violation (STOP LOUD); human-authored skips outside the loop stay legal. Also flag `Writable at` moved later, which the guard ignores today.
- [ ] Make the gate invoker fail LOUD, not open (T14): `runGateScripts` blocks only on exit 2 and allows everything else "for PreToolUse parity" — but Claude Code has a human watching, and this loop does not. A gate script that crashes (or vacuously passes a zero-phase impl — the known `validator-must-reject-zero-parsed-phases` lesson) silently disarms enforcement for the rest of the run. Treat non-zero-non-2 as a hard stop that surfaces the script's stderr and halts the loop, rather than a quiet allow.
- [ ] Treat a killed gate script as a block (T15): `spawnGateScript` has `timeout: 30_000`; on kill the exit code is `null`, which is `!== 2`, which means **allow**. A loaded machine can therefore disarm the gate — and this is not theoretical: Phase 3 observed 5s gate-spawn timeouts under background load. Block on null exit with an explicit "gate script timed out — refusing the edit" message, and make the timeout configurable.
- [ ] Validate `--max-steps` (T16): `Number.parseInt` yields `NaN` for `--max-steps abc`, and `stepCountIs(NaN)` never fires — the loop's only cost bound silently disappears. `0`/negative give an instant zero-work red. Reject non-numeric and `<1` at the CLI boundary with a clear message.

#### Phase 6 Verification
- [ ] T10: a `bash`-driven premature checkoff on the guinea-pig impl is gated identically to the `edit` path — the checkoff does not survive the call.
- [ ] T11: a `bash` command writing to an absolute path outside the worktree root is refused.
- [ ] T12: a symlink inside the worktree pointing outside it cannot be used by `readFile`/`writeFile`/`edit` to cross the root.
- [ ] T13: flipping a non-terminal row to `skipped` mid-phase is caught as a goalpost violation and the loop STOPS instead of advancing.
- [ ] T14: a gate script exiting 1 (crash/malformed impl) stops the run loud instead of allowing the edit.
- [ ] T15: a gate script killed by timeout blocks the edit with a timeout-specific message.
- [ ] T16: `--max-steps abc` / `--max-steps 0` are rejected with a clear error before any model call.

#### Phase 6 Context
- [ ] Add a Known Gotcha to CLAUDE.md recording the enforcement boundary this ritual exposed: the orchestrator's gate covers the `edit`/`writeFile` tools, so any *new* tool that can mutate files (starting with `bash`) must be routed through the same envelope or it is a hole in Tier-1 by construction.

#### Phase 6 Document
- [ ] Update `/reference/cli/run` with an explicit "what is and is not gated" section — the enforcement boundary, the bash caveat, and the fail-loud semantics — so the page never over-claims isolation the MVP does not have.

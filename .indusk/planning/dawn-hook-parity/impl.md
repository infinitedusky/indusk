---
title: "Dawn Hook Parity — Implementation"
date: 2026-08-03
status: draft
trajectory: required
rationale: required
gate_policy: ask
---

# Dawn Hook Parity — Implementation

## Goal

Give the thin lane the same footprint as a Claude Code session: every invariant hook enforced in the write path, one commit per checklist item, a durable pending-eval queue feeding the eval→lessons rail from any machine, and `ask` as the default gate policy with a real headless pause. Builds [adr.md](adr.md) against [test-plan.md](test-plan.md)'s assertions; honest hook inventory in [research.md](research.md).

## Scope

### In Scope
- `claude-md-budget.js` in the thin-lane gate chain.
- Loop-owned per-item commits with intent-derived messages; loud commit failure.
- `.indusk/eval/pending.jsonl` queue: append on commit, dedup-ledgered drain via `eval-trigger` CLI mode; `/rail-check` drain step; `check_health` backlog surfacing.
- Headless `ask` = pause (exit 3 + gate question); unset policy resolves to `ask`; `auto` stays per-plan opt-in.
- Recording the `gate-reminder` shed; correcting the Dawn master's hook count.

### Out of Scope
- Tier-2 judgment checking; the full keep-shed audit; worktree kickoff in `atdawn run`; matrix telemetry (F4); `gpt`/`grok` factories. (All recorded elsewhere — see brief.)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Budget hook in `GATE_SCRIPT_NAMES`; A1–A9 authored red; master hook-count correction | `src/lib/run/gate.ts`, `hooks/claude-md-budget.js`, scripted-driver harness |
| Phase 2 | Loop-owned commit step (stage-item-changes → commit → surface failure) | Phase 1's chain; `loop.ts` checkoff path; temp-git-repo fixtures |
| Phase 3 | Queue module (append/list/dedup ledger); `eval-trigger` CLI drain iteration; `/rail-check` step; `check_health` backlog signal | Phase 2's commit step; `hooks/eval-trigger.js` CLI mode; eval rail invariants |
| Phase 4 | Refusal classifier → exit-3 pause; `ask` default resolution; docs + changelog | `check-gates.js` ask-mode refusal text; `loop.ts` policy resolution |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | a thin-lane run that pushes CLAUDE.md past budget has the write refused with the shared script's own block message | Phase 0 | Phase 1 | written |
| A2 | a run leaves one git commit per completed checklist item, each message naming its item | Phase 0 | Phase 2 | written |
| A3 | after a run, the pending queue holds exactly one record per commit made | Phase 0 | Phase 3 | written |
| A4 | draining produces one scorecard per pending record; a second drain produces nothing new | Phase 0 | Phase 3 | written |
| A5 | a failed commit is surfaced loudly and adds no queue record | Phase 0 | Phase 2 | written |
| A6 | an `ask` plan whose model attempts a proof-less gate skip pauses: exit 3, gate question printed — no red-stop, no proceed | Phase 0 | Phase 4 | written |
| A7 | after conversation proof is added to the impl, a re-run continues past the paused phase | Phase 0 | Phase 4 | written |
| A8 | no `gate_policy` frontmatter behaves as `ask` in the thin lane; explicit `auto` runs unpaused as today | Phase 0 | Phase 4 | written |
| A9 | a run on a machine without the `claude` CLI completes normally and still fills the queue | Phase 0 | Phase 3 | written |

All rows are Phase 0 writable: the scripted-driver harness (`src/lib/run/harness.test-support.ts`) drives the real loop today, and every assertion fails red against current behavior for its real reason (no budget script in the chain, zero commits, no queue file, exit 1 instead of 3, auto-by-contract). No Trajectory Rationale subsection is required — no row is Writable at Phase 1+.

## Checklist

### Phase 1: Budget hook + red suite

- [x] Worktree kickoff: created at `~/code/sandbox/dusk-worktrees/dawn-hook-parity` on branch `plan/dawn-hook-parity` + `pnpm install`. Note: `indusk worktree create` errored (`_resolve_workbench_root: no workbench-shaped .indusk/config.json`) — the worktree extension assumes workbench mode; plain `git worktree add` per the established convention. Same limitation hit by prior plans; candidate fix belongs to the worktree extension, not this plan.
- [x] Author A1–A9 red (test-first): `hook-parity.gate.test.ts` (A1), `commit-cadence.test.ts` (A2/A5), `pending-queue.test.ts` (A3/A4/A9), `ask-pause.test.ts` (A6–A8). Shared scripted-model helpers (`toolCallStep`/`finishStep`/`guineaPigHappyPathSteps` + fixture sources) extracted to `harness.test-support.ts` (fourth consumer — loop.test.ts keeps its local copies for the cleanup ritual to converge). Red confirmed for stated reasons: A1 "Wrote 62475 chars to CLAUDE.md." (write sailed through), A2 zero commits, A3 caught VACUOUS-GREEN in first draft (0 records == 0 commits) — hardened with an explicit `> 0` guard, A5 no failure surfaced, A6–A8 `stopped-red` instead of `paused-gate-question`, A9 empty queue. Deviations from the item's sketch: A5 uses a rejecting pre-commit hook (deterministic regardless of machine git identity), A9 uses a poison-`claude` PATH stub asserting zero invocations (absence-of-PATH would break git/node too) — the poison stub also keeps A4's red run from ever spawning a real evaluator. Preservation greens from birth: under-budget writes still apply; explicit-`auto` runs unpaused.
- [x] Extend `GATE_SCRIPT_NAMES` in `src/lib/run/gate.ts` with `claude-md-budget.js` (chain membership only — the script self-filters by basename; block message passes through verbatim). `realGateScripts` in the test harness mirrors the chain; the resolution test's fixture gained the third stub (claim unchanged). **Incident during this item:** uncommitted wiring vanished into a `git stash` and reappeared minutes later — a concurrent eval-agent session appears to stash/pop the worktree around evaluation; flagged as a highlight + candidate falsification hypothesis.
- [x] Correct the Dawn master's Component 2 row: hook inventory is 5 (`check-plan-order.js` deleted in `62186774`), 3 unwired at plan start; the `gate-reminder` shed recorded in-row with the ADR pointer; acceptance wording amended per the brief ("…for every hook that is an invariant; sheds are recorded"); row status → In flight with this plan linked.

#### Phase 1 Verification
- [ ] A1 green: `pnpm vitest run src/lib/run/` in `apps/indusk-mcp` — over-budget CLAUDE.md write refused in the thin lane with the shared script's message.
- [ ] A2–A9 authored and red, each for its stated reason (not a harness or import error). Capture output.
- [ ] `pnpm exec tsc --noEmit` and `pnpm exec biome check` clean in `apps/indusk-mcp`.

#### Phase 1 Context
- [ ] Update CLAUDE.md's `indusk run` Architecture line: the gate chain is three scripts (`validate-impl-structure`, `check-gates`, `claude-md-budget`).

#### Phase 1 Document
- [ ] Update `/reference/cli/run` "Gate enforcement layers": the chain lists three scripts; note the deliberate `gate-reminder` shed with the ADR pointer.

### Phase 2: Loop-owned commit cadence

- [ ] Implement the per-item commit step in `src/lib/run/loop.ts`: after an item's checkoff survives the gate chain, capture the item's changed files (git status delta since the item began), stage exactly those, and commit with message `item({plan} P{phase}): {item summary, truncated}`. Skip the step cleanly when the worktree is not a git repo (fixture dirs) — loudly, never silently.
- [ ] Surface commit failure loudly: a non-zero commit (nothing staged, hook rejection, signing failure) prints the git error into the run output and adds nothing downstream; the run continues (the failure is bookkeeping, not a gate).

#### Phase 2 Verification
- [ ] A2 green: one commit per completed item, messages name their items.
- [ ] A5 green: a nothing-staged item surfaces the failure and (once Phase 3 lands) enqueues nothing — the no-enqueue half re-asserts in Phase 3.
- [ ] A1 still green; A3/A4/A6–A9 still red for their reasons. `tsc` + `biome` clean.

#### Phase 2 Context
- [ ] Update CLAUDE.md's `indusk run` Architecture line: per-item commits (loop-owned, intent-derived messages).

#### Phase 2 Document
- [ ] Update `/reference/cli/run`: a "Commits" section — cadence, message shape, loud-failure semantics, non-git-worktree behavior.

### Phase 3: Pending-eval queue + drain

- [ ] Queue module `src/lib/run/pending-evals.ts`: `appendPendingEval({ sha, plan, phase, source, timestamp })` → `.indusk/eval/pending.jsonl` (append-only, workbench-aware state path via the `_hook-paths` conventions); `listPending()`; `markDrained(sha)` writing a dedup ledger with the `already_processed → STOP` semantics. Wire `appendPendingEval` into Phase 2's commit step (successful commits only).
- [ ] Drain path: extend `eval-trigger.js`'s CLI mode to iterate `listPending()`, mark each drained BEFORE spawning the evaluator for it (crash-safe: a crashed spawn is a logged gap, never a double-eval), and pass the record's sha + `source: "atdawn"` through to the evaluator.
- [ ] `/rail-check` gains the queue-drain step: edit `apps/indusk-mcp/skills/rail-check.md` AND resync the installed `.claude/skills/` copy (skill-sync-parity pins byte equality).
- [ ] `check_health` surfaces the backlog: pending-count > 0 reported (info at small counts, error past a threshold) via the existing stray-state/health surface.

#### Phase 3 Verification
- [ ] A3 green: one queue record per commit. A4 green: drain with stubbed evaluator produces one scorecard per record, second drain is a no-op. A9 green: `claude`-less PATH run completes and fills the queue.
- [ ] A5's no-enqueue half green. A1/A2 still green; A6–A8 still red. `tsc` + `biome` clean; full `pnpm vitest run` in `apps/indusk-mcp` — no new failures vs baseline.
- [ ] Manual smoke: one real `/rail-check` drain against this plan's own commits (this repo has `claude`) — scorecards appear in `results.log`.

#### Phase 3 Context
- [ ] Update CLAUDE.md's eval-rail Conventions entry: the thin lane feeds `.indusk/eval/pending.jsonl`; drain via `eval-trigger` CLI mode from any `claude`-capable environment; `/rail-check` owns the drain; health surfaces backlog.

#### Phase 3 Document
- [ ] Update `/reference/cli/run`: queue section + the Mermaid sequence diagram from the ADR's Documentation Plan (checkoff → gates → commit → queue → later drain → scorecard). Update the rail-check reference page with the drain step.

### Phase 4: Headless ask = pause

- [ ] Refusal classifier in `src/lib/run/loop.ts` (or `gate.ts`): recognize `check-gates`' ask-mode proof-less-skip refusal by its structured message (match on the existing conversation-proof requirement text — do NOT modify the shared hook; the TS/JS port parity gotcha stays untouched), distinct from generic reds.
- [ ] Pause semantics: on classification, exit 3 printing the gate item, the required conversation-proof format, and the resume instruction (`re-run after amending the impl`). Existing human-gate pause plumbing reused.
- [ ] Policy default: unset `gate_policy` resolves to `ask` in the thin lane (replacing the `loop.ts:125` auto-by-contract); explicit `auto` unchanged.

#### Phase 4 Verification
- [ ] A6 green: proof-less skip on an `ask` plan → exit 3 + question printed. A7 green: proof added → re-run continues past the phase. A8 green: unset policy = `ask`; explicit `auto` unpaused.
- [ ] A1–A5, A9 still green (no regressions): full `pnpm vitest run` in `apps/indusk-mcp`; `tsc` + `biome` clean.

#### Phase 4 Context
- [ ] Update CLAUDE.md's `indusk run` Architecture line: `ask` is the default in both lanes; headless `ask` pauses (exit 3); `auto` is explicit opt-in — retire the "headless = auto by contract" phrasing wherever it appears.

#### Phase 4 Document
- [ ] Update `/reference/cli/run`: exit-code semantics (3 now covers gate-skip pauses), the `ask`-default change, and the `gate_policy: auto` note for deliberately unattended runs. Changelog entry per the ADR's Documentation Plan.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/run/gate.ts` | `GATE_SCRIPT_NAMES` + refusal classification export |
| `apps/indusk-mcp/src/lib/run/loop.ts` | Commit step, queue append call, pause semantics, `ask` default |
| `apps/indusk-mcp/src/lib/run/pending-evals.ts` | New — queue module |
| `apps/indusk-mcp/hooks/eval-trigger.js` | CLI mode iterates the pending queue |
| `apps/indusk-mcp/skills/rail-check.md` + `.claude/skills/rail-check/SKILL.md` | Drain step (byte-parity resync) |
| health surface (`check_health` path) | Pending-backlog signal |
| `apps/docs/src/reference/cli/run.md` | Chain, commits, queue + diagram, exit codes, ask default |
| `.indusk/planning/indusk-v2-dawn/master.md` | Hook-count correction, shed record, component row |
| `CLAUDE.md` | Architecture + eval-rail convention updates per phase |

## Dependencies

- `.indusk/planning/archive/dawn-external-orchestrator/` (loop, gate chain, scripted-driver harness) — archived, done.

## Notes

- The eval-rail invariants are inherited, not re-derived: anchored commit regex stays as bash-gate defense-in-depth; exit-code skip maps to A5; `markProcessed`-style dedup maps to A4; never touch the resume prompt's Step 4.
- `check-gates.js` is deliberately unmodified in Phase 4 — classification happens loop-side on existing message text, avoiding the TS+JS-port double-maintenance gotcha.
- A8 (the assertion) is unrelated to A8 (the archived acceptance experiment) — per-plan ID namespace.

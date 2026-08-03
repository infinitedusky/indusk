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
| A1 | a thin-lane run that pushes CLAUDE.md past budget has the write refused with the shared script's own block message | Phase 0 | Phase 1 | passing |
| A2 | a run leaves one git commit per completed checklist item, each message naming its item | Phase 0 | Phase 2 | passing |
| A3 | after a run, the pending queue holds exactly one record per commit made | Phase 0 | Phase 3 | passing |
| A4 | draining produces one scorecard per pending record; a second drain produces nothing new | Phase 0 | Phase 3 | passing |
| A5 | a failed commit is surfaced loudly and adds no queue record | Phase 0 | Phase 2 | passing |
| A6 | an `ask` plan whose model attempts a proof-less gate skip pauses: exit 3, gate question printed — no red-stop, no proceed | Phase 0 | Phase 4 | passing |
| A7 | after conversation proof is added to the impl, a re-run continues past the paused phase | Phase 0 | Phase 4 | passing |
| A8 | no `gate_policy` frontmatter behaves as `ask` in the thin lane; explicit `auto` runs unpaused as today | Phase 0 | Phase 4 | passing |
| A9 | a run on a machine without the `claude` CLI completes normally and still fills the queue | Phase 0 | Phase 3 | passing |

All rows are Phase 0 writable: the scripted-driver harness (`src/lib/run/harness.test-support.ts`) drives the real loop today, and every assertion fails red against current behavior for its real reason (no budget script in the chain, zero commits, no queue file, exit 1 instead of 3, auto-by-contract). No Trajectory Rationale subsection is required — no row is Writable at Phase 1+.

## Checklist

### Phase 1: Budget hook + red suite

- [x] Worktree kickoff: created at `~/code/sandbox/dusk-worktrees/dawn-hook-parity` on branch `plan/dawn-hook-parity` + `pnpm install`. Note: `indusk worktree create` errored (`_resolve_workbench_root: no workbench-shaped .indusk/config.json`) — the worktree extension assumes workbench mode; plain `git worktree add` per the established convention. Same limitation hit by prior plans; candidate fix belongs to the worktree extension, not this plan.
- [x] Author A1–A9 red (test-first): `hook-parity.gate.test.ts` (A1), `commit-cadence.test.ts` (A2/A5), `pending-queue.test.ts` (A3/A4/A9), `ask-pause.test.ts` (A6–A8). Shared scripted-model helpers (`toolCallStep`/`finishStep`/`guineaPigHappyPathSteps` + fixture sources) extracted to `harness.test-support.ts` (fourth consumer — loop.test.ts keeps its local copies for the cleanup ritual to converge). Red confirmed for stated reasons: A1 "Wrote 62475 chars to CLAUDE.md." (write sailed through), A2 zero commits, A3 caught VACUOUS-GREEN in first draft (0 records == 0 commits) — hardened with an explicit `> 0` guard, A5 no failure surfaced, A6–A8 `stopped-red` instead of `paused-gate-question`, A9 empty queue. Deviations from the item's sketch: A5 uses a rejecting pre-commit hook (deterministic regardless of machine git identity), A9 uses a poison-`claude` PATH stub asserting zero invocations (absence-of-PATH would break git/node too) — the poison stub also keeps A4's red run from ever spawning a real evaluator. Preservation greens from birth: under-budget writes still apply; explicit-`auto` runs unpaused.
- [x] Extend `GATE_SCRIPT_NAMES` in `src/lib/run/gate.ts` with `claude-md-budget.js` (chain membership only — the script self-filters by basename; block message passes through verbatim). `realGateScripts` in the test harness mirrors the chain; the resolution test's fixture gained the third stub (claim unchanged). **Incident during this item:** uncommitted wiring vanished into a `git stash` and reappeared minutes later — a concurrent eval-agent session appears to stash/pop the worktree around evaluation; flagged as a highlight + candidate falsification hypothesis.
- [x] Correct the Dawn master's Component 2 row: hook inventory is 5 (`check-plan-order.js` deleted in `62186774`), 3 unwired at plan start; the `gate-reminder` shed recorded in-row with the ADR pointer; acceptance wording amended per the brief ("…for every hook that is an invariant; sheds are recorded"); row status → In flight with this plan linked.

#### Phase 1 Verification
- [x] A1 green: `pnpm vitest run src/lib/run/` — over-budget write refused with "CLAUDE.md budget exceeded" (the shared script's stderr passed through verbatim); under-budget writes still apply. Suite: 58 passed / 8 failed (the 8 being exactly A2–A9's reds).
- [x] A2–A9 authored and red for stated reasons: A2 zero commits, A3 empty queue (post-hardening), A4 no drain mechanism, A5 no failure surfaced, A6–A8 `stopped-red` where `paused-gate-question` is claimed, A9 empty queue. None red from harness or import errors.
- [x] `tsc --noEmit` exit 0; `biome check` exit 0 — including clearing pre-existing unused-import debt across the run lib left by the orchestrator's harness extraction (confirmed present on `main`; mechanically fixed as discovered work).

#### Phase 1 Context
- [x] Update CLAUDE.md's `indusk run` Architecture line: the gate chain is three scripts (`validate-impl-structure`, `check-gates`, `claude-md-budget`); shed noted inline.

#### Phase 1 Document
- [x] Update `/reference/cli/run` "Gate enforcement layers": the chain lists three scripts; the deliberate `gate-reminder` shed recorded with the ADR pointer and its reasoning.

### Phase 2: Loop-owned commit cadence

- [x] Implement the per-item commit step: new `src/lib/run/commit-cadence.ts` wired through a new `GateOptions.onGatedApply` after-apply seam (gate.ts stays rule-free; driver passes it through; loop owns the cadence). Checkoff detection = a gated `edit` to the impl file whose replacement nets a new `- [x]`; staging is `git add -A` (everything since the previous commit is the item's work product); message `item({plan} P{phase}): {summary, 72-char cap}`. Non-git worktree → cadence disabled with a LOUD `disabledReason` on stderr (loop fixtures unaffected). Known boundary noted in-code: bash-performed checkoffs bypass cadence (gated but uncommitted).
- [x] Surface commit failure loudly: failures collect per-phase as `PhaseReport.commitFailures` (git stderr verbatim) and the run continues — bookkeeping, not a gate; `PhaseReport.commits` carries `{sha, item, phase}` records; the cadence exposes an `onCommit` seam for Phase 3's queue append.

#### Phase 2 Verification
- [x] A2 green: 5 commits for 5 itemwise checkoffs, messages name their items, tree clean at run end.
- [x] A5 green: pre-commit-hook rejection surfaces verbatim in `commitFailures`, zero commits land, run completes; no-enqueue half re-asserts in Phase 3.
- [x] A1 still green; A3/A4/A6–A9 still red for their reasons (suite 60 passed / 6 failed — exactly the Phase 3/4 claims). `tsc` exit 0, `biome` clean.

#### Phase 2 Context
- [x] Update CLAUDE.md's `indusk run` Architecture line: per-item commits (loop-owned, intent-derived messages; failures loud-but-non-gating; non-git disables loudly).

#### Phase 2 Document
- [x] Update `/reference/cli/run`: "Commits" section — cadence, message shape, the deliberately asymmetric failure semantics (loud bookkeeping vs gating), non-git behavior, and the bash-checkoff boundary.

### Phase 3: Pending-eval queue + drain

- [x] Queue module `src/lib/run/pending-evals.ts`: `appendPendingEval` / `listPending` (pending minus drained) / `markDrained` (returns `alreadyDrained: true` as a STOP) over `.indusk/eval/{pending,pending-drained}.jsonl`, workbench-aware via a `.indusk/`-ancestor walk; malformed lines skipped, never fatal (the results.log precedent). Wired into the cadence's `onCommit` — successful commits only. **Discovered design fix:** the queue must be excluded from work-product staging (`git add -A -- . ':(exclude).indusk/eval'`) — it is written *after* each commit, so including it would trail by one record and put run telemetry into plan history; A2's clean-tree assertion narrowed to work-product files with the exemption explained in-test (and `-uall` added so collapsed untracked dirs can't hide strays behind it).
- [x] Drain path: `eval-trigger.js --drain-pending` iterates the queue, appends to the drained ledger BEFORE each spawn (crashed spawn = logged gap, never double-eval), and re-invokes itself per record in CLI mode with a new `--change-id <sha>` so the evaluator scores the queued commit rather than HEAD; `INDUSK_EVAL_CMD` overrides the per-record command for tests. Sequential and awaited; the recorded limitation (the real child detaches its inner evaluator, so a huge backlog still fans out) is commented in-place.
- [x] `/rail-check` gains the queue-drain step (new Step 4b, before the highlights count): backlog math, the drain command, the safe-to-rerun rationale, and what a growing backlog means. Installed `.claude/skills/rail-check/SKILL.md` resynced byte-identical.
- [x] `check_health` surfaces the backlog: `eval/pending-queue` check reports the count with the drain command; `ok` while small, `error` past `PENDING_EVAL_ERROR_THRESHOLD` (25) — a standing backlog means the rail is stalled, not lost.

#### Phase 3 Verification
- [x] A3 green (one record per commit, shas match `git log`); A4 green (stubbed drain = one eval per record, re-drain a no-op); A9 green (poison-`claude` PATH run completes, queue fills, stub never invoked).
- [x] A5's no-enqueue half green. A1/A2 still green; A6–A8 still red for their stated reason. `tsc` exit 0; `biome check` exit 0 across this plan's files (repo-wide pre-existing debt in other dirs left untouched — out of scope). Suite: 63 passed / 3 failed (exactly A6–A8). **Test-infra fix:** the five git+gate integration tests exceeded vitest's 5s default once queue I/O landed — raised to 30s each (real spawns, not slow logic).
- [x] Manual smoke with the REAL evaluator (not the stub): seeded one record for this branch's own HEAD, ran `node .claude/hooks/eval-trigger.js --drain-pending` → evaluator spawned with `source=atdawn` for that exact sha (confirmed in `system.log`: "evaluator process started — changeId: cde0889…", followed by its `git show` of that commit), scorecard written to `results.log`. Immediate re-drain reported "Drained 0; 1 already drained" with the ledger still at one line — **idempotence proven on the real path, not just the stub.**

#### Phase 3 Context
- [x] Update CLAUDE.md's eval-rail Conventions: new "Thin-lane eval rail" entry above the eval-agent line — queue file, ledger-before-spawn, `/rail-check` ownership, health backlog, staging exclusion, ADR pointer.

#### Phase 3 Document
- [x] Update `/reference/cli/run`: "The eval queue" section with the Mermaid sequence diagram (checkoff → gates → commit → queue → later drain → scorecard), safe-to-rerun rationale, and the staging exclusion. Rail-check guide (`/guide/rail-check`) gained step 4b with the drain command and backlog interpretation.

### Phase 4: Headless ask = pause

- [x] Refusal classifier in a new `src/lib/run/gate-question.ts`: `isGateQuestion` requires BOTH the hook's `blocked (policy: ask)` tag AND its printed proof format (either alone is ambiguous); `gateQuestionItems` extracts the listed `[gate] text` lines. The shared hook is untouched — classification is loop-side, so the TS↔JS mirror-port gotcha never fires.
- [x] Pause semantics: new `paused-gate-question` result status carrying the phase, the named items, and a reason that prints the items, the exact conversation-proof line to add, and the resume instruction. Reuses the human-gate pause's exit path (3).
- [x] Policy default: `resolveGatePolicy` reads the frontmatter, defaulting **unset → `ask`**; `isPhaseDone` now honors it — bare `(none needed)`/`skip-reason:` opt-outs count as done only under `auto`, so `ask`/`strict` plans stop for them instead of silently proceeding. Retires the `loop.ts` auto-by-contract comment.

#### Phase 4 Verification
- [x] A6/A7/A8 green (4/4 in `ask-pause.test.ts`): proof-less skip pauses with the question, proof added → re-run completes, unset = `ask` while explicit `auto` stays unpaused.
- [x] A1–A5, A9 still green — **run lib 66/66**. Full `apps/indusk-mcp` suite: **852 passed, 3 failed — all three pre-existing** (`agent-roles-phase4`, the `daemon-identity` PID-reuse pair), unchanged from the plan's baseline. `tsc` exit 0; `biome` clean on this plan's files. **Two honest consequences recorded:** (1) the fresh worktree needed `pnpm build` in indusk-mcp *then* indusk-admin + `bundle-admin.js` to reach env parity — 13 of the initial 16 "failures" were that gap, exactly the lesson written this morning; (2) the orchestrator's driver-swap end-to-end test tipped over vitest's 5s default because this plan grew the gate chain 2→3 scripts (one more spawn per edit) — raised to 30s with the cause in-comment, not a logic regression.

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

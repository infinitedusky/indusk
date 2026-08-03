---
title: "Dawn External Orchestrator — Acceptance Matrix"
date: 2026-07-27
---

# Dawn External Orchestrator — Acceptance Matrix

The acceptance record for [`indusk run`](/reference/cli/run): the guinea-pig plan executed through
the gated loop across model × environment cells, capturing **gate-hold** (did enforcement fire
identically), **outcome** (impl-complete vs stopped-red, rework), and **cost-to-durably-done**
(tokens + wall-clock, not time-to-first-green).

The core claim under test is not "the model wrote good code." It is: **does the same discipline hold
when the model and the machine change?**

## Method

One reference task — a `semver` parse/compare/bump CLI whose plan has a phase that cannot be checked
off until its tests are green — run end-to-end via `indusk run <plan> --model <name>`. Each cell
starts from a pristine copy of the fixture. Gate scripts are the real
`.claude/hooks/{validate-impl-structure,check-gates}.js`, never mocked; the loop's phase-close probe
is the same `check-gates` invocation the Claude Code hook chain uses.

Environments: **local** (darwin arm64) and **remote** (Fly Machine, ubuntu 24.04, sjc,
shared-cpu-2x/2GB). The remote box received the branch as a `git archive` tarball over `fly ssh
sftp` — no repository credentials ever live on it — and the provider key the same way.

## Results

| Cell | Model | Env | Gate-hold | Outcome | Attempts | Wall | Tokens (in/out) |
|------|-------|-----|-----------|---------|----------|------|------------------|
| C1 | gemini-2.5-flash | local | held | impl-complete | 2 | 8m45s + 21s | 31,851 / 2,610 (attempt 2) |
| C2 | gemini-2.5-flash | remote | held | impl-complete | 1 | 48s | 161,164 / 6,239 |
| C3 | gemini-3.6-flash | local | held (stopped red) | starved, zero edits | 1 | 59s | — |
| C4 | gemini-3.6-flash | remote | held (stopped red) | starved, zero edits | 1 | 68s | — |
| C3′ | gemini-3.6-flash | local | held | impl-complete | 1 | 3m04s | 322,588 / 9,580 |
| C4′ | gemini-3.6-flash | remote | held | impl-complete | 1 | 1m31s | 508,315 / 13,410 |
| C5 | claude-sonnet-4-5 | local | held | impl-complete | 1 | 2m38s | 274,183 / 8,236 |
| C6 | claude-sonnet-4-5 | local, **Claude Code harness** | held | impl-complete | 1 | 2m06s | 68,037 (harness accounting; not comparable) |
| C7 | gemini-3.6-flash | local (quality-read re-run) | held | impl-complete | 1 | 3m22s | 627,681 / 11,738 |

The Claude cells were deferred for a week (no Anthropic API key — subscription OAuth cannot fund
SDK calls; see the ADR's billing-lane split), then appended on 2026-08-03 the same day a key
landed. The hot-swap claim held: zero harness changes.

**The quality read (2026-08-03, closing A8):** mutation testing — 8 hand-injected semantic bugs per
suite — showed **identical detection power (8/8 kills) across all three quality cells**, at 15, 14,
and 9 tests: test *count* measured style, never quality. The C5/C6 pair (same model, different
harness) showed no measurable quality difference — the discipline travels with the loop, not the
harness. And no cell shipped a complete CLI (runnable *and* tested), because the fixture's
trajectory named only the pure functions: **models converge coverage precisely onto named
acceptance; what the trajectory doesn't name, nobody tests — or everybody builds differently.**
A8 signed off on this data: route mechanical single-phase work to flash (~2 orders of magnitude
cheaper, quality-equivalent); reserve sonnet+ for work where unprompted test-first ordering and
richer diagnostics are load-bearing.

## What the data says

**Gate-hold was universal — including in the failure cells.** Six of six. The cells that failed are
the interesting evidence: a model that could not work the loop could not *advance* it either. Every
failure was a stopped-red with zero false checkoffs. Enforcement did not depend on the model being
competent, which is the entire point of putting the discipline below the provider swap.

**A red stop over green code is the system working.** C1's first attempt wrote correct source and
6/6 passing tests, then never checked the items off. The engineering succeeded and the *ritual* did
not, so the phase-close probe refused. Cost of that honesty: one 21-second re-attempt.

**Cost-to-durably-done separates models more than tokens-per-run does.** `gemini-3.6-flash` completed
first-attempt in both environments at roughly 3× the token cost of `gemini-2.5-flash`, which was
cheaper per run but thrashed once locally. Counting only the successful run flatters the cheaper
model; counting rework does not.

**Remote was not slower.** C2 (48s) and C4′ (1m31s) both beat their local twins — the loop is
latency-bound on model round-trips, not local CPU, so a headless rented box is a first-class
execution environment rather than a compromise.

## Findings worth carrying forward

- **A misdiagnosis, corrected by wire-level evidence.** The C3/C4 zero-edit failures were first
  attributed to `@ai-sdk/google` failing to round-trip Gemini 3.x `thoughtSignature` parts. Probes
  that logged the raw HTTP traffic disproved it: the SDK handles the signatures correctly, and the
  real cause was **step starvation** — 3.6-flash explores read-heavy (it reads the gate scripts
  before acting) and exhausted the 24-step phase budget before its first write. The budget moved to
  48 with a `--max-steps` knob. *"Zero edits" had two internally consistent explanations; only
  evidence at the wire separated them.*
- **Failed attempts were invisible.** The loop reported steps and tokens only on green phase close,
  so the cost of a red stop vanished. Fixed: red stops now report their attempt cost, and a live
  step ticker narrates the run.
- **Reference fixtures should pin layout.** Cells built the same program in different directory
  shapes because the fixture's impl never said where code goes. Structure was model-mood.
- **Ephemeral cloud rootfs is a workspace-lifecycle problem.** The Fly machine lost its toolchain
  across a stop/start cycle — the first concrete datum in the "raw machines vs managed RDE"
  evaluation, since workspace lifecycle is precisely what the RDE category productizes.

## Related

- [`indusk run` reference](/reference/cli/run) — the command, its loop contract, and its gate layers.
- The plan's own record lives in `.indusk/planning/dawn-external-orchestrator/matrix.md` (cells,
  findings log, and provisioning method).

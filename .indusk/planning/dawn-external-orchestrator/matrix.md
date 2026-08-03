---
title: "Dawn External Orchestrator — Acceptance Matrix (A8)"
date: 2026-07-27
status: in-progress
---

# Acceptance Matrix — A8

The A8 record: guinea-pig (`fixtures/guinea-pig-semver`) run via `indusk run` across model × environment cells. Per cell: **gate-hold** (did every gate enforce identically), **outcome** (impl-complete / stopped-red, rework count), **cost-to-durably-done** (tokens + wall-clock). A8 is Deferred Verification — the comparative *quality* read is Sandy's human judgment over this data.

Deviation from the planned matrix (recorded 2026-07-27): **Claude column deferred** — no Anthropic API key available (org-managed account blocks Console org creation; personal-key route declined for now). Gemini-only across environments; Claude cells append when a key lands (key is a hot-swappable env var, no harness change).

**Key landed 2026-08-03** (stored in `~/.indusk/config.env`; note `atdawn run` reads only `process.env` — source the file first, or wire the loader as a close-out item). Driver smoke-verified, then C5 run the same day — the hot-swap claim held: zero harness changes.

## Cells

| Cell | Model | Env | Gate-hold | Outcome | Attempts | Wall | Tokens (in/out) | Notes |
|------|-------|-----|-----------|---------|----------|------|------------------|-------|
| C1 | gemini-2.5-flash | local (darwin arm64) | ✅ held both attempts | **impl-complete** | 2 | 8m45s + 21s | attempt 2: 31,851 / 2,610 (attempt 1 unreported — see F4) | attempt 1 wrote code + tests (6/6 green on disk, independently verified) but never checked items off — bookkeeping failure, honest red stop; attempt 2 closed the ritual in 11 steps |
| C2 | gemini-2.5-flash | remote (Fly ubuntu 24.04, sjc, shared-cpu-2x) | ✅ held | **impl-complete, first attempt** | 1 | 48s | 161,164 / 6,239 | 24 steps / 23 tool calls; built at the worktree root rather than the fixture dir (see F5); 4/4 tests green, independently verified on the box |
| C3 | gemini-3.6-flash | local | ✅ held (stopped red, no false advance) | did-not-run: zero edits | 1 | 59s | n/a | SDK-blocked: `thoughtSignature` not round-tripped by @ai-sdk/google@4.0.24 — tool calls never surface |
| C4 | gemini-3.6-flash | remote (Fly) | ✅ held (stopped red, no false advance) | did-not-run: zero edits | 1 | 68s | n/a | same signature as C3 — environment-independent |
| C3′ | gemini-3.6-flash | local | ✅ held | **impl-complete, first attempt** | 1 | 3m04s | 322,588 / 9,580 | after the step-budget fix (24→48): 31 steps / 30 tool calls — over the old cap, proving the starvation diagnosis; 6/6 tests green, independently verified |
| C4′ | gemini-3.6-flash | remote (Fly) | ✅ held | **impl-complete, first attempt** | 1 | 1m31s | 508,315 / 13,410 | 33 steps / 32 tool calls; 5 checkoffs confirmed; independent test re-run n/a (machine stopped first — sequencing miss), green close rests on the loop's own probe |
| C5 | claude-sonnet-4-5 | local (darwin arm64) | ✅ held | **impl-complete, first attempt** | 1 | 2m38s | 274,183 / 8,236 | 28 steps / 27 tool calls; test-first honored unprompted (tests authored + run red at step 11 before any source existed); built entirely inside the fixture dir — the F5 layout variance did not reproduce; CLI probed by hand (4 bash invocations) before checkoff; wrote 27 tests vs the Gemini cells' 4–6; 27/27 green, independently verified |

## Findings log

- **F1 (2026-07-27) — CORRECTED same day**: first diagnosis ("gemini-3.x SDK-blocked: `thoughtSignature` not round-tripped") was **wrong** — wire-logged probes show the SDK round-trips signatures fine and 3.6-flash drives the full gated loop correctly. Real root cause: **step starvation**. 3.6-flash explores read-heavy (11 read steps before its first write; it even reads the gate scripts to learn the rules) and the 24-step phase cap expired mid-ritual — in the C3/C4 runs, before any write at all. Fixes shipped: default budget 24 → 48, `--max-steps` CLI knob, 3.6-flash restored as google default (Sandy's pick works). The raw model-id passthrough (shipped during the misdiagnosis) stays — independently useful. *Meta-lesson: "zero edits" had two consistent explanations; only wire-level evidence separated them. The falsified diagnosis is kept here deliberately.*
- **F2 (2026-07-27)**: gate-hold held in every cell run so far, including the failure cells — a model that can't work the loop cannot advance it either (stopped-red, zero false checkoffs). This is the enforcement claim surviving a hostile condition not planned for.

- **F3 (2026-07-27)**: 2.5-flash local attempt 1 exhibited a distinct failure mode — the *engineering* succeeded (source + 6/6 green tests on disk) but the *ritual* didn't (zero checkoffs), so the probe honestly stopped red. Rework cost: one 21-second re-attempt. Discipline-relevant: the gate measures process completion, and a red stop over green code is the system working, not failing.
- **F4 (2026-07-27)**: the loop reports steps/tool-calls/tokens **only on green phase close** — red stops report nothing, so failed-attempt cost is invisible in CLI output. Joins the Phase 4 exit-2-count gap: matrix-grade telemetry (per-attempt usage + per-edit block counts) is a needed indusk fix.
- **F5 (2026-07-27)**: layout variance across runs — C1 built inside a nested `semver/` dir, C2 at the worktree root with its own workspace files. The fixture's impl doesn't pin paths, so structure is model-mood. Outcome-quality note for A8, and an argument for path-pinning in reference-task fixtures.

- **F7 (2026-08-03)**: first Claude cell (C5, sonnet-4-5). Cost-to-durably-done ≈ **$0.95** (274k in / 8.2k out at $3/$15 per M) vs 2.5-flash's near-free cells — but the *behavioral* deltas are the finding: test-first honored without being told (red run before source existed), the tidiest layout of any cell (all files inside the fixture dir; F5 variance absent), manual CLI probing before checkoff, and ~5× the test coverage (27 assertions vs 4–6). One model-routing datum: flash is cheapest-to-done on mechanical tasks; sonnet buys discipline-adjacent behaviors nobody asked for. The A8 Opus/harness-comparison cell remains open — C5 is the *driver* proof, not the harness comparison.
- **F6 (2026-07-27)**: Fly Machine **rootfs is ephemeral across stop/start** (plain image, no volume) — the reprovisioned box lost node/pnpm/key on restart. Also: nodesource started 403ing from the Fly IP on the second pass (fallback: official nodejs.org tarball, more reliable anyway). Consequence for cloud-deployment: the box needs a bootstrap script, a baked image, or a volume — exactly the workspace-lifecycle layer RDEs productize; this is the first concrete datum for the Fly-vs-RDE evaluation.

## Environment provisioning (method record)

Remote cell: Fly Machine `894075b6d50718` (app `dawn-box`, sjc, shared-cpu-2x/2GB, ubuntu:24.04) — Node 24.18.0 (nodejs.org tarball → `/usr/local`; nodesource 403s intermittently from Fly IPs) + pnpm via npm; branch shipped as `git archive` tarball over `fly ssh sftp` (no repo creds on the box); key transferred the same way. **Rootfs resets on stop/start (F6) — reprovision from scratch each time until a bootstrap script/baked image exists.** Machine stopped after the runs (~$0.02/hr while up).

## A8 read (Sandy)

_Pending — the comparative read over the cells above is the human gate. Guiding questions from the brief: did every gate hold in every cell (yes — see Gate-hold column); is the outcome quality acceptable per cell; what does cost-to-durably-done say about model routing?_

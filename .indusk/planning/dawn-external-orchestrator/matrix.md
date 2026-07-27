---
title: "Dawn External Orchestrator — Acceptance Matrix (A8)"
date: 2026-07-27
status: in-progress
---

# Acceptance Matrix — A8

The A8 record: guinea-pig (`fixtures/guinea-pig-semver`) run via `indusk run` across model × environment cells. Per cell: **gate-hold** (did every gate enforce identically), **outcome** (impl-complete / stopped-red, rework count), **cost-to-durably-done** (tokens + wall-clock). A8 is Deferred Verification — the comparative *quality* read is Sandy's human judgment over this data.

Deviation from the planned matrix (recorded 2026-07-27): **Claude column deferred** — no Anthropic API key available (org-managed account blocks Console org creation; personal-key route declined for now). Gemini-only across environments; Claude cells append when a key lands (key is a hot-swappable env var, no harness change).

## Cells

| Cell | Model | Env | Gate-hold | Outcome | Attempts | Wall | Tokens (in/out) | Notes |
|------|-------|-----|-----------|---------|----------|------|------------------|-------|
| C1 | gemini-2.5-flash | local (darwin arm64) | ✅ held both attempts | **impl-complete** | 2 | 8m45s + 21s | attempt 2: 31,851 / 2,610 (attempt 1 unreported — see F4) | attempt 1 wrote code + tests (6/6 green on disk, independently verified) but never checked items off — bookkeeping failure, honest red stop; attempt 2 closed the ritual in 11 steps |
| C2 | gemini-2.5-flash | remote (Fly ubuntu 24.04, sjc, shared-cpu-2x) | ✅ held | **impl-complete, first attempt** | 1 | 48s | 161,164 / 6,239 | 24 steps / 23 tool calls; built at the worktree root rather than the fixture dir (see F5); 4/4 tests green, independently verified on the box |
| C3 | gemini-3.6-flash | local | ✅ held (stopped red, no false advance) | did-not-run: zero edits | 1 | 59s | n/a | SDK-blocked: `thoughtSignature` not round-tripped by @ai-sdk/google@4.0.24 — tool calls never surface |
| C4 | gemini-3.6-flash | remote (Fly) | ✅ held (stopped red, no false advance) | did-not-run: zero edits | 1 | 68s | n/a | same signature as C3 — environment-independent |
| — | claude (any) | — | — | — | — | — | — | **deferred: no API key** |

## Findings log

- **F1 (2026-07-27)**: gemini-3.x unusable through `@ai-sdk/google@4.0.24` (latest) — raw REST returns a clean `functionCall` (+ `thoughtSignature`), but the SDK loop surfaces zero tool calls; both environments reproduce byte-alike. *Provider parity is bounded by SDK model-support lag.* Mitigations shipped: default reverted to gemini-2.5-flash; raw model-id passthrough added so blocked/new ids stay individually testable.
- **F2 (2026-07-27)**: gate-hold held in every cell run so far, including the failure cells — a model that can't work the loop cannot advance it either (stopped-red, zero false checkoffs). This is the enforcement claim surviving a hostile condition not planned for.

- **F3 (2026-07-27)**: 2.5-flash local attempt 1 exhibited a distinct failure mode — the *engineering* succeeded (source + 6/6 green tests on disk) but the *ritual* didn't (zero checkoffs), so the probe honestly stopped red. Rework cost: one 21-second re-attempt. Discipline-relevant: the gate measures process completion, and a red stop over green code is the system working, not failing.
- **F4 (2026-07-27)**: the loop reports steps/tool-calls/tokens **only on green phase close** — red stops report nothing, so failed-attempt cost is invisible in CLI output. Joins the Phase 4 exit-2-count gap: matrix-grade telemetry (per-attempt usage + per-edit block counts) is a needed indusk fix.
- **F5 (2026-07-27)**: layout variance across runs — C1 built inside a nested `semver/` dir, C2 at the worktree root with its own workspace files. The fixture's impl doesn't pin paths, so structure is model-mood. Outcome-quality note for A8, and an argument for path-pinning in reference-task fixtures.

## Environment provisioning (method record)

Remote cell: Fly Machine `894075b6d50718` (app `dawn-box`, sjc, shared-cpu-2x/2GB, ubuntu:24.04) — Node 24.18.0 + pnpm 11.17.0 via nodesource; branch shipped as `git archive` tarball over `fly ssh sftp` (no repo creds on the box); key transferred the same way. Machine stopped after the run (~$0.02/hr while up; restart + re-run any time, e.g. to append Claude cells).

## A8 read (Sandy)

_Pending — the comparative read over the cells above is the human gate. Guiding questions from the brief: did every gate hold in every cell (yes — see Gate-hold column); is the outcome quality acceptable per cell; what does cost-to-durably-done say about model routing?_

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
| C1 | gemini-2.5-flash | local (darwin arm64) | — | — | — | — | — | pending |
| C2 | gemini-2.5-flash | remote (Fly ubuntu 24.04, sjc, shared-cpu-2x) | — | — | — | — | — | pending |
| C3 | gemini-3.6-flash | local | ✅ held (stopped red, no false advance) | did-not-run: zero edits | 1 | 59s | n/a | SDK-blocked: `thoughtSignature` not round-tripped by @ai-sdk/google@4.0.24 — tool calls never surface |
| C4 | gemini-3.6-flash | remote (Fly) | ✅ held (stopped red, no false advance) | did-not-run: zero edits | 1 | 68s | n/a | same signature as C3 — environment-independent |
| — | claude (any) | — | — | — | — | — | — | **deferred: no API key** |

## Findings log

- **F1 (2026-07-27)**: gemini-3.x unusable through `@ai-sdk/google@4.0.24` (latest) — raw REST returns a clean `functionCall` (+ `thoughtSignature`), but the SDK loop surfaces zero tool calls; both environments reproduce byte-alike. *Provider parity is bounded by SDK model-support lag.* Mitigations shipped: default reverted to gemini-2.5-flash; raw model-id passthrough added so blocked/new ids stay individually testable.
- **F2 (2026-07-27)**: gate-hold held in every cell run so far, including the failure cells — a model that can't work the loop cannot advance it either (stopped-red, zero false checkoffs). This is the enforcement claim surviving a hostile condition not planned for.

## A8 read (Sandy)

_Pending — filled after C1/C2 land._

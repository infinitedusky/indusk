---
title: "Dawn External Orchestrator (MVP) — Retrospective"
date: 2026-08-03
status: completed
---

# Dawn External Orchestrator (MVP) — Retrospective

## What We Set Out to Do

Decouple InDusk's discipline from Claude Code. The brief's key finding (verified before a line was written): the gate scripts are already externalizable — pure functions of *(edit intent + repo state) → allow/block* with a clean stdin/exit-code contract. Build a thin, model-agnostic orchestrator (`indusk run <plan> --model X`) that rents the agentic loop (AI SDK), reuses the gates as-is through a ~50-line adapter, and owns only the loop control ported from `/work --autopilot`. First driver Claude, then one non-Claude, proven across a model × environment acceptance matrix (A8).

## What Actually Happened

Eight phases (0–7), 53 commits, 35 files, +4073 lines. The architecture held exactly as briefed — the adapter really was small, the gates really did port unchanged, and the loop control (per-phase scope, advance-on-green probe, goalpost guard, human-gate pause, red-stop) transplanted cleanly.

Reality inverted one load-bearing assumption: **"Claude first" became "Claude last."** No Anthropic API key was available (org-managed account), so Gemini — whose key had been sitting in `~/.indusk/config.env` since the Graphiti era — became the de-facto first live driver. The Claude driver was built and unit-tested but ran against the real API for the first time on 2026-08-03, when a key finally landed mid-close-out. The hot-swap claim held exactly as designed: zero harness changes, smoke → full cell (C5) the same day.

The acceptance matrix grew from a planned 4 cells to **9** (C1–C7 plus the two 3.6-flash retries), three models, two harnesses, two environments, and a findings log (F1–F10) that ended up more valuable than the cells table:

- **F1** is the plan's best story: gemini-3.6's "zero edits" had two consistent explanations (SDK-blocked vs step starvation), the first diagnosis shipped wrong, and only wire-level logging separated them. The falsified diagnosis is kept in the log deliberately.
- **F2**: gate-hold was universal — including both failure cells. A model that can't work the loop can't advance it either.
- **Falsification (Phase 6)** found the structural hole the happy path never would: the gate covered the *edit* tool while **bash could rewrite checkboxes ungated — and it failed open**. Fixed: bash snapshot-gating + revert, escape-scan best-effort, and a loud-fail invoker (exit 2, any non-zero, and timeout all block — an unattended loop must never read silence as permission).
- **Cleanup (Phase 7)** split the two files Phase 6 doubled and extracted the shared test harness.
- **A8 closed 2026-08-03** with a mutation-based quality read (C5/C6/C7): kill-rate 8/8 for every suite — three models and two harnesses produced *detection-equivalent* tests; the deltas were style. No cell shipped a complete CLI (runnable **and** tested) because the fixture's trajectory named only the pure functions — models converge coverage exactly onto named acceptance. Signed off: acceptance met; route mechanical single-phase work to flash; the harness made no measurable quality difference at sonnet.

## Getting to Done

- **The key drought shaped the whole acceptance phase.** The matrix deviation ("Claude column deferred") was recorded honestly and the hot-swap design made recovery a same-day operation — but the definitive driver went unexercised for a week.
- **Remote cells cost real ops pain**: Fly rootfs is ephemeral across stop/start (F6 — reprovision from scratch each time), nodesource 403s from Fly IPs, and one cell lost its independent test re-run because the machine stopped first.
- **The loop's own telemetry gap (F4)**: red stops report nothing, so failed-attempt cost is invisible in CLI output — the matrix needed hand-stitched accounting.
- **During the quality read, run artifacts had to be recovered** — earlier cells' convention was reset-after-recording, which was right for gate-hold data and wrong for quality reads; C6's code came back out of a subagent transcript, C5 needed a re-run. A grep misread ("CLI falsely checked off") was made and retracted within minutes (F10) — the lowercase pure `cli()` function didn't match a case-sensitive pattern. Kept in the log per the F1 precedent.

## What We Learned

- **The portability thesis is now evidence, not architecture**: gates as pure (intent, state) → allow/block functions ran identically behind three models on two environments. Discipline travels with the loop, not the harness.
- **A gate covers tool surfaces, not intentions** — any tool that can mutate files outside the envelope is a hole *by construction*, and it will fail open unless the invoker is loud-fail. Falsification, not review, found this.
- **When a run produces zero effects, there are always ≥2 consistent explanations** — capability failure vs budget/plumbing starvation — and only wire-level evidence separates them. Never ship the first diagnosis.
- **Acceptance shapes coverage with precision**: every model tested exactly what the trajectory named and diverged freely on what it didn't (the CLI). This is simultaneously a fixture-design warning and proof the trajectory mechanism steers.
- **Mutation kill-rate, not test count, is the quality instrument** — 15, 14, and 9 tests all killed 8/8; count measured style.
- **Cost-to-durably-done ≠ tokens-per-run**: failed attempts cost wall-clock but never false-advanced, so the honest metric includes rework attempts (F3's engineering-succeeded/ritual-failed split).

## What We'd Do Differently

- **Preserve run artifacts from day one.** Reset-after-recording destroyed exactly what the quality read needed. The method note is now in the matrix: quality reads require kept artifacts.
- **Build matrix-grade telemetry into the loop before running the matrix** (per-attempt usage, per-edit block counts) instead of accepting F4's invisibility and hand-stitching.
- **Chase the API key as a Phase 0 item**, not an ambient hope — a driver that exists but can't be exercised is a standing risk, and the eventual unblock took one paste.
- **Name every deliverable in the fixture's trajectory** — including entry points. The un-named CLI produced three different partial deliverables across three models.

## Insights Worth Carrying Forward

- The **findings-log-with-kept-corrections** pattern (F1, F10) is worth repeating in every experimental phase: wrong diagnoses stay visible with their refutations, which is what makes later readers trust the surviving claims.
- **The thin lane is now a real routing option**: flash for mechanical single-phase work at ~2 orders of magnitude lower cost, quality-equivalent when the trajectory is well-named. Sonnet buys unprompted test-first ordering, runnable artifacts, and diagnostics.
- Close-out items deliberately carried forward (recorded in the Dawn master, Component 1 row): the `config.env` loader gap in `atdawn run`; `gpt`/`grok` factories; F4 telemetry; path-pinning in reference fixtures.

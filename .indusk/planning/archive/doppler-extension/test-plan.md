---
title: "Doppler extension — Test Plan"
date: 2026-06-04
status: accepted
---

# Doppler extension — Test Plan

## Purpose

The behavioral assertions that, taken together, mean the doppler extension is
working. Each names the mechanism by which it's tested. These become the source
rows for the impl's Test Trajectory.

The load-bearing assertion is **A3** — a freshly created worktree is build-ready
with no manual env step. Everything else supports that promise or the "Doppler
default, ce deprecated" system posture.

A note on test mechanism: the `env-pull` step shells out to the real `doppler`
binary. Tests split into two layers — **script-logic** tests stub the `doppler`
binary on `PATH` so they assert the extension's behavior (config-driven file
writes, per-app fan-out, gitignore) deterministically in CI; **live-integration**
is covered by manual smoke against a real Doppler project. The split keeps CI
free of a paid external dependency while still exercising every code path.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | After enabling the doppler extension, the developer finds a `.env.example` at `.indusk/extensions/doppler/.env` showing exactly which Doppler token + config to provide. | vitest integration |
| A2 | With a valid token in the gitignored `.indusk/extensions/doppler/.env`, running the env-pull step populates each app's `.env.<profile>` with that app's Doppler values. | vitest integration (stubbed `doppler` binary returning fixture secrets) |
| A3 | **Creating a worktree auto-provisions its env** — after `indusk worktree create <slug>`, the new worktree's apps have populated `.env` files and it builds, with no manual env step. | vitest integration (stubbed `doppler`) |
| A4 | A fresh `indusk init` gives a project the Doppler env setup (extension enabled, env-pull wired, plain docker-compose templates) and does **not** create the composable.env `env/` contract tree. | vitest integration |
| A5 | A developer running `indusk update` on an existing composable.env project is told ce is deprecated and where to migrate, and the project keeps working (ce is not removed out from under them). | vitest integration |
| A6 | The composable-env extension can still be explicitly enabled on a project (opt-in for legacy). | vitest integration |
| A7 | The doppler-provisioned env files are gitignored — they never show up in `git status` in the trunk or any worktree. | vitest integration |
| A8 | dusk's own local stack comes up with composable.env removed — `pnpm wt numero docker:up` (post-migration) brings up the apps without any `ce` invocation. | manual smoke (real Doppler + docker) |
| A9 | A new/3rd-party dev whose only setup was dropping the Doppler token into the gitignored file can create a worktree that builds — zero per-worktree steps. | manual smoke (fresh-env simulation against real Doppler) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The live Doppler API returns the expected secrets for each `<env>_<app>` config and the binary's `secrets download` contract holds. | Paid external integration; can't run against live Doppler in CI without a shared test project + token, and upstream CLI behavior can change. | Script-logic paths fully covered by stubbed-binary tests (A2/A3/A7); live behavior covered by manual smoke (A8/A9); first real worktree-create on numero acts as the canary. |

## Notes

- A8/A9 are the only assertions that touch live Doppler; everything else runs in
  CI via the stubbed binary. If the stub drifts from the real CLI's output
  format, A8/A9 catch it — keep the stub fixture honest against a real
  `doppler secrets download --format env` sample.
- A3 is the assertion the whole plan exists to satisfy. If the worktree-create
  integration can't make A3 pass deterministically with the stub, the auto-
  provisioning design needs rework before impl proceeds.
- dusk is `otel.role: library` — no OTel assertions; the extension emits no
  runtime telemetry.

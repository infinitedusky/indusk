---
title: "Retrospective — Eval Agent OpenTelemetry"
date: 2026-04-17
plan: improvement-eval-agent-open-telemetry
status: closed
---

# Eval Agent OpenTelemetry — Retrospective

## What We Set Out to Do

Ship opt-in OpenTelemetry instrumentation for the background eval agent (evaluator) so we can see what happens between "evaluator spawned" and "scorecard written." The evaluator had been silently failing since 2026-04-11 — scorecards disappeared, no crash log — and diagnosing it required the "add temporary `console.error` and redeploy" anti-pattern we'd already decided to stop using.

The plan was deliberately scoped as a straight-to-implementation micro-plan (brief + impl only, no ADR, no research) — both a cost-controlled fix and a dogfood experiment for the lightweight planning pattern we want for Dusk v2.

Goal in one sentence: eliminate the black-box period between hook-spawn and scorecard-write, so the companion `bug-fix-eval-agent` plan could use live traces (not guessed diagnostics) to find the real failure point.

## What Actually Happened

The plan shipped over 5 phases + 3 published versions:

- **Phase 0 (1.17.x → 1.18.0)**: Rename `judge` → `evaluator`. Cleaner semantics + span-name stability before instrumentation. Files, symbols, log strings, docs. Grep-based T1–T3 tests confirmed zero `judge` tokens remain in `eval/` sources.
- **Phase 1 (still 1.18.0)**: OTel init + config gating. `initEvalOtel`, `isEvalOtelEnabled`, `shutdownEvalOtel`, `withSpan`. Default OFF. Three layers of graceful degradation (disabled / endpoint missing / SDK init throws).
- **Phase 2 (still 1.18.0)**: Evaluator lifecycle spans. Root `eval.run` + six wrapper-level children (`read_session`, `build_prompt`, `spawn_claude`, `parse_output`, `update_session`, `write_scorecard`). Also: I realized mid-plan that the "seven inside-Claude steps" I'd originally promised couldn't be spanned from the wrapper — those live in the Claude subprocess. Reshape the trajectory honestly and document the limit as future work (once Claude Code exposes its own OTel).
- **Phase 3 (1.18.0)**: Highlights count attribute on root span + exception propagation tests. T10 + T11 confirmed.
- **1.18.1**: Ship + first smoke. Dash0 "agent" dataset stayed empty despite `initEvalOtel` logging success. Diagnosis via `dash0 spans query` showed `OTEL_EXPORTER_OTLP_HEADERS` env parsing silently drops space-containing Bearer tokens. Fix: read `DASH0_API_TOKEN` directly, build Authorization header in the exporter constructor.
- **1.18.2**: User routed project telemetry to `indusk-test` dataset via composable.env but wanted eval agent spans to go to a dedicated `agent` dataset. Env-set `OTEL_EXPORTER_OTLP_HEADERS` contains `Dash0-Dataset=indusk-test` which overrides constructor headers per OTel spec. Solution: `EVAL_AGENT_DATASET` env var in the resolution chain, plus rewrite `Dash0-Dataset=<old>` → `Dash0-Dataset=<eval-target>` in-place in the env header before the SDK reads it. Smoke passed end-to-end via composable.env wiring.
- **Phase 5 reopen → 1.19.0**: User pushed for logs ("the new OpenTelemetry standard is spans + logs, not events"). Added `@opentelemetry/api-logs` + `sdk-logs` + `exporter-logs-otlp-http`. `initEvalOtelLogs`, `getEvalLogger`, `logEvalContent`. Emission at `prompt`, `claude.stdout` (+ `claude.error` on non-zero exit), `scorecard`, `error`. Trace_id auto-correlation inside `withSpan`. Tests via `InMemoryLogRecordExporter`. Final smoke: 3 log records per run visible in Dash0 alongside the 7-span tree.
- **Falsification (bounty hunt)**: Found one real bug — the hook's embedded script uses CJS `require("fs")` inside `--input-type=module`, which crashes with `ReferenceError: require is not defined in ES module scope`. Every hook-spawned evaluator has been failing at parse, line 2. All recent scorecards in `.indusk/eval/results.log` came from manual direct invocations, not `jj describe` triggers. This means the OTel plan's Deferred Verification mitigation ("run jj describe and confirm a trace appears in Dash0") was **never actually satisfied via the hook path** — only via direct invocations. Routed to the already-queued `bug-fix-eval-agent` plan as its confirmed Phase 1 hypothesis.

**Structural impact:** primarily `apps/indusk-mcp/src/lib/eval/` — one new module (`otel.ts`, ~260 LOC), heavy modifications to `persistent-evaluator.ts`, light touches in `evaluator-runner.ts`. Plus the rename cascade across hooks, skills, and docs. 3 new test files with 13 new test cases. `CLAUDE.md` Conventions + Current State updates. Changelog entries for 1.17.0, 1.18.0, 1.18.1, 1.18.2, 1.19.0.

## Getting to Done

Six things cost more than planned or arrived unplanned:

1. **The "seven inside-Claude steps" was wrong at plan-write time.** I specced per-step spans for catchup/read_transcript/etc. — those happen inside the Claude subprocess, not in our Node wrapper. Discovered mid-Phase-2 when I tried to instrument them. Reshaped to wrapper-level spans + documented the limit.

2. **Ordering `/falsify` vs scope expansion vs publishing.** I hit a pattern where each scope expansion (Phase 4 content attrs → Phase 5 logs → …) happened because user feedback surfaced a real need, not because the plan under-specified. This worked because the plan was a micro-plan with low overhead per phase — but it does mean "Phase 3" in the final impl is much bigger than "Phase 3" in the original plan.

3. **Four separate `1.18.x` publish cycles during a single plan.** Each OTP prompt + publish + `indusk update` + smoke was ~5 minutes of user time. The env-header parsing bug (1.18.1) was only found POST-publish; the dataset routing bug (1.18.2) was only found POST-publish of 1.18.1. Live-smoke iteration was the right debugging strategy but expensive.

4. **Env-header precedence was the biggest surprise.** My first instinct was to pass headers in the exporter constructor and trust OTel's conventional env override. I'd missed that the SDK's env parser is finicky with space-containing values, AND that env headers beat constructor headers per spec. Both cost a publish cycle to surface.

5. **Dash0 URL region format.** I wrote `eu-west-4` (with hyphen, port `:4318`), should have been `europe-west4` (no hyphen, no port). Wasted diagnostic time until I learned to check `dash0 config profiles list`.

6. **The OTel plan's Deferred Verification mitigation was structurally unprovable via the hook path** — and we didn't notice until falsification. Every direct invocation "smoke passed." Every hook-spawn silently crashed at `require`. The fact that we had any scorecards at all was because I'd been running direct invocations throughout the debug cycle. Real test of the hook path came only in falsification.

## What We Learned

1. **OTel SDK env-header parsing is brittle for real-world tokens.** `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer auth_xxx` silently drops the space-containing value. If you're integrating with a vendor that uses Bearer tokens, read the token directly and build the Authorization header in the exporter constructor — don't trust env parsing.

2. **Vendor-specific headers (e.g., Dash0-Dataset) need wrapper-level override logic.** Because env headers beat constructor headers, and because composable.env-style tooling sets the env header to a project-wide value, a plan that needs a different value per signal-source has to rewrite the env header in-place. `rewriteDatasetInEnvHeaders` in `otel.ts` is the pattern.

3. **`NodeTracerProvider` is the right primitive when you don't need auto-instrumentation.** `NodeSDK` bakes in HTTP/DB auto-instrumentation; for a single-purpose process wrapper that does nothing interesting at the Node-library level, it's pure overhead. "Running in Node" doesn't imply "needs NodeSDK."

4. **Smoke-loop plans are better for observability features than for logic features.** Observability features are validated by the signals arriving where expected — which is hard to pre-test in unit scope. The live-smoke cycle (publish → update → fire → query → iterate) was the right shape here, but expensive per cycle. Batching two fixes into a single publish would have cut the session time significantly.

5. **Hook-spawned subprocesses with `stdio: "ignore"` can fail at parse and be invisible for weeks.** The hook's `require()` bug has existed since at least 2026-04-11 (when `results.log` last got a scorecard from the hook path). No log, no alert, no sign. The only reason we caught it was the falsification ritual's specific-hypothesis discipline — "what if the ESM import contract was violated somewhere we haven't re-verified?"

6. **Writing a plan's tests in unit scope is not the same as validating the plan's Deferred Verification mitigation.** Our unit tests all passed throughout. The "Dash0 trace visible after jj describe" mitigation was only **claimed** to be met via the live smoke — but the live smoke I ran was direct-invocation, not hook-spawn. The wording mattered; the distinction mattered; we didn't notice until falsification. Going forward: Deferred Verification mitigations should be explicit about **which code path** they exercise, not just "the whole thing."

## What We'd Do Differently

1. **Before writing per-step trajectory rows, sanity-check whether the steps live in code you can touch.** Phase 2's "seven steps" should have been caught at plan-authoring time, not at implementation time.

2. **Batch publishes more aggressively.** 1.18.0 → 1.18.1 → 1.18.2 → 1.19.0 could plausibly have been two publishes if we'd paused to list likely gotchas (header parsing, header precedence, dataset routing) up front and checked them together.

3. **Include "which code path does this test" in Deferred Verification mitigations.** Not "run jj describe" — "run jj describe **through the hook-spawn path**, confirm process id exits non-zero, confirm `eval.otel initialized` appears in `system.log` with timestamp matching the hook-fire." Specificity up front would have forced us to exercise the failing path earlier.

4. **The straight-to-impl micro-plan worked.** No ADR, no research phase, and we still shipped five phases with a confirmed falsification hand-off. Fine-grained: I'd keep the brief's "In Scope / Out of Scope" structure, trim the brief prose by ~40%, and use the impl's Trajectory rows as the source of truth for what's promised. For Dusk v2's planning, micro-plan as a first-class workflow is validated.

## Insights Worth Carrying Forward

- **OTel + vendor-specific header routing needs a dedicated testing pattern.** "Smoke-passes with our curl test" ≠ "Smoke-passes via the wrapped exporter." Build a `dash0 {spans,logs} query` verification into the plan's Deferred Verification from the start.
- **Falsification is load-bearing for any plan that doesn't have a deterministic integration test.** Observability plans inherently can't have them — so the bounty hunt IS the integration test.
- **The evaluator-Dash0 pipeline is the first production-like OTel integration in this repo.** Everything we learned about header precedence, dataset routing, env-parsing quirks, and graceful degradation applies to every future observability integration. Document this in the OTel reference page (done in Phase 1–5 docs).
- **`bug-fix-eval-agent` is now well-specified.** The falsification log names the exact failure point (`require("fs")` in `evaluatorScript` template literal at `apps/indusk-mcp/hooks/eval-trigger.js:230`), the exact error, and the exact fix options (switch to ESM-native imports OR use `createRequire` from `node:module`). That plan can execute quickly once OTel ships and the ritual validates via traces.

## Signals to Graphiti

- Retro lesson: OTel SDK env-header parsing drops space-containing Bearer tokens → use constructor headers with a direct token env var.
- Retro lesson: Vendor headers in env override constructor; rewrite in-place if needed.
- Retro lesson: "Running in Node" doesn't imply NodeSDK — NodeTracerProvider is often the right primitive.
- Retro hindsight: Batch publishes by listing gotchas up front.
- Retro hindsight: Deferred Verification mitigations should name the code path, not just the command.
- Retro audit: One trajectory row (T5/T6-era wording about "seven inside-Claude steps") was reshaped mid-plan — mitigation classification `fix-in-scope`, reshape logged in Phase 2.
- Retro audit: Deferred Verification mitigation ("jj describe → trace in Dash0") was satisfied only via direct invocation; hook-spawn path blocked by `bug-fix-eval-agent`'s hook-ESM bug.

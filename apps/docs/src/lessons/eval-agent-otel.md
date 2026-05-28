# Lessons — Eval Agent OpenTelemetry

Distilled from the [`improvement-eval-agent-open-telemetry`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/improvement-eval-agent-open-telemetry) plan, shipped as indusk-mcp 1.19.0.

## OTel SDK env-header parsing is brittle for real-world tokens

`OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer auth_xxx` silently drops the space-containing value when the SDK parses it. Exports retry-loop and nothing lands at the backend. Symptom: `initEvalOtel` logs success, Dash0 stays empty.

**Rule:** if you're integrating with a vendor that uses Bearer tokens, read the token directly from its own env var (`DASH0_API_TOKEN`, `HONEYCOMB_API_KEY`, etc.) and build the Authorization header in the OTLP exporter's constructor. Don't trust env parsing to carry the value through.

See `apps/indusk-mcp/src/lib/eval/otel.ts` `initEvalOtel` for the pattern.

## Vendor headers in env override constructor; rewrite in-place if you need per-signal routing

Per OTel spec, `OTEL_EXPORTER_OTLP_HEADERS` env beats headers passed to the exporter constructor. If composable.env (or any shell-level tooling) sets that env var with a project-wide value like `Dash0-Dataset=indusk-test`, and you want a different value for a specific subsystem (e.g., eval agent spans → `Dash0-Dataset=agent`), you have to **rewrite the env var in-place** before the exporter reads it.

See `rewriteDatasetInEnvHeaders` in `apps/indusk-mcp/src/lib/eval/otel.ts`.

## `NodeTracerProvider` is the right primitive when you don't need auto-instrumentation

`NodeSDK` bakes in HTTP/DB auto-instrumentation. For a single-purpose process wrapper that does nothing interesting at the Node-library level (e.g., our evaluator wrapper, which just spawns a subprocess and collects stdout), `NodeSDK` is pure overhead — it registers hooks into `fs`, `dns`, etc. at import time with no useful spans to show for it.

**Rule:** "running in Node" doesn't imply "needs NodeSDK." Start with `NodeTracerProvider` + `BatchSpanProcessor` + the specific exporter you want. Reach for `NodeSDK` only when you need auto-instrumentation.

## Smoke-loop plans are better for observability features than for logic features

Observability features are validated by signals arriving where expected — hard to pre-test in unit scope because the "test" is "does this specific shape of trace appear at the backend?" Unit tests can confirm the SDK is wired and spans are emitted locally; they can't confirm the end-to-end path reaches the backend with the expected structure.

The right shape: publish → update → fire a real run → query the backend → iterate. Expensive per cycle (~5 min for publish + OTP + update + smoke), so **batch fixes aggressively**. The OTel plan did 4 publish cycles in a single session (1.18.0 → 1.18.1 → 1.18.2 → 1.19.0) — most could plausibly have been 2 publishes if we'd listed likely gotchas up front (header parsing, header precedence, dataset routing) and checked them together.

## Hook-spawned subprocesses with `stdio: "ignore"` can fail at parse and be invisible for weeks

Our evaluator is spawned by a Claude Code PostToolUse hook as `node --input-type=module -e <inline-script>` with `stdio: "ignore"`. The inline script had `const fs = require("fs")` at top-level — which throws `ReferenceError: require is not defined in ES module scope` under ESM. Every hook-spawned invocation crashed at parse, line 2. No log, no alert, no sign — stderr was swallowed by `stdio: "ignore"`.

The bug existed since at least 2026-04-11 (when `.indusk/eval/results.log` last got a scorecard from the hook path). We didn't catch it until the falsification ritual's **specific-hypothesis discipline**: "what if the ESM contract was violated somewhere we haven't re-verified since the rename?"

**Rule:** any detached subprocess with silenced stderr is a latent bug farm. At minimum, add an early "process started" log that writes to a known file via ESM-safe APIs (no `require`), and check that log exists before trusting downstream steps ran.

## Deferred Verification mitigations should name the code path, not just the command

The OTel plan's mitigation was: "run `jj describe`, confirm a trace appears in Dash0." I verified it every iteration — via direct invocation of the evaluator, not via the hook-spawn path. The mitigation text didn't say which path; I assumed "the whole thing"; the hook path was silently broken the entire time. Falsification found it.

**Rule:** when writing Deferred Verification rows, don't say "run X." Say "run X through code path Y, confirm signal Z appears at observation point W." Specificity up front forces you to exercise the failing path during development, not discover it at close-out.

## Falsification is load-bearing for plans that don't have a deterministic integration test

Observability plans inherently can't have one — the signal has to arrive at an external backend. So unit tests cover the SDK wiring, the live smoke covers arrival at the backend, and **the falsification ritual covers the assumption gap between them**.

The OTel plan's falsification surfaced exactly one finding — the hook-ESM bug — that unit tests + live smoke + normal code review all missed. That's the ritual's entire point: the author only writes tests they can think of, and the author is the last person likely to notice the gaps in their own thinking.

---

## Pointer

Full retrospective: [`.indusk/planning/archive/improvement-eval-agent-open-telemetry/retrospective.md`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/improvement-eval-agent-open-telemetry/retrospective.md)

Falsification log: [`.indusk/planning/archive/improvement-eval-agent-open-telemetry/falsification.md`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/improvement-eval-agent-open-telemetry/falsification.md)

Downstream plan: `bug-fix-eval-agent` inherited the confirmed falsification finding as its Phase 1 premise.

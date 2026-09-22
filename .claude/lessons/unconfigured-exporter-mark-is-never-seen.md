# A telemetry mark nobody configured an exporter for is never seen — verify the export path is on by default, not just that the mark exists

day-monitor's ADR (D10) assumed the evaluator emitted no spans at all, and planned a workaround (a direct OTLP post from the hook). Ground truth was different: the evaluator already emitted `eval.*` spans — but only when a person hand-set `INDUSK_EVAL_OTEL` and an endpoint. On a normal machine, nothing reached Jaeger, which looks identical to "no spans emitted" from the outside (nothing arrives either way).

Why it matters: "does the code emit the signal" and "does the signal reach the backend on a stock setup" are different questions, and only testing the sink (Jaeger/the collector) with no manual env vars set answers the second one. An ADR that verifies the first and assumes the second ships a fix for the wrong problem.

What to do instead: when a plan's premise is "X emits no telemetry," verify by running X unmodified on a clean environment and checking the collector — not by grepping for exporter setup code. Here the real fix was making the export default to the local telemetry daemon when it's running, with `eval.otel.enabled: false` as the explicit off switch, so the mark requires no manual configuration to be observed.

See `.indusk/planning/day-monitor/` for the corrected D10 and the default-on export fix.

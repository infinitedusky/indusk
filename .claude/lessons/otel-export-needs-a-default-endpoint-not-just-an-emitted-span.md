# A span emitted with no configured exporter is never seen — default OTel export to the local daemon when it's running

Emitting a span is not the same as exporting it anywhere. During day-monitor, ADR D10 assumed the evaluator emitted no spans at all (and planned a workaround: a direct OTLP post from the hook). It turned out `eval.*` spans WERE already emitted — but only reached Jaeger when a person manually set `INDUSK_EVAL_OTEL` and an exporter endpoint. On a normal machine, nothing was ever configured, so the spans existed but went nowhere.

The fix: default OTel export to the local telemetry daemon whenever it's running, with `eval.otel.enabled: false` as the explicit off switch — rather than requiring opt-in configuration that nobody sets.

General rule: before designing around "does X emit telemetry", check whether it emits but silently drops for lack of a default exporter target — that's a different, and much easier, problem than adding instrumentation from scratch. See `.indusk/planning/archive/day-monitor/adr.md` (D10) and its retrospective.

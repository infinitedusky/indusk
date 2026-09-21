# A conventional OTel attribute like deployment.environment is a resource attribute — read the process/resource tags, not just the span's own tags

OpenTelemetry's semantic conventions distinguish span attributes (set per-span, describing one operation) from resource attributes (set once per process/service, describing what emitted the spans). `deployment.environment` is a resource attribute: a conventionally instrumented application sets it once on its Resource, not on every span. In Jaeger's data model this lands on the trace's `processes[processID].tags`, not on `span.tags`.

A reader that only checks `span.tags` for a resource-level attribute will find it in synthetic test fixtures (which often put everything on the span for convenience) but never in a real exporter's output — so every unit test can pass while production silently reads the field as absent.

Caught in day-always-on's A21 (the first fully end-to-end test using a real, separately-authenticated OTel SDK process rather than an OTLP fixture) — `parseMarkedSpan` in `apps/indusk-mcp/src/lib/promises/telemetry.ts` read only `span.tags` for `ENVIRONMENT_ATTRIBUTE`; every A1-A20 unit row passed because the test fixture (`otlpBody`) put the attribute on the span. The fix checks the span's own tags first, then falls back to the trace's process tags, and the regression guard was pulled back into the fast unit suite (`local-jaeger.ts` gained `resourceAttributes`, and A12 now asserts through that path) rather than living only in `pnpm e2e`.

**Do**: when reading any OTel semantic-convention attribute that is documented as resource-level (`deployment.environment`, `service.name`, `service.version`, etc.) from a trace backend's API, check both the span's own tags and the process/resource tags, span first. When building a test fixture that exercises this read, make sure the fixture places the attribute at the same level a real SDK would — or add one end-to-end test with a real SDK, because a fixture that "helpfully" puts everything on the span hides exactly this class of bug from every unit test that uses it.

See `.indusk/planning/day-always-on/adr.md` (D6, D10) and `/guide/always-on`.

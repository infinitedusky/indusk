# telemetry-binaries — shared files

This directory holds assets shared across the four platform-specific packages (`telemetry-binaries-darwin-arm64`, `-darwin-x64`, `-linux-arm64`, `-linux-x64`). The build script copies these into each platform package as part of the bundling step.

## What lives here

| File | Purpose |
|------|---------|
| `UPSTREAM.json` | Pinned upstream versions for Jaeger + OTel Collector, URL templates, per-platform archive-name maps, checksum-source URLs. The build script reads this; humans edit it to bump upstream versions. |
| `jaeger-config.yaml` | Jaeger v2 config — traces pipeline, in-memory storage (`max_traces=100000`), `jaeger_query` extension on 16686, healthcheckv2 on 13133. Shipped in every platform package's root. |
| `collector-config.yaml` | otelcol config — logs-only pipeline, OTLP HTTP receiver on 4319, file exporter writing rotating JSONL to `$INDUSK_TELEMETRY_LOGS_PATH`. Shipped in every platform package's root. |
| `LICENSE` | Apache 2.0 license text covering both upstream projects (Jaeger + OpenTelemetry Collector). |
| `NOTICE` | Per-upstream attribution, pointing to Jaeger's and OTel Collector's repos + licenses. |

## Why two binaries (Jaeger + otelcol core) instead of one

Jaeger v2 is itself an OTel Collector distribution (the spike in `.indusk/planning/local-telemetry/spike-findings.md` confirms this), but it ships only trace-oriented components — no `file` exporter, no log-storage path. Logs need a separate binary.

We chose **otelcol core** (not contrib, not k8s) for logs because:
- Core is ~168 MB; contrib is ~339 MB (measured on darwin-arm64 v0.150.1). ~170 MB lighter per platform.
- Core's component list includes every receiver/processor/exporter our locked pipeline needs — `otlp`, `batch`, `memory_limiter`, `file`, `health_check`.
- k8s distribution was the first suggestion but is Linux-only — doesn't work for darwin.

This is an intentional tradeoff: more components = larger binary = larger platform package. Our locked pipeline is narrow, so we use the narrowest distribution that covers it.

## How to bump upstream versions

1. Edit `UPSTREAM.json`:
   - Change `jaeger.version` to the desired Jaeger release tag (without the `v` prefix).
   - Change `otelcol.version` to the desired OTel Collector release.
2. Run the build script: `scripts/build-telemetry-binaries.sh`. This fetches + verifies + packs all four platforms. Idempotent via cache.
3. Smoke-test the binaries:

   ```sh
   BIN=packages/telemetry-binaries-$(node -e "console.log(process.platform+'-'+process.arch)")/bin
   "$BIN/jaeger" version
   "$BIN/otelcol" --version
   ```

4. Run the T2 integration test (Phase 2 Verification): `pnpm --filter @infinitedusky/indusk-mcp vitest run src/__tests__/telemetry-ui-reachable.test.ts`. Should go green.
5. Bump `version` in each of the four platform packages' `package.json`.
6. Publish with: `scripts/build-telemetry-binaries.sh --publish`. Publishes all four platform packages to npm.
7. Bump `@infinitedusky/indusk-mcp`'s `optionalDependencies` versions to match.

## How to test the binaries by hand

```sh
# Terminal 1: run Jaeger
cd packages/telemetry-binaries-darwin-arm64
./bin/jaeger --config=file:jaeger-config.yaml

# Terminal 2: emit a test span via @opentelemetry/sdk-trace-node
# (see apps/indusk-mcp/scripts/emit-test-span.mjs once that's authored)

# Terminal 3: query Jaeger
curl http://localhost:16686/api/services
curl "http://localhost:16686/api/traces?service=YOUR-SERVICE&limit=10" | jq .
```

## Supported platforms

- `darwin-arm64` (Apple Silicon macOS)
- `darwin-x64` (Intel macOS)
- `linux-arm64` (ARM Linux — Raspberry Pi, Graviton, etc.)
- `linux-x64` (x86_64 Linux)

Unsupported platforms (Windows, BSD, musl-libc Linux like Alpine) are excluded at npm install time via the platform packages' `os`/`cpu` fields. Add a new platform package here + run the build script with it to expand support.

## See also

- `.indusk/planning/local-telemetry/adr.md` — the architectural decision record
- `.indusk/planning/local-telemetry/spike-findings.md` — Phase 1 spike measurements + decisions
- `scripts/build-telemetry-binaries.sh` — the build pipeline
- `apps/indusk-mcp/extensions/local-telemetry/` — the extension that consumes these binaries (Phase 4)

# @infinitedusky/telemetry-binaries-linux-arm64

Native binaries for `linux-arm64`, bundled for [`@infinitedusky/indusk-mcp`](https://www.npmjs.com/package/@infinitedusky/indusk-mcp)'s `local-telemetry` extension.

## Contents

- **`bin/jaeger`** — Jaeger v2 trace backend. See `NOTICE` for upstream attribution.
- **`bin/otelcol`** — OpenTelemetry Collector (core distribution). See `NOTICE` for upstream attribution.
- **`jaeger-config.yaml`** — trace-pipeline config with in-memory storage.
- **`collector-config.yaml`** — log-pipeline config with file exporter.

## Licensing

Both upstream projects are Apache 2.0. Binaries are redistributed unmodified. See `LICENSE` and `NOTICE`.

## This is not a fork

This package exists purely to simplify installation for InDusk users. For the canonical upstream distributions:

- Jaeger: https://github.com/jaegertracing/jaeger
- OpenTelemetry Collector: https://github.com/open-telemetry/opentelemetry-collector-releases

## Install

This package is installed automatically via npm's platform-matching `optionalDependencies` when you `npm install @infinitedusky/indusk-mcp` on a `linux-arm64` machine. Do not depend on it directly.

## Version pinning

See `packages/telemetry-binaries-shared/UPSTREAM.json` in the source monorepo for the exact upstream versions bundled.

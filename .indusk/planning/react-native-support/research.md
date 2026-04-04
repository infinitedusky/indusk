---
title: "React Native OTel and Extension Research"
date: 2026-04-04
status: complete
---

# React Native OTel and Extension Research

## Question
How do we get OpenTelemetry working in React Native/Expo, and what extensions does indusk-mcp need for React Native development?

## Findings

### OTel in React Native — Package Compatibility

| Package | Works in RN? | Notes |
|---------|-------------|-------|
| `@opentelemetry/api` | Yes | Pure interfaces, zero deps |
| `@opentelemetry/semantic-conventions` | Yes | Pure constants |
| `@opentelemetry/core` | Yes | Pure JS context propagation |
| `@opentelemetry/resources` | Partial | Auto-detectors import Node `os` module. Must construct Resource manually. Fix: Metro `unstable_enablePackageExports: true` |
| `@opentelemetry/sdk-trace-base` | Yes* | Works if resource detector issue is bypassed |
| `@opentelemetry/exporter-trace-otlp-http` | Yes* | Needed TextEncoder polyfill (fixed in recent versions via PR #5193). Uses fetch, which RN has. |
| `@opentelemetry/sdk-node` | No | Node.js only — imports `http`, `https`, `os`, etc. |
| `@opentelemetry/sdk-trace-web` | No | Browser-specific — imports `document`, `window` |
| `@opentelemetry/auto-instrumentations-node` | No | Node.js only |

### Two Required Workarounds

1. **Metro config**: `unstable_enablePackageExports: true` in `metro.config.js`. This makes Metro resolve the `browser` field in OTel package.json files, avoiding the Node `os` module import from `@opentelemetry/resources`. Without this: `Error: Unable to resolve module os`.

2. **TextEncoder polyfill**: Hermes doesn't have `TextEncoder`. The OTLP exporter serializer falls back to Base64 encoding, which collectors reject with HTTP 400. Fix: `import 'fast-text-encoding'` before OTel imports. Note: OTel PR #5193 (merged) may have fixed this in recent versions — test before adding polyfill.

### Alternative Approaches Evaluated

**Embrace SDK** — Fully OTel-native RN SDK with Expo config plugin. Requires account creation for app IDs/API tokens. Has OTLP-HTTP export to bypass their backend. Rejected: third-party dependency for something we can do with standard packages.

**Callstack `react-native-open-telemetry`** — Native module wrapper. Highly experimental, no bidirectional JS/Native communication. Rejected: too immature.

**Sentry** — Has RN SDK with OTel-compatible tracing, but it's primarily error tracking, not general observability. Not OTel-native.

**Honeycomb `@honeycomb/react-native`** — Uses the same standard OTel packages + Metro config approach we're taking. Validates our approach.

### Storybook for React Native

- Package: `@storybook/react-native` (actively maintained, Storybook 9)
- Expo template: `npx create-expo-app --template expo-template-storybook`
- Config folder: `.rnstorybook/`
- Requires `unstable_allowRequireContext` in Metro config for dynamic story imports
- Runs on-device, renders real native components (not web Storybook in a browser)

### Framer MCP

- Official Framer MCP plugin on Framer Marketplace
- Connects Framer projects to MCP-compatible AI tools via secure tunnel
- Capabilities: read/edit project files, update styles, manage components
- Community server: `framer-plugin-mcp` on GitHub adds web3 capabilities
- Extension would be MCP server config + skill, no custom code

## Sources
- [OTel JS RN support request — Issue #1089](https://github.com/open-telemetry/opentelemetry-js/issues/1089)
- [Unable to resolve `os` — Issue #5240](https://github.com/open-telemetry/opentelemetry-js/issues/5240)
- [OTLP Base64 encoding fix — PR #5193](https://github.com/open-telemetry/opentelemetry-js/pull/5193)
- [Honeycomb OTel React Native](https://github.com/honeycombio/honeycomb-opentelemetry-react-native)
- [Storybook React Native repo](https://github.com/storybookjs/react-native)
- [Framer MCP plugin](https://www.framer.com/marketplace/plugins/mcp/)

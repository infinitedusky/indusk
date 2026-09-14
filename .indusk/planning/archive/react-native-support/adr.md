---
title: "React Native Support — OTel with Standard Packages, Three New Extensions"
date: 2026-04-04
status: accepted
---

# React Native Support — OTel with Standard Packages, Three New Extensions

## Y-Statement
In the context of **adding React Native/Expo support to indusk-mcp**,
facing **React Native's Hermes runtime lacking Node.js and browser APIs that OTel SDK packages assume**,
we decided for **standard OTel JS packages (`api` + `sdk-trace-base` + `exporter-trace-otlp-http`) with Metro config and polyfill workarounds**
and against **Embrace SDK (third-party dependency with account requirement) and Callstack's experimental native wrapper**,
to achieve **the same OTLP → Dash0 pipeline used by all other project types, with no third-party observability vendor lock-in**,
accepting **two required workarounds in Metro config and potential TextEncoder polyfill**,
because **the standard packages work in RN when auto-detectors are bypassed, and this is the same approach Honeycomb's production RN distro uses**.

## Context
`indusk init` scaffolds OTel instrumentation for every project type — Node.js, Next.js, Python, React SPA. React Native is the missing piece. The standard `@opentelemetry/sdk-node` doesn't work in Hermes (imports `os`, `http`, etc.), and `sdk-trace-web` assumes browser globals (`document`, `window`). But the base packages — `api`, `sdk-trace-base`, and `exporter-trace-otlp-http` — are pure JS and work in React Native with two workarounds.

See `research.md` for full package compatibility analysis.

## Decision

### OTel Approach
1. **New template `instrumentation.rn.ts`** — uses `sdk-trace-base` (not `sdk-node` or `sdk-trace-web`), constructs `Resource` manually (no auto-detectors), exports via `exporter-trace-otlp-http` to Dash0.
2. **Metro config patch** — `init` updates `metro.config.js` to add `resolver.unstable_enablePackageExports = true`.
3. **TextEncoder polyfill** — `init` adds `fast-text-encoding` as a dependency and imports it in the instrumentation file. May be removable once we verify recent OTel versions include the fix.
4. **`init` detection** — Expo project detected by `app.json` containing `"expo"` key or `expo` in `package.json` dependencies.

### New Extensions

**Expo extension** (`extensions/expo/`):
- Manifest with detection rule: `{ "file": "app.json" }` + content check for `expo` key
- Skill: Expo patterns (EAS Build, config plugins, expo-router, Metro config)
- Health checks: `expo --version` installed, `eas --version` installed
- Verification: `expo doctor` passes

**Storybook extension** (`extensions/storybook/`):
- Manifest with detection rule: `{ "devDependency": "@storybook/react-native" }` or `{ "file": ".storybook/main.js" }`
- Skill: Storybook patterns for React Native (on-device rendering, story organization, `unstable_allowRequireContext`)
- No health checks (Storybook is a dev-time tool, not infrastructure)

**Framer MCP extension** (`extensions/framer/`):
- Manifest with detection rule: `{ "mcp_server": "framer" }`
- Skill: Framer MCP patterns (project access, component editing, style management)
- MCP server setup instructions in skill
- No health checks (depends on Framer plugin tunnel, external service)

### `init` Changes
- Add Expo detection before the existing `isNextJs` / `isPython` / `isReactSPA` checks
- Expo projects get `instrumentation.rn.ts` template, Metro config patch, and TextEncoder polyfill
- Skip Node.js packages (`sdk-node`, `auto-instrumentations-node`, `pino`)
- Print install command for RN-compatible OTel packages

## Alternatives Considered

### Embrace SDK
Full OTel-native React Native SDK with Expo config plugin. Supports OTLP-HTTP export.
**Rejected:** Requires creating an Embrace account for app IDs and API tokens. Adds a third-party vendor dependency when standard OTel packages work with minor workarounds. Lock-in we don't need.

### Callstack `react-native-open-telemetry`
Native module wrapper around OTel.
**Rejected:** Highly experimental, no bidirectional JS/Native communication, immature.

### Skip OTel for React Native
Scaffold project without instrumentation.
**Rejected:** OTel is a core principle — every project is observable from day one. Same pipeline, same backend, regardless of platform.

## Consequences

### Positive
- Same OTLP → Dash0 pipeline as all other project types
- No third-party vendor dependency for observability
- Proven approach (Honeycomb's RN distro uses identical stack)
- Three new extensions expand indusk-mcp's project type coverage

### Negative
- Metro `unstable_enablePackageExports` is an unstable API — could change in future Metro versions
- TextEncoder polyfill may be unnecessary with recent OTel versions (needs testing)
- Manual `Resource` construction means no automatic device/OS detection (can be added later)

### Risks
- Metro's `unstable_enablePackageExports` could break or change behavior in a Metro update. Mitigation: pin Metro version in Expo extension skill guidance, monitor Metro changelog.
- OTel JS team explicitly says React Native is unsupported. Mitigation: we depend on stable, low-level packages only (`api`, `sdk-trace-base`), not the full SDK. These are unlikely to add Node-only deps.

## Documentation Plan

### Pages
- New: `reference/extensions/expo.md` — Expo extension setup, OTel for React Native, EAS Build requirements
- New: `reference/extensions/storybook.md` — Storybook extension for React Native
- New: `reference/extensions/framer.md` — Framer MCP extension setup
- Update: `guide/getting-started.md` — add React Native/Expo as a supported project type

### Diagrams
- Update architecture diagram showing React Native OTel flow: App → OTel SDK (Hermes) → OTLP-HTTP → Dash0

### Changelog
- Added React Native/Expo support with standard OTel instrumentation
- Added Expo, Storybook, and Framer MCP extensions

### ADR in Docs
- Publish as `decisions/react-native-otel.md`

## References
- `planning/react-native-support/research.md`
- `planning/react-native-support/brief.md`
- [OTel JS Issue #1089 — React Native support](https://github.com/open-telemetry/opentelemetry-js/issues/1089)
- [Honeycomb OTel React Native](https://github.com/honeycombio/honeycomb-opentelemetry-react-native)
- `planning/archive/otel-core-skill/adr.md` — existing OTel patterns

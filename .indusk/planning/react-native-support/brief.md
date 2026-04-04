---
title: "React Native Support — Expo, OTel, and New Extensions"
date: 2026-04-04
status: accepted
---

# React Native Support — Brief

## Problem
`indusk init` doesn't know what to do with a React Native/Expo project. It either scaffolds Node.js OTel templates (which won't work in React Native's Hermes runtime) or falls back to "unknown project type" with no instrumentation. We also lack extensions for Expo, Storybook, and Framer — three tools that are core to Sandy's React Native workflow.

## Proposed Direction

### 1. Expo Extension
New built-in extension that detects Expo projects (`app.json` with `expo` key, or `expo` in dependencies) and provides:
- **Skill** — Expo patterns, EAS Build, config plugins, navigation, Metro config
- **Health checks** — Expo CLI installed, dev client configured
- **OTel scaffolding** — Standard OTel JS packages configured for React Native, exporting to Dash0 via OTLP-HTTP
- **Detection** in `init` — scaffolds React Native OTel instrumentation instead of Node.js OTel

### 2. `init` React Native / Expo Detection
Update `init.ts` to detect Expo projects and scaffold:
- `instrumentation.ts` using `@opentelemetry/api` + `@opentelemetry/sdk-trace-base` + `@opentelemetry/exporter-trace-otlp-http`
- Manual `Resource` construction (no auto-detectors — they import Node's `os` module)
- OTLP-HTTP export to Dash0 endpoint (using existing composable.env Dash0 config)
- Metro config update: `unstable_enablePackageExports: true` (required for OTel packages to resolve correctly in Metro bundler)
- `fast-text-encoding` polyfill (for OTLP serialization in Hermes)
- Skip Node.js OTel templates (`@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`)

**No third-party SDK required.** Standard OTel JS packages work in React Native with two workarounds:
1. Metro `unstable_enablePackageExports: true` — avoids `os` module import from `@opentelemetry/resources`
2. TextEncoder polyfill — `fast-text-encoding` for OTLP serialization (may not be needed with recent OTel versions)

This keeps the same OTLP pipeline as all other projects: app → OTel SDK → OTLP-HTTP → Dash0.

### 3. Storybook Extension
New built-in extension that detects Storybook (`.storybook/` or `.rnstorybook/` directory, or `@storybook/react-native` in dependencies) and provides:
- **Skill** — Storybook patterns for React Native (on-device rendering, Metro config, story organization)
- **Detection** — `.storybook/` or `@storybook/react-native` in devDependencies

### 4. Framer MCP Extension
New built-in extension for Framer's MCP integration:
- **MCP server config** — Framer's official MCP plugin provides a tunnel endpoint
- **Skill** — Framer + MCP patterns (reading/editing projects, component management)
- **Detection** — `framer` MCP server in `.mcp.json`

## Context
- Standard `@opentelemetry/api` + `sdk-trace-base` + `exporter-trace-otlp-http` work in React Native with Metro config and polyfill workarounds. No third-party wrapper needed.
- `@opentelemetry/resources` auto-detectors import Node's `os` module — must construct Resource manually.
- `@opentelemetry/sdk-node` and `auto-instrumentations-node` are Node-only — cannot be used.
- Honeycomb's React Native distro uses this exact approach (standard OTel packages + Metro config).
- Storybook 9 has first-class Expo support via `@storybook/react-native`.
- Framer has an official MCP plugin on their marketplace.
- The extension system already supports built-in extensions with manifests, skills, health checks, and detection rules.

## Scope

### In Scope
- Expo extension (manifest, skill, health checks, detection)
- `init` Expo/React Native detection and OTel scaffolding with standard packages
- OTel instrumentation template for React Native (`templates/instrumentation.rn.ts`)
- Storybook extension (manifest, skill, detection)
- Framer MCP extension (manifest, skill, detection, MCP server setup instructions)

### Out of Scope
- Building the actual React Native test app (separate project, not this plan)
- React Native without Expo (bare RN — too many variants, Expo is the default)
- Storybook web (only React Native Storybook)
- Custom native OTel modules (using JS-only approach)

## Success Criteria
- `indusk init` on a fresh Expo project correctly detects it and scaffolds OTel with standard packages
- Scaffolded OTel sends traces to Dash0 from a running Expo dev client
- Expo extension health checks pass on a configured Expo project
- Storybook extension detects `@storybook/react-native` projects
- Framer extension provides MCP server setup instructions
- No Node.js-specific OTel code scaffolded into React Native projects

## Depends On
- Extension system (completed)
- OTel extension patterns (completed)
- `indusk init` scaffolding pipeline (completed)

## Blocks
- Sandy's React Native test project (needs these extensions to test graphiti e2e)

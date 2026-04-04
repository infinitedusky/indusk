---
title: "React Native Support — Implementation"
date: 2026-04-05
status: approved
gate_policy: ask
---

# React Native Support — Implementation

## Goal
Add React Native/Expo support to indusk-mcp: `init` detects Expo projects and scaffolds OTel with standard packages, plus three new extensions (Expo, Storybook, Framer MCP).

## Scope
### In Scope
- Expo extension (manifest, skill, health checks)
- Storybook extension (manifest, skill)
- Framer MCP extension (manifest, skill, MCP server config)
- `instrumentation.rn.ts` template
- `init.ts` Expo detection and scaffolding
- Metro config patching

### Out of Scope
- Building a React Native app (separate project)
- Bare React Native (Expo only)
- Native OTel modules

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 0 | Auto-add MCP servers from extension manifests during `init` | Extension manifest `mcp_server` field |
| Phase 1 | Three extension manifests + skills | Existing extension system |
| Phase 2 | `instrumentation.rn.ts` template | OTel packages, Dash0 config patterns |
| Phase 3 | `init.ts` Expo detection + scaffolding | Phase 0 auto-add, Phase 1 extensions, Phase 2 template |
| Phase 4 | End-to-end validation on fresh Expo project | All prior phases |

## Phase 0: Auto-Add MCP Servers from Extensions

Any extension with `mcp_server` in its manifest should be auto-added to `.mcp.json` via `claude mcp add` during `init`. No manual `.mcp.json` editing — ever.

### Implementation
- [ ] Update `init.ts` extension hooks section: after running `on_init` hooks, check each enabled extension for `mcp_server` config
- [ ] For each extension with `mcp_server`:
  - Check if the server already exists in `.mcp.json` (by extension name)
  - If not, run `claude mcp add` with the appropriate type, URL/command, and env vars from the manifest
  - For HTTP servers (like Dash0): `claude mcp add -t http -s project --header "Authorization: Bearer $TOKEN" {name} {url}`
  - For stdio servers: `claude mcp add -t stdio -s project {name} {command} {args}`
  - Read secrets from extension's `.env` file in `.indusk/extensions/{name}/.env` if it exists
- [ ] Update Dash0 extension manifest: ensure `mcp_server` has enough info for auto-add (type, URL pattern, required env vars)
- [ ] Update Framer extension manifest: same pattern
- [ ] Remove "Configure the Dash0 MCP server in .mcp.json" messaging — it's now automatic

#### Phase 0 OTel
- skip-reason: MCP server config plumbing, no new observable code paths

#### Phase 0 Verification
- [ ] `indusk init` on a project with Dash0 extension enabled auto-adds `dash0` to `.mcp.json`
- [ ] Running `init` again doesn't duplicate the MCP server entry
- [ ] Extensions without `mcp_server` are unaffected
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` succeeds
- [ ] `pnpm check` passes

#### Phase 0 Context
- [ ] Update CLAUDE.md Conventions: extensions with MCP servers are auto-added by `init`, never manually configured

#### Phase 0 Document
- [ ] Update extension authoring docs: `mcp_server` manifest field auto-adds during init

## Phase 1: Extensions

### Implementation
- [ ] Create `extensions/expo/manifest.json`:
  ```json
  {
    "name": "expo",
    "description": "Expo/React Native — EAS Build, config plugins, Metro config, OTel via standard packages",
    "provides": {
      "skill": true,
      "health_checks": [
        { "name": "expo-cli-installed", "command": "npx expo --version" },
        { "name": "eas-cli-installed", "command": "npx eas --version" }
      ],
      "verification": ["npx expo doctor"]
    },
    "detect": { "dependency": "expo" }
  }
  ```
- [ ] Create `extensions/expo/skill.md` — Expo patterns:
  - EAS Build vs Expo Go (dev client required for native modules like OTel)
  - Config plugins pattern (how `app.json` plugins work)
  - expo-router navigation patterns
  - Metro config (`unstable_enablePackageExports`, `unstable_allowRequireContext`)
  - OTel setup: standard packages, no Embrace, OTLP → Dash0
  - Common gotchas: Expo Go can't load native modules, `npx expo prebuild` for native config
- [ ] Create `extensions/storybook/manifest.json`:
  ```json
  {
    "name": "storybook",
    "description": "Storybook — component development and testing, React Native on-device stories",
    "provides": { "skill": true },
    "detect": { "devDependency": "@storybook/react-native" }
  }
  ```
- [ ] Create `extensions/storybook/skill.md` — Storybook patterns:
  - React Native Storybook (on-device, not web)
  - `.rnstorybook/` config directory
  - `unstable_allowRequireContext` in Metro config
  - Story organization for components
  - Storybook 9 + Expo integration
- [ ] Create `extensions/framer/manifest.json`:
  ```json
  {
    "name": "framer",
    "description": "Framer MCP — AI-assisted design editing, component management, style updates",
    "provides": {
      "skill": true
    },
    "mcp_server": {
      "type": "http",
      "setup_instructions": [
        "1. Install the Framer MCP plugin from the Framer Marketplace",
        "2. Open the plugin in your Framer project to get the tunnel URL",
        "3. Run: claude mcp add -t http -s project framer <tunnel-url>"
      ]
    },
    "detect": { "mcp_server": "framer" }
  }
  ```
- [ ] Create `extensions/framer/skill.md` — Framer MCP patterns:
  - Reading and editing Framer project files
  - Component management
  - Style updates
  - Working with Framer's MCP plugin tunnel

#### Phase 1 OTel
- skip-reason: Extension manifests and skills are metadata, no new code paths

#### Phase 1 Verification
- [ ] `indusk extensions list` shows expo, storybook, framer in available extensions
- [ ] `indusk extensions enable expo storybook framer` succeeds
- [ ] `indusk extensions status` shows all three enabled
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` succeeds
- [ ] `pnpm check` passes

#### Phase 1 Context
- [ ] Update CLAUDE.md Architecture: add expo, storybook, framer to extension list

#### Phase 1 Document
- [ ] Add extension descriptions to docs sidebar and reference pages

## Phase 2: OTel Template

### Implementation
- [ ] Create `templates/instrumentation.rn.ts`:
  ```typescript
  // React Native OTel instrumentation — standard packages, OTLP-HTTP export
  // Requires: metro.config.js with resolver.unstable_enablePackageExports = true
  import 'fast-text-encoding'; // TextEncoder polyfill for Hermes
  import { Resource } from '@opentelemetry/resources';
  import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
  import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
  import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: "unknown-service",
  });

  const exporter = new OTLPTraceExporter({
    url: process.env.EXPO_PUBLIC_OTEL_ENDPOINT,
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OTEL_AUTH_TOKEN}`,
    },
  });

  const provider = new BasicTracerProvider({ resource });
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  export { provider };
  ```
  Note: `EXPO_PUBLIC_` prefix makes env vars available in Expo client code.
- [ ] Verify template compiles (dry run against RN-compatible TS config)

#### Phase 2 OTel
- [ ] The template itself IS the OTel instrumentation — validate the import pattern works with `sdk-trace-base` (not `sdk-node`)

#### Phase 2 Verification
- [ ] Template file exists at `templates/instrumentation.rn.ts`
- [ ] Template uses `sdk-trace-base` and `exporter-trace-otlp-http` (NOT `sdk-node` or `sdk-trace-web`)
- [ ] Template imports `fast-text-encoding` before OTel
- [ ] Template constructs `Resource` manually (no auto-detectors)
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` succeeds

#### Phase 2 Context
- (none needed)

#### Phase 2 Document
- [ ] Add OTel React Native setup guide to `reference/extensions/expo.md`

## Phase 3: `init` Expo Detection

### Implementation
- [ ] Add Expo detection in `init.ts` OTel section — before `isNextJs` check:
  ```typescript
  const isExpo = existsSync(join(projectRoot, 'app.json')) &&
    (() => {
      try {
        const appJson = JSON.parse(readFileSync(join(projectRoot, 'app.json'), 'utf-8'));
        return 'expo' in appJson;
      } catch { return false; }
    })();
  ```
- [ ] Add Expo OTel scaffolding branch:
  - Copy `instrumentation.rn.ts` to `src/instrumentation.ts` (or project root)
  - Replace `"unknown-service"` with project name
  - Print install command: `npx expo install @opentelemetry/api @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions fast-text-encoding`
  - Print wiring instructions: `import './instrumentation'` at top of `App.tsx` or root layout
- [ ] Patch Metro config if `metro.config.js` exists:
  - Read existing config
  - If `unstable_enablePackageExports` not present, warn user to add it:
    ```
    Add to metro.config.js resolver:
      unstable_enablePackageExports: true
    ```
  - Don't auto-edit Metro config (too many variants) — print instructions
- [ ] Auto-enable expo extension if Expo project detected (via `autoEnableExtensions`)
- [ ] Ensure Expo detection runs BEFORE `isNextJs` / `isPython` / `isReactSPA` so it doesn't fall through to React SPA (both may have `vite.config`)

#### Phase 3 OTel
- [ ] Verify scaffolded instrumentation uses correct packages (no `sdk-node` imports in RN projects)

#### Phase 3 Verification
- [ ] `indusk init` in a fresh Expo project detects it as Expo
- [ ] Scaffolds `instrumentation.ts` using RN template (check for `sdk-trace-base`, no `sdk-node`)
- [ ] Prints correct install command with RN-compatible packages
- [ ] Does NOT scaffold `logger.ts` or `filtering-exporter.ts` (Node.js only)
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` succeeds
- [ ] `pnpm check` passes

#### Phase 3 Context
- [ ] Update CLAUDE.md Conventions: `init` scaffolds OTel for Expo/React Native using standard packages (no Embrace)
- [ ] Update CLAUDE.md Known Gotchas: Expo projects need `unstable_enablePackageExports` in Metro config for OTel

#### Phase 3 Document
- [ ] Update Getting Started guide with React Native/Expo as supported project type

## Phase 4: Validation

### Implementation
- [ ] Create a fresh Expo project: `npx create-expo-app test-rn-otel`
- [ ] Run `indusk init` in it
- [ ] Verify:
  - Expo detected correctly
  - `instrumentation.ts` scaffolded with RN template
  - Extensions auto-enabled (expo at minimum)
  - Health checks pass after following printed setup instructions
  - Traces reach Dash0 from the running app (if possible — may need dev client build)
- [ ] Clean up test project after validation

#### Phase 4 OTel
- [ ] Traces from the test app appear in Dash0 (or document what's needed to make them appear)

#### Phase 4 Verification
- [ ] Full `indusk init` → scaffold → build → traces flow works on Expo project
- [ ] `indusk extensions status` shows expo enabled with passing health checks
- [ ] No Node.js OTel packages scaffolded

#### Phase 4 Context
- [ ] Update CLAUDE.md Current State: React Native/Expo supported

#### Phase 4 Document
- [ ] Capture any gotchas discovered during validation in the Expo extension skill

## Files Affected
| File | Change |
|------|--------|
| `extensions/expo/manifest.json` | New — Expo extension manifest |
| `extensions/expo/skill.md` | New — Expo patterns and OTel setup |
| `extensions/storybook/manifest.json` | New — Storybook extension manifest |
| `extensions/storybook/skill.md` | New — Storybook RN patterns |
| `extensions/framer/manifest.json` | New — Framer MCP extension manifest |
| `extensions/framer/skill.md` | New — Framer MCP patterns |
| `templates/instrumentation.rn.ts` | New — React Native OTel template |
| `src/bin/commands/init.ts` | Update — add Expo detection and scaffolding |

## Dependencies
- Existing extension system
- Existing `init` scaffolding pipeline
- OTel packages: `@opentelemetry/api`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, `@opentelemetry/semantic-conventions`
- `fast-text-encoding` polyfill

## Notes
- Metro `unstable_enablePackageExports` is required but "unstable" — monitor for changes
- TextEncoder polyfill may become unnecessary as OTel JS fixes land — test without it periodically
- Phase 4 validation ideally sends real traces to Dash0, but may require EAS Build (not Expo Go) for native module support — document if so
